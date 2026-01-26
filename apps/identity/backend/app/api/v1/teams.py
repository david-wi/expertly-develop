"""Team management API endpoints."""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Team, TeamMember, User, Organization
from app.api.v1.users import get_organization
from app.schemas.team import (
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    TeamDetailResponse,
    TeamListResponse,
    TeamMemberAdd,
    TeamMemberResponse,
)

router = APIRouter()


@router.get("", response_model=TeamListResponse)
async def list_teams(
    limit: int = 100,
    offset: int = 0,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """List teams in the organization."""
    query = (
        select(Team)
        .where(Team.organization_id == org.id)
        .order_by(Team.name)
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    teams = result.scalars().all()

    # Get member counts
    team_responses = []
    for team in teams:
        count_result = await db.execute(
            select(func.count(TeamMember.id)).where(TeamMember.team_id == team.id)
        )
        member_count = count_result.scalar()
        team_resp = TeamResponse.model_validate(team)
        team_resp.member_count = member_count
        team_responses.append(team_resp)

    # Get total count
    count_query = select(func.count(Team.id)).where(Team.organization_id == org.id)
    total = (await db.execute(count_query)).scalar()

    return TeamListResponse(items=team_responses, total=total)


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_data: TeamCreate,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """Create a new team."""
    team = Team(
        organization_id=org.id,
        name=team_data.name,
        description=team_data.description,
    )

    db.add(team)
    await db.commit()
    await db.refresh(team)

    return team


@router.get("/{team_id}", response_model=TeamDetailResponse)
async def get_team(
    team_id: UUID,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """Get a team by ID with members."""
    result = await db.execute(
        select(Team)
        .where(Team.id == team_id, Team.organization_id == org.id)
        .options(selectinload(Team.members).selectinload(TeamMember.user))
    )
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Build response with member details
    members = []
    for membership in team.members:
        members.append(
            TeamMemberResponse(
                id=membership.id,
                user_id=membership.user_id,
                user_name=membership.user.name,
                user_avatar_url=membership.user.avatar_url,
                user_type=membership.user.user_type,
                role=membership.role,
                joined_at=membership.joined_at,
            )
        )

    return TeamDetailResponse(
        id=team.id,
        organization_id=team.organization_id,
        name=team.name,
        description=team.description,
        member_count=len(members),
        members=members,
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


@router.patch("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: UUID,
    team_data: TeamUpdate,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """Update a team."""
    result = await db.execute(
        select(Team).where(Team.id == team_id, Team.organization_id == org.id)
    )
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    update_data = team_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)

    await db.commit()
    await db.refresh(team)

    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: UUID,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """Delete a team."""
    result = await db.execute(
        select(Team).where(Team.id == team_id, Team.organization_id == org.id)
    )
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    await db.delete(team)
    await db.commit()


@router.post("/{team_id}/members", response_model=TeamMemberResponse)
async def add_team_member(
    team_id: UUID,
    member_data: TeamMemberAdd,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """Add a member to a team."""
    # Verify team exists
    team_result = await db.execute(
        select(Team).where(Team.id == team_id, Team.organization_id == org.id)
    )
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Verify user exists
    user_result = await db.execute(
        select(User).where(User.id == member_data.user_id, User.organization_id == org.id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already a member
    existing = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id, TeamMember.user_id == member_data.user_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a team member")

    membership = TeamMember(
        team_id=team_id,
        user_id=member_data.user_id,
        role=member_data.role,
    )

    db.add(membership)
    await db.commit()
    await db.refresh(membership)

    return TeamMemberResponse(
        id=membership.id,
        user_id=membership.user_id,
        user_name=user.name,
        user_avatar_url=user.avatar_url,
        user_type=user.user_type,
        role=membership.role,
        joined_at=membership.joined_at,
    )


@router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    team_id: UUID,
    user_id: UUID,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from a team."""
    # Verify team exists
    team_result = await db.execute(
        select(Team).where(Team.id == team_id, Team.organization_id == org.id)
    )
    if not team_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Team not found")

    # Find membership
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id, TeamMember.user_id == user_id
        )
    )
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(status_code=404, detail="Team member not found")

    await db.delete(membership)
    await db.commit()
