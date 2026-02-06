"""Role-Based Access Control service."""

import logging
from typing import Optional, List, Dict, Any

from bson import ObjectId

from app.database import get_database
from app.models.rbac import (
    Role,
    UserRole,
    ALL_PERMISSIONS,
    DEFAULT_ROLES,
    SYSTEM_PERMISSIONS,
)
from app.models.base import utc_now

logger = logging.getLogger(__name__)


# ============================================================================
# Role Management
# ============================================================================


async def ensure_default_roles() -> None:
    """Create default system roles if they don't exist."""
    db = get_database()

    for role_data in DEFAULT_ROLES:
        existing = await db.roles.find_one({"name": role_data["name"], "is_system_role": True})
        if not existing:
            role = Role(
                name=role_data["name"],
                description=role_data["description"],
                permissions=role_data["permissions"],
                is_system_role=True,
            )
            await db.roles.insert_one(role.model_dump_mongo())
            logger.info("Created default role: %s", role_data["name"])


async def get_role(role_id: str) -> Optional[Dict[str, Any]]:
    """Get a role by ID."""
    db = get_database()
    return await db.roles.find_one({"_id": ObjectId(role_id)})


async def get_role_by_name(name: str) -> Optional[Dict[str, Any]]:
    """Get a role by name."""
    db = get_database()
    return await db.roles.find_one({"name": name})


async def list_roles(is_active: Optional[bool] = None) -> List[Dict[str, Any]]:
    """List all roles."""
    db = get_database()
    query: Dict[str, Any] = {}
    if is_active is not None:
        query["is_active"] = is_active
    return await db.roles.find(query).sort("name", 1).to_list(100)


async def create_role(
    name: str,
    description: Optional[str] = None,
    permissions: Optional[List[str]] = None,
) -> Role:
    """Create a new custom role."""
    db = get_database()

    # Check for duplicate name
    existing = await db.roles.find_one({"name": name})
    if existing:
        raise ValueError(f"Role with name '{name}' already exists")

    # Validate permissions
    if permissions:
        invalid = [p for p in permissions if p not in ALL_PERMISSIONS]
        if invalid:
            raise ValueError(f"Invalid permissions: {', '.join(invalid)}")

    role = Role(
        name=name,
        description=description,
        permissions=permissions or [],
        is_system_role=False,
    )
    await db.roles.insert_one(role.model_dump_mongo())

    logger.info("Created role: %s with %d permissions", name, len(role.permissions))
    return role


async def update_role(
    role_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    permissions: Optional[List[str]] = None,
    is_active: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    """Update an existing role."""
    db = get_database()

    role_doc = await db.roles.find_one({"_id": ObjectId(role_id)})
    if not role_doc:
        return None

    update_data: Dict[str, Any] = {"updated_at": utc_now()}

    if name is not None:
        # Check uniqueness
        existing = await db.roles.find_one({"name": name, "_id": {"$ne": ObjectId(role_id)}})
        if existing:
            raise ValueError(f"Role with name '{name}' already exists")
        update_data["name"] = name

    if description is not None:
        update_data["description"] = description

    if permissions is not None:
        invalid = [p for p in permissions if p not in ALL_PERMISSIONS]
        if invalid:
            raise ValueError(f"Invalid permissions: {', '.join(invalid)}")
        update_data["permissions"] = permissions

    if is_active is not None:
        update_data["is_active"] = is_active

    await db.roles.update_one({"_id": ObjectId(role_id)}, {"$set": update_data})
    return await db.roles.find_one({"_id": ObjectId(role_id)})


async def delete_role(role_id: str) -> bool:
    """Delete a role (not system roles)."""
    db = get_database()

    role_doc = await db.roles.find_one({"_id": ObjectId(role_id)})
    if not role_doc:
        return False

    if role_doc.get("is_system_role"):
        raise ValueError("Cannot delete system roles")

    # Remove all user assignments for this role
    await db.user_roles.delete_many({"role_id": ObjectId(role_id)})

    # Delete the role
    result = await db.roles.delete_one({"_id": ObjectId(role_id)})
    return result.deleted_count > 0


# ============================================================================
# User Role Assignment
# ============================================================================


async def assign_role(
    user_id: str,
    role_id: str,
    assigned_by: Optional[str] = None,
) -> UserRole:
    """Assign a role to a user."""
    db = get_database()

    # Validate role exists
    role_doc = await db.roles.find_one({"_id": ObjectId(role_id)})
    if not role_doc:
        raise ValueError("Role not found")

    # Check if already assigned
    existing = await db.user_roles.find_one({
        "user_id": user_id,
        "role_id": ObjectId(role_id),
    })
    if existing:
        raise ValueError("Role already assigned to this user")

    user_role = UserRole(
        user_id=user_id,
        role_id=ObjectId(role_id),
        assigned_by=assigned_by,
    )
    await db.user_roles.insert_one(user_role.model_dump_mongo())

    logger.info("Assigned role %s to user %s", role_doc.get("name"), user_id)
    return user_role


async def remove_role(user_id: str, role_id: str) -> bool:
    """Remove a role from a user."""
    db = get_database()

    result = await db.user_roles.delete_one({
        "user_id": user_id,
        "role_id": ObjectId(role_id),
    })

    if result.deleted_count > 0:
        logger.info("Removed role %s from user %s", role_id, user_id)
        return True
    return False


# ============================================================================
# Permission Checking
# ============================================================================


async def get_user_roles(user_id: str) -> List[Dict[str, Any]]:
    """Get all roles assigned to a user, with role details."""
    db = get_database()

    user_roles = await db.user_roles.find({"user_id": user_id}).to_list(50)

    result = []
    for ur in user_roles:
        role_doc = await db.roles.find_one({"_id": ur["role_id"]})
        if role_doc:
            result.append({
                "assignment_id": str(ur["_id"]),
                "user_id": ur["user_id"],
                "role_id": str(ur["role_id"]),
                "role_name": role_doc.get("name"),
                "role_description": role_doc.get("description"),
                "permissions": role_doc.get("permissions", []),
                "is_system_role": role_doc.get("is_system_role", False),
                "assigned_by": ur.get("assigned_by"),
                "assigned_at": ur.get("assigned_at"),
            })

    return result


async def get_user_permissions(user_id: str) -> List[str]:
    """Get all permissions for a user (combined from all assigned roles)."""
    db = get_database()

    user_roles = await db.user_roles.find({"user_id": user_id}).to_list(50)
    role_ids = [ur["role_id"] for ur in user_roles]

    if not role_ids:
        return []

    roles = await db.roles.find({"_id": {"$in": role_ids}, "is_active": True}).to_list(50)

    # Combine all permissions (deduplicated)
    permissions = set()
    for role in roles:
        permissions.update(role.get("permissions", []))

    return sorted(list(permissions))


async def check_permission(user_id: str, permission: str) -> bool:
    """Check if a user has a specific permission."""
    permissions = await get_user_permissions(user_id)
    return permission in permissions


async def check_permissions(user_id: str, required_permissions: List[str]) -> Dict[str, bool]:
    """Check multiple permissions at once."""
    user_permissions = await get_user_permissions(user_id)
    return {p: p in user_permissions for p in required_permissions}


# ============================================================================
# User Listing (for role assignment UI)
# ============================================================================


async def get_users_with_roles() -> List[Dict[str, Any]]:
    """Get all user role assignments with role details."""
    db = get_database()

    # Get all user role assignments
    user_roles = await db.user_roles.find({}).to_list(1000)

    # Group by user
    user_map: Dict[str, Dict[str, Any]] = {}
    for ur in user_roles:
        uid = ur["user_id"]
        if uid not in user_map:
            user_map[uid] = {
                "user_id": uid,
                "roles": [],
            }

        role_doc = await db.roles.find_one({"_id": ur["role_id"]})
        if role_doc:
            user_map[uid]["roles"].append({
                "assignment_id": str(ur["_id"]),
                "role_id": str(ur["role_id"]),
                "role_name": role_doc.get("name"),
                "assigned_by": ur.get("assigned_by"),
                "assigned_at": ur.get("assigned_at"),
            })

    return list(user_map.values())
