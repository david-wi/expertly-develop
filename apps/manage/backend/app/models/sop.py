from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class SOPType(str, Enum):
    GENERAL = "general"  # Free-form instructions
    STEP_BY_STEP = "step_by_step"  # Structured steps


class SOPStep(BaseModel):
    """A single step in a step-by-step SOP."""
    order: int
    title: str
    instructions: str
    expected_output: Optional[str] = None
    validation_rules: Optional[dict] = None


class SOP(MongoModel):
    """Standard Operating Procedure - instructions for tasks."""
    organization_id: PyObjectId
    name: str
    description: Optional[str] = None
    sop_type: SOPType = SOPType.GENERAL

    # General SOP content
    content: Optional[str] = None

    # Step-by-step SOP
    steps: list[SOPStep] = Field(default_factory=list)

    # Queue matching - which queues this SOP applies to
    queue_ids: list[PyObjectId] = Field(default_factory=list)

    # Task matching - keywords/patterns to match tasks
    match_keywords: list[str] = Field(default_factory=list)

    # Versioning
    version: int = 1
    is_active: bool = True


class SOPCreate(BaseModel):
    """Schema for creating an SOP."""
    name: str
    description: Optional[str] = None
    sop_type: SOPType = SOPType.GENERAL
    content: Optional[str] = None
    steps: list[SOPStep] = Field(default_factory=list)
    queue_ids: list[str] = Field(default_factory=list)
    match_keywords: list[str] = Field(default_factory=list)


class SOPUpdate(BaseModel):
    """Schema for updating an SOP."""
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    steps: Optional[list[SOPStep]] = None
    queue_ids: Optional[list[str]] = None
    match_keywords: Optional[list[str]] = None
    is_active: Optional[bool] = None
