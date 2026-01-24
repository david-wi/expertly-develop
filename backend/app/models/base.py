"""Base models and utilities for MongoDB documents."""

from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from bson import ObjectId
from pydantic import BaseModel, Field, GetCoreSchemaHandler, GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import CoreSchema, core_schema


class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic v2 compatibility."""

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: GetCoreSchemaHandler
    ) -> CoreSchema:
        return core_schema.json_or_python_schema(
            json_schema=core_schema.str_schema(),
            python_schema=core_schema.union_schema([
                core_schema.is_instance_schema(ObjectId),
                core_schema.chain_schema([
                    core_schema.str_schema(),
                    core_schema.no_info_plain_validator_function(cls.validate),
                ]),
            ]),
            serialization=core_schema.plain_serializer_function_ser_schema(str),
        )

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        return {"type": "string"}

    @classmethod
    def validate(cls, v: Any) -> ObjectId:
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str) and ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError("Invalid ObjectId")


# Type alias for optional ObjectId fields
OptionalObjectId = Annotated[Optional[PyObjectId], Field(default=None)]


class MongoModel(BaseModel):
    """Base model for MongoDB documents."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

    def to_mongo(self) -> dict:
        """Convert model to MongoDB document format."""
        data = self.model_dump(by_alias=True, exclude_none=True)
        if "_id" in data and data["_id"] is None:
            del data["_id"]
        return data

    @classmethod
    def from_mongo(cls, data: dict) -> "MongoModel":
        """Create model instance from MongoDB document."""
        if data is None:
            return None
        return cls(**data)


class TimestampMixin(BaseModel):
    """Mixin providing timestamp fields."""

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def update_timestamp(self) -> None:
        """Update the updated_at timestamp."""
        self.updated_at = datetime.now(timezone.utc)


class SoftDeleteMixin(BaseModel):
    """Mixin providing soft delete functionality."""

    deleted_at: Optional[datetime] = None

    def soft_delete(self) -> None:
        """Mark record as deleted."""
        self.deleted_at = datetime.now(timezone.utc)

    @property
    def is_deleted(self) -> bool:
        """Check if record is deleted."""
        return self.deleted_at is not None
