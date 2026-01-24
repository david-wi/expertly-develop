"""Job queue management service."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId

from app.database import get_database
from app.models.job import Job, JobStatus, JobType


class JobService:
    """Service for managing the job queue."""

    def __init__(self):
        self.collection_name = "jobs"

    @property
    def collection(self):
        return get_database()[self.collection_name]

    async def create_job(
        self,
        tenant_id: ObjectId,
        job_type: JobType,
        params: Dict[str, Any],
        requested_by: Optional[ObjectId] = None,
        project_id: Optional[ObjectId] = None,
    ) -> Job:
        """Create a new job and return it with its ID."""
        job = Job(
            tenant_id=tenant_id,
            job_type=job_type,
            params=params,
            requested_by=requested_by,
            project_id=project_id,
            status=JobStatus.PENDING,
            created_at=datetime.now(timezone.utc),
        )

        result = await self.collection.insert_one(job.to_mongo())
        job.id = result.inserted_id
        return job

    async def get_job(self, job_id: ObjectId) -> Optional[Job]:
        """Get a job by ID."""
        data = await self.collection.find_one({"_id": job_id})
        return Job.from_mongo(data) if data else None

    async def get_job_by_str_id(self, job_id: str) -> Optional[Job]:
        """Get a job by string ID."""
        return await self.get_job(ObjectId(job_id))

    async def list_jobs(
        self,
        tenant_id: ObjectId,
        status: Optional[JobStatus] = None,
        job_type: Optional[JobType] = None,
        project_id: Optional[ObjectId] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Job]:
        """List jobs with optional filters."""
        query = {"tenant_id": tenant_id}

        if status:
            query["status"] = status.value
        if job_type:
            query["job_type"] = job_type.value
        if project_id:
            query["project_id"] = project_id

        cursor = (
            self.collection.find(query)
            .sort("created_at", -1)
            .skip(offset)
            .limit(limit)
        )

        return [Job.from_mongo(doc) async for doc in cursor]

    async def claim_next_pending_job(self, job_types: List[JobType] = None) -> Optional[Job]:
        """
        Atomically claim the next pending job for processing.

        Uses findAndModify to prevent race conditions between workers.
        """
        query = {"status": JobStatus.PENDING.value}
        if job_types:
            query["job_type"] = {"$in": [jt.value for jt in job_types]}

        update = {
            "$set": {
                "status": JobStatus.RUNNING.value,
                "started_at": datetime.now(timezone.utc),
            }
        }

        data = await self.collection.find_one_and_update(
            query,
            update,
            sort=[("created_at", 1)],
            return_document=True,
        )

        return Job.from_mongo(data) if data else None

    async def update_job_progress(
        self,
        job_id: ObjectId,
        progress: int,
        current_step: Optional[str] = None,
    ) -> bool:
        """Update job progress."""
        update = {"$set": {"progress": progress}}
        if current_step:
            update["$set"]["current_step"] = current_step

        result = await self.collection.update_one({"_id": job_id}, update)
        return result.modified_count > 0

    async def complete_job(
        self,
        job_id: ObjectId,
        result: Dict[str, Any],
    ) -> bool:
        """Mark a job as completed with results."""
        now = datetime.now(timezone.utc)

        # Get the job to calculate elapsed time
        job = await self.get_job(job_id)
        elapsed_ms = None
        if job and job.started_at:
            elapsed_ms = int((now - job.started_at).total_seconds() * 1000)

        update = {
            "$set": {
                "status": JobStatus.COMPLETED.value,
                "completed_at": now,
                "progress": 100,
                "result": result,
                "elapsed_ms": elapsed_ms,
            }
        }

        result_update = await self.collection.update_one({"_id": job_id}, update)
        return result_update.modified_count > 0

    async def fail_job(self, job_id: ObjectId, error: str) -> bool:
        """Mark a job as failed with an error message."""
        now = datetime.now(timezone.utc)

        # Get the job to calculate elapsed time
        job = await self.get_job(job_id)
        elapsed_ms = None
        if job and job.started_at:
            elapsed_ms = int((now - job.started_at).total_seconds() * 1000)

        update = {
            "$set": {
                "status": JobStatus.FAILED.value,
                "completed_at": now,
                "error": error,
                "elapsed_ms": elapsed_ms,
            }
        }

        result = await self.collection.update_one({"_id": job_id}, update)
        return result.modified_count > 0

    async def cancel_job(self, job_id: ObjectId) -> bool:
        """Cancel a pending or running job."""
        result = await self.collection.update_one(
            {
                "_id": job_id,
                "status": {"$in": [JobStatus.PENDING.value, JobStatus.RUNNING.value]},
            },
            {
                "$set": {
                    "status": JobStatus.CANCELLED.value,
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )
        return result.modified_count > 0

    async def count_jobs(
        self,
        tenant_id: ObjectId,
        status: Optional[JobStatus] = None,
    ) -> int:
        """Count jobs with optional status filter."""
        query = {"tenant_id": tenant_id}
        if status:
            query["status"] = status.value
        return await self.collection.count_documents(query)

    async def get_queue_stats(self, tenant_id: ObjectId) -> Dict[str, int]:
        """Get job queue statistics."""
        pipeline = [
            {"$match": {"tenant_id": tenant_id}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        ]

        stats = {s.value: 0 for s in JobStatus}
        async for doc in self.collection.aggregate(pipeline):
            stats[doc["_id"]] = doc["count"]

        return stats


# Singleton instance
job_service = JobService()
