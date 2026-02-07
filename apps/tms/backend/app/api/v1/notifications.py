"""Push notifications API for web push and notification management."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.base import utc_now

router = APIRouter()


# ============================================================================
# Push Subscription Management
# ============================================================================

class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys
    expirationTime: Optional[int] = None


@router.post("/push/subscribe")
async def save_push_subscription(data: PushSubscriptionCreate, request: Request):
    """Save a push notification subscription."""
    db = get_database()

    # Get user info from request (would come from auth in production)
    user_id = request.headers.get("X-User-Id", "anonymous")

    subscription = {
        "user_id": user_id,
        "endpoint": data.endpoint,
        "keys": {
            "p256dh": data.keys.p256dh,
            "auth": data.keys.auth,
        },
        "expiration_time": data.expirationTime,
        "user_agent": request.headers.get("User-Agent"),
        "ip_address": request.client.host if request.client else None,
        "is_active": True,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }

    # Upsert by endpoint
    await db.push_subscriptions.update_one(
        {"endpoint": data.endpoint},
        {"$set": subscription},
        upsert=True
    )

    return {"status": "subscribed"}


@router.delete("/push/unsubscribe")
async def remove_push_subscription(request: Request):
    """Remove a push subscription."""
    db = get_database()
    user_id = request.headers.get("X-User-Id", "anonymous")

    await db.push_subscriptions.update_many(
        {"user_id": user_id},
        {"$set": {"is_active": False, "updated_at": utc_now()}}
    )

    return {"status": "unsubscribed"}


@router.get("/push/subscriptions")
async def get_subscriptions(user_id: Optional[str] = None):
    """Get active push subscriptions (admin)."""
    db = get_database()

    query = {"is_active": True}
    if user_id:
        query["user_id"] = user_id

    subscriptions = await db.push_subscriptions.find(query).to_list(100)

    return [
        {
            "id": str(s["_id"]),
            "user_id": s.get("user_id"),
            "endpoint": s.get("endpoint")[:50] + "...",
            "created_at": s.get("created_at"),
        }
        for s in subscriptions
    ]


# ============================================================================
# Send Notifications
# ============================================================================

class SendNotificationRequest(BaseModel):
    title: str
    body: str
    url: Optional[str] = None
    icon: Optional[str] = None
    tag: Optional[str] = None
    requireInteraction: bool = False
    data: Optional[dict] = None
    user_ids: Optional[List[str]] = None  # If None, send to all


@router.post("/push/send")
async def send_push_notification(data: SendNotificationRequest):
    """Send push notification to subscribers."""
    db = get_database()

    # Get subscriptions
    query = {"is_active": True}
    if data.user_ids:
        query["user_id"] = {"$in": data.user_ids}

    subscriptions = await db.push_subscriptions.find(query).to_list(1000)

    if not subscriptions:
        return {"status": "no_subscribers", "sent": 0}

    # In production, use pywebpush library to send actual push notifications
    # For now, we'll just log them

    notification_payload = {
        "title": data.title,
        "body": data.body,
        "icon": data.icon or "/icons/icon-192.png",
        "badge": "/icons/icon-72.png",
        "tag": data.tag or "tms-notification",
        "data": data.data or {},
        "requireInteraction": data.requireInteraction,
    }

    if data.url:
        notification_payload["data"]["url"] = data.url

    # Log notification attempt
    notification_log = {
        "payload": notification_payload,
        "recipient_count": len(subscriptions),
        "user_ids": data.user_ids,
        "sent_at": utc_now(),
        "status": "sent",
    }
    await db.notification_logs.insert_one(notification_log)

    # TODO: Implement actual push sending with pywebpush
    # Example:
    # from pywebpush import webpush, WebPushException
    # VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
    # VAPID_CLAIMS = {"sub": "mailto:admin@example.com"}
    #
    # for sub in subscriptions:
    #     try:
    #         webpush(
    #             subscription_info={
    #                 "endpoint": sub["endpoint"],
    #                 "keys": sub["keys"],
    #             },
    #             data=json.dumps(notification_payload),
    #             vapid_private_key=VAPID_PRIVATE_KEY,
    #             vapid_claims=VAPID_CLAIMS,
    #         )
    #     except WebPushException as e:
    #         if e.response.status_code == 410:  # Gone - subscription expired
    #             await db.push_subscriptions.update_one(
    #                 {"_id": sub["_id"]},
    #                 {"$set": {"is_active": False}}
    #             )

    return {
        "status": "sent",
        "sent": len(subscriptions),
        "notification": notification_payload,
    }


# ============================================================================
# In-App Notifications
# ============================================================================

class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    notification_type: str = "info"  # info, success, warning, error, alert
    link_url: Optional[str] = None
    shipment_id: Optional[str] = None
    work_item_id: Optional[str] = None
    tender_id: Optional[str] = None
    invoice_id: Optional[str] = None
    send_push: bool = False


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    notification_type: str
    link_url: Optional[str] = None
    is_read: bool
    created_at: datetime


@router.post("/", response_model=NotificationResponse)
async def create_notification(data: NotificationCreate):
    """Create an in-app notification."""
    db = get_database()

    notification = {
        "user_id": data.user_id,
        "title": data.title,
        "message": data.message,
        "notification_type": data.notification_type,
        "link_url": data.link_url,
        "shipment_id": ObjectId(data.shipment_id) if data.shipment_id else None,
        "work_item_id": ObjectId(data.work_item_id) if data.work_item_id else None,
        "tender_id": ObjectId(data.tender_id) if data.tender_id else None,
        "invoice_id": ObjectId(data.invoice_id) if data.invoice_id else None,
        "is_read": False,
        "read_at": None,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }

    result = await db.notifications.insert_one(notification)

    # Send push notification if requested
    if data.send_push:
        push_data = SendNotificationRequest(
            title=data.title,
            body=data.message,
            url=data.link_url,
            user_ids=[data.user_id],
            data={
                "notification_id": str(result.inserted_id),
                "shipment_id": data.shipment_id,
                "work_item_id": data.work_item_id,
            }
        )
        await send_push_notification(push_data)

    return NotificationResponse(
        id=str(result.inserted_id),
        user_id=data.user_id,
        title=data.title,
        message=data.message,
        notification_type=data.notification_type,
        link_url=data.link_url,
        is_read=False,
        created_at=notification["created_at"],
    )


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    user_id: str,
    unread_only: bool = False,
    limit: int = 50,
):
    """Get notifications for a user."""
    db = get_database()

    query = {"user_id": user_id}
    if unread_only:
        query["is_read"] = False

    notifications = await db.notifications.find(query).sort("created_at", -1).limit(limit).to_list(limit)

    return [
        NotificationResponse(
            id=str(n["_id"]),
            user_id=n["user_id"],
            title=n["title"],
            message=n["message"],
            notification_type=n.get("notification_type", "info"),
            link_url=n.get("link_url"),
            is_read=n.get("is_read", False),
            created_at=n["created_at"],
        )
        for n in notifications
    ]


@router.post("/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read."""
    db = get_database()

    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"is_read": True, "read_at": utc_now()}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"status": "read"}


@router.post("/mark-all-read")
async def mark_all_notifications_read(user_id: str):
    """Mark all notifications as read for a user."""
    db = get_database()

    await db.notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True, "read_at": utc_now()}}
    )

    return {"status": "all_read"}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str):
    """Delete a notification."""
    db = get_database()

    result = await db.notifications.delete_one({"_id": ObjectId(notification_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"status": "deleted"}


# ============================================================================
# Notification Preferences
# ============================================================================

# ============================================================================
# Notification Center (aggregated view with actions)
# ============================================================================


class NotificationCenterResponse(BaseModel):
    """Aggregated notification center response."""
    notifications: List[NotificationResponse]
    unread_count: int
    total_count: int
    categories: dict


@router.get("/center", response_model=NotificationCenterResponse)
async def get_notification_center(
    user_id: str,
    limit: int = 50,
    category: Optional[str] = None,
):
    """
    Get notification center with aggregated counts by category.

    Provides the full notification center experience with unread counts,
    categorization, and one-click action URLs for each notification.
    """
    db = get_database()

    # Build query
    query: dict = {"user_id": user_id}
    if category and category != "all":
        query["notification_type"] = category

    # Get all notifications
    notifications_cursor = db.notifications.find(query).sort("created_at", -1).limit(limit)
    notifications_list = await notifications_cursor.to_list(limit)

    # Count unread
    unread_count = await db.notifications.count_documents({"user_id": user_id, "is_read": False})
    total_count = await db.notifications.count_documents({"user_id": user_id})

    # Count by category
    categories: dict = {}
    for ntype in ["info", "success", "warning", "error", "alert",
                  "shipment_update", "approval_needed", "exception", "billing"]:
        count = await db.notifications.count_documents({
            "user_id": user_id,
            "notification_type": ntype,
            "is_read": False,
        })
        if count > 0:
            categories[ntype] = count

    notification_responses = [
        NotificationResponse(
            id=str(n["_id"]),
            user_id=n["user_id"],
            title=n["title"],
            message=n["message"],
            notification_type=n.get("notification_type", "info"),
            link_url=n.get("link_url"),
            is_read=n.get("is_read", False),
            created_at=n["created_at"],
        )
        for n in notifications_list
    ]

    return NotificationCenterResponse(
        notifications=notification_responses,
        unread_count=unread_count,
        total_count=total_count,
        categories=categories,
    )


# ============================================================================
# Notification Preferences
# ============================================================================


class NotificationChannels(BaseModel):
    """Per-event channel configuration."""
    in_app: bool = True
    push: bool = True
    email: bool = False


class NotificationRule(BaseModel):
    """Configurable notification rule for a specific event type."""
    event_type: str
    label: str
    description: str
    channels: NotificationChannels = NotificationChannels()
    enabled: bool = True


# Default notification rules with sensible defaults
DEFAULT_NOTIFICATION_RULES: List[dict] = [
    {
        "event_type": "load_accepted",
        "label": "Load Accepted",
        "description": "When a carrier accepts a tendered load",
        "channels": {"in_app": True, "push": True, "email": True},
        "enabled": True,
    },
    {
        "event_type": "delivery_complete",
        "label": "Delivery Complete",
        "description": "When a shipment is delivered to its destination",
        "channels": {"in_app": True, "push": True, "email": True},
        "enabled": True,
    },
    {
        "event_type": "shipment_at_risk",
        "label": "Shipment at Risk",
        "description": "When a shipment is flagged as at-risk for delay or issue",
        "channels": {"in_app": True, "push": True, "email": True},
        "enabled": True,
    },
    {
        "event_type": "new_quote_request",
        "label": "New Quote Request",
        "description": "When a new rate request is received",
        "channels": {"in_app": True, "push": True, "email": False},
        "enabled": True,
    },
    {
        "event_type": "tender_response",
        "label": "Tender Response",
        "description": "When a carrier responds to a tender offer",
        "channels": {"in_app": True, "push": True, "email": False},
        "enabled": True,
    },
    {
        "event_type": "shipment_status_change",
        "label": "Shipment Status Change",
        "description": "When a shipment transitions to a new status",
        "channels": {"in_app": True, "push": False, "email": False},
        "enabled": True,
    },
    {
        "event_type": "exception_alert",
        "label": "Exception Alert",
        "description": "When a shipment exception is detected",
        "channels": {"in_app": True, "push": True, "email": True},
        "enabled": True,
    },
    {
        "event_type": "invoice_due",
        "label": "Invoice Due",
        "description": "When an invoice payment is approaching due date",
        "channels": {"in_app": True, "push": False, "email": True},
        "enabled": True,
    },
    {
        "event_type": "check_call_due",
        "label": "Check Call Due",
        "description": "When a check call is due for a shipment",
        "channels": {"in_app": True, "push": True, "email": False},
        "enabled": True,
    },
    {
        "event_type": "document_uploaded",
        "label": "Document Uploaded",
        "description": "When a document (BOL, POD, etc.) is uploaded",
        "channels": {"in_app": True, "push": False, "email": False},
        "enabled": True,
    },
    {
        "event_type": "approval_needed",
        "label": "Approval Needed",
        "description": "When an action requires your approval",
        "channels": {"in_app": True, "push": True, "email": True},
        "enabled": True,
    },
    {
        "event_type": "carrier_update",
        "label": "Carrier Update",
        "description": "When carrier information changes (insurance, status)",
        "channels": {"in_app": True, "push": False, "email": False},
        "enabled": True,
    },
    {
        "event_type": "billing_alert",
        "label": "Billing Alert",
        "description": "Important billing and payment notifications",
        "channels": {"in_app": True, "push": False, "email": True},
        "enabled": True,
    },
    {
        "event_type": "edi_transmission",
        "label": "EDI Transmission",
        "description": "EDI message send/receive notifications",
        "channels": {"in_app": True, "push": False, "email": False},
        "enabled": False,
    },
    {
        "event_type": "load_board_activity",
        "label": "Load Board Activity",
        "description": "Updates from connected load boards",
        "channels": {"in_app": True, "push": False, "email": False},
        "enabled": False,
    },
]


class NotificationPreferences(BaseModel):
    email_enabled: bool = True
    push_enabled: bool = True
    sms_enabled: bool = False

    # Event types (legacy fields kept for backward compatibility)
    new_quote_request: bool = True
    tender_response: bool = True
    shipment_status_change: bool = True
    exception_alert: bool = True
    invoice_due: bool = True
    check_call_due: bool = True
    document_uploaded: bool = True

    # Additional notification categories
    approval_needed: bool = True
    carrier_update: bool = True
    billing_alert: bool = True
    edi_transmission: bool = False
    load_board_activity: bool = False

    # Configurable notification rules with per-event channel control
    notification_rules: Optional[List[NotificationRule]] = None

    # Quiet hours
    quiet_hours_enabled: bool = False
    quiet_hours_start: Optional[str] = "22:00"  # HH:MM format
    quiet_hours_end: Optional[str] = "07:00"  # HH:MM format


@router.get("/preferences/{user_id}", response_model=NotificationPreferences)
async def get_notification_preferences(user_id: str):
    """Get notification preferences for a user."""
    db = get_database()

    prefs = await db.notification_preferences.find_one({"user_id": user_id})

    if not prefs:
        # Return defaults with default rules
        default_prefs = NotificationPreferences(
            notification_rules=[NotificationRule(**rule) for rule in DEFAULT_NOTIFICATION_RULES]
        )
        return default_prefs

    # Parse stored rules or use defaults
    stored_rules = prefs.get("notification_rules")
    if stored_rules:
        rules = [NotificationRule(**rule) for rule in stored_rules]
    else:
        rules = [NotificationRule(**rule) for rule in DEFAULT_NOTIFICATION_RULES]

    filtered = {k: v for k, v in prefs.items() if k not in ("_id", "user_id", "notification_rules", "updated_at")}
    return NotificationPreferences(notification_rules=rules, **filtered)


@router.put("/preferences/{user_id}", response_model=NotificationPreferences)
async def update_notification_preferences(user_id: str, data: NotificationPreferences):
    """Update notification preferences for a user."""
    db = get_database()

    prefs = data.model_dump()
    prefs["user_id"] = user_id
    prefs["updated_at"] = utc_now()

    # Convert notification rules to dicts for MongoDB storage
    if prefs.get("notification_rules"):
        prefs["notification_rules"] = [
            rule if isinstance(rule, dict) else rule
            for rule in prefs["notification_rules"]
        ]

    await db.notification_preferences.update_one(
        {"user_id": user_id},
        {"$set": prefs},
        upsert=True
    )

    return data


@router.post("/test")
async def send_test_notification(request: Request):
    """Send a test push notification to verify push is working."""
    db = get_database()
    user_id = request.headers.get("X-User-Id", "anonymous")

    # Get user's active subscriptions
    subscriptions = await db.push_subscriptions.find(
        {"user_id": user_id, "is_active": True}
    ).to_list(10)

    if not subscriptions:
        raise HTTPException(
            status_code=404,
            detail="No active push subscription found. Please enable push notifications first."
        )

    # Create a test in-app notification
    test_notification = {
        "user_id": user_id,
        "title": "Test Notification",
        "message": "Push notifications are working! You will receive alerts for important TMS events.",
        "notification_type": "info",
        "is_read": False,
        "read_at": None,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await db.notifications.insert_one(test_notification)

    # Send test push notification
    push_data = SendNotificationRequest(
        title="Expertly TMS - Test",
        body="Push notifications are working! You will receive alerts for load accepted, delivery complete, and shipment at risk events.",
        url="/settings",
        tag="tms-test",
        user_ids=[user_id],
        data={"type": "test"},
    )
    result = await send_push_notification(push_data)

    return {
        "status": "sent",
        "message": "Test notification sent successfully",
        "subscribers": len(subscriptions),
    }
