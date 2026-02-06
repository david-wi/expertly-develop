from typing import Optional
from .base import MongoModel

class AppSettings(MongoModel):
    anthropic_api_key: str = ""
    sec_edgar_user_agent: str = ""
    queue_batch_size: int = 5
    default_model: str = "claude-sonnet-4-20250514"
