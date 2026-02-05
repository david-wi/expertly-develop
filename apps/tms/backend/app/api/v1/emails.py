"""
Email API - Centralized email management for TMS.

Provides endpoints for:
- Listing emails (inbox, sent, by entity)
- Receiving inbound emails (webhook for SendGrid/etc)
- Sending outbound emails
- Classifying and matching emails to entities
- Threading conversations
"""

from datetime import datetime
from typing import Optional, List
from bson import ObjectId

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field

from app.database import get_database
from app.models.email_message import EmailMessage, EmailThread, EmailDirection, EmailCategory, EmailAttachment
from app.services.email_classification import email_classifier

router = APIRouter()


# FastAPI dependency wrapper for database
def get_db():
    """Get database as FastAPI dependency."""
    return get_database()


# ============== Pydantic Schemas ==============

class EmailMessageResponse(BaseModel):
    id: str
    message_id: str
    thread_id: Optional[str] = None
    direction: str
    is_read: bool
    is_starred: bool
    is_archived: bool
    from_email: str
    from_name: Optional[str] = None
    to_emails: List[str] = []
    cc_emails: List[str] = []
    subject: str
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    has_attachments: bool
    attachments: List[dict] = []
    category: str
    classification_confidence: Optional[float] = None
    ai_summary: Optional[str] = None
    extracted_action_items: Optional[List[str]] = None
    shipment_id: Optional[str] = None
    quote_id: Optional[str] = None
    customer_id: Optional[str] = None
    carrier_id: Optional[str] = None
    auto_matched: bool
    match_confidence: Optional[float] = None
    needs_review: bool
    received_at: Optional[str] = None
    sent_at: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class EmailThreadResponse(BaseModel):
    id: str
    thread_id: str
    subject: str
    participants: List[str]
    shipment_id: Optional[str] = None
    customer_id: Optional[str] = None
    carrier_id: Optional[str] = None
    message_count: int
    unread_count: int
    last_message_at: Optional[str] = None
    is_archived: bool


class InboundEmailWebhook(BaseModel):
    """Schema for inbound email webhooks (SendGrid format)."""
    from_email: str = Field(alias="from")
    from_name: Optional[str] = None
    to: List[str] = []
    cc: Optional[List[str]] = []
    subject: str
    text: Optional[str] = None
    html: Optional[str] = None
    message_id: Optional[str] = None
    in_reply_to: Optional[str] = None
    attachments: Optional[List[dict]] = []

    class Config:
        populate_by_name = True


class SendEmailRequest(BaseModel):
    """Request to send an outbound email."""
    to_emails: List[str]
    cc_emails: Optional[List[str]] = []
    subject: str
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    shipment_id: Optional[str] = None
    quote_id: Optional[str] = None
    customer_id: Optional[str] = None
    carrier_id: Optional[str] = None
    reply_to_message_id: Optional[str] = None


class EmailListParams(BaseModel):
    """Parameters for listing emails."""
    direction: Optional[str] = None  # inbound, outbound
    category: Optional[str] = None
    shipment_id: Optional[str] = None
    quote_id: Optional[str] = None
    customer_id: Optional[str] = None
    carrier_id: Optional[str] = None
    is_read: Optional[bool] = None
    is_starred: Optional[bool] = None
    is_archived: Optional[bool] = None
    needs_review: Optional[bool] = None
    search: Optional[str] = None
    limit: int = 50
    offset: int = 0


# ============== Helper Functions ==============

def serialize_email(email: dict) -> EmailMessageResponse:
    """Convert MongoDB email document to response."""
    return EmailMessageResponse(
        id=str(email["_id"]),
        message_id=email.get("message_id", ""),
        thread_id=email.get("thread_id"),
        direction=email.get("direction", "inbound"),
        is_read=email.get("is_read", False),
        is_starred=email.get("is_starred", False),
        is_archived=email.get("is_archived", False),
        from_email=email.get("from_email", ""),
        from_name=email.get("from_name"),
        to_emails=email.get("to_emails", []),
        cc_emails=email.get("cc_emails", []),
        subject=email.get("subject", ""),
        body_text=email.get("body_text"),
        body_html=email.get("body_html"),
        has_attachments=email.get("has_attachments", False),
        attachments=email.get("attachments", []),
        category=email.get("category", "uncategorized"),
        classification_confidence=email.get("classification_confidence"),
        ai_summary=email.get("ai_summary"),
        extracted_action_items=email.get("extracted_action_items"),
        shipment_id=str(email["shipment_id"]) if email.get("shipment_id") else None,
        quote_id=str(email["quote_id"]) if email.get("quote_id") else None,
        customer_id=str(email["customer_id"]) if email.get("customer_id") else None,
        carrier_id=str(email["carrier_id"]) if email.get("carrier_id") else None,
        auto_matched=email.get("auto_matched", False),
        match_confidence=email.get("match_confidence"),
        needs_review=email.get("needs_review", False),
        received_at=email.get("received_at").isoformat() if email.get("received_at") else None,
        sent_at=email.get("sent_at").isoformat() if email.get("sent_at") else None,
        created_at=email.get("created_at").isoformat() if email.get("created_at") else None,
    )


async def process_inbound_email(db, email_id: str):
    """Background task to classify and match an inbound email."""
    email = await db.email_messages.find_one({"_id": ObjectId(email_id)})
    if not email:
        return

    # Classify the email
    classification = await email_classifier.classify_email(
        from_email=email.get("from_email", ""),
        from_name=email.get("from_name"),
        subject=email.get("subject", ""),
        body=email.get("body_text") or email.get("body_html") or "",
    )

    # Try to match to entities
    matches = await email_classifier.match_email_to_entities(
        db=db,
        reference_numbers=classification.get("reference_numbers", {}),
        from_email=email.get("from_email", ""),
        subject=email.get("subject", ""),
    )

    # Update the email with classification and matches
    update_data = {
        "category": classification.get("category", "uncategorized"),
        "classification_confidence": classification.get("confidence"),
        "ai_summary": classification.get("summary"),
        "auto_matched": matches.get("auto_matched", False),
        "match_confidence": matches.get("match_confidence"),
        "needs_review": not matches.get("auto_matched", False),
    }

    # Add action items if present
    if classification.get("action_needed"):
        update_data["extracted_action_items"] = [classification["action_needed"]]

    # Add entity matches
    if matches.get("shipment_id"):
        update_data["shipment_id"] = ObjectId(matches["shipment_id"])
    if matches.get("shipment_ids"):
        update_data["shipment_ids"] = [ObjectId(sid) for sid in matches["shipment_ids"]]
    if matches.get("quote_id"):
        update_data["quote_id"] = ObjectId(matches["quote_id"])
    if matches.get("customer_id"):
        update_data["customer_id"] = ObjectId(matches["customer_id"])
    if matches.get("carrier_id"):
        update_data["carrier_id"] = ObjectId(matches["carrier_id"])

    # Update the email
    await db.email_messages.update_one(
        {"_id": ObjectId(email_id)},
        {"$set": update_data}
    )

    # Create work item if action is needed and high priority
    if classification.get("action_needed") and classification.get("urgency") == "high":
        await db.work_items.insert_one({
            "work_type": "email_action",
            "title": f"Action needed: {email.get('subject', 'Email')}",
            "description": classification.get("action_needed"),
            "status": "open",
            "priority": "high",
            "source_type": "email",
            "source_id": ObjectId(email_id),
            "shipment_id": update_data.get("shipment_id"),
            "customer_id": update_data.get("customer_id"),
            "carrier_id": update_data.get("carrier_id"),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })


# ============== Endpoints ==============

@router.get("", response_model=List[EmailMessageResponse])
async def list_emails(
    direction: Optional[str] = None,
    category: Optional[str] = None,
    shipment_id: Optional[str] = None,
    quote_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    carrier_id: Optional[str] = None,
    is_read: Optional[bool] = None,
    is_starred: Optional[bool] = None,
    is_archived: Optional[bool] = None,
    needs_review: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db=Depends(get_db),
):
    """List emails with optional filters."""
    query = {}

    if direction:
        query["direction"] = direction
    if category:
        query["category"] = category
    if shipment_id:
        query["shipment_id"] = ObjectId(shipment_id)
    if quote_id:
        query["quote_id"] = ObjectId(quote_id)
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)
    if carrier_id:
        query["carrier_id"] = ObjectId(carrier_id)
    if is_read is not None:
        query["is_read"] = is_read
    if is_starred is not None:
        query["is_starred"] = is_starred
    if is_archived is not None:
        query["is_archived"] = is_archived
    else:
        # By default, don't show archived emails
        query["is_archived"] = False
    if needs_review is not None:
        query["needs_review"] = needs_review

    if search:
        query["$or"] = [
            {"subject": {"$regex": search, "$options": "i"}},
            {"body_text": {"$regex": search, "$options": "i"}},
            {"from_email": {"$regex": search, "$options": "i"}},
            {"from_name": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.email_messages.find(query).sort("received_at", -1).skip(offset).limit(limit)
    emails = await cursor.to_list(length=limit)

    return [serialize_email(email) for email in emails]


@router.get("/inbox", response_model=List[EmailMessageResponse])
async def get_inbox(
    category: Optional[str] = None,
    is_read: Optional[bool] = None,
    limit: int = 50,
    db=Depends(get_db),
):
    """Get inbox emails (inbound, not archived)."""
    query = {
        "direction": "inbound",
        "is_archived": False,
        "is_spam": False,
    }
    if category:
        query["category"] = category
    if is_read is not None:
        query["is_read"] = is_read

    cursor = db.email_messages.find(query).sort("received_at", -1).limit(limit)
    emails = await cursor.to_list(length=limit)

    return [serialize_email(email) for email in emails]


@router.get("/needs-review", response_model=List[EmailMessageResponse])
async def get_emails_needing_review(
    limit: int = 50,
    db=Depends(get_db),
):
    """Get emails that need manual review (not auto-matched)."""
    query = {
        "direction": "inbound",
        "is_archived": False,
        "needs_review": True,
    }

    cursor = db.email_messages.find(query).sort("received_at", -1).limit(limit)
    emails = await cursor.to_list(length=limit)

    return [serialize_email(email) for email in emails]


@router.get("/by-shipment/{shipment_id}", response_model=List[EmailMessageResponse])
async def get_emails_by_shipment(
    shipment_id: str,
    db=Depends(get_db),
):
    """Get all emails related to a specific shipment."""
    query = {
        "$or": [
            {"shipment_id": ObjectId(shipment_id)},
            {"shipment_ids": ObjectId(shipment_id)},
        ]
    }

    cursor = db.email_messages.find(query).sort("received_at", -1)
    emails = await cursor.to_list(length=100)

    return [serialize_email(email) for email in emails]


@router.get("/stats")
async def get_email_stats(db=Depends(get_db)):
    """Get email statistics for dashboard."""
    # Count unread inbox
    unread_count = await db.email_messages.count_documents({
        "direction": "inbound",
        "is_read": False,
        "is_archived": False,
        "is_spam": False,
    })

    # Count needs review
    needs_review_count = await db.email_messages.count_documents({
        "direction": "inbound",
        "needs_review": True,
        "is_archived": False,
    })

    # Count by category
    pipeline = [
        {"$match": {"direction": "inbound", "is_archived": False}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]
    category_counts = {}
    async for doc in db.email_messages.aggregate(pipeline):
        category_counts[doc["_id"]] = doc["count"]

    return {
        "unread_count": unread_count,
        "needs_review_count": needs_review_count,
        "by_category": category_counts,
    }


@router.get("/{email_id}", response_model=EmailMessageResponse)
async def get_email(email_id: str, db=Depends(get_db)):
    """Get a single email by ID."""
    email = await db.email_messages.find_one({"_id": ObjectId(email_id)})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    return serialize_email(email)


@router.post("/webhook/inbound")
async def receive_inbound_email(
    email_data: InboundEmailWebhook,
    background_tasks: BackgroundTasks,
    db=Depends(get_db),
):
    """
    Webhook endpoint for receiving inbound emails.

    Configure your email service (SendGrid, etc.) to POST emails here.
    """
    # Generate message ID if not provided
    message_id = email_data.message_id or f"msg-{datetime.utcnow().timestamp()}"

    # Check for duplicate
    existing = await db.email_messages.find_one({"message_id": message_id})
    if existing:
        return {"status": "duplicate", "id": str(existing["_id"])}

    # Create email document
    email_doc = {
        "message_id": message_id,
        "in_reply_to": email_data.in_reply_to,
        "direction": EmailDirection.INBOUND.value,
        "is_read": False,
        "is_starred": False,
        "is_archived": False,
        "is_spam": False,
        "from_email": email_data.from_email,
        "from_name": email_data.from_name,
        "to_emails": email_data.to,
        "cc_emails": email_data.cc or [],
        "subject": email_data.subject,
        "body_text": email_data.text,
        "body_html": email_data.html,
        "has_attachments": bool(email_data.attachments),
        "attachments": [
            {
                "filename": att.get("filename", "unknown"),
                "mime_type": att.get("type", "application/octet-stream"),
                "size_bytes": att.get("size", 0),
            }
            for att in (email_data.attachments or [])
        ],
        "category": EmailCategory.UNCATEGORIZED.value,
        "needs_review": True,
        "received_at": datetime.utcnow(),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "source": "sendgrid_webhook",
    }

    result = await db.email_messages.insert_one(email_doc)
    email_id = str(result.inserted_id)

    # Process email in background (classify and match)
    background_tasks.add_task(process_inbound_email, db, email_id)

    return {"status": "received", "id": email_id}


@router.post("/{email_id}/mark-read")
async def mark_email_read(email_id: str, db=Depends(get_db)):
    """Mark an email as read."""
    result = await db.email_messages.update_one(
        {"_id": ObjectId(email_id)},
        {"$set": {"is_read": True, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")

    return {"status": "ok"}


@router.post("/{email_id}/mark-unread")
async def mark_email_unread(email_id: str, db=Depends(get_db)):
    """Mark an email as unread."""
    result = await db.email_messages.update_one(
        {"_id": ObjectId(email_id)},
        {"$set": {"is_read": False, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")

    return {"status": "ok"}


@router.post("/{email_id}/star")
async def star_email(email_id: str, db=Depends(get_db)):
    """Star/unstar an email."""
    email = await db.email_messages.find_one({"_id": ObjectId(email_id)})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    new_starred = not email.get("is_starred", False)
    await db.email_messages.update_one(
        {"_id": ObjectId(email_id)},
        {"$set": {"is_starred": new_starred, "updated_at": datetime.utcnow()}}
    )

    return {"status": "ok", "is_starred": new_starred}


@router.post("/{email_id}/archive")
async def archive_email(email_id: str, db=Depends(get_db)):
    """Archive an email."""
    result = await db.email_messages.update_one(
        {"_id": ObjectId(email_id)},
        {"$set": {"is_archived": True, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")

    return {"status": "ok"}


@router.post("/{email_id}/link-shipment")
async def link_email_to_shipment(
    email_id: str,
    shipment_id: str,
    db=Depends(get_db),
):
    """Link an email to a shipment."""
    # Verify shipment exists
    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    result = await db.email_messages.update_one(
        {"_id": ObjectId(email_id)},
        {
            "$set": {
                "shipment_id": ObjectId(shipment_id),
                "needs_review": False,
                "auto_matched": False,  # Manual match
                "updated_at": datetime.utcnow(),
            },
            "$addToSet": {"shipment_ids": ObjectId(shipment_id)},
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")

    email = await db.email_messages.find_one({"_id": ObjectId(email_id)})
    return serialize_email(email)


@router.post("/{email_id}/reclassify")
async def reclassify_email(
    email_id: str,
    background_tasks: BackgroundTasks,
    db=Depends(get_db),
):
    """Re-run AI classification on an email."""
    email = await db.email_messages.find_one({"_id": ObjectId(email_id)})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    background_tasks.add_task(process_inbound_email, db, email_id)

    return {"status": "processing"}


@router.delete("/{email_id}")
async def delete_email(email_id: str, db=Depends(get_db)):
    """Delete an email (soft delete - marks as archived)."""
    result = await db.email_messages.update_one(
        {"_id": ObjectId(email_id)},
        {"$set": {"is_archived": True, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")

    return {"status": "ok"}
