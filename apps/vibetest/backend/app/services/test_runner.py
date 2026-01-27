"""Test runner service for executing test cases."""
import uuid
from datetime import datetime
from typing import Optional
import threading

from sqlalchemy.orm import Session

from app.models import TestRun, TestResult, TestCase, Environment, Artifact
from app.services.browser import get_browser_service
from app.services.ai import get_ai_service
from app.services.encryption import get_encryption_service


class TestRunnerService:
    """Service for orchestrating test execution."""

    def __init__(self, db: Session):
        self.db = db
        self.browser_service = get_browser_service()
        self.ai_service = get_ai_service()
        self.encryption_service = get_encryption_service()

    def start_run(
        self,
        project_id: str,
        test_case_ids: list[str],
        environment_id: Optional[str] = None,
        name: Optional[str] = None,
        triggered_by: str = "manual",
    ) -> TestRun:
        """Start a new test run."""
        now = datetime.utcnow()

        # Create run record
        run = TestRun(
            id=str(uuid.uuid4()),
            project_id=project_id,
            environment_id=environment_id,
            name=name or f"Test Run {now.isoformat()}",
            status="pending",
            triggered_by=triggered_by,
            created_at=now,
            updated_at=now,
        )
        self.db.add(run)

        # Create pending results for each test
        for test_id in test_case_ids:
            result = TestResult(
                id=str(uuid.uuid4()),
                run_id=run.id,
                test_case_id=test_id,
                status="pending",
                created_at=now,
                updated_at=now,
            )
            self.db.add(result)

        self.db.commit()
        self.db.refresh(run)

        # Start execution in background thread
        thread = threading.Thread(
            target=self._execute_run,
            args=(run.id, test_case_ids, environment_id),
            daemon=True,
        )
        thread.start()

        return run

    def _execute_run(
        self,
        run_id: str,
        test_case_ids: list[str],
        environment_id: Optional[str],
    ):
        """Execute test run in background."""
        from app.database import SessionLocal

        db = SessionLocal()
        try:
            # Update run status
            run = db.query(TestRun).filter(TestRun.id == run_id).first()
            if not run:
                return

            run.status = "running"
            run.started_at = datetime.utcnow()
            run.updated_at = datetime.utcnow()
            db.commit()

            # Get environment credentials
            credentials = None
            base_url = None
            if environment_id:
                env = db.query(Environment).filter(Environment.id == environment_id).first()
                if env:
                    base_url = env.base_url
                    if env.credentials_encrypted:
                        credentials = self.encryption_service.decrypt_credentials(
                            env.credentials_encrypted
                        )

            # Execute each test
            passed = 0
            failed = 0
            skipped = 0

            for test_id in test_case_ids:
                test_case = db.query(TestCase).filter(TestCase.id == test_id).first()
                if not test_case:
                    continue

                result = (
                    db.query(TestResult)
                    .filter(TestResult.run_id == run_id, TestResult.test_case_id == test_id)
                    .first()
                )
                if not result:
                    continue

                # Update to running
                result.status = "running"
                result.updated_at = datetime.utcnow()
                db.commit()

                start_time = datetime.utcnow()

                try:
                    if test_case.execution_type == "browser" and test_case.automation_config:
                        # Execute browser test
                        config = test_case.automation_config
                        steps = config.get("steps", [])
                        start_url = config.get("start_url") or base_url

                        if start_url and steps:
                            exec_result = self.browser_service.execute_test_steps(
                                start_url=start_url,
                                steps=steps,
                                credentials=credentials,
                                session_id=run_id,
                            )

                            result.status = exec_result.status
                            result.steps_executed = [
                                {
                                    "step": r.step,
                                    "status": r.status,
                                    "duration_ms": r.duration_ms,
                                    "error": r.error,
                                    "screenshot_path": r.screenshot_path,
                                }
                                for r in exec_result.results
                            ]

                            if exec_result.status == "failed":
                                failed_step = next(
                                    (r for r in exec_result.results if r.status == "failed"),
                                    None,
                                )
                                result.error_message = failed_step.error if failed_step else "Test failed"

                                # AI failure analysis
                                if self.ai_service.is_available() and exec_result.final_screenshot_base64:
                                    analysis = self.ai_service.analyze_test_failure(
                                        test_title=test_case.title,
                                        steps=steps,
                                        expected=test_case.expected_results or "",
                                        actual=result.error_message or "",
                                        screenshot_base64=exec_result.final_screenshot_base64,
                                    )
                                    result.ai_analysis = {
                                        "summary": analysis.summary,
                                        "likely_root_cause": analysis.likely_root_cause,
                                        "suggested_fix": analysis.suggested_fix,
                                        "confidence": analysis.confidence,
                                    }

                            # Store artifacts
                            if exec_result.final_screenshot_path:
                                artifact = Artifact(
                                    id=str(uuid.uuid4()),
                                    run_id=run_id,
                                    result_id=result.id,
                                    type="screenshot",
                                    file_path=exec_result.final_screenshot_path,
                                    created_at=datetime.utcnow(),
                                )
                                db.add(artifact)

                        else:
                            result.status = "skipped"
                            result.error_message = "Missing start URL or steps"

                    elif test_case.execution_type == "api":
                        # TODO: Implement API test execution
                        result.status = "skipped"
                        result.error_message = "API test execution not yet implemented"

                    elif test_case.execution_type == "visual" and base_url:
                        # Execute visual test
                        explore_result = self.browser_service.explore_page(
                            url=base_url,
                            credentials=credentials,
                            session_id=run_id,
                        )

                        artifact = Artifact(
                            id=str(uuid.uuid4()),
                            run_id=run_id,
                            result_id=result.id,
                            type="screenshot",
                            file_path=explore_result.screenshot_path,
                            created_at=datetime.utcnow(),
                        )
                        db.add(artifact)

                        result.status = "passed"

                    else:
                        # Manual test - skip in automated run
                        result.status = "skipped"
                        result.error_message = "Manual test requires human execution"

                except Exception as e:
                    result.status = "failed"
                    result.error_message = str(e)

                result.duration_ms = int(
                    (datetime.utcnow() - start_time).total_seconds() * 1000
                )
                result.updated_at = datetime.utcnow()
                db.commit()

                if result.status == "passed":
                    passed += 1
                elif result.status == "failed":
                    failed += 1
                else:
                    skipped += 1

            # Update run as completed
            run.status = "failed" if failed > 0 else "completed"
            run.completed_at = datetime.utcnow()
            run.summary = {
                "total": len(test_case_ids),
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "duration_ms": int(
                    (run.completed_at - run.started_at).total_seconds() * 1000
                ),
            }
            run.updated_at = datetime.utcnow()
            db.commit()

        except Exception as e:
            print(f"Run execution failed: {e}")
            try:
                run = db.query(TestRun).filter(TestRun.id == run_id).first()
                if run:
                    run.status = "failed"
                    run.completed_at = datetime.utcnow()
                    run.updated_at = datetime.utcnow()
                    db.commit()
            except Exception:
                pass

        finally:
            db.close()

    def get_run_status(self, run_id: str) -> Optional[TestRun]:
        """Get current run status."""
        return self.db.query(TestRun).filter(TestRun.id == run_id).first()
