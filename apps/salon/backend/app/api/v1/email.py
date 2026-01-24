"""Email OAuth API endpoints."""

import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional

from ...core.database import get_collection
from ...core.security import get_current_user
from ...services.email_service import (
    get_google_auth_url,
    get_microsoft_auth_url,
    exchange_google_code,
    exchange_microsoft_code,
    EmailService,
    render_email_template,
)

router = APIRouter()


class EmailConfigResponse(BaseModel):
    connected: bool
    provider: Optional[str] = None
    email: Optional[str] = None
    connected_at: Optional[datetime] = None


class SendTestEmailRequest(BaseModel):
    to: str
    template: str = "appointment_confirmation"


# Store OAuth states temporarily (in production, use Redis or similar)
oauth_states: dict[str, dict] = {}


@router.get("/status", response_model=EmailConfigResponse)
async def get_email_status(current_user: dict = Depends(get_current_user)):
    """Get email OAuth connection status."""
    config_collection = get_collection("oauth_configs")
    config = await config_collection.find_one({
        "salon_id": current_user["salon_id"],
        "type": "email_oauth",
    })

    if not config:
        return EmailConfigResponse(connected=False)

    return EmailConfigResponse(
        connected=True,
        provider=config.get("provider"),
        email=config.get("email"),
        connected_at=config.get("connected_at"),
    )


@router.post("/connect/google")
async def initiate_google_oauth(current_user: dict = Depends(get_current_user)):
    """Initiate Google OAuth flow for Gmail."""
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "salon_id": current_user["salon_id"],
        "provider": "google",
        "created_at": datetime.now(timezone.utc),
    }

    auth_url = get_google_auth_url(state)
    return {"url": auth_url}


@router.post("/connect/microsoft")
async def initiate_microsoft_oauth(current_user: dict = Depends(get_current_user)):
    """Initiate Microsoft OAuth flow for Outlook."""
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "salon_id": current_user["salon_id"],
        "provider": "microsoft",
        "created_at": datetime.now(timezone.utc),
    }

    auth_url = get_microsoft_auth_url(state)
    return {"url": auth_url}


@router.get("/callback/google")
async def google_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
):
    """Handle Google OAuth callback."""
    state_data = oauth_states.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    try:
        token_data = await exchange_google_code(code)
        token_data["connected_at"] = datetime.now(timezone.utc)

        config_collection = get_collection("oauth_configs")
        await config_collection.update_one(
            {"salon_id": state_data["salon_id"], "type": "email_oauth"},
            {"$set": {**token_data, "salon_id": state_data["salon_id"], "type": "email_oauth"}},
            upsert=True,
        )

        # Redirect to settings page with success message
        return RedirectResponse(url="/settings?tab=notifications&email_connected=true")
    except Exception as e:
        return RedirectResponse(url=f"/settings?tab=notifications&email_error={str(e)}")


@router.get("/callback/microsoft")
async def microsoft_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
):
    """Handle Microsoft OAuth callback."""
    state_data = oauth_states.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    try:
        token_data = await exchange_microsoft_code(code)
        token_data["connected_at"] = datetime.now(timezone.utc)

        config_collection = get_collection("oauth_configs")
        await config_collection.update_one(
            {"salon_id": state_data["salon_id"], "type": "email_oauth"},
            {"$set": {**token_data, "salon_id": state_data["salon_id"], "type": "email_oauth"}},
            upsert=True,
        )

        return RedirectResponse(url="/settings?tab=notifications&email_connected=true")
    except Exception as e:
        return RedirectResponse(url=f"/settings?tab=notifications&email_error={str(e)}")


@router.post("/disconnect")
async def disconnect_email(current_user: dict = Depends(get_current_user)):
    """Disconnect email OAuth."""
    config_collection = get_collection("oauth_configs")
    await config_collection.delete_one({
        "salon_id": current_user["salon_id"],
        "type": "email_oauth",
    })

    return {"message": "Email disconnected successfully"}


@router.post("/send-test")
async def send_test_email(
    request: SendTestEmailRequest,
    current_user: dict = Depends(get_current_user),
):
    """Send a test email."""
    config_collection = get_collection("oauth_configs")
    salons_collection = get_collection("salons")

    config = await config_collection.find_one({
        "salon_id": current_user["salon_id"],
        "type": "email_oauth",
    })

    if not config:
        raise HTTPException(status_code=400, detail="Email not connected")

    salon = await salons_collection.find_one({"_id": current_user["salon_id"]})
    salon_name = salon.get("name", "Your Salon") if salon else "Your Salon"

    # Render test email
    subject, html = render_email_template(
        request.template,
        salon_name=salon_name,
        client_name="Test Customer",
        service_name="Test Service",
        date="January 25, 2026",
        time="2:00 PM",
        staff_name="Test Stylist",
        discount_text="15% OFF",
        review_links="<a href='#'>Leave a Review</a>",
    )

    email_service = EmailService(config_collection)
    success = await email_service.send_email(
        salon_id=current_user["salon_id"],
        to=request.to,
        subject=subject,
        body_html=html,
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send email")

    return {"message": f"Test email sent to {request.to}"}
