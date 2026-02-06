"""RBAC API endpoints for role management and user role assignment."""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.rbac import SYSTEM_PERMISSIONS, ALL_PERMISSIONS
from app.services.rbac_service import (
    ensure_default_roles,
    list_roles,
    get_role,
    create_role,
    update_role,
    delete_role,
    assign_role,
    remove_role,
    get_user_roles,
    get_user_permissions,
    check_permission,
    check_permissions,
    get_users_with_roles,
)
from app.models.base import utc_now

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================


class RoleCreateRequest(BaseModel):
    """Create a new role."""
    name: str
    description: Optional[str] = None
    permissions: List[str] = []


class RoleUpdateRequest(BaseModel):
    """Update a role."""
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class AssignRoleRequest(BaseModel):
    """Assign a role to a user."""
    user_id: str
    role_id: str
    assigned_by: Optional[str] = None


class RemoveRoleRequest(BaseModel):
    """Remove a role from a user."""
    user_id: str
    role_id: str


class CheckPermissionRequest(BaseModel):
    """Check permissions for a user."""
    user_id: str
    permissions: List[str]


class RoleResponse(BaseModel):
    """Response model for a role."""
    id: str
    name: str
    description: Optional[str] = None
    permissions: List[str]
    is_system_role: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserRoleResponse(BaseModel):
    """Response model for a user's role assignment."""
    assignment_id: str
    user_id: str
    role_id: str
    role_name: str
    role_description: Optional[str] = None
    permissions: List[str]
    is_system_role: bool
    assigned_by: Optional[str] = None
    assigned_at: Optional[datetime] = None


class PermissionGroupResponse(BaseModel):
    """Response model for permission groups."""
    resource: str
    permissions: List[str]


# ============================================================================
# Helpers
# ============================================================================


def role_doc_to_response(doc: dict) -> RoleResponse:
    """Convert a MongoDB document to a RoleResponse."""
    return RoleResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        description=doc.get("description"),
        permissions=doc.get("permissions", []),
        is_system_role=doc.get("is_system_role", False),
        is_active=doc.get("is_active", True),
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
    )


# ============================================================================
# Role CRUD
# ============================================================================


@router.get("/roles", response_model=List[RoleResponse])
async def list_roles_endpoint(is_active: Optional[bool] = None):
    """List all roles."""
    # Ensure defaults exist on first call
    await ensure_default_roles()

    roles = await list_roles(is_active=is_active)
    return [role_doc_to_response(r) for r in roles]


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role_endpoint(role_id: str):
    """Get a single role by ID."""
    role_doc = await get_role(role_id)
    if not role_doc:
        raise HTTPException(status_code=404, detail="Role not found")
    return role_doc_to_response(role_doc)


@router.post("/roles", response_model=RoleResponse)
async def create_role_endpoint(data: RoleCreateRequest):
    """Create a new custom role."""
    try:
        role = await create_role(
            name=data.name,
            description=data.description,
            permissions=data.permissions,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    doc = await get_role(str(role.id))
    return role_doc_to_response(doc)


@router.patch("/roles/{role_id}", response_model=RoleResponse)
async def update_role_endpoint(role_id: str, data: RoleUpdateRequest):
    """Update an existing role."""
    try:
        updated = await update_role(
            role_id=role_id,
            name=data.name,
            description=data.description,
            permissions=data.permissions,
            is_active=data.is_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not updated:
        raise HTTPException(status_code=404, detail="Role not found")

    return role_doc_to_response(updated)


@router.delete("/roles/{role_id}")
async def delete_role_endpoint(role_id: str):
    """Delete a role (cannot delete system roles)."""
    try:
        deleted = await delete_role(role_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not deleted:
        raise HTTPException(status_code=404, detail="Role not found")

    return {"status": "deleted", "id": role_id}


# ============================================================================
# User Role Assignment
# ============================================================================


@router.post("/assign", response_model=UserRoleResponse)
async def assign_role_endpoint(data: AssignRoleRequest):
    """Assign a role to a user."""
    try:
        user_role = await assign_role(
            user_id=data.user_id,
            role_id=data.role_id,
            assigned_by=data.assigned_by,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Get role info for response
    role_doc = await get_role(data.role_id)

    return UserRoleResponse(
        assignment_id=str(user_role.id),
        user_id=data.user_id,
        role_id=data.role_id,
        role_name=role_doc.get("name", ""),
        role_description=role_doc.get("description"),
        permissions=role_doc.get("permissions", []),
        is_system_role=role_doc.get("is_system_role", False),
        assigned_by=data.assigned_by,
        assigned_at=user_role.assigned_at,
    )


@router.post("/remove")
async def remove_role_endpoint(data: RemoveRoleRequest):
    """Remove a role from a user."""
    removed = await remove_role(data.user_id, data.role_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Role assignment not found")
    return {"status": "removed", "user_id": data.user_id, "role_id": data.role_id}


# ============================================================================
# User Permissions
# ============================================================================


@router.get("/users/{user_id}/roles", response_model=List[UserRoleResponse])
async def get_user_roles_endpoint(user_id: str):
    """Get all roles assigned to a user."""
    roles = await get_user_roles(user_id)
    return [
        UserRoleResponse(
            assignment_id=r["assignment_id"],
            user_id=r["user_id"],
            role_id=r["role_id"],
            role_name=r["role_name"],
            role_description=r.get("role_description"),
            permissions=r.get("permissions", []),
            is_system_role=r.get("is_system_role", False),
            assigned_by=r.get("assigned_by"),
            assigned_at=r.get("assigned_at"),
        )
        for r in roles
    ]


@router.get("/users/{user_id}/permissions")
async def get_user_permissions_endpoint(user_id: str):
    """Get all permissions for a user."""
    permissions = await get_user_permissions(user_id)
    return {"user_id": user_id, "permissions": permissions}


@router.post("/check-permissions")
async def check_permissions_endpoint(data: CheckPermissionRequest):
    """Check multiple permissions for a user."""
    results = await check_permissions(data.user_id, data.permissions)
    return {
        "user_id": data.user_id,
        "results": results,
        "has_all": all(results.values()),
    }


# ============================================================================
# User Listing
# ============================================================================


@router.get("/users")
async def list_users_with_roles():
    """Get all users and their role assignments."""
    return await get_users_with_roles()


# ============================================================================
# Available Permissions
# ============================================================================


@router.get("/permissions", response_model=List[PermissionGroupResponse])
async def list_permissions():
    """List all available permissions grouped by resource."""
    return [
        PermissionGroupResponse(resource=resource, permissions=perms)
        for resource, perms in SYSTEM_PERMISSIONS.items()
    ]


@router.get("/permissions/flat")
async def list_all_permissions():
    """List all available permissions as a flat list."""
    return {"permissions": ALL_PERMISSIONS}
