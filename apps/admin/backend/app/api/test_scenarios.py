"""API routes for test scenarios."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.test_scenario_service import TestScenarioService
from app.schemas.test_scenario import (
    TestScenarioCreate,
    TestScenarioUpdate,
    TestScenarioResponse,
    TestScenarioListResponse,
    TestScenarioStatsResponse,
    TestRunCreate,
    TestRunResponse,
    TestRunListResponse,
)

router = APIRouter()


def get_test_scenario_service(db: AsyncSession = Depends(get_db)) -> TestScenarioService:
    """Dependency to instantiate test scenario service."""
    return TestScenarioService(db)


# Scenario endpoints

@router.get("", response_model=TestScenarioListResponse)
async def list_scenarios(
    app_name: Optional[str] = Query(None, description="Filter by app name"),
    category: Optional[str] = Query(None, description="Filter by category"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    service: TestScenarioService = Depends(get_test_scenario_service),
):
    """
    List test scenarios with optional filters.

    Includes the latest run result for each scenario.
    """
    results, total = await service.get_scenarios_with_latest_run(
        app_name=app_name,
        category=category,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )

    scenarios = []
    for scenario, latest_run in results:
        response = TestScenarioResponse.model_validate(scenario)
        if latest_run:
            response.latest_run = TestRunResponse.model_validate(latest_run)
        scenarios.append(response)

    return TestScenarioListResponse(scenarios=scenarios, total=total)


@router.get("/stats", response_model=TestScenarioStatsResponse)
async def get_stats(
    service: TestScenarioService = Depends(get_test_scenario_service),
):
    """Get test scenario statistics summary."""
    stats = await service.get_stats()
    return TestScenarioStatsResponse(**stats)


@router.get("/apps", response_model=list[str])
async def get_distinct_apps(
    service: TestScenarioService = Depends(get_test_scenario_service),
):
    """Get list of distinct app names."""
    return await service.get_distinct_apps()


@router.get("/categories", response_model=list[str])
async def get_distinct_categories(
    service: TestScenarioService = Depends(get_test_scenario_service),
):
    """Get list of distinct test categories."""
    return await service.get_distinct_categories()


@router.get("/{scenario_id}", response_model=TestScenarioResponse)
async def get_scenario(
    scenario_id: UUID,
    service: TestScenarioService = Depends(get_test_scenario_service),
):
    """Get a single test scenario by ID."""
    scenario = await service.get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Test scenario not found")

    response = TestScenarioResponse.model_validate(scenario)
    latest_run = await service.get_latest_run(scenario_id)
    if latest_run:
        response.latest_run = TestRunResponse.model_validate(latest_run)

    return response


@router.post("", response_model=TestScenarioResponse, status_code=201)
async def create_scenario(
    data: TestScenarioCreate,
    service: TestScenarioService = Depends(get_test_scenario_service),
):
    """Create a new test scenario."""
    # Check if scenario_key already exists
    existing = await service.get_scenario_by_key(data.scenario_key)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Scenario with key '{data.scenario_key}' already exists"
        )

    scenario = await service.create_scenario(data)
    return TestScenarioResponse.model_validate(scenario)


@router.put("/{scenario_id}", response_model=TestScenarioResponse)
async def update_scenario(
    scenario_id: UUID,
    data: TestScenarioUpdate,
    service: TestScenarioService = Depends(get_test_scenario_service),
):
    """Update a test scenario."""
    scenario = await service.update_scenario(scenario_id, data)
    if not scenario:
        raise HTTPException(status_code=404, detail="Test scenario not found")

    response = TestScenarioResponse.model_validate(scenario)
    latest_run = await service.get_latest_run(scenario_id)
    if latest_run:
        response.latest_run = TestRunResponse.model_validate(latest_run)

    return response


@router.delete("/{scenario_id}", status_code=204)
async def delete_scenario(
    scenario_id: UUID,
    service: TestScenarioService = Depends(get_test_scenario_service),
):
    """Delete a test scenario and all its runs."""
    deleted = await service.delete_scenario(scenario_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Test scenario not found")


# Run endpoints

@router.post("/runs", response_model=TestRunResponse, status_code=201)
async def report_run(
    data: TestRunCreate,
    service: TestScenarioService = Depends(get_test_scenario_service),
):
    """
    Report a test run result.

    This endpoint is intended for CI/CD systems to report test results.
    The scenario_key is used to match the run to the correct scenario.
    """
    run = await service.create_run(data)
    if not run:
        raise HTTPException(
            status_code=404,
            detail=f"Test scenario with key '{data.scenario_key}' not found"
        )
    return TestRunResponse.model_validate(run)


@router.get("/{scenario_id}/runs", response_model=TestRunListResponse)
async def list_scenario_runs(
    scenario_id: UUID,
    status: Optional[str] = Query(None, description="Filter by status"),
    environment: Optional[str] = Query(None, description="Filter by environment"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    service: TestScenarioService = Depends(get_test_scenario_service),
):
    """List test runs for a specific scenario."""
    # Verify scenario exists
    scenario = await service.get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Test scenario not found")

    runs, total = await service.get_runs(
        scenario_id=scenario_id,
        status=status,
        environment=environment,
        skip=skip,
        limit=limit,
    )

    return TestRunListResponse(
        runs=[TestRunResponse.model_validate(r) for r in runs],
        total=total,
    )


@router.get("/runs/{run_id}", response_model=TestRunResponse)
async def get_run(
    run_id: UUID,
    service: TestScenarioService = Depends(get_test_scenario_service),
):
    """Get a single test run by ID."""
    run = await service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return TestRunResponse.model_validate(run)
