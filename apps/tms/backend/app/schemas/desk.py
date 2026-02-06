from datetime import datetime
from typing import List, Optional, Union

from pydantic import BaseModel

from app.models.desk import DeskType


class RoutingRuleSchema(BaseModel):
    field: str
    operator: str
    value: Union[str, List[str]]


class CoverageScheduleSchema(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str
    timezone: str = "America/New_York"


class DeskCreate(BaseModel):
    name: str
    description: str = ""
    desk_type: DeskType = DeskType.GENERAL
    is_active: bool = True
    routing_rules: List[RoutingRuleSchema] = []
    coverage: List[CoverageScheduleSchema] = []
    members: List[str] = []
    priority: int = 0


class DeskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    desk_type: Optional[DeskType] = None
    is_active: Optional[bool] = None
    routing_rules: Optional[List[RoutingRuleSchema]] = None
    coverage: Optional[List[CoverageScheduleSchema]] = None
    members: Optional[List[str]] = None
    priority: Optional[int] = None


class DeskResponse(BaseModel):
    id: str
    name: str
    description: str
    desk_type: DeskType
    is_active: bool
    routing_rules: List[RoutingRuleSchema]
    coverage: List[CoverageScheduleSchema]
    members: List[str]
    priority: int
    member_count: int = 0
    active_work_items_count: int = 0
    is_covered: bool = False
    created_at: datetime
    updated_at: datetime


class AddMemberRequest(BaseModel):
    user_id: str


class RouteWorkItemRequest(BaseModel):
    work_item_id: str
