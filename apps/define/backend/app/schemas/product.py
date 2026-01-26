from pydantic import BaseModel
from typing import Optional


class ProductCreate(BaseModel):
    name: str
    prefix: Optional[str] = None
    description: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    prefix: Optional[str] = None
    description: Optional[str] = None


class ProductResponse(BaseModel):
    id: str
    name: str
    prefix: str
    description: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ProductWithCount(ProductResponse):
    requirement_count: int = 0
