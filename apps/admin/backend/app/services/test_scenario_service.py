"""Test scenario service for business logic."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.test_scenario import TestScenario, TestRun, TestRunStatus
from app.schemas.test_scenario import (
    TestScenarioCreate,
    TestScenarioUpdate,
    TestRunCreate,
    AppScenarioCount,
    CategoryScenarioCount,
    StatusRunCount,
)


class TestScenarioService:
    """Service class for test scenario operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_scenario(self, data: TestScenarioCreate) -> TestScenario:
        """Create a new test scenario."""
        scenario = TestScenario(
            scenario_key=data.scenario_key,
            name=data.name,
            description=data.description,
            app_name=data.app_name,
            category=data.category.value,
            test_file=data.test_file,
            steps=[s.model_dump() for s in data.steps] if data.steps else None,
            is_active=data.is_active,
        )

        self.db.add(scenario)
        await self.db.flush()
        await self.db.refresh(scenario)

        return scenario

    async def get_scenarios(
        self,
        app_name: Optional[str] = None,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[TestScenario], int]:
        """List test scenarios with filters and pagination."""
        # Build filter conditions
        conditions = []
        if app_name:
            conditions.append(TestScenario.app_name == app_name)
        if category:
            conditions.append(TestScenario.category == category)
        if is_active is not None:
            conditions.append(TestScenario.is_active == is_active)

        # Count query
        count_query = select(func.count()).select_from(TestScenario)
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        # Data query with pagination
        query = select(TestScenario)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(TestScenario.app_name, TestScenario.name).offset(skip).limit(limit)

        result = await self.db.execute(query)
        scenarios = result.scalars().all()

        return list(scenarios), total

    async def get_scenario(self, scenario_id: UUID) -> Optional[TestScenario]:
        """Get a single test scenario by ID."""
        query = select(TestScenario).where(TestScenario.id == scenario_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_scenario_by_key(self, scenario_key: str) -> Optional[TestScenario]:
        """Get a test scenario by its unique key."""
        query = select(TestScenario).where(TestScenario.scenario_key == scenario_key)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def update_scenario(
        self,
        scenario_id: UUID,
        data: TestScenarioUpdate,
    ) -> Optional[TestScenario]:
        """Update a test scenario."""
        scenario = await self.get_scenario(scenario_id)
        if not scenario:
            return None

        if data.name is not None:
            scenario.name = data.name
        if data.description is not None:
            scenario.description = data.description
        if data.app_name is not None:
            scenario.app_name = data.app_name
        if data.category is not None:
            scenario.category = data.category.value
        if data.test_file is not None:
            scenario.test_file = data.test_file
        if data.steps is not None:
            scenario.steps = [s.model_dump() for s in data.steps]
        if data.is_active is not None:
            scenario.is_active = data.is_active

        await self.db.flush()
        await self.db.refresh(scenario)

        return scenario

    async def delete_scenario(self, scenario_id: UUID) -> bool:
        """Delete a test scenario."""
        scenario = await self.get_scenario(scenario_id)
        if not scenario:
            return False

        await self.db.delete(scenario)
        await self.db.flush()
        return True

    async def get_latest_run(self, scenario_id: UUID) -> Optional[TestRun]:
        """Get the most recent test run for a scenario."""
        query = (
            select(TestRun)
            .where(TestRun.scenario_id == scenario_id)
            .order_by(TestRun.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_scenarios_with_latest_run(
        self,
        app_name: Optional[str] = None,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[tuple[TestScenario, Optional[TestRun]]], int]:
        """Get scenarios with their latest run attached."""
        scenarios, total = await self.get_scenarios(
            app_name=app_name,
            category=category,
            is_active=is_active,
            skip=skip,
            limit=limit,
        )

        # Get latest runs for all scenarios
        results = []
        for scenario in scenarios:
            latest_run = await self.get_latest_run(scenario.id)
            results.append((scenario, latest_run))

        return results, total

    # Test Run operations

    async def create_run(self, data: TestRunCreate) -> Optional[TestRun]:
        """Create a new test run result."""
        # Find the scenario by key
        scenario = await self.get_scenario_by_key(data.scenario_key)
        if not scenario:
            return None

        run = TestRun(
            scenario_id=scenario.id,
            status=data.status.value,
            duration_ms=data.duration_ms,
            failed_step=data.failed_step,
            error_message=data.error_message,
            error_stack=data.error_stack,
            step_results=[s.model_dump() for s in data.step_results] if data.step_results else None,
            environment=data.environment,
            run_id=data.run_id,
            started_at=data.started_at,
            completed_at=data.completed_at or datetime.now(timezone.utc),
        )

        self.db.add(run)
        await self.db.flush()
        await self.db.refresh(run)

        return run

    async def get_runs(
        self,
        scenario_id: Optional[UUID] = None,
        status: Optional[str] = None,
        environment: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[TestRun], int]:
        """List test runs with filters and pagination."""
        conditions = []
        if scenario_id:
            conditions.append(TestRun.scenario_id == scenario_id)
        if status:
            conditions.append(TestRun.status == status)
        if environment:
            conditions.append(TestRun.environment == environment)

        # Count query
        count_query = select(func.count()).select_from(TestRun)
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        # Data query with pagination
        query = select(TestRun)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(TestRun.created_at.desc()).offset(skip).limit(limit)

        result = await self.db.execute(query)
        runs = result.scalars().all()

        return list(runs), total

    async def get_run(self, run_id: UUID) -> Optional[TestRun]:
        """Get a single test run by ID."""
        query = select(TestRun).where(TestRun.id == run_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    # Statistics

    async def get_stats(self) -> dict:
        """Get test scenario and run statistics."""
        # Total and active scenarios
        total_scenarios_query = select(func.count()).select_from(TestScenario)
        total_result = await self.db.execute(total_scenarios_query)
        total_scenarios = total_result.scalar()

        active_scenarios_query = (
            select(func.count())
            .select_from(TestScenario)
            .where(TestScenario.is_active == True)
        )
        active_result = await self.db.execute(active_scenarios_query)
        active_scenarios = active_result.scalar()

        # Count by app
        by_app_query = (
            select(TestScenario.app_name, func.count().label("count"))
            .where(TestScenario.is_active == True)
            .group_by(TestScenario.app_name)
            .order_by(func.count().desc())
        )
        by_app_result = await self.db.execute(by_app_query)
        by_app = [
            AppScenarioCount(app_name=row.app_name, count=row.count)
            for row in by_app_result.all()
        ]

        # Count by category
        by_category_query = (
            select(TestScenario.category, func.count().label("count"))
            .where(TestScenario.is_active == True)
            .group_by(TestScenario.category)
            .order_by(func.count().desc())
        )
        by_category_result = await self.db.execute(by_category_query)
        by_category = [
            CategoryScenarioCount(category=row.category, count=row.count)
            for row in by_category_result.all()
        ]

        # Run stats - get latest run status for each scenario
        # This uses a subquery to find the latest run per scenario
        latest_run_subquery = (
            select(
                TestRun.scenario_id,
                func.max(TestRun.created_at).label("max_created_at")
            )
            .group_by(TestRun.scenario_id)
            .subquery()
        )

        latest_runs_query = (
            select(TestRun.status, func.count().label("count"))
            .join(
                latest_run_subquery,
                and_(
                    TestRun.scenario_id == latest_run_subquery.c.scenario_id,
                    TestRun.created_at == latest_run_subquery.c.max_created_at
                )
            )
            .group_by(TestRun.status)
        )
        latest_runs_result = await self.db.execute(latest_runs_query)
        run_stats = {row.status: row.count for row in latest_runs_result.all()}

        return {
            "total_scenarios": total_scenarios,
            "active_scenarios": active_scenarios,
            "by_app": by_app,
            "by_category": by_category,
            "run_stats": run_stats,
        }

    async def get_distinct_apps(self) -> list[str]:
        """Get list of distinct app names."""
        query = (
            select(TestScenario.app_name)
            .distinct()
            .order_by(TestScenario.app_name)
        )
        result = await self.db.execute(query)
        return [row[0] for row in result.all()]

    async def get_distinct_categories(self) -> list[str]:
        """Get list of distinct categories."""
        query = (
            select(TestScenario.category)
            .distinct()
            .order_by(TestScenario.category)
        )
        result = await self.db.execute(query)
        return [row[0] for row in result.all()]
