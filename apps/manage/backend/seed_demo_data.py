"""Seed script to create demo data for Acme Corporation in Manage."""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from bson import ObjectId

from app.database import get_database, connect_database
from app.models import Organization, OrganizationSettings, User, UserType, UserRole, Queue, Team
from app.models.queue import ScopeType
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskStatus, RecurringTask, RecurrenceType
from app.models.playbook import Playbook, PlaybookStep, ScopeType as PlaybookScopeType, ItemType, AssigneeType
from app.utils.auth import hash_api_key

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Demo org slug (must match Identity)
DEMO_ORG_SLUG = "acme-demo"
DEMO_ORG_NAME = "Acme Corporation"


async def seed_demo_data():
    """Create comprehensive demo data for Acme Corporation."""
    await connect_database()
    db = get_database()

    # Check if demo org already exists
    existing_org = await db.organizations.find_one({"slug": DEMO_ORG_SLUG})
    if existing_org:
        logger.info(f"Demo org already exists. Updating data...")
        org_id = existing_org["_id"]
    else:
        # Create demo organization
        org_id = ObjectId()
        org = Organization(
            id=org_id,
            name=DEMO_ORG_NAME,
            slug=DEMO_ORG_SLUG,
            settings=OrganizationSettings(
                allow_virtual_users=True,
                default_task_priority=5,
                task_checkout_timeout_minutes=30,
            ),
            is_default=False
        )
        await db.organizations.insert_one(org.model_dump_mongo())
        logger.info(f"Created organization: {DEMO_ORG_NAME}")

    # Create users (mapped from Identity seed)
    users_data = [
        # Leadership
        {"name": "Sarah Chen", "email": "sarah.chen@acme.demo", "role": UserRole.OWNER, "user_type": UserType.HUMAN},
        {"name": "Marcus Johnson", "email": "marcus.johnson@acme.demo", "role": UserRole.ADMIN, "user_type": UserType.HUMAN},
        {"name": "Emily Rodriguez", "email": "emily.rodriguez@acme.demo", "role": UserRole.ADMIN, "user_type": UserType.HUMAN},
        # Engineering
        {"name": "Alex Kim", "email": "alex.kim@acme.demo", "role": UserRole.MEMBER, "user_type": UserType.HUMAN},
        {"name": "Jordan Lee", "email": "jordan.lee@acme.demo", "role": UserRole.MEMBER, "user_type": UserType.HUMAN},
        {"name": "Taylor Swift", "email": "taylor.swift@acme.demo", "role": UserRole.MEMBER, "user_type": UserType.HUMAN},
        {"name": "Casey Morgan", "email": "casey.morgan@acme.demo", "role": UserRole.MEMBER, "user_type": UserType.HUMAN},
        # Sales
        {"name": "Ryan O'Connor", "email": "ryan.oconnor@acme.demo", "role": UserRole.MEMBER, "user_type": UserType.HUMAN},
        {"name": "Priya Patel", "email": "priya.patel@acme.demo", "role": UserRole.MEMBER, "user_type": UserType.HUMAN},
        {"name": "Derek Williams", "email": "derek.williams@acme.demo", "role": UserRole.MEMBER, "user_type": UserType.HUMAN},
        # Support
        {"name": "Michelle Torres", "email": "michelle.torres@acme.demo", "role": UserRole.MEMBER, "user_type": UserType.HUMAN},
        {"name": "Chris Anderson", "email": "chris.anderson@acme.demo", "role": UserRole.MEMBER, "user_type": UserType.HUMAN},
        # Bots
        {"name": "Acme Assistant", "email": None, "role": UserRole.MEMBER, "user_type": UserType.VIRTUAL},
        {"name": "Deploy Bot", "email": None, "role": UserRole.MEMBER, "user_type": UserType.VIRTUAL},
        {"name": "Monitor Bot", "email": None, "role": UserRole.MEMBER, "user_type": UserType.VIRTUAL},
        {"name": "Sales Bot", "email": None, "role": UserRole.MEMBER, "user_type": UserType.VIRTUAL},
        # David (for testing)
        {"name": "David", "email": "david@example.com", "role": UserRole.OWNER, "user_type": UserType.HUMAN},
    ]

    user_map = {}  # name -> user_id
    for u in users_data:
        existing = await db.users.find_one({"organization_id": org_id, "name": u["name"]})
        if existing:
            user_map[u["name"]] = existing["_id"]
        else:
            user_id = ObjectId()
            user = User(
                id=user_id,
                organization_id=org_id,
                email=u["email"],
                name=u["name"],
                user_type=u["user_type"],
                role=u["role"],
                is_default=False,
            )
            await db.users.insert_one(user.model_dump_mongo())
            user_map[u["name"]] = user_id
            logger.info(f"  Created user: {u['name']}")

    # Create teams
    teams_data = [
        {"name": "Engineering", "description": "Product development and technical infrastructure",
         "members": ["Marcus Johnson", "Alex Kim", "Jordan Lee", "Taylor Swift", "Casey Morgan", "Deploy Bot", "Monitor Bot"],
         "lead": "Marcus Johnson"},
        {"name": "Sales", "description": "Revenue generation and customer acquisition",
         "members": ["Ryan O'Connor", "Priya Patel", "Derek Williams", "Sales Bot"],
         "lead": "Ryan O'Connor"},
        {"name": "Customer Success", "description": "Customer support and satisfaction",
         "members": ["Michelle Torres", "Chris Anderson", "Acme Assistant"],
         "lead": "Michelle Torres"},
        {"name": "Leadership", "description": "Executive team and strategic planning",
         "members": ["Sarah Chen", "Marcus Johnson", "Emily Rodriguez", "Ryan O'Connor"],
         "lead": "Sarah Chen"},
    ]

    team_map = {}  # name -> team_id
    for t in teams_data:
        existing = await db.teams.find_one({"organization_id": org_id, "name": t["name"]})
        if existing:
            team_map[t["name"]] = existing["_id"]
        else:
            team_id = ObjectId()
            team = Team(
                id=team_id,
                organization_id=org_id,
                name=t["name"],
                description=t["description"],
                member_ids=[user_map[m] for m in t["members"] if m in user_map],
                lead_id=user_map.get(t["lead"]),
            )
            await db.teams.insert_one(team.model_dump_mongo())
            team_map[t["name"]] = team_id
            logger.info(f"  Created team: {t['name']}")

    # Create queues
    queues_data = [
        # Organization-wide queues
        {"purpose": "Triage", "description": "New items awaiting assignment", "scope_type": ScopeType.ORGANIZATION, "scope_id": None},
        {"purpose": "Urgent", "description": "High priority items needing immediate attention", "scope_type": ScopeType.ORGANIZATION, "scope_id": None},
        # Team queues
        {"purpose": "Engineering Backlog", "description": "Technical tasks and bugs", "scope_type": ScopeType.TEAM, "scope_id": team_map.get("Engineering")},
        {"purpose": "Sales Pipeline", "description": "Sales opportunities and follow-ups", "scope_type": ScopeType.TEAM, "scope_id": team_map.get("Sales")},
        {"purpose": "Support Tickets", "description": "Customer support requests", "scope_type": ScopeType.TEAM, "scope_id": team_map.get("Customer Success")},
        # User queues (for David)
        {"purpose": "Inbox", "description": "Personal inbox", "scope_type": ScopeType.USER, "scope_id": user_map.get("David"), "is_system": True, "system_type": "inbox"},
        {"purpose": "Approvals", "description": "Items awaiting your approval", "scope_type": ScopeType.USER, "scope_id": user_map.get("David"), "is_system": True, "system_type": "approvals"},
    ]

    queue_map = {}  # purpose -> queue_id
    for q in queues_data:
        existing = await db.queues.find_one({"organization_id": org_id, "purpose": q["purpose"]})
        if existing:
            queue_map[q["purpose"]] = existing["_id"]
        else:
            queue_id = ObjectId()
            queue = Queue(
                id=queue_id,
                organization_id=org_id,
                purpose=q["purpose"],
                description=q["description"],
                scope_type=q["scope_type"],
                scope_id=q["scope_id"],
                is_system=q.get("is_system", False),
                system_type=q.get("system_type"),
            )
            await db.queues.insert_one(queue.model_dump_mongo())
            queue_map[q["purpose"]] = queue_id
            logger.info(f"  Created queue: {q['purpose']}")

    # Create projects
    projects_data = [
        {"name": "Q1 Product Launch", "description": "Launch new product features for Q1", "status": ProjectStatus.ACTIVE,
         "owner": "Sarah Chen", "team": "Leadership", "children": [
            {"name": "Marketing Campaign", "description": "Launch marketing materials", "status": ProjectStatus.ACTIVE, "owner": "Emily Rodriguez"},
            {"name": "Technical Implementation", "description": "Build and deploy features", "status": ProjectStatus.ACTIVE, "owner": "Marcus Johnson", "team": "Engineering"},
            {"name": "Sales Enablement", "description": "Prepare sales team for launch", "status": ProjectStatus.ACTIVE, "owner": "Ryan O'Connor", "team": "Sales"},
        ]},
        {"name": "Infrastructure Upgrade", "description": "Upgrade cloud infrastructure and improve performance", "status": ProjectStatus.ACTIVE,
         "owner": "Marcus Johnson", "team": "Engineering", "children": [
            {"name": "Database Migration", "description": "Migrate to new database cluster", "status": ProjectStatus.COMPLETED, "owner": "Alex Kim"},
            {"name": "CDN Setup", "description": "Configure global CDN", "status": ProjectStatus.ACTIVE, "owner": "Taylor Swift"},
            {"name": "Monitoring Dashboard", "description": "Build real-time monitoring", "status": ProjectStatus.ACTIVE, "owner": "Jordan Lee"},
        ]},
        {"name": "Customer Onboarding Improvement", "description": "Streamline customer onboarding process", "status": ProjectStatus.ACTIVE,
         "owner": "Michelle Torres", "team": "Customer Success"},
        {"name": "Sales Process Automation", "description": "Automate repetitive sales tasks", "status": ProjectStatus.ON_HOLD,
         "owner": "Ryan O'Connor", "team": "Sales"},
    ]

    project_map = {}  # name -> project_id

    async def create_project(p, parent_id=None):
        existing = await db.projects.find_one({"organization_id": org_id, "name": p["name"]})
        if existing:
            project_map[p["name"]] = existing["_id"]
            proj_id = existing["_id"]
        else:
            proj_id = ObjectId()
            project = Project(
                id=proj_id,
                organization_id=org_id,
                name=p["name"],
                description=p["description"],
                status=p["status"],
                owner_user_id=user_map.get(p.get("owner")),
                team_id=team_map.get(p.get("team")),
                parent_project_id=parent_id,
            )
            await db.projects.insert_one(project.model_dump_mongo())
            project_map[p["name"]] = proj_id
            logger.info(f"  Created project: {p['name']}")

        # Create children
        for child in p.get("children", []):
            await create_project(child, proj_id)

    for p in projects_data:
        await create_project(p)

    # Create playbooks
    playbooks_data = [
        {
            "name": "New Employee Onboarding",
            "description": "Complete onboarding checklist for new team members",
            "scope_type": PlaybookScopeType.ORGANIZATION,
            "steps": [
                {"title": "Set up workstation", "description": "Configure laptop, install required software"},
                {"title": "Create accounts", "description": "Set up email, Slack, GitHub, and other tool accounts"},
                {"title": "Security training", "description": "Complete mandatory security awareness training"},
                {"title": "Team introductions", "description": "Schedule 1:1s with team members"},
                {"title": "Review documentation", "description": "Read through team wiki and processes"},
            ]
        },
        {
            "name": "Bug Triage Process",
            "description": "Standard process for triaging incoming bug reports",
            "scope_type": PlaybookScopeType.TEAM,
            "scope_id": team_map.get("Engineering"),
            "steps": [
                {"title": "Verify reproduction", "description": "Confirm the bug can be reproduced"},
                {"title": "Assess severity", "description": "Determine impact and urgency (P1-P4)"},
                {"title": "Assign to engineer", "description": "Route to appropriate team member"},
                {"title": "Update ticket", "description": "Add labels, milestone, and initial assessment"},
            ]
        },
        {
            "name": "Sales Demo Preparation",
            "description": "Checklist for preparing customer demos",
            "scope_type": PlaybookScopeType.TEAM,
            "scope_id": team_map.get("Sales"),
            "steps": [
                {"title": "Research customer", "description": "Review company profile, recent news, competitors"},
                {"title": "Customize demo environment", "description": "Set up demo with customer-relevant data"},
                {"title": "Prepare talking points", "description": "Create agenda and key value propositions"},
                {"title": "Test technology", "description": "Verify screen share, audio, and demo environment"},
                {"title": "Send calendar invite", "description": "Include dial-in info and agenda"},
            ]
        },
        {
            "name": "Customer Escalation Handling",
            "description": "Process for handling escalated customer issues",
            "scope_type": PlaybookScopeType.TEAM,
            "scope_id": team_map.get("Customer Success"),
            "steps": [
                {"title": "Acknowledge receipt", "description": "Respond within 1 hour acknowledging the issue"},
                {"title": "Gather context", "description": "Review ticket history and customer details"},
                {"title": "Loop in stakeholders", "description": "Notify account owner and relevant teams"},
                {"title": "Create action plan", "description": "Document resolution steps and timeline"},
                {"title": "Execute and follow up", "description": "Implement fix and confirm resolution"},
            ]
        },
        {
            "name": "Weekly Status Report",
            "description": "Template for weekly team status updates",
            "scope_type": PlaybookScopeType.ORGANIZATION,
            "steps": [
                {"title": "Accomplishments", "description": "List key achievements from the past week"},
                {"title": "In Progress", "description": "Current work and expected completion"},
                {"title": "Blockers", "description": "Issues needing attention or escalation"},
                {"title": "Next Week", "description": "Planned priorities for the coming week"},
            ]
        },
        {
            "name": "Deployment Checklist",
            "description": "Pre and post deployment verification steps",
            "scope_type": PlaybookScopeType.TEAM,
            "scope_id": team_map.get("Engineering"),
            "steps": [
                {"title": "Run test suite", "description": "Ensure all tests pass"},
                {"title": "Review changes", "description": "Code review and approval"},
                {"title": "Backup database", "description": "Create backup before deployment"},
                {"title": "Deploy to staging", "description": "Verify in staging environment"},
                {"title": "Deploy to production", "description": "Execute production deployment"},
                {"title": "Smoke test", "description": "Verify critical paths work"},
                {"title": "Monitor metrics", "description": "Watch error rates and performance"},
            ]
        },
    ]

    playbook_map = {}  # name -> playbook_id
    for pb in playbooks_data:
        existing = await db.playbooks.find_one({"organization_id": org_id, "name": pb["name"]})
        if existing:
            playbook_map[pb["name"]] = existing["_id"]
        else:
            pb_id = str(uuid.uuid4())
            steps = [
                PlaybookStep(
                    id=str(uuid.uuid4()),
                    order=i,
                    title=s["title"],
                    description=s["description"],
                    assignee_type=AssigneeType.ANYONE,
                )
                for i, s in enumerate(pb["steps"])
            ]
            playbook = Playbook(
                id=pb_id,
                organization_id=str(org_id),
                name=pb["name"],
                description=pb["description"],
                item_type=ItemType.PLAYBOOK,
                scope_type=pb["scope_type"],
                scope_id=str(pb.get("scope_id")) if pb.get("scope_id") else None,
                steps=steps,
                order_index=len(playbook_map),
            )
            await db.playbooks.insert_one(playbook.model_dump(by_alias=True))
            playbook_map[pb["name"]] = pb_id
            logger.info(f"  Created playbook: {pb['name']} ({len(steps)} steps)")

    # Create tasks
    now = datetime.utcnow()
    tasks_data = [
        # Queued tasks
        {"title": "Review Q1 budget proposal", "description": "Review and approve the Q1 budget allocation", "status": TaskStatus.QUEUED,
         "queue": "Inbox", "priority": 8, "assigned_to": "David"},
        {"title": "Update API documentation", "description": "Document the new v2 API endpoints", "status": TaskStatus.QUEUED,
         "queue": "Engineering Backlog", "priority": 5, "assigned_to": "Jordan Lee", "project": "Infrastructure Upgrade"},
        {"title": "Fix login timeout bug", "description": "Users reporting session timeouts after 5 minutes", "status": TaskStatus.QUEUED,
         "queue": "Engineering Backlog", "priority": 9, "assigned_to": "Alex Kim"},

        # In progress tasks
        {"title": "Prepare investor deck", "description": "Update slides for next week's investor meeting", "status": TaskStatus.IN_PROGRESS,
         "queue": "Inbox", "priority": 9, "assigned_to": "Sarah Chen", "project": "Q1 Product Launch"},
        {"title": "Configure CDN regions", "description": "Set up edge locations in APAC", "status": TaskStatus.IN_PROGRESS,
         "queue": "Engineering Backlog", "priority": 7, "assigned_to": "Taylor Swift", "project": "CDN Setup"},
        {"title": "Follow up with Acme Corp lead", "description": "Schedule demo for enterprise deal", "status": TaskStatus.IN_PROGRESS,
         "queue": "Sales Pipeline", "priority": 8, "assigned_to": "Priya Patel"},

        # Completed tasks
        {"title": "Migrate user database", "description": "Move user data to new PostgreSQL cluster", "status": TaskStatus.COMPLETED,
         "queue": "Engineering Backlog", "priority": 10, "assigned_to": "Alex Kim", "project": "Database Migration"},
        {"title": "Onboard new sales rep", "description": "Complete Derek's onboarding", "status": TaskStatus.COMPLETED,
         "queue": "Inbox", "priority": 6, "assigned_to": "Ryan O'Connor"},
        {"title": "Resolve support ticket #1234", "description": "Customer couldn't access dashboard", "status": TaskStatus.COMPLETED,
         "queue": "Support Tickets", "priority": 7, "assigned_to": "Chris Anderson"},

        # Support tickets
        {"title": "Customer: Can't export reports", "description": "Enterprise customer unable to export PDF reports", "status": TaskStatus.QUEUED,
         "queue": "Support Tickets", "priority": 6, "assigned_to": "Michelle Torres"},
        {"title": "Customer: API rate limiting", "description": "Customer hitting rate limits on integration", "status": TaskStatus.IN_PROGRESS,
         "queue": "Support Tickets", "priority": 5, "assigned_to": "Chris Anderson"},

        # Urgent items
        {"title": "Production alert: High CPU", "description": "Web servers showing 90%+ CPU usage", "status": TaskStatus.IN_PROGRESS,
         "queue": "Urgent", "priority": 10, "assigned_to": "Monitor Bot"},
    ]

    task_count = 0
    for t in tasks_data:
        existing = await db.tasks.find_one({"organization_id": org_id, "title": t["title"]})
        if not existing:
            task_id = ObjectId()
            task = Task(
                id=task_id,
                organization_id=org_id,
                title=t["title"],
                description=t["description"],
                status=t["status"],
                priority=t["priority"],
                queue_id=queue_map.get(t["queue"]),
                assigned_to_id=user_map.get(t.get("assigned_to")),
                project_id=project_map.get(t.get("project")),
            )
            await db.tasks.insert_one(task.model_dump_mongo())
            task_count += 1

    if task_count > 0:
        logger.info(f"  Created {task_count} tasks")

    # Create recurring tasks
    recurring_data = [
        {"title": "Weekly team standup", "description": "Monday 9am team sync", "recurrence_type": RecurrenceType.WEEKLY,
         "days_of_week": [0], "queue": "Inbox", "assigned_to": "David"},
        {"title": "Monthly metrics review", "description": "Review KPIs and dashboards", "recurrence_type": RecurrenceType.MONTHLY,
         "day_of_month": 1, "queue": "Inbox", "assigned_to": "Sarah Chen"},
        {"title": "Daily backup verification", "description": "Verify backup completion", "recurrence_type": RecurrenceType.DAILY,
         "queue": "Engineering Backlog", "assigned_to": "Monitor Bot"},
    ]

    recurring_count = 0
    for r in recurring_data:
        existing = await db.recurring_tasks.find_one({"organization_id": org_id, "title": r["title"]})
        if not existing:
            rec_id = ObjectId()
            recurring = RecurringTask(
                id=rec_id,
                organization_id=org_id,
                title=r["title"],
                description=r["description"],
                recurrence_type=r["recurrence_type"],
                days_of_week=r.get("days_of_week"),
                day_of_month=r.get("day_of_month"),
                queue_id=queue_map.get(r["queue"]),
                assigned_to_id=user_map.get(r.get("assigned_to")),
                priority=5,
                is_active=True,
                start_date=now,
            )
            await db.recurring_tasks.insert_one(recurring.model_dump_mongo())
            recurring_count += 1

    if recurring_count > 0:
        logger.info(f"  Created {recurring_count} recurring tasks")

    logger.info(f"\nDemo data seeding complete for {DEMO_ORG_NAME}!")
    logger.info(f"  Users: {len(user_map)}")
    logger.info(f"  Teams: {len(team_map)}")
    logger.info(f"  Queues: {len(queue_map)}")
    logger.info(f"  Projects: {len(project_map)}")
    logger.info(f"  Playbooks: {len(playbook_map)}")


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
