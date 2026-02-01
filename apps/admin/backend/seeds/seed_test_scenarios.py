"""Seed script to populate initial test scenarios with step-by-step descriptions."""

import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.config import get_settings
from app.models.test_scenario import TestScenario


# Test scenario definitions with plain-English step descriptions
TEST_SCENARIOS_DATA = [
    # Define App
    {
        "scenario_key": "define.login",
        "name": "User Login Flow",
        "description": "Verify user can log in via Identity service and access Define dashboard",
        "app_name": "Define",
        "category": "smoke",
        "test_file": "apps/define/frontend/e2e/login.spec.ts",
        "steps": [
            {"step_number": 1, "description": "Navigate to Define app homepage", "expected_outcome": "Login page or dashboard is displayed"},
            {"step_number": 2, "description": "Click 'Sign In' if not authenticated", "expected_outcome": "Redirect to Identity service"},
            {"step_number": 3, "description": "Enter valid email and password", "expected_outcome": "Credentials accepted"},
            {"step_number": 4, "description": "Complete login authentication", "expected_outcome": "Redirect back to Define app"},
            {"step_number": 5, "description": "Verify dashboard loads with user data", "expected_outcome": "Products list or welcome message displayed"},
        ],
    },
    {
        "scenario_key": "define.product-crud",
        "name": "Product CRUD Operations",
        "description": "Create, read, update, and delete products with requirements",
        "app_name": "Define",
        "category": "integration",
        "test_file": "apps/define/backend/tests/test_products.py",
        "steps": [
            {"step_number": 1, "description": "Create a new product via API", "expected_outcome": "Product created with unique ID"},
            {"step_number": 2, "description": "Fetch the created product", "expected_outcome": "Product data matches input"},
            {"step_number": 3, "description": "Add requirements to the product", "expected_outcome": "Requirements attached to product"},
            {"step_number": 4, "description": "Update product name and description", "expected_outcome": "Product reflects changes"},
            {"step_number": 5, "description": "Delete the product", "expected_outcome": "Product no longer retrievable"},
        ],
    },
    {
        "scenario_key": "define.ai-import",
        "name": "AI Requirements Import",
        "description": "Import requirements from text, PDF, or images using AI",
        "app_name": "Define",
        "category": "e2e",
        "steps": [
            {"step_number": 1, "description": "Navigate to import page", "expected_outcome": "Import options displayed"},
            {"step_number": 2, "description": "Upload a document containing requirements", "expected_outcome": "Document accepted for processing"},
            {"step_number": 3, "description": "AI extracts requirements from document", "expected_outcome": "Parsed requirements displayed for review"},
            {"step_number": 4, "description": "User reviews and confirms requirements", "expected_outcome": "Requirements shown with edit options"},
            {"step_number": 5, "description": "Requirements saved to product", "expected_outcome": "Requirements appear in product detail"},
        ],
    },

    # Develop App
    {
        "scenario_key": "develop.walkthrough-create",
        "name": "Create Visual Walkthrough",
        "description": "Create a new walkthrough project with screenshots and annotations",
        "app_name": "Develop",
        "category": "e2e",
        "test_file": "apps/develop/frontend/e2e/product-dropdown.spec.ts",
        "steps": [
            {"step_number": 1, "description": "Log in and navigate to Develop dashboard", "expected_outcome": "Dashboard with project list displayed"},
            {"step_number": 2, "description": "Click 'New Walkthrough' button", "expected_outcome": "Creation wizard opens"},
            {"step_number": 3, "description": "Enter walkthrough name and target URL", "expected_outcome": "Form accepts input"},
            {"step_number": 4, "description": "Start recording user actions", "expected_outcome": "Recording indicator visible"},
            {"step_number": 5, "description": "Perform actions on target page", "expected_outcome": "Screenshots captured for each action"},
            {"step_number": 6, "description": "Stop recording and save", "expected_outcome": "Walkthrough saved with steps"},
        ],
    },
    {
        "scenario_key": "develop.job-queue",
        "name": "Job Queue Processing",
        "description": "Verify background jobs are queued and processed correctly",
        "app_name": "Develop",
        "category": "integration",
        "test_file": "apps/develop/backend/tests/test_api.py",
        "steps": [
            {"step_number": 1, "description": "Submit a new job to the queue", "expected_outcome": "Job ID returned"},
            {"step_number": 2, "description": "Query job status", "expected_outcome": "Status is 'pending' or 'processing'"},
            {"step_number": 3, "description": "Worker picks up the job", "expected_outcome": "Status changes to 'processing'"},
            {"step_number": 4, "description": "Job completes successfully", "expected_outcome": "Status is 'completed' with results"},
            {"step_number": 5, "description": "Verify job output is correct", "expected_outcome": "Output matches expected format"},
        ],
    },

    # Manage App
    {
        "scenario_key": "manage.playbooks",
        "name": "Playbook Execution",
        "description": "Create and execute playbooks with task assignments",
        "app_name": "Manage",
        "category": "e2e",
        "test_file": "apps/manage/frontend/e2e/playbooks.spec.ts",
        "steps": [
            {"step_number": 1, "description": "Navigate to Playbooks section", "expected_outcome": "Playbook list displayed"},
            {"step_number": 2, "description": "Create a new playbook with steps", "expected_outcome": "Playbook saved with defined steps"},
            {"step_number": 3, "description": "Execute the playbook", "expected_outcome": "Tasks created from playbook steps"},
            {"step_number": 4, "description": "Assign tasks to team members", "expected_outcome": "Assignments visible in queue"},
            {"step_number": 5, "description": "Complete tasks in sequence", "expected_outcome": "Playbook progress updates"},
            {"step_number": 6, "description": "Verify playbook completion", "expected_outcome": "All steps marked complete"},
        ],
    },
    {
        "scenario_key": "manage.bot-workflow",
        "name": "Bot Task Workflow",
        "description": "Verify bots can process and complete assigned tasks",
        "app_name": "Manage",
        "category": "integration",
        "test_file": "apps/manage/backend/tests/test_scenario_bot_workflow.py",
        "steps": [
            {"step_number": 1, "description": "Bot polls for available tasks in the queue", "expected_outcome": "API returns list of pending tasks"},
            {"step_number": 2, "description": "Bot claims the next available task atomically", "expected_outcome": "Task assigned to bot, status is 'in_progress'"},
            {"step_number": 3, "description": "Bot starts working on the claimed task", "expected_outcome": "Task has 'started_at' timestamp"},
            {"step_number": 4, "description": "Bot posts progress updates (50%, 90%)", "expected_outcome": "Progress visible in task details"},
            {"step_number": 5, "description": "Bot completes task with output data", "expected_outcome": "Task status is 'completed' with output"},
        ],
    },
    {
        "scenario_key": "manage.queue-priority",
        "name": "Queue Priority Ordering",
        "description": "Tasks are processed in correct priority order",
        "app_name": "Manage",
        "category": "integration",
        "steps": [
            {"step_number": 1, "description": "Create tasks with different priorities", "expected_outcome": "Tasks created with high, medium, low priority"},
            {"step_number": 2, "description": "Query the queue for next task", "expected_outcome": "Highest priority task returned first"},
            {"step_number": 3, "description": "Complete high priority task", "expected_outcome": "Task marked complete"},
            {"step_number": 4, "description": "Query queue again", "expected_outcome": "Next highest priority task returned"},
            {"step_number": 5, "description": "Verify FIFO within same priority", "expected_outcome": "Older tasks processed first"},
        ],
    },

    # Today App
    {
        "scenario_key": "today.dashboard",
        "name": "Dashboard Load",
        "description": "Dashboard displays tasks, stats, and recent activity",
        "app_name": "Today",
        "category": "smoke",
        "test_file": "apps/today/frontend/e2e/dashboard.spec.ts",
        "steps": [
            {"step_number": 1, "description": "Navigate to Today app", "expected_outcome": "Dashboard page loads"},
            {"step_number": 2, "description": "Verify task summary widget loads", "expected_outcome": "Shows task counts by status"},
            {"step_number": 3, "description": "Verify recent activity feed loads", "expected_outcome": "Shows recent task updates"},
            {"step_number": 4, "description": "Verify quick actions are available", "expected_outcome": "Add task button visible"},
        ],
    },
    {
        "scenario_key": "today.task-crud",
        "name": "Task CRUD Operations",
        "description": "Create, complete, and manage daily tasks",
        "app_name": "Today",
        "category": "e2e",
        "test_file": "apps/today/frontend/e2e/tasks.spec.ts",
        "steps": [
            {"step_number": 1, "description": "Click 'Add Task' button", "expected_outcome": "Task creation form appears"},
            {"step_number": 2, "description": "Enter task title and details", "expected_outcome": "Form accepts input"},
            {"step_number": 3, "description": "Save the task", "expected_outcome": "Task appears in task list"},
            {"step_number": 4, "description": "Mark task as complete", "expected_outcome": "Task shows completed status"},
            {"step_number": 5, "description": "Delete the task", "expected_outcome": "Task removed from list"},
        ],
    },
    {
        "scenario_key": "today.production-e2e",
        "name": "Production E2E Tests",
        "description": "End-to-end tests against production environment",
        "app_name": "Today",
        "category": "e2e",
        "test_file": "apps/today/frontend/e2e/production-e2e.spec.ts",
        "steps": [
            {"step_number": 1, "description": "Load production URL", "expected_outcome": "Site responds with 200 OK"},
            {"step_number": 2, "description": "Authenticate with test credentials", "expected_outcome": "Login successful"},
            {"step_number": 3, "description": "Verify core features work", "expected_outcome": "Tasks load, UI responds"},
            {"step_number": 4, "description": "Test critical user flows", "expected_outcome": "All flows complete successfully"},
        ],
    },

    # Identity App
    {
        "scenario_key": "identity.auth",
        "name": "Authentication Flow",
        "description": "User registration, login, and session management",
        "app_name": "Identity",
        "category": "smoke",
        "steps": [
            {"step_number": 1, "description": "Navigate to login page", "expected_outcome": "Login form displayed"},
            {"step_number": 2, "description": "Enter valid credentials", "expected_outcome": "Form accepts input"},
            {"step_number": 3, "description": "Submit login form", "expected_outcome": "Authentication cookie set"},
            {"step_number": 4, "description": "Verify session is active", "expected_outcome": "User info endpoint returns data"},
            {"step_number": 5, "description": "Logout and verify session cleared", "expected_outcome": "Cookie removed, redirect to login"},
        ],
    },
    {
        "scenario_key": "identity.org-switch",
        "name": "Organization Switching",
        "description": "Users can switch between organizations they belong to",
        "app_name": "Identity",
        "category": "integration",
        "steps": [
            {"step_number": 1, "description": "Login as user with multiple orgs", "expected_outcome": "Session established"},
            {"step_number": 2, "description": "List available organizations", "expected_outcome": "Multiple orgs displayed"},
            {"step_number": 3, "description": "Select a different organization", "expected_outcome": "Context switches to new org"},
            {"step_number": 4, "description": "Verify data shows new org context", "expected_outcome": "Org-specific data loads"},
        ],
    },

    # Salon App
    {
        "scenario_key": "salon.comprehensive",
        "name": "Comprehensive Salon Tests",
        "description": "Full suite of salon management operations",
        "app_name": "Salon",
        "category": "e2e",
        "test_file": "apps/salon/frontend/e2e/comprehensive.spec.ts",
        "steps": [
            {"step_number": 1, "description": "Login to Salon app", "expected_outcome": "Dashboard displayed"},
            {"step_number": 2, "description": "View appointment calendar", "expected_outcome": "Calendar with bookings loads"},
            {"step_number": 3, "description": "Create a new appointment", "expected_outcome": "Appointment saved"},
            {"step_number": 4, "description": "View client list", "expected_outcome": "Client records displayed"},
            {"step_number": 5, "description": "Generate daily report", "expected_outcome": "Report with stats shown"},
        ],
    },
    {
        "scenario_key": "salon.booking",
        "name": "Appointment Booking",
        "description": "Book, modify, and cancel salon appointments",
        "app_name": "Salon",
        "category": "integration",
        "steps": [
            {"step_number": 1, "description": "Select date and time slot", "expected_outcome": "Availability shown"},
            {"step_number": 2, "description": "Choose service and stylist", "expected_outcome": "Options selectable"},
            {"step_number": 3, "description": "Enter client information", "expected_outcome": "Form accepts data"},
            {"step_number": 4, "description": "Confirm booking", "expected_outcome": "Appointment created, confirmation shown"},
            {"step_number": 5, "description": "Modify appointment time", "expected_outcome": "Time updated successfully"},
            {"step_number": 6, "description": "Cancel appointment", "expected_outcome": "Appointment cancelled, slot freed"},
        ],
    },

    # VibeTest App
    {
        "scenario_key": "vibetest.smoke",
        "name": "VibeTest Smoke Tests",
        "description": "Basic smoke tests for the testing platform",
        "app_name": "VibeTest",
        "category": "smoke",
        "test_file": "apps/vibetest/e2e/tests/test_smoke.py",
        "steps": [
            {"step_number": 1, "description": "Load VibeTest homepage", "expected_outcome": "Page loads without errors"},
            {"step_number": 2, "description": "Verify navigation elements", "expected_outcome": "Menu items visible"},
            {"step_number": 3, "description": "Check API health endpoint", "expected_outcome": "Returns healthy status"},
            {"step_number": 4, "description": "Verify authentication works", "expected_outcome": "Login flow functions"},
        ],
    },

    # Vibecode App
    {
        "scenario_key": "vibecode.session",
        "name": "Coding Session Workflow",
        "description": "Create and run an interactive coding session",
        "app_name": "Vibecode",
        "category": "e2e",
        "steps": [
            {"step_number": 1, "description": "Start a new coding session", "expected_outcome": "Session initialized"},
            {"step_number": 2, "description": "Enter code in the editor", "expected_outcome": "Code accepted"},
            {"step_number": 3, "description": "Run the code", "expected_outcome": "Output displayed"},
            {"step_number": 4, "description": "Use AI assistant for help", "expected_outcome": "AI provides suggestions"},
            {"step_number": 5, "description": "Save session state", "expected_outcome": "Session persisted"},
        ],
    },

    # Cross-App Tests
    {
        "scenario_key": "cross-app.theme",
        "name": "Theme Synchronization",
        "description": "Themes update correctly across all applications",
        "app_name": "All Apps",
        "category": "integration",
        "steps": [
            {"step_number": 1, "description": "Set a theme in Admin app", "expected_outcome": "Theme saved to database"},
            {"step_number": 2, "description": "Verify Define app picks up theme", "expected_outcome": "Define uses new colors"},
            {"step_number": 3, "description": "Verify Manage app picks up theme", "expected_outcome": "Manage uses new colors"},
            {"step_number": 4, "description": "Verify Today app picks up theme", "expected_outcome": "Today uses new colors"},
            {"step_number": 5, "description": "Switch theme and verify propagation", "expected_outcome": "All apps update"},
        ],
    },
    {
        "scenario_key": "cross-app.auth",
        "name": "Cross-App Authentication",
        "description": "Single sign-on works across all Expertly applications",
        "app_name": "All Apps",
        "category": "e2e",
        "steps": [
            {"step_number": 1, "description": "Login via Identity service", "expected_outcome": "Session cookie set"},
            {"step_number": 2, "description": "Navigate to Define app", "expected_outcome": "Already authenticated"},
            {"step_number": 3, "description": "Navigate to Manage app", "expected_outcome": "Already authenticated"},
            {"step_number": 4, "description": "Navigate to Today app", "expected_outcome": "Already authenticated"},
            {"step_number": 5, "description": "Logout from one app", "expected_outcome": "Logged out everywhere"},
        ],
    },

    # Admin App
    {
        "scenario_key": "admin.theme-management",
        "name": "Theme Management",
        "description": "Create, edit, and manage application themes",
        "app_name": "Admin",
        "category": "e2e",
        "steps": [
            {"step_number": 1, "description": "Navigate to Themes page", "expected_outcome": "Theme list displayed"},
            {"step_number": 2, "description": "Create a new theme", "expected_outcome": "Theme form shown"},
            {"step_number": 3, "description": "Set color values", "expected_outcome": "Color picker works"},
            {"step_number": 4, "description": "Save and preview theme", "expected_outcome": "Preview updates in real-time"},
            {"step_number": 5, "description": "Set theme as default", "expected_outcome": "Theme marked as default"},
        ],
    },
    {
        "scenario_key": "admin.error-logs",
        "name": "Error Log Viewing",
        "description": "View and manage error logs from all applications",
        "app_name": "Admin",
        "category": "smoke",
        "steps": [
            {"step_number": 1, "description": "Navigate to Error Logs page", "expected_outcome": "Error list loads"},
            {"step_number": 2, "description": "Filter by application", "expected_outcome": "List updates with filter"},
            {"step_number": 3, "description": "View error details", "expected_outcome": "Stack trace and context shown"},
            {"step_number": 4, "description": "Mark error as acknowledged", "expected_outcome": "Status updates"},
        ],
    },
    {
        "scenario_key": "admin.monitoring",
        "name": "Service Monitoring",
        "description": "Monitor health of all Expertly services",
        "app_name": "Admin",
        "category": "smoke",
        "steps": [
            {"step_number": 1, "description": "Navigate to Monitor page", "expected_outcome": "Service status grid displayed"},
            {"step_number": 2, "description": "Verify all services show status", "expected_outcome": "Each service has health indicator"},
            {"step_number": 3, "description": "Click refresh to update status", "expected_outcome": "Status values update"},
            {"step_number": 4, "description": "View service history", "expected_outcome": "Historical uptime shown"},
        ],
    },
]


async def seed_test_scenarios(db: AsyncSession):
    """Seed the initial test scenarios."""
    now = datetime.now(timezone.utc)

    print("Creating test scenarios...")
    for scenario_data in TEST_SCENARIOS_DATA:
        scenario = TestScenario(
            id=uuid.uuid4(),
            scenario_key=scenario_data["scenario_key"],
            name=scenario_data["name"],
            description=scenario_data["description"],
            app_name=scenario_data["app_name"],
            category=scenario_data["category"],
            test_file=scenario_data.get("test_file"),
            steps=scenario_data.get("steps"),
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(scenario)
        print(f"  Created: [{scenario_data['app_name']}] {scenario_data['name']}")

    await db.commit()
    print(f"\nTest scenario seed completed! Created {len(TEST_SCENARIOS_DATA)} scenarios.")


async def main():
    """Main entry point."""
    settings = get_settings()

    engine = create_async_engine(settings.database_url, echo=True)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        await seed_test_scenarios(session)


if __name__ == "__main__":
    asyncio.run(main())
