"""Document schemas for API requests/responses."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class DocumentMetadataInput(BaseModel):
    """Input schema for document metadata."""

    project_id: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []


class DocumentResponse(BaseModel):
    """Schema for document response."""

    id: str
    document_key: str
    version: int
    is_current: bool
    name: str
    content_type: str
    file_size: int
    metadata: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentVersionsResponse(BaseModel):
    """Schema for document versions response."""

    document_key: str
    versions: List[DocumentResponse]
    total: int
