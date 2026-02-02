"""SQLAlchemy models for Expertly Today.

Note: User and Tenant data now comes from Identity service.
tenant_id and user_id columns store Identity UUIDs directly.
"""

from app.models.base import Base, TimestampMixin
from app.models.project import Project
from app.models.task import Task
from app.models.question import Question, QuestionUnblock
from app.models.person import Person, TaskPerson
from app.models.client import Client
from app.models.draft import Draft
from app.models.playbook import Playbook
from app.models.knowledge import Knowledge
from app.models.recurring_task import RecurringTask
from app.models.waiting_item import WaitingItem
from app.models.sales_opportunity import SalesOpportunity
from app.models.log import Log

__all__ = [
    "Base",
    "TimestampMixin",
    "Project",
    "Task",
    "Question",
    "QuestionUnblock",
    "Person",
    "TaskPerson",
    "Client",
    "Draft",
    "Playbook",
    "Knowledge",
    "RecurringTask",
    "WaitingItem",
    "SalesOpportunity",
    "Log",
]
