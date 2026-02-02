"""Preconfigured scenarios API endpoints."""

from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import UserContext, get_user_context
from app.database import get_database
from app.models.scenario import PreconfiguredScenario

router = APIRouter()


class ScenarioResponse(BaseModel):
    """Schema for scenario response."""

    id: str
    code: str
    name: str
    description: Optional[str]
    scenario_template: str
    default_observations: list[str]
    is_system: bool


class ScenarioListResponse(BaseModel):
    """Schema for scenario list response."""

    items: list[ScenarioResponse]
    total: int


def scenario_to_response(scenario: PreconfiguredScenario) -> ScenarioResponse:
    """Convert scenario model to response schema."""
    return ScenarioResponse(
        id=str(scenario.id),
        code=scenario.code,
        name=scenario.name,
        description=scenario.description,
        scenario_template=scenario.scenario_template,
        default_observations=scenario.default_observations,
        is_system=scenario.is_system,
    )


@router.get("", response_model=ScenarioListResponse)
async def list_scenarios(
    user: UserContext = Depends(get_user_context),
):
    """List available preconfigured scenarios."""
    db = get_database()

    # Get both system-wide and organization-specific scenarios
    query = {
        "$or": [
            {"organization_id": None},
            {"organization_id": user.organization_id},
        ]
    }

    cursor = db.preconfigured_scenarios.find(query).sort("name", 1)
    scenarios = [PreconfiguredScenario.from_mongo(doc) async for doc in cursor]

    return ScenarioListResponse(
        items=[scenario_to_response(s) for s in scenarios],
        total=len(scenarios),
    )


@router.get("/{code}", response_model=ScenarioResponse)
async def get_scenario(
    code: str,
    user: UserContext = Depends(get_user_context),
):
    """Get a scenario by code."""
    db = get_database()

    # Look for organization-specific first, then system-wide
    doc = await db.preconfigured_scenarios.find_one({
        "code": code,
        "$or": [
            {"organization_id": user.organization_id},
            {"organization_id": None},
        ]
    })

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scenario not found",
        )

    return scenario_to_response(PreconfiguredScenario.from_mongo(doc))
