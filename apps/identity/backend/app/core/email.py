"""Email sending service for authentication flows."""

import logging
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import aiosmtplib

from app.config import get_settings

logger = logging.getLogger(__name__)


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
) -> bool:
    """
    Send an email via SMTP.

    Returns True if successful, False otherwise.
    Falls back to logging if SMTP is not configured.
    """
    settings = get_settings()

    # Check if SMTP is configured
    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
        # Fall back to logging
        logger.info(f"EMAIL TO: {to_email}")
        logger.info(f"SUBJECT: {subject}")
        logger.info(f"CONTENT: {text_content or html_content[:500]}...")
        logger.warning("SMTP not configured - email logged but not sent")
        return True

    try:
        # Build the message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email or settings.smtp_user}>"
        msg["To"] = to_email

        # Add text and HTML parts
        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Send via SMTP
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            start_tls=True,  # Use STARTTLS (required for Gmail on port 587)
        )

        logger.info(f"Email sent successfully to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


async def send_magic_code_email(email: str, code: str) -> bool:
    """Send a magic code email for passwordless login."""
    subject = "Your Expertly Login Code"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }}
            .container {{ max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
            .logo {{ text-align: center; margin-bottom: 24px; }}
            .code {{ font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f0f0f5; border-radius: 8px; margin: 24px 0; font-family: monospace; }}
            .note {{ color: #666; font-size: 14px; text-align: center; }}
            .footer {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <strong style="font-size: 24px; color: #7c3aed;">Expertly</strong>
            </div>
            <h2 style="text-align: center; margin-bottom: 8px;">Your login code</h2>
            <p style="text-align: center; color: #666;">Enter this code to sign in to your account:</p>
            <div class="code">{code}</div>
            <p class="note">This code expires in 15 minutes.</p>
            <p class="note">If you didn't request this code, you can safely ignore this email.</p>
            <div class="footer">
                &copy; Expertly - Unified authentication for all Expertly apps
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
Your Expertly Login Code

Enter this code to sign in to your account:

{code}

This code expires in 15 minutes.

If you didn't request this code, you can safely ignore this email.
    """

    return await send_email(email, subject, html_content, text_content)


async def send_password_reset_email(email: str, reset_token: str, reset_url: str) -> bool:
    """Send a password reset email."""
    subject = "Reset Your Expertly Password"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }}
            .container {{ max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
            .logo {{ text-align: center; margin-bottom: 24px; }}
            .button {{ display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6, #7c3aed); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }}
            .button-container {{ text-align: center; margin: 32px 0; }}
            .note {{ color: #666; font-size: 14px; text-align: center; }}
            .footer {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center; }}
            .url {{ word-break: break-all; font-size: 12px; color: #666; background: #f5f5f5; padding: 12px; border-radius: 4px; margin-top: 16px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <strong style="font-size: 24px; color: #7c3aed;">Expertly</strong>
            </div>
            <h2 style="text-align: center; margin-bottom: 8px;">Reset your password</h2>
            <p style="text-align: center; color: #666;">Click the button below to reset your password:</p>
            <div class="button-container">
                <a href="{reset_url}" class="button">Reset Password</a>
            </div>
            <p class="note">This link expires in 15 minutes.</p>
            <p class="note">If you didn't request this, you can safely ignore this email.</p>
            <div class="url">
                If the button doesn't work, copy and paste this URL into your browser:<br><br>
                {reset_url}
            </div>
            <div class="footer">
                &copy; Expertly - Unified authentication for all Expertly apps
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
Reset Your Expertly Password

Click the link below to reset your password:

{reset_url}

This link expires in 15 minutes.

If you didn't request this, you can safely ignore this email.
    """

    return await send_email(email, subject, html_content, text_content)
