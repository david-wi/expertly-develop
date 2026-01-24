"""Quick start endpoints."""
import uuid
import threading
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models import QuickStartSession, Project, Environment, TestCase, User
from app.schemas import (
    QuickStartCreate,
    QuickStartResponse,
    QuickStartResultResponse,
    QuickStartResults,
    PageInfo,
    SuggestedTest,
    Issue,
)
from app.services.browser import get_browser_service
from app.services.ai import get_ai_service
from app.services.encryption import get_encryption_service
from app.api.deps import get_current_user, get_optional_user

router = APIRouter()


@router.post("", response_model=QuickStartResponse, status_code=201)
def start_quick_start(
    session_in: QuickStartCreate,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Start a quick start exploration session."""
    # Validate URL
    try:
        from urllib.parse import urlparse
        parsed = urlparse(session_in.url)
        if not parsed.scheme or not parsed.netloc:
            raise ValueError("Invalid URL")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format")

    encryption_service = get_encryption_service()
    now = datetime.utcnow()
    session_id = str(uuid.uuid4())

    session = QuickStartSession(
        id=session_id,
        organization_id=current_user.organization_id if current_user else None,
        url=session_in.url,
        credentials_encrypted=encryption_service.encrypt_credentials(
            session_in.credentials.model_dump() if session_in.credentials else None
        ),
        status="pending",
        progress=0,
        progress_message="Starting exploration...",
        created_at=now,
        updated_at=now,
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    # Start exploration in background
    thread = threading.Thread(
        target=_run_exploration,
        args=(session_id, session_in.url, session_in.credentials, session_in.max_pages),
        daemon=True,
    )
    thread.start()

    return QuickStartResponse(
        id=session.id,
        url=session.url,
        status=session.status,
        progress=session.progress,
        progress_message=session.progress_message,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


@router.get("/{session_id}", response_model=QuickStartResultResponse)
def get_quick_start_status(
    session_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Get quick start session status and results."""
    query = db.query(QuickStartSession).filter(QuickStartSession.id == session_id)

    # If authenticated, verify access
    if current_user:
        query = query.filter(
            (QuickStartSession.organization_id == current_user.organization_id) |
            (QuickStartSession.organization_id.is_(None))
        )

    session = query.first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    results = None
    if session.results:
        data = session.results
        results = QuickStartResults(
            pages_explored=data.get("pages_explored", 0),
            pages=[PageInfo(**p) for p in data.get("pages", [])],
            suggested_tests=[SuggestedTest(**t) for t in data.get("suggested_tests", [])],
            issues=[Issue(**i) for i in data.get("issues", [])],
            ai_available=data.get("ai_available", False),
        )

    return QuickStartResultResponse(
        id=session.id,
        url=session.url,
        status=session.status,
        progress=session.progress,
        progress_message=session.progress_message,
        created_at=session.created_at,
        updated_at=session.updated_at,
        results=results,
        project_id=session.project_id,
    )


@router.post("/{session_id}/save-project")
def save_as_project(
    session_id: str,
    name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save quick start results as a new project."""
    session = db.query(QuickStartSession).filter(
        QuickStartSession.id == session_id,
        (QuickStartSession.organization_id == current_user.organization_id) |
        (QuickStartSession.organization_id.is_(None))
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "completed":
        raise HTTPException(status_code=400, detail="Session not completed")

    if session.project_id:
        raise HTTPException(status_code=400, detail="Already saved as project")

    now = datetime.utcnow()

    # Create project with organization
    project = Project(
        id=str(uuid.uuid4()),
        organization_id=current_user.organization_id,
        name=name,
        description=f"Auto-generated from {session.url}",
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(project)

    # Create environment
    encryption_service = get_encryption_service()
    environment = Environment(
        id=str(uuid.uuid4()),
        project_id=project.id,
        name="Default",
        type="staging",
        base_url=session.url,
        credentials_encrypted=session.credentials_encrypted,
        is_default=True,
        created_at=now,
        updated_at=now,
    )
    db.add(environment)

    # Create test cases from suggestions
    if session.results and session.results.get("suggested_tests"):
        for test_data in session.results["suggested_tests"]:
            test_case = TestCase(
                id=str(uuid.uuid4()),
                project_id=project.id,
                title=test_data.get("title", "Untitled Test"),
                description=test_data.get("description"),
                preconditions=test_data.get("preconditions"),
                steps=test_data.get("steps", []),
                expected_results=test_data.get("expected_results"),
                tags=test_data.get("tags", []),
                priority=test_data.get("priority", "medium"),
                status="draft",
                execution_type=test_data.get("execution_type", "browser"),
                automation_config={"steps": test_data.get("steps", []), "start_url": session.url},
                created_by="ai",
                created_at=now,
                updated_at=now,
            )
            db.add(test_case)

    # Update session
    session.project_id = project.id
    session.organization_id = current_user.organization_id  # Associate with org
    session.updated_at = now

    db.commit()

    return {
        "project_id": project.id,
        "tests_created": len(session.results.get("suggested_tests", [])) if session.results else 0,
    }


def _run_exploration(
    session_id: str,
    url: str,
    credentials: Optional[dict],
    max_pages: int,
):
    """Run exploration in background thread."""
    db = SessionLocal()
    browser_service = get_browser_service()
    ai_service = get_ai_service()
    encryption_service = get_encryption_service()

    try:
        # Update status
        session = db.query(QuickStartSession).filter(QuickStartSession.id == session_id).first()
        if not session:
            return

        session.status = "exploring"
        session.progress = 10
        session.progress_message = "Connecting to site..."
        session.updated_at = datetime.utcnow()
        db.commit()

        # Decrypt credentials
        creds = None
        if credentials:
            creds = credentials.model_dump() if hasattr(credentials, 'model_dump') else credentials

        # Explore pages
        pages = browser_service.explore_multiple_pages(
            start_url=url,
            credentials=creds,
            max_pages=max_pages,
            session_id=session_id,
        )

        session.progress = 50
        session.progress_message = f"Explored {len(pages)} pages. Analyzing..."
        session.updated_at = datetime.utcnow()
        db.commit()

        # Analyze pages
        suggested_tests = []
        issues = []

        for i, page in enumerate(pages):
            session.progress = 50 + int((i / len(pages)) * 40)
            session.progress_message = f"Analyzing page {i + 1} of {len(pages)}..."
            session.updated_at = datetime.utcnow()
            db.commit()

            # AI analysis if available
            if ai_service.is_available():
                try:
                    analysis = ai_service.analyze_page_screenshot(
                        screenshot_base64=page.screenshot_base64,
                        url=page.url,
                    )

                    for test in analysis.suggested_tests:
                        suggested_tests.append({
                            "title": test.title,
                            "description": test.description,
                            "preconditions": test.preconditions,
                            "steps": test.steps,
                            "expected_results": test.expected_results,
                            "priority": test.priority,
                            "tags": test.tags,
                            "execution_type": test.execution_type,
                        })

                    for issue in analysis.issues:
                        issues.append({
                            "url": page.url,
                            "type": issue.get("type", "unknown"),
                            "message": issue.get("message", ""),
                            "severity": issue.get("severity", "info"),
                        })

                except Exception as e:
                    print(f"AI analysis failed for {page.url}: {e}")

        # Generate basic tests if AI not available or no tests generated
        if not suggested_tests:
            for page in pages:
                # Navigation test
                suggested_tests.append({
                    "title": f"Verify {page.title or 'page'} loads correctly",
                    "description": f"Ensure the page at {page.url} loads without errors",
                    "preconditions": "None",
                    "steps": [
                        {"action": "navigate", "value": page.url},
                        {"action": "verify", "selector": "body", "expected": "Page loads"},
                    ],
                    "expected_results": "Page loads successfully",
                    "priority": "medium",
                    "tags": ["smoke", "navigation"],
                    "execution_type": "browser",
                })

                # Form tests
                for form in page.forms[:2]:
                    steps = [{"action": "navigate", "value": page.url}]
                    for input_field in form.get("inputs", [])[:5]:
                        if input_field.get("name"):
                            value = "test@example.com" if input_field.get("type") == "email" else "test"
                            steps.append({
                                "action": "type",
                                "selector": f'[name="{input_field["name"]}"]',
                                "value": value,
                            })

                    if steps:
                        suggested_tests.append({
                            "title": f"Test form on {page.title or 'page'}",
                            "description": f"Test form submission at {page.url}",
                            "preconditions": "Navigate to page",
                            "steps": steps,
                            "expected_results": "Form can be filled",
                            "priority": "high",
                            "tags": ["forms", "functional"],
                            "execution_type": "browser",
                        })

        # Compile results
        results = {
            "pages_explored": len(pages),
            "pages": [
                {
                    "url": p.url,
                    "title": p.title,
                    "screenshot_path": p.screenshot_path,
                    "links_count": len(p.links),
                    "forms_count": len(p.forms),
                    "buttons_count": len(p.buttons),
                    "errors_count": len(p.errors),
                    "load_time_ms": p.load_time_ms,
                }
                for p in pages
            ],
            "suggested_tests": suggested_tests[:50],  # Limit to 50 tests
            "issues": issues[:100],  # Limit to 100 issues
            "ai_available": ai_service.is_available(),
        }

        # Update session as completed
        session.status = "completed"
        session.progress = 100
        session.progress_message = f"Completed! Found {len(pages)} pages, generated {len(suggested_tests)} test suggestions."
        session.results = results
        session.updated_at = datetime.utcnow()
        db.commit()

    except Exception as e:
        print(f"Exploration failed: {e}")
        try:
            session = db.query(QuickStartSession).filter(QuickStartSession.id == session_id).first()
            if session:
                session.status = "failed"
                session.progress = 0
                session.progress_message = str(e)
                session.updated_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass

    finally:
        db.close()
