from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import uuid4
from datetime import datetime
import json

from app.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.models.product import Product
from app.models.jira_settings import JiraSettings
from app.models.jira_story_draft import JiraStoryDraft
from app.schemas.jira import (
    JiraSettingsCreate, JiraSettingsUpdate, JiraSettingsResponse,
    JiraStoryDraftCreate, JiraStoryDraftUpdate, JiraStoryDraftResponse,
    JiraSendRequest, JiraSendAllRequest,
)
from app.services.jira_service import JiraService

router = APIRouter()


# Jira Settings endpoints
@router.get("/settings/{product_id}", response_model=Optional[JiraSettingsResponse])
def get_jira_settings(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get Jira settings for a product."""
    settings = db.query(JiraSettings).filter(JiraSettings.product_id == product_id).first()
    return settings


@router.post("/settings/{product_id}", response_model=JiraSettingsResponse, status_code=201)
def create_jira_settings(
    product_id: str,
    data: JiraSettingsCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create or update Jira settings for a product."""
    # Verify product exists
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.utcnow().isoformat()
    existing = db.query(JiraSettings).filter(JiraSettings.product_id == product_id).first()

    if existing:
        # Update existing
        existing.jira_host = data.jira_host.strip()
        existing.jira_email = data.jira_email.strip()
        existing.jira_api_token = data.jira_api_token
        existing.default_project_key = data.default_project_key.strip().upper()
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new
        settings = JiraSettings(
            id=str(uuid4()),
            product_id=product_id,
            jira_host=data.jira_host.strip(),
            jira_email=data.jira_email.strip(),
            jira_api_token=data.jira_api_token,
            default_project_key=data.default_project_key.strip().upper(),
            created_at=now,
            updated_at=now,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
        return settings


@router.put("/settings/{product_id}", response_model=JiraSettingsResponse)
def update_jira_settings(
    product_id: str,
    data: JiraSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update Jira settings for a product."""
    settings = db.query(JiraSettings).filter(JiraSettings.product_id == product_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Jira settings not found")

    if data.jira_host is not None:
        settings.jira_host = data.jira_host.strip()
    if data.jira_email is not None:
        settings.jira_email = data.jira_email.strip()
    if data.jira_api_token is not None:
        settings.jira_api_token = data.jira_api_token
    if data.default_project_key is not None:
        settings.default_project_key = data.default_project_key.strip().upper()

    settings.updated_at = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(settings)

    return settings


# Jira Story Drafts endpoints
@router.get("/drafts", response_model=List[JiraStoryDraftResponse])
def list_drafts(
    product_id: str = Query(..., description="Product ID to filter by"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List Jira story drafts for a product."""
    drafts = (
        db.query(JiraStoryDraft)
        .filter(JiraStoryDraft.product_id == product_id)
        .order_by(JiraStoryDraft.created_at.desc())
        .all()
    )
    return drafts


@router.post("/drafts", response_model=JiraStoryDraftResponse, status_code=201)
def create_draft(
    data: JiraStoryDraftCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new Jira story draft."""
    # Verify product exists
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.utcnow().isoformat()
    draft = JiraStoryDraft(
        id=str(uuid4()),
        product_id=data.product_id,
        requirement_id=data.requirement_id,
        summary=data.summary.strip(),
        description=data.description.strip() if data.description else None,
        issue_type=data.issue_type,
        priority=data.priority,
        labels=json.dumps(data.labels) if data.labels else None,
        story_points=data.story_points,
        status="draft",
        created_at=now,
        updated_at=now,
    )

    db.add(draft)
    db.commit()
    db.refresh(draft)

    return draft


@router.get("/drafts/{draft_id}", response_model=JiraStoryDraftResponse)
def get_draft(
    draft_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a single Jira story draft by ID."""
    draft = db.query(JiraStoryDraft).filter(JiraStoryDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


@router.put("/drafts/{draft_id}", response_model=JiraStoryDraftResponse)
def update_draft(
    draft_id: str,
    data: JiraStoryDraftUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a Jira story draft."""
    draft = db.query(JiraStoryDraft).filter(JiraStoryDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if data.summary is not None:
        draft.summary = data.summary.strip()
    if data.description is not None:
        draft.description = data.description.strip() if data.description else None
    if data.issue_type is not None:
        draft.issue_type = data.issue_type
    if data.priority is not None:
        draft.priority = data.priority
    if data.labels is not None:
        draft.labels = json.dumps(data.labels) if data.labels else None
    if data.story_points is not None:
        draft.story_points = data.story_points

    draft.updated_at = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(draft)

    return draft


@router.delete("/drafts/{draft_id}", status_code=204)
def delete_draft(
    draft_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a Jira story draft."""
    draft = db.query(JiraStoryDraft).filter(JiraStoryDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    db.delete(draft)
    db.commit()

    return None


# Send to Jira endpoints
@router.post("/send")
async def send_to_jira(
    data: JiraSendRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Send a single draft to Jira."""
    draft = db.query(JiraStoryDraft).filter(JiraStoryDraft.id == data.draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    settings = db.query(JiraSettings).filter(JiraSettings.product_id == draft.product_id).first()
    if not settings:
        raise HTTPException(status_code=400, detail="Jira settings not configured for this product")

    jira_service = JiraService(
        host=settings.jira_host,
        email=settings.jira_email,
        api_token=settings.jira_api_token,
    )

    try:
        result = await jira_service.create_issue(
            project_key=settings.default_project_key,
            summary=draft.summary,
            description=draft.description,
            issue_type=draft.issue_type,
            priority=draft.priority,
            labels=json.loads(draft.labels) if draft.labels else None,
            story_points=draft.story_points,
        )

        draft.status = "sent"
        draft.jira_issue_key = result["key"]
        draft.jira_url = result["url"]
        draft.error_message = None
        draft.updated_at = datetime.utcnow().isoformat()

        db.commit()
        db.refresh(draft)

        return {"success": True, "draft": draft}

    except Exception as e:
        draft.status = "failed"
        draft.error_message = str(e)
        draft.updated_at = datetime.utcnow().isoformat()
        db.commit()

        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-all")
async def send_all_to_jira(
    data: JiraSendAllRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Send multiple drafts to Jira."""
    settings = db.query(JiraSettings).filter(JiraSettings.product_id == data.product_id).first()
    if not settings:
        raise HTTPException(status_code=400, detail="Jira settings not configured for this product")

    jira_service = JiraService(
        host=settings.jira_host,
        email=settings.jira_email,
        api_token=settings.jira_api_token,
    )

    results = {"success": [], "failed": []}

    for draft_id in data.draft_ids:
        draft = db.query(JiraStoryDraft).filter(JiraStoryDraft.id == draft_id).first()
        if not draft:
            results["failed"].append({"id": draft_id, "error": "Draft not found"})
            continue

        try:
            result = await jira_service.create_issue(
                project_key=settings.default_project_key,
                summary=draft.summary,
                description=draft.description,
                issue_type=draft.issue_type,
                priority=draft.priority,
                labels=json.loads(draft.labels) if draft.labels else None,
                story_points=draft.story_points,
            )

            draft.status = "sent"
            draft.jira_issue_key = result["key"]
            draft.jira_url = result["url"]
            draft.error_message = None
            draft.updated_at = datetime.utcnow().isoformat()

            results["success"].append({
                "id": draft_id,
                "jira_key": result["key"],
                "jira_url": result["url"],
            })

        except Exception as e:
            draft.status = "failed"
            draft.error_message = str(e)
            draft.updated_at = datetime.utcnow().isoformat()

            results["failed"].append({"id": draft_id, "error": str(e)})

    db.commit()

    return results
