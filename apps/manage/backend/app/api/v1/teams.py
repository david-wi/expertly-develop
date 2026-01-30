from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import Team, TeamCreate, TeamUpdate, User
from app.models.queue import Queue, ScopeType
from app.api.deps import get_current_user

router = APIRouter()


async def create_system_queues_for_team(db, organization_id, team_id):
    """Create system queues (Inbox and Approvals) for a team."""
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


@router.get("")
async def list_teams(
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List teams in the current organization."""
    db = get_database()

    cursor = db.teams.find({"organization_id": current_user.organization_id})
    teams = await cursor.to_list(100)

    return [
        {
            **team,
            "_id": str(team["_id"]),
            "organization_id": str(team["organization_id"]),
            "member_ids": [str(m) for m in team.get("member_ids", [])],
            "lead_id": str(team["lead_id"]) if team.get("lead_id") else None
        }
        for team in teams
    ]


@router.get("/{team_id}")
async def get_team(
    team_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific team."""
    db = get_database()

    if not ObjectId.is_valid(team_id):
        raise HTTPException(status_code=400, detail="Invalid team ID")

    team = await db.teams.find_one({
        "_id": ObjectId(team_id),
        "organization_id": current_user.organization_id
    })

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    return {
        **team,
        "_id": str(team["_id"]),
        "organization_id": str(team["organization_id"]),
        "member_ids": [str(m) for m in team.get("member_ids", [])],
        "lead_id": str(team["lead_id"]) if team.get("lead_id") else None
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_team(
    data: TeamCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new team."""
    db = get_database()

    # Verify permission
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can create teams")

    team = Team(
        organization_id=current_user.organization_id,
        name=data.name,
        description=data.description,
        member_ids=[ObjectId(m) for m in data.member_ids if ObjectId.is_valid(m)],
        lead_id=ObjectId(data.lead_id) if data.lead_id and ObjectId.is_valid(data.lead_id) else None
    )

    await db.teams.insert_one(team.model_dump_mongo())

    # Create system queues (Inbox and Approvals) for the new team
    await create_system_queues_for_team(db, current_user.organization_id, team.id)

    return {
        **team.model_dump_mongo(),
        "_id": str(team.id),
        "organization_id": str(team.organization_id),
        "member_ids": [str(m) for m in team.member_ids],
        "lead_id": str(team.lead_id) if team.lead_id else None
    }


@router.patch("/{team_id}")
async def update_team(
    team_id: str,
    data: TeamUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update a team."""
    db = get_database()

    if not ObjectId.is_valid(team_id):
        raise HTTPException(status_code=400, detail="Invalid team ID")

    # Verify permission
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can update teams")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Convert member_ids and lead_id to ObjectIds
    if "member_ids" in update_data:
        update_data["member_ids"] = [
            ObjectId(m) for m in update_data["member_ids"] if ObjectId.is_valid(m)
        ]
    if "lead_id" in update_data:
        update_data["lead_id"] = ObjectId(update_data["lead_id"]) if update_data["lead_id"] else None

    result = await db.teams.find_one_and_update(
        {"_id": ObjectId(team_id), "organization_id": current_user.organization_id},
        {"$set": update_data},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Team not found")

    return {
        **result,
        "_id": str(result["_id"]),
        "organization_id": str(result["organization_id"]),
        "member_ids": [str(m) for m in result.get("member_ids", [])],
        "lead_id": str(result["lead_id"]) if result.get("lead_id") else None
    }


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a team."""
    db = get_database()

    if not ObjectId.is_valid(team_id):
        raise HTTPException(status_code=400, detail="Invalid team ID")

    # Verify permission
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can delete teams")

    result = await db.teams.delete_one({
        "_id": ObjectId(team_id),
        "organization_id": current_user.organization_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")


@router.post("/{team_id}/members/{user_id}")
async def add_team_member(
    team_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Add a member to a team."""
    db = get_database()

    if not ObjectId.is_valid(team_id) or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    # Verify permission
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can manage team members")

    # Verify user exists
    user = await db.users.find_one({
        "_id": ObjectId(user_id),
        "organization_id": current_user.organization_id
    })
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.teams.find_one_and_update(
        {"_id": ObjectId(team_id), "organization_id": current_user.organization_id},
        {"$addToSet": {"member_ids": ObjectId(user_id)}},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Team not found")

    return {
        **result,
        "_id": str(result["_id"]),
        "organization_id": str(result["organization_id"]),
        "member_ids": [str(m) for m in result.get("member_ids", [])],
        "lead_id": str(result["lead_id"]) if result.get("lead_id") else None
    }


@router.delete("/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Remove a member from a team."""
    db = get_database()

    if not ObjectId.is_valid(team_id) or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    # Verify permission
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can manage team members")

    result = await db.teams.find_one_and_update(
        {"_id": ObjectId(team_id), "organization_id": current_user.organization_id},
        {"$pull": {"member_ids": ObjectId(user_id)}},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Team not found")

    return {
        **result,
        "_id": str(result["_id"]),
        "organization_id": str(result["organization_id"]),
        "member_ids": [str(m) for m in result.get("member_ids", [])],
        "lead_id": str(result["lead_id"]) if result.get("lead_id") else None
    }
