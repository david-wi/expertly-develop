"""Preconfigured scenario model for walkthrough templates."""

from datetime import datetime, timezone
from typing import List, Optional
from pydantic import Field

from app.models.base import MongoModel, TimestampMixin, PyObjectId


class PreconfiguredScenario(MongoModel, TimestampMixin):
    """Preconfigured scenario template."""

    organization_id: Optional[str] = None  # null = system-wide, otherwise Identity org UUID

    code: str  # unique identifier
    name: str
    description: Optional[str] = None
    scenario_template: str  # The actual scenario text template
    default_observations: List[str] = Field(default_factory=list)
    is_system: bool = True

    class Config:
        json_schema_extra = {
            "example": {
                "code": "basic_visual_walkthrough",
                "name": "Basic Visual Walkthrough",
                "description": "Explores main pages and captures screenshots",
                "scenario_template": "Navigate to homepage\nClick main navigation items\nCapture key screens",
                "default_observations": [
                    "Note any errors",
                    "Check responsiveness",
                ],
                "is_system": True,
            }
        }
