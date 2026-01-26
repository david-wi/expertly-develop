from pydantic import BaseModel


class AttachmentResponse(BaseModel):
    id: str
    requirement_id: str
    filename: str
    original_filename: str
    mime_type: str
    size_bytes: int
    storage_path: str
    created_at: str

    class Config:
        from_attributes = True
