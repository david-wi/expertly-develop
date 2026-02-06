from typing import Optional
from pydantic import BaseModel

class IndustryCreate(BaseModel):
    name: str
    slug: str
    parent_id: Optional[str] = None
    level: int = 0
    icon: str = "Building2"
    description: str = ""
    sort_order: int = 0
    is_system: bool = False

class IndustryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    parent_id: Optional[str] = None
    level: Optional[int] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None

class IndustryResponse(BaseModel):
    id: str
    name: str
    slug: str
    parent_id: Optional[str]
    level: int
    icon: str
    description: str
    sort_order: int
    company_count: int
    is_system: bool
    created_at: str
    updated_at: str

class IndustryTreeNode(BaseModel):
    id: str
    name: str
    slug: str
    level: int
    icon: str
    description: str
    company_count: int
    children: list["IndustryTreeNode"] = []
