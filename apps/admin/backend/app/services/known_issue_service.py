"""Known issue service for business logic."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.known_issue import KnownIssue, IssueStatus
from app.schemas.known_issue import KnownIssueCreate, KnownIssueUpdate


class KnownIssueService:
    """Service class for known issue operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_known_issue(self, data: KnownIssueCreate) -> KnownIssue:
        """Create a new known issue."""
        known_issue = KnownIssue(
            title=data.title,
            description=data.description,
            app_name=data.app_name,
            severity=data.severity.value,
            status=data.status.value,
            workaround=data.workaround,
            affected_version=data.affected_version,
        )

        self.db.add(known_issue)
        await self.db.flush()
        await self.db.refresh(known_issue)

        return known_issue

    async def get_known_issues(
        self,
        app_name: Optional[str] = None,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        include_resolved: bool = True,
    ) -> list[KnownIssue]:
        """List known issues with filters."""
        conditions = []
        if app_name:
            conditions.append(KnownIssue.app_name == app_name)
        if status:
            conditions.append(KnownIssue.status == status)
        if severity:
            conditions.append(KnownIssue.severity == severity)
        if not include_resolved:
            conditions.append(KnownIssue.status != IssueStatus.RESOLVED.value)

        query = select(KnownIssue)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(KnownIssue.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_known_issue(self, issue_id: UUID) -> Optional[KnownIssue]:
        """Get a single known issue by ID."""
        query = select(KnownIssue).where(KnownIssue.id == issue_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def update_known_issue(
        self,
        issue_id: UUID,
        data: KnownIssueUpdate,
    ) -> Optional[KnownIssue]:
        """Update a known issue."""
        known_issue = await self.get_known_issue(issue_id)
        if not known_issue:
            return None

        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field == 'severity' and value:
                value = value.value
            elif field == 'status' and value:
                value = value.value
                # Auto-set resolved_at when marking as resolved
                if value == IssueStatus.RESOLVED.value and not known_issue.resolved_at:
                    known_issue.resolved_at = datetime.now(timezone.utc)
            setattr(known_issue, field, value)

        await self.db.flush()
        await self.db.refresh(known_issue)

        return known_issue

    async def delete_known_issue(self, issue_id: UUID) -> bool:
        """Delete a known issue."""
        known_issue = await self.get_known_issue(issue_id)
        if not known_issue:
            return False

        await self.db.delete(known_issue)
        await self.db.flush()
        return True
