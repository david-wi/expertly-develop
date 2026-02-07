"""Common types and utilities used across all schemas."""

from datetime import datetime, timezone
from typing import Any, Generic, Optional, TypeVar

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field, GetCoreSchemaHandler
from pydantic_core import CoreSchema, core_schema


class PyObjectId(str):
    """Custom type for MongoDB ObjectId serialization.

    Accepts ObjectId or hex string on input, serializes as hex string.
    """

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: GetCoreSchemaHandler
    ) -> CoreSchema:
        return core_schema.no_info_plain_validator_function(
            cls.validate,
            serialization=core_schema.to_string_ser_schema(),
        )

    @classmethod
    def validate(cls, v: Any) -> str:
        if isinstance(v, ObjectId):
            return str(v)
        if isinstance(v, str):
            if not ObjectId.is_valid(v):
                raise ValueError(f"Invalid ObjectId: {v}")
            return v
        raise ValueError(f"Cannot convert {type(v)} to ObjectId string")


class TimestampMixin(BaseModel):
    """Mixin providing standard timestamp fields."""

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        alias="createdAt",
        description="Timestamp when the record was created",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        alias="updatedAt",
        description="Timestamp when the record was last updated",
    )

    model_config = ConfigDict(populate_by_name=True)


class PaginationParams(BaseModel):
    """Pagination parameters for list queries."""

    limit: int = Field(
        default=50,
        ge=1,
        le=200,
        description="Maximum number of items to return",
    )
    cursor: Optional[str] = Field(
        default=None,
        description="Opaque cursor for pagination; pass the value from the previous response",
    )

    model_config = ConfigDict(populate_by_name=True)


DataT = TypeVar("DataT")


class PaginatedResponse(BaseModel, Generic[DataT]):
    """Generic paginated response wrapper."""

    items: list[DataT] = Field(description="Page of results")
    next_cursor: Optional[str] = Field(
        default=None,
        alias="nextCursor",
        description="Cursor to fetch the next page; null when no more results",
    )
    total_count: Optional[int] = Field(
        default=None,
        alias="totalCount",
        description="Total number of items matching the query (omitted when expensive to compute)",
    )

    model_config = ConfigDict(populate_by_name=True)


class ResponseEnvelope(BaseModel, Generic[DataT]):
    """Standard API response envelope."""

    success: bool = Field(default=True, description="Whether the request succeeded")
    data: Optional[DataT] = Field(default=None, description="Response payload")
    message: Optional[str] = Field(
        default=None,
        description="Human-readable message (usually present on errors)",
    )
    errors: Optional[list[dict[str, Any]]] = Field(
        default=None,
        description="List of error details when success is false",
    )

    model_config = ConfigDict(populate_by_name=True)


class ErrorDetail(BaseModel):
    """Structured error detail for response envelopes."""

    field: Optional[str] = Field(default=None, description="Field that caused the error")
    code: str = Field(description="Machine-readable error code")
    message: str = Field(description="Human-readable error description")

    model_config = ConfigDict(populate_by_name=True)
