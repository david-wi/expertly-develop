"""Error log service for business logic."""

from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.error_log import ErrorLog, ErrorStatus
from app.schemas.error_log import (
    ErrorLogCreate,
    ErrorLogUpdate,
    AppErrorCount,
    StatusErrorCount,
    SeverityErrorCount,
)


class ErrorLogService:
    """Service class for error log operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_error_log(self, data: ErrorLogCreate) -> ErrorLog:
        """Create a new error log entry."""
        error_log = ErrorLog(
            app_name=data.app_name,
            error_message=data.error_message,
            stack_trace=data.stack_trace,
            url=data.url,
            user_id=data.user_id,
            user_email=data.user_email,
            org_id=data.org_id,
            browser_info=data.browser_info,
            additional_context=data.additional_context,
            severity=data.severity.value,
            status=ErrorStatus.NEW.value,
            occurred_at=data.occurred_at or datetime.now(timezone.utc),
        )

        self.db.add(error_log)
        await self.db.flush()
        await self.db.refresh(error_log)

        return error_log

    async def get_error_logs(
        self,
        app_name: Optional[str] = None,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[ErrorLog], int]:
        """List error logs with filters and pagination."""
        # Build filter conditions
        conditions = []
        if app_name:
            conditions.append(ErrorLog.app_name == app_name)
        if status:
            conditions.append(ErrorLog.status == status)
        if severity:
            conditions.append(ErrorLog.severity == severity)
        if start_date:
            conditions.append(ErrorLog.occurred_at >= start_date)
        if end_date:
            conditions.append(ErrorLog.occurred_at <= end_date)

        # Count query
        count_query = select(func.count()).select_from(ErrorLog)
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        # Data query with pagination
        query = select(ErrorLog)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(ErrorLog.occurred_at.desc()).offset(skip).limit(limit)

        result = await self.db.execute(query)
        error_logs = result.scalars().all()

        return list(error_logs), total

    async def get_error_log(self, error_id: UUID) -> Optional[ErrorLog]:
        """Get a single error log by ID."""
        query = select(ErrorLog).where(ErrorLog.id == error_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def update_error_log(
        self,
        error_id: UUID,
        data: ErrorLogUpdate,
    ) -> Optional[ErrorLog]:
        """Update an error log entry (mainly status changes)."""
        error_log = await self.get_error_log(error_id)
        if not error_log:
            return None

        if data.status:
            old_status = error_log.status
            error_log.status = data.status.value

            # Set timestamp based on status change
            now = datetime.now(timezone.utc)
            if data.status == ErrorStatus.ACKNOWLEDGED and old_status == ErrorStatus.NEW.value:
                error_log.acknowledged_at = now
            elif data.status == ErrorStatus.RESOLVED:
                error_log.resolved_at = now
                if not error_log.acknowledged_at:
                    error_log.acknowledged_at = now

        await self.db.flush()
        await self.db.refresh(error_log)

        return error_log

    async def get_error_stats(self) -> dict:
        """Get error statistics."""
        now = datetime.now(timezone.utc)
        last_24h = now - timedelta(hours=24)
        last_7d = now - timedelta(days=7)

        # Total count
        total_query = select(func.count()).select_from(ErrorLog)
        total_result = await self.db.execute(total_query)
        total = total_result.scalar()

        # Count by app
        by_app_query = (
            select(ErrorLog.app_name, func.count().label("count"))
            .group_by(ErrorLog.app_name)
            .order_by(func.count().desc())
        )
        by_app_result = await self.db.execute(by_app_query)
        by_app = [
            AppErrorCount(app_name=row.app_name, count=row.count)
            for row in by_app_result.all()
        ]

        # Count by status
        by_status_query = (
            select(ErrorLog.status, func.count().label("count"))
            .group_by(ErrorLog.status)
            .order_by(func.count().desc())
        )
        by_status_result = await self.db.execute(by_status_query)
        by_status = [
            StatusErrorCount(status=row.status, count=row.count)
            for row in by_status_result.all()
        ]

        # Count by severity
        by_severity_query = (
            select(ErrorLog.severity, func.count().label("count"))
            .group_by(ErrorLog.severity)
            .order_by(func.count().desc())
        )
        by_severity_result = await self.db.execute(by_severity_query)
        by_severity = [
            SeverityErrorCount(severity=row.severity, count=row.count)
            for row in by_severity_result.all()
        ]

        # Last 24h count
        last_24h_query = (
            select(func.count())
            .select_from(ErrorLog)
            .where(ErrorLog.occurred_at >= last_24h)
        )
        last_24h_result = await self.db.execute(last_24h_query)
        last_24h_count = last_24h_result.scalar()

        # Last 7d count
        last_7d_query = (
            select(func.count())
            .select_from(ErrorLog)
            .where(ErrorLog.occurred_at >= last_7d)
        )
        last_7d_result = await self.db.execute(last_7d_query)
        last_7d_count = last_7d_result.scalar()

        return {
            "total": total,
            "by_app": by_app,
            "by_status": by_status,
            "by_severity": by_severity,
            "last_24h": last_24h_count,
            "last_7d": last_7d_count,
        }

    async def get_distinct_apps(self) -> list[str]:
        """Get list of distinct app names that have logged errors."""
        query = select(ErrorLog.app_name).distinct().order_by(ErrorLog.app_name)
        result = await self.db.execute(query)
        return [row[0] for row in result.all()]
