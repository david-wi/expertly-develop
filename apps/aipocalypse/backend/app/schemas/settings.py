from typing import Optional
from pydantic import BaseModel

class SettingsResponse(BaseModel):
    anthropic_api_key_set: bool
    sec_edgar_user_agent: str
    queue_batch_size: int
    default_model: str

class SettingsUpdate(BaseModel):
    anthropic_api_key: Optional[str] = None
    sec_edgar_user_agent: Optional[str] = None
    queue_batch_size: Optional[int] = None
    default_model: Optional[str] = None

class TestResult(BaseModel):
    success: bool
    message: str
