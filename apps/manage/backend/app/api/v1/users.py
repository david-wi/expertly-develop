"""User API endpoints - proxies to Identity service."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from typing import Optional

from identity_client import IdentityClient
from identity_client.auth import get_session_token
from identity_client.models import User as IdentityUser

from app.utils.auth import get_identity_client, get_current_user
from app.database import get_database
from app.models.queue import Queue, ScopeType

router = APIRouter()


class BotConfig(BaseModel):
    """Bot configuration."""
    poll_interval_seconds: Optional[int] = None
    max_concurrent_tasks: Optional[int] = None
    allowed_queue_ids: Optional[list[str]] = None
    capabilities: Optional[list[str]] = None
    what_i_can_help_with: Optional[str] = None


class UserCreate(BaseModel):
    """Schema for creating a user."""
    name: str
    email: Optional[str] = None
    user_type: str = "human"  # "human" or "bot"
    role: str = "member"
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    responsibilities: Optional[str] = None
    bot_config: Optional[BotConfig] = None


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    responsibilities: Optional[str] = None
    bot_config: Optional[BotConfig] = None


async def create_system_queues(db, organization_id: str, scope_type: ScopeType, scope_id: str):
    """Create system queues (Inbox and Approvals) for a user, bot, or team."""
    # Check if queues already exist
    existing = await db.queues.find_one({
        "organization_id": organization_id,
        "scope_type": scope_type.value,
        "scope_id": scope_id,
        "is_system": True,
    })
    if existing:
        return  # Already have system queues

    # Create Inbox queue
    inbox_queue = Queue(
        organization_id=organization_id,
        purpose="Inbox",
        description="Default queue for incoming tasks",
        scope_type=scope_type,
        scope_id=scope_id,
        is_system=True,
        system_type="inbox"
    )
    await db.queues.insert_one(inbox_queue.model_dump_mongo())

    # Create Approvals queue
    approvals_queue = Queue(
        organization_id=organization_id,
        purpose="Approvals",
        description="Queue for tasks requiring approval",
        scope_type=scope_type,
        scope_id=scope_id,
        is_system=True,
        system_type="approvals"
    )
    await db.queues.insert_one(approvals_queue.model_dump_mongo())


def _user_to_dict(user: IdentityUser) -> dict:
    """Convert Identity user to API response format."""
    result = {
        "id": user.id,
        "_id": user.id,  # For backward compatibility
        "organization_id": user.organization_id,
        "name": user.name,
        "email": user.email,
        "user_type": user.user_type if user.user_type else "human",
        "role": user.role,
        "is_active": user.is_active if hasattr(user, 'is_active') else True,
        "is_default": user.is_default if hasattr(user, 'is_default') else False,
        "avatar_url": user.avatar_url,
        "title": user.title if hasattr(user, 'title') else None,
        "responsibilities": user.responsibilities if hasattr(user, 'responsibilities') else None,
        "bot_config": user.bot_config.model_dump() if hasattr(user, 'bot_config') and user.bot_config else None,
        "created_at": user.created_at if hasattr(user, 'created_at') else None,
        "updated_at": user.updated_at if hasattr(user, 'updated_at') else None,
    }
    return result


@router.get("")
async def list_users(
    request: Request,
    user_type: str | None = None,
    current_user: IdentityUser = Depends(get_current_user)
) -> list[dict]:
    """List users in the current organization from Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    client = get_identity_client()
    try:
        result = await client.list_users(
            session_token=session_token,
            organization_id=current_user.organization_id,
        )
        users = result.items

        # Filter by user_type if specified
        if user_type:
            users = [u for u in users if u.user_type == user_type]

        return [_user_to_dict(u) for u in users]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")


@router.get("/me")
async def get_current_user_info(
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Get current user information and ensure system queues exist."""
    # Ensure system queues exist for this user (creates them if not)
    db = get_database()
    await create_system_queues(
        db,
        current_user.organization_id,
        ScopeType.USER,
        current_user.id
    )
    return _user_to_dict(current_user)


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Get a specific user from Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    client = get_identity_client()
    try:
        user = await client.get_user(user_id, session_token)
        return _user_to_dict(user)
    except Exception as e:
        if "404" in str(e) or "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user: {str(e)}")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Create a new user in Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    # Verify permission (admin or owner)
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can create users")

    client = get_identity_client()

    # Build request body for Identity API
    create_data = {
        "name": data.name,
        "user_type": data.user_type,
        "role": data.role,
    }
    if data.email:
        create_data["email"] = data.email
    if data.avatar_url:
        create_data["avatar_url"] = data.avatar_url
    if data.title:
        create_data["title"] = data.title
    if data.responsibilities:
        create_data["responsibilities"] = data.responsibilities
    if data.bot_config:
        create_data["bot_config"] = data.bot_config.model_dump()

    try:
        # Call Identity API to create user
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                f"{client.base_url}/api/v1/users",
                json=create_data,
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

        # Create system queues for the new user in Manage's database
        db = get_database()
        new_user_id = result.get("user", result).get("id", result.get("id"))
        await create_system_queues(
            db,
            current_user.organization_id,
            ScopeType.USER,
            new_user_id
        )

        # Return the created user with api_key if provided
        user_data = result.get("user", result)
        response_dict = {
            "id": user_data.get("id"),
            "_id": user_data.get("id"),
            "organization_id": user_data.get("organization_id"),
            "name": user_data.get("name"),
            "email": user_data.get("email"),
            "user_type": user_data.get("user_type", "human"),
            "role": user_data.get("role"),
            "is_active": user_data.get("is_active", True),
            "is_default": user_data.get("is_default", False),
            "avatar_url": user_data.get("avatar_url"),
            "title": user_data.get("title"),
            "responsibilities": user_data.get("responsibilities"),
            "bot_config": user_data.get("bot_config"),
        }
        if "api_key" in result:
            response_dict["api_key"] = result["api_key"]
        return response_dict

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")


@router.patch("/{user_id}")
async def update_user(
    user_id: str,
    data: UserUpdate,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Update a user in Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    # Can update self or must be admin
    is_self = current_user.id == user_id
    is_admin = current_user.role in ["admin", "owner"]

    if not is_self and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Non-admins can't change role
    if "role" in update_data and not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can change roles")

    # Convert bot_config to dict if present
    if "bot_config" in update_data and update_data["bot_config"]:
        update_data["bot_config"] = update_data["bot_config"]

    client = get_identity_client()

    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.patch(
                f"{client.base_url}/api/v1/users/{user_id}",
                json=update_data,
                headers={
                    "X-Session-Token": session_token,
                    "X-Organization-Id": current_user.organization_id,
                    "Content-Type": "application/json",
                },
            )
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="User not found")
            response.raise_for_status()
            result = response.json()

        return {
            "id": result.get("id"),
            "_id": result.get("id"),
            "organization_id": result.get("organization_id"),
            "name": result.get("name"),
            "email": result.get("email"),
            "user_type": result.get("user_type", "human"),
            "role": result.get("role"),
            "is_active": result.get("is_active", True),
            "is_default": result.get("is_default", False),
            "avatar_url": result.get("avatar_url"),
            "title": result.get("title"),
            "responsibilities": result.get("responsibilities"),
            "bot_config": result.get("bot_config"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update user: {str(e)}")


@router.post("/{user_id}/regenerate-api-key")
async def regenerate_api_key(
    user_id: str,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Regenerate API key for a user via Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    # Can regenerate own key or must be admin
    is_self = current_user.id == user_id
    is_admin = current_user.role in ["admin", "owner"]

    if not is_self and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    client = get_identity_client()

    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                f"{client.base_url}/api/v1/users/{user_id}/regenerate-api-key",
                headers={
                    "X-Session-Token": session_token,
                    "X-Organization-Id": current_user.organization_id,
                },
            )
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="User not found")
            response.raise_for_status()
            return response.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to regenerate API key: {str(e)}")


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
):
    """Delete a user via Identity (also removes their personal queues from Manage)."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    # Verify permission
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can delete users")

    # Cannot delete yourself
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    client = get_identity_client()
    db = get_database()

    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.delete(
                f"{client.base_url}/api/v1/users/{user_id}",
                headers={
                    "X-Session-Token": session_token,
                    "X-Organization-Id": current_user.organization_id,
                },
            )
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="User not found")
            if response.status_code == 400:
                detail = response.json().get("detail", "Cannot delete user")
                raise HTTPException(status_code=400, detail=detail)
            response.raise_for_status()

        # Delete user's personal queues from Manage's database
        await db.queues.delete_many({
            "scope_type": "user",
            "scope_id": user_id,
            "organization_id": current_user.organization_id
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")
