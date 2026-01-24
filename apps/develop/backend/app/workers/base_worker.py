"""Base worker for processing jobs."""

import asyncio
import signal
from abc import ABC, abstractmethod
from typing import List, Optional

from app.database import connect_to_mongodb, close_mongodb_connection
from app.models.job import Job, JobType
from app.services.job_service import job_service
from app.config import get_settings


class BaseWorker(ABC):
    """Base class for job workers."""

    def __init__(self, job_types: List[JobType]):
        self.job_types = job_types
        self.running = False
        self._current_job: Optional[Job] = None

    @abstractmethod
    async def process_job(self, job: Job) -> dict:
        """
        Process a job and return the result.

        Subclasses must implement this method.
        """
        pass

    async def update_progress(self, job: Job, progress: int, step: str) -> None:
        """Update job progress."""
        await job_service.update_job_progress(job.id, progress, step)

    async def run(self) -> None:
        """Main worker loop."""
        settings = get_settings()

        # Connect to database
        await connect_to_mongodb()

        self.running = True
        print(f"Worker started, processing job types: {[jt.value for jt in self.job_types]}")

        try:
            while self.running:
                # Try to claim a job
                job = await job_service.claim_next_pending_job(self.job_types)

                if job:
                    self._current_job = job
                    print(f"Processing job {job.id} of type {job.job_type}")

                    try:
                        result = await self.process_job(job)
                        await job_service.complete_job(job.id, result)
                        print(f"Job {job.id} completed successfully")

                    except Exception as e:
                        error_msg = str(e)
                        print(f"Job {job.id} failed: {error_msg}")
                        await job_service.fail_job(job.id, error_msg)

                    finally:
                        self._current_job = None

                else:
                    # No jobs available, wait before polling again
                    await asyncio.sleep(settings.job_poll_interval)

        except asyncio.CancelledError:
            print("Worker shutdown requested")

        finally:
            await close_mongodb_connection()
            print("Worker stopped")

    def stop(self) -> None:
        """Stop the worker gracefully."""
        self.running = False

    def setup_signal_handlers(self) -> None:
        """Set up signal handlers for graceful shutdown."""
        loop = asyncio.get_event_loop()

        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, self.stop)
