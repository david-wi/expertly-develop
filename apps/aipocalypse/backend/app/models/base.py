from datetime import datetime, timezone
from typing import Annotated, Any
from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    @classmethod
    def validate(cls, v: Any, handler) -> ObjectId:
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str):
            if ObjectId.is_valid(v):
                return ObjectId(v)
        raise ValueError("Invalid ObjectId")
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema
        return core_schema.no_info_plain_validator_function(
            cls._validate,
            serialization=core_schema.to_string_ser_schema(),
        )
    @classmethod
    def _validate(cls, v: Any) -> ObjectId:
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str) and ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError("Invalid ObjectId")

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class MongoModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str},
    )
    id: Annotated[PyObjectId, Field(alias="_id", default_factory=PyObjectId)]
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    def model_dump_mongo(self, **kwargs) -> dict:
        data = self.model_dump(by_alias=True, **kwargs)
        return data
    def mark_updated(self) -> None:
        self.updated_at = utc_now()
