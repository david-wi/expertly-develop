"""Team API endpoints - proxies to Identity service."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from typing import Optional

from identity_client.auth import get_session_token
from identity_client.models import User as IdentityUser

from app.utils.auth import get_identity_client, get_current_user
from app.database import get_database
from app.models.queue import Queue, ScopeType

router = APIRouter()


class TeamCreate(BaseModel):
    """Schema for creating a team."""
    name: str
    description: Optional[str] = None
    member_ids: list[str] = []
    lead_id: Optional[str] = None


class TeamUpdate(BaseModel):
    """Schema for updating a team."""
    name: Optional[str] = None
    description: Optional[str] = None
    member_ids: Optional[list[str]] = None
    lead_id: Optional[str] = None


async def create_system_queues_for_team(db, organization_id: str, team_id: str):
    """Create system queues (Inbox and Approvals) for a team."""
    # Check if queues already exist
    existing = await db.queues.find_one({
        "organization_id": organization_id,
        "scope_type": ScopeType.TEAM.value,
        "scope_id": team_id,
        "is_system": True,
    })
    if existing:
        return

    # Create Inbox queue
    inbox_queue = Queue(
        organization_id=organization_id,
        purpose="Inbox",
        description="Default queue for incoming tasks",
        scope_type=ScopeType.TEAM,
        scope_id=team_id,
        is_system=True,
        system_type="inbox"
    )
    await db.queues.insert_one(inbox_queue.model_dump_mongo())

    # Create Approvals queue
    approvals_queue = Queue(
        organization_id=organization_id,
        purpose="Approvals",
        description="Queue for tasks requiring approval",
        scope_type=ScopeType.TEAM,
        scope_id=team_id,
        is_system=True,
        system_type="approvals"
    )
    await db.queues.insert_one(approvals_queue.model_dump_mongo())


def _team_to_dict(team_data: dict) -> dict:
    """Convert Identity team to API response format."""
    members = team_data.get("members", [])
    member_ids = [m.get("user_id") if isinstance(m, dict) else m for m in members]

    return {
        "id": team_data.get("id"),
        "_id": team_data.get("id"),  # For backward compatibility
        "organization_id": team_data.get("organization_id"),
        "name": team_data.get("name"),
        "description": team_data.get("description"),
        "member_ids": member_ids,
        "lead_id": team_data.get("lead_id"),
        "member_count": team_data.get("member_count", len(member_ids)),
        "created_at": team_data.get("created_at"),
        "updated_at": team_data.get("updated_at"),
    }


@router.get("")
async def list_teams(
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> list[dict]:
    """List teams in the current organization from Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    client = get_identity_client()
    try:
        result = await client.list_teams(
            session_token=session_token,
            organization_id=current_user.organization_id,
        )
        return [_team_to_dict(t.model_dump()) for t in result.items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch teams: {str(e)}")


@router.get("/{team_id}")
async def get_team(
    team_id: str,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Get a specific team from Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    client = get_identity_client()
    try:
        team = await client.get_team(team_id, session_token)
        return _team_to_dict(team.model_dump())
    except Exception as e:
        if "404" in str(e) or "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Team not found")
        raise HTTPException(status_code=500, detail=f"Failed to fetch team: {str(e)}")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_team(
    data: TeamCreate,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Create a new team in Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    # Verify permission
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can create teams")

    client = get_identity_client()

    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                f"{client.base_url}/api/v1/teams",
                json={
                    "name": data.name,
                    "description": data.description,
                },
                headers={
                    "X-Session-Token": session_token,
                    "X-Organization-Id": current_user.organization_id,
                    "Content-Type": "application/json",
                },
            )
            if response.status_code == 400:
                detail = response.json().get("detail", "Bad request")
                raise HTTPException(status_code=400, detail=detail)
            response.raise_for_status()
            result = response.json()

        # Create system queues for the new team in Manage's database
        db = get_database()
        new_team_id = result.get("id")
        await create_system_queues_for_team(
            db,
            current_user.organization_id,
            new_team_id
        )

        # Add members if specified
        if data.member_ids:
            for member_id in data.member_ids:
                try:
                    await http_client.post(
                        f"{client.base_url}/api/v1/teams/{new_team_id}/members",
                        json={"user_id": member_id, "role": "member"},
                        headers={
                            "X-Session-Token": session_token,
                            "X-Organization-Id": current_user.organization_id,
                            "Content-Type": "application/json",
                        },
                    )
                except Exception:
                    pass  # Ignore individual member add failures

        return _team_to_dict(result)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create team: {str(e)}")


@router.patch("/{team_id}")
async def update_team(
    team_id: str,
    data: TeamUpdate,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Update a team in Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    # Verify permission
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can update teams")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Remove member_ids and lead_id from update - handle separately
    member_ids = update_data.pop("member_ids", None)
    update_data.pop("lead_id", None)  # Not supported in Identity yet

    client = get_identity_client()

    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            if update_data:  # Only update if there are fields to update
                response = await http_client.patch(
                    f"{client.base_url}/api/v1/teams/{team_id}",
                    json=update_data,
                    headers={
                        "X-Session-Token": session_token,
                        "X-Organization-Id": current_user.organization_id,
                        "Content-Type": "application/json",
                    },
                )
                if response.status_code == 404:
                    raise HTTPException(status_code=404, detail="Team not found")
                response.raise_for_status()
                result = response.json()
            else:
                # Just fetch the current team
                team = await client.get_team(team_id, session_token)
                result = team.model_dump()

        return _team_to_dict(result)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update team: {str(e)}")


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: str,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
):
    """Delete a team via Identity (also removes team queues from Manage)."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    # Verify permission
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can delete teams")

    client = get_identity_client()
    db = get_database()

    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.delete(
                f"{client.base_url}/api/v1/teams/{team_id}",
                headers={
                    "X-Session-Token": session_token,
                    "X-Organization-Id": current_user.organization_id,
                },
            )
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Team not found")
            response.raise_for_status()

        # Delete team's queues from Manage's database
        await db.queues.delete_many({
            "scope_type": "team",
            "scope_id": team_id,
            "organization_id": current_user.organization_id
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete team: {str(e)}")


@router.post("/{team_id}/members/{user_id}")
async def add_team_member(
    team_id: str,
    user_id: str,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Add a member to a team via Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    # Verify permission
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can manage team members")

    client = get_identity_client()

    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                f"{client.base_url}/api/v1/teams/{team_id}/members",
                json={"user_id": user_id, "role": "member"},
                headers={
                    "X-Session-Token": session_token,
                    "X-Organization-Id": current_user.organization_id,
                    "Content-Type": "application/json",
                },
            )
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Team or user not found")
            response.raise_for_status()

        # Fetch updated team
        team = await client.get_team(team_id, session_token)
        return _team_to_dict(team.model_dump())

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add team member: {str(e)}")


@router.delete("/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: str,
    user_id: str,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Remove a member from a team via Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    # Verify permission
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can manage team members")

    client = get_identity_client()

    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.delete(
                f"{client.base_url}/api/v1/teams/{team_id}/members/{user_id}",
                headers={
                    "X-Session-Token": session_token,
                    "X-Organization-Id": current_user.organization_id,
                },
            )
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Team or user not found")
            response.raise_for_status()

        # Fetch updated team
        team = await client.get_team(team_id, session_token)
        return _team_to_dict(team.model_dump())

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove team member: {str(e)}")
