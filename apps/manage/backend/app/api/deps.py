"""Common API dependencies."""
from app.utils.auth import get_current_user, get_current_user_org_id

__all__ = ["get_current_user", "get_current_user_org_id"]
