from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import Project, ProjectCreate, ProjectUpdate, ProjectStatus, User
from app.api.deps import get_current_user

router = APIRouter()


def serialize_project(project: dict) -> dict:
    """Convert ObjectIds to strings in project document."""
    result = {**project, "_id": str(project["_id"]), "id": str(project["_id"])}
    for field in ["organization_id", "parent_project_id", "owner_user_id", "team_id"]:
        if project.get(field):
            result[field] = str(project[field])
    return result


@router.get("")
async def list_projects(
    status: str | None = None,
    parent_project_id: str | None = None,
    top_level_only: bool = False,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List projects in the current organization."""
    db = get_database()

    query = {"organization_id": current_user.organization_id}

    if status:
        query["status"] = status

    if parent_project_id:
        if not ObjectId.is_valid(parent_project_id):
            raise HTTPException(status_code=400, detail="Invalid parent project ID")
        query["parent_project_id"] = ObjectId(parent_project_id)
    elif top_level_only:
        query["parent_project_id"] = None

    cursor = db.projects.find(query).sort("created_at", -1)
    projects = await cursor.to_list(100)

    return [serialize_project(p) for p in projects]


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific project."""
    db = get_database()

    if not ObjectId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({
        "_id": ObjectId(project_id),
        "organization_id": current_user.organization_id
    })

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return serialize_project(project)


@router.get("/{project_id}/children")
async def get_project_children(
    project_id: str,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Get child projects of a project."""
    db = get_database()

    if not ObjectId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")

    cursor = db.projects.find({
        "organization_id": current_user.organization_id,
        "parent_project_id": ObjectId(project_id)
    })
    projects = await cursor.to_list(100)

    return [serialize_project(p) for p in projects]


@router.get("/{project_id}/recurring-tasks")
async def get_project_recurring_tasks(
    project_id: str,
    is_active: bool | None = None,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Get recurring tasks associated with a project."""
    db = get_database()

    if not ObjectId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")

    # Verify project exists and user has access
    project = await db.projects.find_one({
        "_id": ObjectId(project_id),
        "organization_id": current_user.organization_id
    })
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = {
        "organization_id": current_user.organization_id,
        "project_id": ObjectId(project_id)
    }

    if is_active is not None:
        query["is_active"] = is_active

    cursor = db.recurring_tasks.find(query).sort("created_at", -1)
    tasks = await cursor.to_list(100)

    # Serialize recurring tasks
    result = []
    for task in tasks:
        serialized = {
            **task,
            "_id": str(task["_id"]),
            "organization_id": str(task["organization_id"]),
            "queue_id": str(task["queue_id"]),
            "project_id": str(task["project_id"]) if task.get("project_id") else None,
        }
        result.append(serialized)

    return result


@router.get("/{project_id}/tasks")
async def get_project_tasks(
    project_id: str,
    status: str | None = None,
    include_subtasks: bool = False,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Get tasks associated with a project."""
    db = get_database()

    if not ObjectId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")

    query = {
        "organization_id": current_user.organization_id,
        "project_id": ObjectId(project_id)
    }

    if status:
        query["status"] = status

    if not include_subtasks:
        query["parent_task_id"] = None

    cursor = db.tasks.find(query).sort([("priority", 1), ("created_at", 1)])
    tasks = await cursor.to_list(1000)

    # Serialize tasks
    result = []
    for task in tasks:
        serialized = {**task, "_id": str(task["_id"])}
        for field in ["organization_id", "queue_id", "assigned_to_id", "checked_out_by_id",
                      "parent_task_id", "project_id", "sop_id"]:
            if task.get(field):
                serialized[field] = str(task[field])
        result.append(serialized)

    return result


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new project."""
    db = get_database()

    project = Project(
        organization_id=current_user.organization_id,
        name=data.name,
        description=data.description,
        parent_project_id=ObjectId(data.parent_project_id) if data.parent_project_id else None,
        owner_user_id=ObjectId(data.owner_user_id) if data.owner_user_id else current_user.id,
        team_id=ObjectId(data.team_id) if data.team_id else None
    )

    # Verify parent project exists
    if project.parent_project_id:
        parent = await db.projects.find_one({
            "_id": project.parent_project_id,
            "organization_id": current_user.organization_id
        })
        if not parent:
            raise HTTPException(status_code=404, detail="Parent project not found")

    await db.projects.insert_one(project.model_dump_mongo())

    return serialize_project(project.model_dump_mongo())


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update a project."""
    db = get_database()

    if not ObjectId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Convert IDs
    for field in ["parent_project_id", "owner_user_id", "team_id"]:
        if field in update_data and update_data[field]:
            update_data[field] = ObjectId(update_data[field])

    # Prevent circular parent reference
    if "parent_project_id" in update_data:
        if str(update_data["parent_project_id"]) == project_id:
            raise HTTPException(status_code=400, detail="Project cannot be its own parent")

    result = await db.projects.find_one_and_update(
        {"_id": ObjectId(project_id), "organization_id": current_user.organization_id},
        {"$set": update_data},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Project not found")

    return serialize_project(result)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a project."""
    db = get_database()

    if not ObjectId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID")

    # Check for child projects
    child_count = await db.projects.count_documents({
        "parent_project_id": ObjectId(project_id),
        "organization_id": current_user.organization_id
    })
    if child_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Project has {child_count} child projects. Delete them first."
        )

    # Check for tasks
    task_count = await db.tasks.count_documents({
        "project_id": ObjectId(project_id),
        "organization_id": current_user.organization_id
    })
    if task_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Project has {task_count} tasks. Move or delete them first."
        )

    result = await db.projects.delete_one({
        "_id": ObjectId(project_id),
        "organization_id": current_user.organization_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
