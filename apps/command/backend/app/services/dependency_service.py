"""
Dependency service for managing task dependencies (DAG-based workflow).
"""
import logging
from collections import deque
from typing import Optional

from bson import ObjectId

from app.database import get_database
from app.models import TaskStatus

logger = logging.getLogger(__name__)


class DependencyService:
    """Service for managing task dependencies."""

    def __init__(self):
        self.db = get_database()

    async def validate_dependencies(
        self,
        task_id: Optional[ObjectId],
        depends_on: list[str],
        organization_id: ObjectId
    ) -> tuple[bool, Optional[str]]:
        """
        Validate a list of dependency task IDs.

        Checks:
        - All IDs are valid ObjectIds
        - All referenced tasks exist in the same organization
        - No self-reference
        - No circular dependencies

        Args:
            task_id: The task being updated (None for new tasks)
            depends_on: List of task ID strings to depend on
            organization_id: Organization for access control

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not depends_on:
            return True, None

        # Check for self-reference
        if task_id and str(task_id) in depends_on:
            return False, "A task cannot depend on itself"

        # Validate all IDs
        valid_ids = []
        for dep_id in depends_on:
            if not ObjectId.is_valid(dep_id):
                return False, f"Invalid dependency ID: {dep_id}"
            valid_ids.append(ObjectId(dep_id))

        # Check all tasks exist in the organization
        count = await self.db.tasks.count_documents({
            "_id": {"$in": valid_ids},
            "organization_id": organization_id
        })
        if count != len(valid_ids):
            return False, "One or more dependency tasks not found"

        # Check for circular dependencies
        if task_id:
            would_cycle = await self.would_create_cycle(task_id, valid_ids, organization_id)
            if would_cycle:
                return False, "Adding these dependencies would create a circular dependency"

        return True, None

    async def would_create_cycle(
        self,
        task_id: ObjectId,
        new_deps: list[ObjectId],
        organization_id: ObjectId
    ) -> bool:
        """
        Check if adding new dependencies would create a cycle.

        Uses BFS to traverse downstream from the new dependencies,
        checking if any path leads back to the original task.

        Args:
            task_id: The task that would have new dependencies
            new_deps: New dependency task IDs to add
            organization_id: Organization for access control

        Returns:
            True if adding deps would create a cycle
        """
        # BFS from task_id through downstream tasks
        # If any of new_deps is reachable, we have a cycle
        visited = set()
        queue = deque([task_id])

        while queue:
            current = queue.popleft()
            if current in visited:
                continue
            visited.add(current)

            # Find tasks that depend on current task
            cursor = self.db.tasks.find(
                {
                    "organization_id": organization_id,
                    "depends_on": current
                },
                {"_id": 1}
            )
            async for downstream in cursor:
                downstream_id = downstream["_id"]
                if downstream_id in new_deps:
                    return True  # Cycle detected
                if downstream_id not in visited:
                    queue.append(downstream_id)

        return False

    async def check_dependencies_met(
        self,
        task_id: ObjectId,
        organization_id: ObjectId
    ) -> tuple[bool, list[dict]]:
        """
        Check if all dependencies of a task are completed.

        Args:
            task_id: The task to check
            organization_id: Organization for access control

        Returns:
            Tuple of (all_met, list of incomplete dependency info)
        """
        task = await self.db.tasks.find_one({
            "_id": task_id,
            "organization_id": organization_id
        })

        if not task:
            return False, [{"error": "Task not found"}]

        depends_on = task.get("depends_on", [])
        if not depends_on:
            return True, []

        # Get all dependency tasks
        cursor = self.db.tasks.find(
            {
                "_id": {"$in": depends_on},
                "organization_id": organization_id
            },
            {"_id": 1, "title": 1, "status": 1}
        )

        incomplete = []
        async for dep in cursor:
            if dep["status"] != TaskStatus.COMPLETED.value:
                incomplete.append({
                    "id": str(dep["_id"]),
                    "title": dep.get("title", "Untitled"),
                    "status": dep["status"]
                })

        return len(incomplete) == 0, incomplete

    async def unblock_dependent_tasks(
        self,
        completed_task_id: ObjectId,
        organization_id: ObjectId
    ) -> int:
        """
        When a task completes, check if any blocked tasks can be unblocked.

        For each task that depends on the completed task:
        - If all its dependencies are now complete, change status from BLOCKED to QUEUED

        Args:
            completed_task_id: The task that just completed
            organization_id: Organization for access control

        Returns:
            Number of tasks unblocked
        """
        unblocked_count = 0

        # Find blocked tasks that depend on this completed task
        cursor = self.db.tasks.find({
            "organization_id": organization_id,
            "depends_on": completed_task_id,
            "status": TaskStatus.BLOCKED.value
        })

        async for blocked_task in cursor:
            # Check if all dependencies are now met
            all_met, _ = await self.check_dependencies_met(
                blocked_task["_id"],
                organization_id
            )

            if all_met:
                # Unblock the task
                result = await self.db.tasks.update_one(
                    {"_id": blocked_task["_id"]},
                    {"$set": {"status": TaskStatus.QUEUED.value}}
                )
                if result.modified_count > 0:
                    unblocked_count += 1
                    logger.info(
                        f"Unblocked task {blocked_task['_id']} after "
                        f"completion of {completed_task_id}"
                    )

        return unblocked_count

    async def get_task_dependencies(
        self,
        task_id: ObjectId,
        organization_id: ObjectId
    ) -> dict:
        """
        Get dependency information for a task.

        Returns both upstream (depends_on) and downstream (blocking) tasks.

        Args:
            task_id: The task to get dependencies for
            organization_id: Organization for access control

        Returns:
            Dict with upstream and downstream task info
        """
        task = await self.db.tasks.find_one({
            "_id": task_id,
            "organization_id": organization_id
        })

        if not task:
            return {"error": "Task not found"}

        # Get upstream tasks (this task depends on)
        depends_on = task.get("depends_on", [])
        upstream = []
        if depends_on:
            cursor = self.db.tasks.find(
                {"_id": {"$in": depends_on}},
                {"_id": 1, "title": 1, "status": 1}
            )
            async for dep in cursor:
                upstream.append({
                    "id": str(dep["_id"]),
                    "title": dep.get("title", "Untitled"),
                    "status": dep["status"]
                })

        # Get downstream tasks (tasks that depend on this one)
        downstream = []
        cursor = self.db.tasks.find(
            {
                "organization_id": organization_id,
                "depends_on": task_id
            },
            {"_id": 1, "title": 1, "status": 1}
        )
        async for dep in cursor:
            downstream.append({
                "id": str(dep["_id"]),
                "title": dep.get("title", "Untitled"),
                "status": dep["status"]
            })

        return {
            "task_id": str(task_id),
            "upstream": upstream,  # Tasks this one depends on
            "downstream": downstream  # Tasks depending on this one
        }
