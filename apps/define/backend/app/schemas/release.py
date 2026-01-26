from pydantic import BaseModel
from typing import Optional


class ReleaseSnapshotCreate(BaseModel):
    product_id: str
    version_name: str
    description: Optional[str] = None


class ReleaseSnapshotUpdate(BaseModel):
    version_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class ReleaseSnapshotResponse(BaseModel):
    id: str
    product_id: str
    version_name: str
    description: Optional[str] = None
    requirements_snapshot: str  # JSON
    stats: Optional[str] = None  # JSON
    status: str
    created_at: str
    released_at: Optional[str] = None

    class Config:
        from_attributes = True
