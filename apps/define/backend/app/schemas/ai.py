from pydantic import BaseModel
from typing import Optional, List


class FileContent(BaseModel):
    name: str
    type: str
    content: str  # base64 for images/PDFs, text for text files


class ExistingRequirement(BaseModel):
    id: str
    stable_key: str
    title: str
    parent_id: Optional[str] = None


class ParseRequirementsRequest(BaseModel):
    description: str
    files: Optional[List[FileContent]] = None
    existing_requirements: List[ExistingRequirement]
    target_parent_id: Optional[str] = None
    product_name: str


class ParsedRequirement(BaseModel):
    temp_id: str
    title: str
    what_this_does: Optional[str] = None
    why_this_exists: Optional[str] = None
    not_included: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    priority: str = "medium"
    tags: List[str] = []
    parent_ref: Optional[str] = None
