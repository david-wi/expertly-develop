from pydantic import BaseModel
from typing import Optional, List


class JiraSettingsCreate(BaseModel):
    jira_host: str
    jira_email: str
    jira_api_token: str
    default_project_key: str


class JiraSettingsUpdate(BaseModel):
    jira_host: Optional[str] = None
    jira_email: Optional[str] = None
    jira_api_token: Optional[str] = None
    default_project_key: Optional[str] = None


class JiraSettingsResponse(BaseModel):
    id: str
    product_id: str
    jira_host: str
    jira_email: str
    default_project_key: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class JiraStoryDraftCreate(BaseModel):
    product_id: str
    requirement_id: Optional[str] = None
    summary: str
    description: Optional[str] = None
    issue_type: str = "Story"
    priority: str = "Medium"
    labels: Optional[List[str]] = None
    story_points: Optional[int] = None


class JiraStoryDraftUpdate(BaseModel):
    summary: Optional[str] = None
    description: Optional[str] = None
    issue_type: Optional[str] = None
    priority: Optional[str] = None
    labels: Optional[List[str]] = None
    story_points: Optional[int] = None


class JiraStoryDraftResponse(BaseModel):
    id: str
    product_id: str
    requirement_id: Optional[str] = None
    summary: str
    description: Optional[str] = None
    issue_type: str
    priority: str
    labels: Optional[str] = None  # JSON string
    story_points: Optional[int] = None
    status: str
    jira_issue_key: Optional[str] = None
    jira_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class JiraSendRequest(BaseModel):
    draft_id: str


class JiraSendAllRequest(BaseModel):
    product_id: str
    draft_ids: List[str]
