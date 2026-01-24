"""Walkthrough schemas for API requests/responses."""

from typing import List, Optional
from pydantic import BaseModel, Field


class WalkthroughCreate(BaseModel):
    """Schema for creating a walkthrough job."""

    project_id: str
    scenario_text: str = Field(..., min_length=1, max_length=10000)
    label: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    observations: Optional[List[str]] = None
    persona_id: Optional[str] = None
    preconfigured_scenario: Optional[str] = None


class WalkthroughResponse(BaseModel):
    """Schema for walkthrough job response."""

    job_id: str
    status: str
    message: str
