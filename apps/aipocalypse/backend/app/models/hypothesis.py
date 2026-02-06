from typing import Optional
from pydantic import Field
from .base import MongoModel, PyObjectId

class Hypothesis(MongoModel):
    title: str
    description: str
    thesis_type: str = "disruption"  # disruption, secular_trend, macro, regulatory
    affected_industry_ids: list[str] = Field(default_factory=list)
    affected_company_type_ids: list[str] = Field(default_factory=list)
    impact_direction: str = "negative"  # positive, negative, mixed
    confidence_level: int = 50  # 0-100
    tags: list[str] = Field(default_factory=list)
    status: str = "active"  # active, archived
    supporting_evidence: list[str] = Field(default_factory=list)
    counter_arguments: list[str] = Field(default_factory=list)
