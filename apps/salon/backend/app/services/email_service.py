"""Email service with OAuth support for Gmail and Outlook."""

import os
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime, timezone
import httpx

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# OAuth configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/v1/email/callback/google")

MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")
MICROSOFT_REDIRECT_URI = os.getenv("MICROSOFT_REDIRECT_URI", "http://localhost:8000/api/v1/email/callback/microsoft")
MICROSOFT_TENANT_ID = os.getenv("MICROSOFT_TENANT_ID", "common")

# OAuth scopes
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
]

MICROSOFT_SCOPES = [
    "https://graph.microsoft.com/Mail.Send",
    "https://graph.microsoft.com/Mail.ReadBasic",
    "https://graph.microsoft.com/User.Read",
    "offline_access",
]


def get_google_auth_url(state: str) -> str:
    """Generate Google OAuth authorization URL."""
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"


def get_microsoft_auth_url(state: str) -> str:
    """Generate Microsoft OAuth authorization URL."""
    params = {
        "client_id": MICROSOFT_CLIENT_ID,
        "redirect_uri": MICROSOFT_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(MICROSOFT_SCOPES),
        "state": state,
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize?{query}"


async def exchange_google_code(code: str) -> dict:
    """Exchange Google authorization code for tokens."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        response.raise_for_status()
        tokens = response.json()

        # Get user email
        user_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        user_response.raise_for_status()
        user_info = user_response.json()

        return {
            "provider": "google",
            "email": user_info.get("email"),
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token"),
            "expires_at": datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600),
        }


async def exchange_microsoft_code(code: str) -> dict:
    """Exchange Microsoft authorization code for tokens."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/oauth2/v2.0/token",
            data={
                "client_id": MICROSOFT_CLIENT_ID,
                "client_secret": MICROSOFT_CLIENT_SECRET,
                "code": code,
                "redirect_uri": MICROSOFT_REDIRECT_URI,
                "grant_type": "authorization_code",
                "scope": " ".join(MICROSOFT_SCOPES),
            },
        )
        response.raise_for_status()
        tokens = response.json()

        # Get user email
        user_response = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        user_response.raise_for_status()
        user_info = user_response.json()

        return {
            "provider": "microsoft",
            "email": user_info.get("mail") or user_info.get("userPrincipalName"),
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token"),
            "expires_at": datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600),
        }


async def refresh_google_token(refresh_token: str) -> dict:
    """Refresh Google access token."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        response.raise_for_status()
        tokens = response.json()

        return {
            "access_token": tokens["access_token"],
            "expires_at": datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600),
        }


async def refresh_microsoft_token(refresh_token: str) -> dict:
    """Refresh Microsoft access token."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/oauth2/v2.0/token",
            data={
                "client_id": MICROSOFT_CLIENT_ID,
                "client_secret": MICROSOFT_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
                "scope": " ".join(MICROSOFT_SCOPES),
            },
        )
        response.raise_for_status()
        tokens = response.json()

        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token", refresh_token),
            "expires_at": datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600),
        }


async def send_email_google(
    access_token: str,
    to: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
) -> bool:
    """Send email using Gmail API."""
    try:
        message = MIMEMultipart("alternative")
        message["to"] = to
        message["subject"] = subject

        if body_text:
            message.attach(MIMEText(body_text, "plain"))
        message.attach(MIMEText(body_html, "html"))

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                headers={"Authorization": f"Bearer {access_token}"},
                json={"raw": raw},
            )
            response.raise_for_status()
            return True
    except Exception as e:
        print(f"Failed to send email via Gmail: {e}")
        return False


async def send_email_microsoft(
    access_token: str,
    to: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
) -> bool:
    """Send email using Microsoft Graph API."""
    try:
        message_payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": body_html,
                },
                "toRecipients": [
                    {"emailAddress": {"address": to}}
                ],
            },
            "saveToSentItems": True,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://graph.microsoft.com/v1.0/me/sendMail",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=message_payload,
            )
            response.raise_for_status()
            return True
    except Exception as e:
        print(f"Failed to send email via Microsoft: {e}")
        return False


class EmailService:
    """High-level email service that handles token refresh and sending."""

    def __init__(self, db_collection):
        self.collection = db_collection

    async def get_email_config(self, salon_id: str) -> Optional[dict]:
        """Get email OAuth config for a salon."""
        return await self.collection.find_one({"salon_id": salon_id, "type": "email_oauth"})

    async def save_email_config(self, salon_id: str, config: dict) -> None:
        """Save email OAuth config for a salon."""
        await self.collection.update_one(
            {"salon_id": salon_id, "type": "email_oauth"},
            {"$set": {**config, "salon_id": salon_id, "type": "email_oauth", "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )

    async def send_email(
        self,
        salon_id: str,
        to: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
    ) -> bool:
        """Send email using configured OAuth provider."""
        config = await self.get_email_config(salon_id)
        if not config:
            print(f"No email OAuth config found for salon {salon_id}")
            return False

        provider = config.get("provider")
        access_token = config.get("access_token")
        refresh_token = config.get("refresh_token")
        expires_at = config.get("expires_at", 0)

        # Check if token needs refresh
        if datetime.now(timezone.utc).timestamp() > expires_at - 300:  # 5 min buffer
            try:
                if provider == "google":
                    new_tokens = await refresh_google_token(refresh_token)
                elif provider == "microsoft":
                    new_tokens = await refresh_microsoft_token(refresh_token)
                else:
                    print(f"Unknown provider: {provider}")
                    return False

                access_token = new_tokens["access_token"]
                config["access_token"] = access_token
                config["expires_at"] = new_tokens["expires_at"]
                if "refresh_token" in new_tokens:
                    config["refresh_token"] = new_tokens["refresh_token"]
                await self.save_email_config(salon_id, config)
            except Exception as e:
                print(f"Failed to refresh token: {e}")
                return False

        # Send email
        if provider == "google":
            return await send_email_google(access_token, to, subject, body_html, body_text)
        elif provider == "microsoft":
            return await send_email_microsoft(access_token, to, subject, body_html, body_text)
        else:
            print(f"Unknown provider: {provider}")
            return False


# Email templates
EMAIL_TEMPLATES = {
    "appointment_confirmation": {
        "subject": "Appointment Confirmed - {salon_name}",
        "html": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #D4A5A5;">Appointment Confirmed</h2>
            <p>Hi {client_name},</p>
            <p>Your appointment has been confirmed!</p>
            <div style="background: #FAF7F5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Service:</strong> {service_name}</p>
                <p><strong>Date:</strong> {date}</p>
                <p><strong>Time:</strong> {time}</p>
                <p><strong>Stylist:</strong> {staff_name}</p>
            </div>
            <p>We look forward to seeing you!</p>
            <p>Best regards,<br>{salon_name}</p>
        </div>
        """,
    },
    "appointment_reminder": {
        "subject": "Reminder: Appointment Tomorrow - {salon_name}",
        "html": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #D4A5A5;">Appointment Reminder</h2>
            <p>Hi {client_name},</p>
            <p>This is a friendly reminder about your upcoming appointment.</p>
            <div style="background: #FAF7F5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Service:</strong> {service_name}</p>
                <p><strong>Date:</strong> {date}</p>
                <p><strong>Time:</strong> {time}</p>
                <p><strong>Stylist:</strong> {staff_name}</p>
            </div>
            <p>If you need to reschedule, please contact us as soon as possible.</p>
            <p>See you soon!<br>{salon_name}</p>
        </div>
        """,
    },
    "review_request": {
        "subject": "How was your visit? - {salon_name}",
        "html": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #D4A5A5;">Thank You for Visiting!</h2>
            <p>Hi {client_name},</p>
            <p>We hope you enjoyed your recent visit to {salon_name}.</p>
            <p>Your feedback means the world to us! Would you mind taking a moment to leave us a review?</p>
            <div style="text-align: center; margin: 30px 0;">
                {review_links}
            </div>
            <p>Thank you for choosing us!</p>
            <p>Best regards,<br>{salon_name}</p>
        </div>
        """,
    },
    "birthday": {
        "subject": "Happy Birthday from {salon_name}! 🎂",
        "html": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #D4A5A5;">Happy Birthday, {client_name}! 🎂</h2>
            <p>Wishing you a wonderful birthday!</p>
            <p>As our gift to you, enjoy a special birthday discount on your next visit:</p>
            <div style="background: #D4A5A5; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="font-size: 24px; margin: 0;">{discount_text}</p>
            </div>
            <p>Book your birthday appointment today!</p>
            <p>With love,<br>{salon_name}</p>
        </div>
        """,
    },
}


def render_email_template(template_name: str, **kwargs) -> tuple[str, str]:
    """Render an email template with given variables."""
    template = EMAIL_TEMPLATES.get(template_name)
    if not template:
        raise ValueError(f"Unknown template: {template_name}")

    subject = template["subject"].format(**kwargs)
    html = template["html"].format(**kwargs)

    return subject, html
