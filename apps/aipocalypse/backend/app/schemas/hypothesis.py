from typing import Optional
from pydantic import BaseModel, Field

class HypothesisCreate(BaseModel):
    title: str
    description: str
    thesis_type: str = "disruption"
    affected_industry_ids: list[str] = Field(default_factory=list)
    affected_company_type_ids: list[str] = Field(default_factory=list)
    impact_direction: str = "negative"
    confidence_level: int = 50
    tags: list[str] = Field(default_factory=list)
    supporting_evidence: list[str] = Field(default_factory=list)
    counter_arguments: list[str] = Field(default_factory=list)

class HypothesisUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    thesis_type: Optional[str] = None
    affected_industry_ids: Optional[list[str]] = None
    affected_company_type_ids: Optional[list[str]] = None
    impact_direction: Optional[str] = None
    confidence_level: Optional[int] = None
    tags: Optional[list[str]] = None
    status: Optional[str] = None
    supporting_evidence: Optional[list[str]] = None
    counter_arguments: Optional[list[str]] = None

class HypothesisResponse(BaseModel):
    id: str
    title: str
    description: str
    thesis_type: str
    affected_industry_ids: list[str]
    affected_company_type_ids: list[str]
    impact_direction: str
    confidence_level: int
    tags: list[str]
    status: str
    supporting_evidence: list[str]
    counter_arguments: list[str]
    created_at: str
    updated_at: str
