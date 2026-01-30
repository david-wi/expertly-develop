from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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
async def get_jira_settings(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get Jira settings for a product."""
    stmt = select(JiraSettings).where(JiraSettings.product_id == product_id)
    result = await db.execute(stmt)
    settings = result.scalar_one_or_none()
    return settings


@router.post("/settings/{product_id}", response_model=JiraSettingsResponse, status_code=201)
async def create_jira_settings(
    product_id: str,
    data: JiraSettingsCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create or update Jira settings for a product."""
    # Verify product exists
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.utcnow().isoformat()
    existing_stmt = select(JiraSettings).where(JiraSettings.product_id == product_id)
    existing_result = await db.execute(existing_stmt)
    existing = existing_result.scalar_one_or_none()

    if existing:
        # Update existing
        existing.jira_host = data.jira_host.strip()
        existing.jira_email = data.jira_email.strip()
        existing.jira_api_token = data.jira_api_token
        existing.default_project_key = data.default_project_key.strip().upper()
        existing.updated_at = now
        await db.flush()
        await db.refresh(existing)
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
        await db.flush()
        await db.refresh(settings)
        return settings


@router.put("/settings/{product_id}", response_model=JiraSettingsResponse)
async def update_jira_settings(
    product_id: str,
    data: JiraSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update Jira settings for a product."""
    stmt = select(JiraSettings).where(JiraSettings.product_id == product_id)
    result = await db.execute(stmt)
    settings = result.scalar_one_or_none()
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
    await db.flush()
    await db.refresh(settings)

    return settings


# Jira Story Drafts endpoints
@router.get("/drafts", response_model=List[JiraStoryDraftResponse])
async def list_drafts(
    product_id: str = Query(..., description="Product ID to filter by"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List Jira story drafts for a product."""
    stmt = (
        select(JiraStoryDraft)
        .where(JiraStoryDraft.product_id == product_id)
        .order_by(JiraStoryDraft.created_at.desc())
    )
    result = await db.execute(stmt)
    drafts = result.scalars().all()
    return drafts


@router.post("/drafts", response_model=JiraStoryDraftResponse, status_code=201)
async def create_draft(
    data: JiraStoryDraftCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new Jira story draft."""
    # Verify product exists
    stmt = select(Product).where(Product.id == data.product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
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
    await db.flush()
    await db.refresh(draft)

    return draft


@router.get("/drafts/{draft_id}", response_model=JiraStoryDraftResponse)
async def get_draft(
    draft_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a single Jira story draft by ID."""
    stmt = select(JiraStoryDraft).where(JiraStoryDraft.id == draft_id)
    result = await db.execute(stmt)
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


@router.put("/drafts/{draft_id}", response_model=JiraStoryDraftResponse)
async def update_draft(
    draft_id: str,
    data: JiraStoryDraftUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a Jira story draft."""
    stmt = select(JiraStoryDraft).where(JiraStoryDraft.id == draft_id)
    result = await db.execute(stmt)
    draft = result.scalar_one_or_none()
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
    await db.flush()
    await db.refresh(draft)

    return draft


@router.delete("/drafts/{draft_id}", status_code=204)
async def delete_draft(
    draft_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a Jira story draft."""
    stmt = select(JiraStoryDraft).where(JiraStoryDraft.id == draft_id)
    result = await db.execute(stmt)
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    await db.delete(draft)

    return None


# Send to Jira endpoints
@router.post("/send")
async def send_to_jira(
    data: JiraSendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Send a single draft to Jira."""
    stmt = select(JiraStoryDraft).where(JiraStoryDraft.id == data.draft_id)
    result = await db.execute(stmt)
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    settings_stmt = select(JiraSettings).where(JiraSettings.product_id == draft.product_id)
    settings_result = await db.execute(settings_stmt)
    settings = settings_result.scalar_one_or_none()
    if not settings:
        raise HTTPException(status_code=400, detail="Jira settings not configured for this product")

    jira_service = JiraService(
        host=settings.jira_host,
        email=settings.jira_email,
        api_token=settings.jira_api_token,
    )

    try:
        jira_result = await jira_service.create_issue(
            project_key=settings.default_project_key,
            summary=draft.summary,
            description=draft.description,
            issue_type=draft.issue_type,
            priority=draft.priority,
            labels=json.loads(draft.labels) if draft.labels else None,
            story_points=draft.story_points,
        )

        draft.status = "sent"
        draft.jira_issue_key = jira_result["key"]
        draft.jira_url = jira_result["url"]
        draft.error_message = None
        draft.updated_at = datetime.utcnow().isoformat()

        await db.flush()
        await db.refresh(draft)

        return {"success": True, "draft": draft}

    except Exception as e:
        draft.status = "failed"
        draft.error_message = str(e)
        draft.updated_at = datetime.utcnow().isoformat()
        await db.flush()

        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-all")
async def send_all_to_jira(
    data: JiraSendAllRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Send multiple drafts to Jira."""
    settings_stmt = select(JiraSettings).where(JiraSettings.product_id == data.product_id)
    settings_result = await db.execute(settings_stmt)
    settings = settings_result.scalar_one_or_none()
    if not settings:
        raise HTTPException(status_code=400, detail="Jira settings not configured for this product")

    jira_service = JiraService(
        host=settings.jira_host,
        email=settings.jira_email,
        api_token=settings.jira_api_token,
    )

    results = {"success": [], "failed": []}

    for draft_id in data.draft_ids:
        draft_stmt = select(JiraStoryDraft).where(JiraStoryDraft.id == draft_id)
        draft_result = await db.execute(draft_stmt)
        draft = draft_result.scalar_one_or_none()
        if not draft:
            results["failed"].append({"id": draft_id, "error": "Draft not found"})
            continue

        try:
            jira_result = await jira_service.create_issue(
                project_key=settings.default_project_key,
                summary=draft.summary,
                description=draft.description,
                issue_type=draft.issue_type,
                priority=draft.priority,
                labels=json.loads(draft.labels) if draft.labels else None,
                story_points=draft.story_points,
            )

            draft.status = "sent"
            draft.jira_issue_key = jira_result["key"]
            draft.jira_url = jira_result["url"]
            draft.error_message = None
            draft.updated_at = datetime.utcnow().isoformat()

            results["success"].append({
                "id": draft_id,
                "jira_key": jira_result["key"],
                "jira_url": jira_result["url"],
            })

        except Exception as e:
            draft.status = "failed"
            draft.error_message = str(e)
            draft.updated_at = datetime.utcnow().isoformat()

            results["failed"].append({"id": draft_id, "error": str(e)})

    await db.flush()

    return results
