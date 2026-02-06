from typing import Optional
from pydantic import Field
from .base import MongoModel

class Industry(MongoModel):
    name: str
    slug: str
    parent_id: Optional[str] = None  # null for top-level sectors
    level: int = 0  # 0=sector, 1=industry, 2=sub-industry
    icon: str = "Building2"  # Lucide icon name
    description: str = ""
    sort_order: int = 0
    company_count: int = 0  # denormalized
    is_system: bool = True
