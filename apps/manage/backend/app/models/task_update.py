from typing import Optional
from pydantic import BaseModel

from app.models.base import MongoModel, PyObjectId


class TaskProgressUpdate(MongoModel):
    """Task progress update - status posts during task execution."""
    task_id: PyObjectId
    user_id: PyObjectId
    content: str
    progress_percent: Optional[int] = None  # 0-100


class TaskProgressUpdateCreate(BaseModel):
    """Schema for creating a task progress update."""
    content: str
    progress_percent: Optional[int] = None
