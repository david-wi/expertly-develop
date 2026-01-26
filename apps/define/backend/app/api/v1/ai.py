from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.schemas.ai import ParseRequirementsRequest, ParsedRequirement
from app.services.ai_service import AIService

router = APIRouter()


@router.post("/parse-requirements", response_model=dict)
async def parse_requirements(
    data: ParseRequirementsRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Parse requirements from text/files using AI."""
    if not data.description.strip():
        raise HTTPException(status_code=400, detail="Description is required")

    ai_service = AIService()

    try:
        requirements = await ai_service.parse_requirements(
            description=data.description,
            files=data.files,
            existing_requirements=data.existing_requirements,
            target_parent_id=data.target_parent_id,
            product_name=data.product_name,
        )

        return {"requirements": requirements}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
