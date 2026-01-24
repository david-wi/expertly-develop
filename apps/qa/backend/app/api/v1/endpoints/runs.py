"""Test run endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TestRun, TestResult, TestCase, Environment, Project, Artifact, User
from app.schemas import TestRunCreate, TestRunResponse, TestRunDetailResponse, RunSummary
from app.services.test_runner import TestRunnerService
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=list[TestRunResponse])
def list_runs(
    project_id: str,
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List test runs for a project."""
    # Validate project access
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(TestRun).filter(TestRun.project_id == project_id)

    if status:
        query = query.filter(TestRun.status == status)

    runs = query.order_by(TestRun.created_at.desc()).limit(limit).all()

    # Enrich with summary data
    result = []
    for run in runs:
        summary = None
        if run.summary:
            summary = RunSummary(**run.summary)
        else:
            # Calculate summary from results
            results = db.query(TestResult).filter(TestResult.run_id == run.id).all()
            if results:
                summary = RunSummary(
                    total=len(results),
                    passed=len([r for r in results if r.status == "passed"]),
                    failed=len([r for r in results if r.status == "failed"]),
                    skipped=len([r for r in results if r.status == "skipped"]),
                )

        result.append(TestRunResponse(
            id=run.id,
            project_id=run.project_id,
            environment_id=run.environment_id,
            suite_id=run.suite_id,
            name=run.name,
            status=run.status,
            started_at=run.started_at,
            completed_at=run.completed_at,
            summary=summary,
            triggered_by=run.triggered_by,
            created_at=run.created_at,
            updated_at=run.updated_at,
        ))

    return result


@router.post("", response_model=TestRunResponse, status_code=201)
def start_run(
    project_id: str,
    run_in: TestRunCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start a new test run."""
    # Validate project access
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Determine which tests to run
    test_case_ids = run_in.test_case_ids or []

    if not test_case_ids:
        if run_in.suite_id:
            # Get tests from suite
            from app.models import TestSuite
            suite = db.query(TestSuite).filter(TestSuite.id == run_in.suite_id).first()
            if suite:
                test_case_ids = suite.test_case_ids or []
        else:
            # Get all approved tests
            tests = (
                db.query(TestCase)
                .filter(
                    TestCase.project_id == project_id,
                    TestCase.status == "approved",
                    TestCase.deleted_at.is_(None),
                )
                .all()
            )
            test_case_ids = [t.id for t in tests]

    if not test_case_ids:
        raise HTTPException(status_code=400, detail="No tests to run")

    # Start the run
    runner = TestRunnerService(db)
    run = runner.start_run(
        project_id=project_id,
        test_case_ids=test_case_ids,
        environment_id=run_in.environment_id,
        name=run_in.name,
        triggered_by=run_in.triggered_by,
    )

    return TestRunResponse(
        id=run.id,
        project_id=run.project_id,
        environment_id=run.environment_id,
        suite_id=run.suite_id,
        name=run.name,
        status=run.status,
        started_at=run.started_at,
        completed_at=run.completed_at,
        summary=None,
        triggered_by=run.triggered_by,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


@router.get("/{run_id}", response_model=TestRunDetailResponse)
def get_run(
    project_id: str,
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a test run with results."""
    # Validate project access
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    run = (
        db.query(TestRun)
        .filter(
            TestRun.id == run_id,
            TestRun.project_id == project_id,
        )
        .first()
    )

    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Get results
    results = db.query(TestResult).filter(TestResult.run_id == run_id).all()

    # Get environment
    environment = None
    if run.environment_id:
        env = db.query(Environment).filter(Environment.id == run.environment_id).first()
        if env:
            environment = {
                "id": env.id,
                "name": env.name,
                "type": env.type,
                "base_url": env.base_url,
            }

    # Enrich results with test case info and artifacts
    enriched_results = []
    for result in results:
        test_case = db.query(TestCase).filter(TestCase.id == result.test_case_id).first()
        artifacts = db.query(Artifact).filter(Artifact.result_id == result.id).all()

        enriched_results.append({
            "id": result.id,
            "test_case_id": result.test_case_id,
            "test_case_title": test_case.title if test_case else None,
            "status": result.status,
            "duration_ms": result.duration_ms,
            "error_message": result.error_message,
            "steps_executed": result.steps_executed,
            "ai_analysis": result.ai_analysis,
            "artifacts": [
                {"id": a.id, "type": a.type, "file_path": a.file_path}
                for a in artifacts
            ],
        })

    summary = None
    if run.summary:
        summary = RunSummary(**run.summary)

    return TestRunDetailResponse(
        id=run.id,
        project_id=run.project_id,
        environment_id=run.environment_id,
        suite_id=run.suite_id,
        name=run.name,
        status=run.status,
        started_at=run.started_at,
        completed_at=run.completed_at,
        summary=summary,
        triggered_by=run.triggered_by,
        created_at=run.created_at,
        updated_at=run.updated_at,
        results=enriched_results,
        environment=environment,
    )


@router.get("/{run_id}/results")
def get_run_results(
    project_id: str,
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get test results for a run."""
    # Validate project access
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    run = (
        db.query(TestRun)
        .filter(
            TestRun.id == run_id,
            TestRun.project_id == project_id,
        )
        .first()
    )

    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")

    results = db.query(TestResult).filter(TestResult.run_id == run_id).all()

    return [
        {
            "id": r.id,
            "test_case_id": r.test_case_id,
            "status": r.status,
            "duration_ms": r.duration_ms,
            "error_message": r.error_message,
            "steps_executed": r.steps_executed,
            "ai_analysis": r.ai_analysis,
        }
        for r in results
    ]
