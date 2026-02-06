from enum import Enum
from typing import List, Optional, Union

from pydantic import BaseModel

from .base import MongoModel


class DeskType(str, Enum):
    """Types of desks for organizing work."""
    LANE = "lane"
    MODE = "mode"
    CUSTOMER = "customer"
    GENERAL = "general"


class RoutingRule(BaseModel):
    """A single routing rule for matching work items to a desk."""
    field: str  # "origin_state", "equipment_type", "customer_id", "work_type"
    operator: str  # "equals", "in", "contains", "regex"
    value: Union[str, List[str]]


class CoverageSchedule(BaseModel):
    """Coverage schedule entry for a desk."""
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str  # "08:00"
    end_time: str  # "17:00"
    timezone: str = "America/New_York"


class Desk(MongoModel):
    """A desk represents a team or functional area that handles specific work items."""

    name: str  # e.g., "East Coast", "Flatbed", "LTL", "High Value"
    description: str = ""
    desk_type: DeskType = DeskType.GENERAL
    is_active: bool = True

    # Routing rules - work items matching these criteria auto-route here
    routing_rules: List[RoutingRule] = []

    # Coverage schedule
    coverage: List[CoverageSchedule] = []

    # Assigned team members
    members: List[str] = []  # user IDs

    # Priority (higher = checked first during routing)
    priority: int = 0
