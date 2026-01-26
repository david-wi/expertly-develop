from pydantic import BaseModel
from typing import Optional, List


class RequirementCreate(BaseModel):
    product_id: str
    parent_id: Optional[str] = None
    title: str
    what_this_does: Optional[str] = None
    why_this_exists: Optional[str] = None
    not_included: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    status: str = "draft"
    priority: str = "medium"
    tags: Optional[List[str]] = None


class RequirementUpdate(BaseModel):
    title: Optional[str] = None
    what_this_does: Optional[str] = None
    why_this_exists: Optional[str] = None
    not_included: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None
    parent_id: Optional[str] = None
    order_index: Optional[int] = None


class RequirementResponse(BaseModel):
    id: str
    product_id: str
    parent_id: Optional[str] = None
    stable_key: str
    title: str
    what_this_does: Optional[str] = None
    why_this_exists: Optional[str] = None
    not_included: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    status: str
    priority: str
    tags: Optional[str] = None  # JSON string
    order_index: int
    current_version: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class RequirementBatchItem(BaseModel):
    temp_id: str
    title: str
    what_this_does: Optional[str] = None
    why_this_exists: Optional[str] = None
    not_included: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    priority: str = "medium"
    tags: Optional[List[str]] = None
    parent_ref: Optional[str] = None  # Either existing ID or temp_id


class RequirementBatchCreate(BaseModel):
    product_id: str
    requirements: List[RequirementBatchItem]
