from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from .base import MongoModel, PyObjectId


class CustomerContact(MongoModel):
    """Standalone customer contact record (separate collection)."""

    customer_id: PyObjectId
    name: str
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_primary: bool = False
    department: Optional[str] = None
    notes: Optional[str] = None
