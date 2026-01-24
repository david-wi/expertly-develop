"""Walkthrough worker for processing visual walkthrough jobs."""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict
from bson import ObjectId

from app.database import get_database
from app.models.job import Job, JobType
from app.models.artifact import Artifact
from app.models.document import DocumentMetadata
from app.workers.base_worker import BaseWorker
from app.services.browser_service import browser_service, Screenshot
from app.services.pdf_service import pdf_service
from app.services.document_service import document_service
from app.services.encryption_service import encryption_service
from app.services.project_service import project_service


class WalkthroughWorker(BaseWorker):
    """Worker for processing visual walkthrough jobs."""

    def __init__(self):
        super().__init__([JobType.WALKTHROUGH])

    async def process_job(self, job: Job) -> Dict[str, Any]:
        """Process a walkthrough job."""
        params = job.params
        db = get_database()

        # Get project
        project = await project_service.get_project(ObjectId(params["project_id"]))
        if not project:
            raise ValueError("Project not found")

        if not project.site_url:
            raise ValueError("Project has no site URL configured")

        # Update progress
        await self.update_progress(job, 5, "Initializing browser...")

        # Start browser session
        await browser_service.start()
        session = await browser_service.create_session()

        try:
            screenshots = []

            # Handle login if credentials are configured
            if project.site_credentials:
                await self.update_progress(job, 10, "Logging in...")

                creds = await project_service.get_decrypted_credentials(project.id)

                if creds and creds.username and creds.password and creds.login_url:
                    success = await browser_service.login(
                        session,
                        login_url=creds.login_url,
                        username=creds.username,
                        password=creds.password,
                        username_selector=creds.username_selector or "#username",
                        password_selector=creds.password_selector or "#password",
                        submit_selector=creds.submit_selector or "button[type='submit']",
                    )
                    if not success:
                        raise ValueError("Login failed")

            # Handle persona credentials if specified
            if params.get("persona_id"):
                persona = await db.personas.find_one({
                    "_id": ObjectId(params["persona_id"])
                })
                if persona and persona.get("credentials"):
                    await self.update_progress(job, 15, "Logging in as persona...")

                    creds_data = persona["credentials"]
                    username = encryption_service.decrypt(creds_data.get("username", ""))
                    password = encryption_service.decrypt(creds_data.get("password", ""))

                    if username and password and project.site_credentials:
                        login_creds = await project_service.get_decrypted_credentials(project.id)
                        if login_creds and login_creds.login_url:
                            await browser_service.login(
                                session,
                                login_url=login_creds.login_url,
                                username=username,
                                password=password,
                                username_selector=login_creds.username_selector or "#username",
                                password_selector=login_creds.password_selector or "#password",
                                submit_selector=login_creds.submit_selector or "button[type='submit']",
                            )

            # Execute scenario
            await self.update_progress(job, 20, "Executing scenario...")

            def progress_callback(progress: int, step: str):
                # Map scenario progress to 20-80 range
                mapped_progress = 20 + int((progress / 100) * 60)
                asyncio.create_task(self.update_progress(job, mapped_progress, step))

            screenshots = await browser_service.execute_scenario(
                session,
                params["scenario_text"],
                project.site_url,
                progress_callback,
            )

            if not screenshots:
                # If no screenshots captured by scenario, capture at least the homepage
                await self.update_progress(job, 75, "Capturing homepage...")
                screenshot = await browser_service.navigate_and_capture(
                    session,
                    project.site_url,
                    "Homepage",
                    "Initial page load",
                )
                screenshots = [screenshot]

        finally:
            await browser_service.close_session(session)

        # Generate PDF
        await self.update_progress(job, 85, "Generating PDF report...")

        pdf_bytes = pdf_service.generate_walkthrough_pdf(
            title=params.get("label", "Visual Walkthrough"),
            description=params.get("description"),
            screenshots=screenshots,
            observations=params.get("observations"),
            project_name=project.name,
            generated_at=datetime.now(timezone.utc),
        )

        # Store PDF as document
        await self.update_progress(job, 90, "Saving artifact...")

        doc = await document_service.create_document(
            tenant_id=job.tenant_id,
            name=f"{params.get('label', 'walkthrough')}.pdf",
            content=pdf_bytes,
            content_type="application/pdf",
            created_by=job.requested_by,
            metadata=DocumentMetadata(
                project_id=project.id,
                category="walkthrough",
                tags=["visual-walkthrough", "pdf"],
            ),
        )

        # Create artifact record
        artifact = Artifact(
            tenant_id=job.tenant_id,
            project_id=project.id,
            created_by=job.requested_by,
            job_id=job.id,
            label=params.get("label", "Visual Walkthrough"),
            description=params.get("description"),
            artifact_type_code="visual_walkthrough",
            format="pdf",
            document_id=ObjectId(doc.document_key),
            generation_params=params,
            status="complete",
        )

        result = await db.artifacts.insert_one(artifact.to_mongo())
        artifact.id = result.inserted_id

        await self.update_progress(job, 100, "Complete")

        return {
            "artifact_id": str(artifact.id),
            "document_key": doc.document_key,
            "screenshots_count": len(screenshots),
        }


async def main():
    """Entry point for the walkthrough worker."""
    worker = WalkthroughWorker()
    worker.setup_signal_handlers()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
