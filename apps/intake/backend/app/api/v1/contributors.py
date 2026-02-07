"""Contributor and assignment management routes."""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_collection
from app.core.security import get_current_user, generate_pin
from app.schemas.contributor import (
    AssignmentCreate,
    AssignmentResponse,
    ContributorCreate,
    ContributorResponse,
)
from app.schemas.common import ResponseEnvelope

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/contributors
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/contributors",
    response_model=ResponseEnvelope[ContributorResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Add a contributor to an intake",
)
async def add_contributor(
    intakeId: str,
    body: ContributorCreate,
    current_user: dict = Depends(get_current_user),
):
    """Register a new contributor for an intake and generate their PIN."""
    intakes_col = get_collection("intakes")
    contributors_col = get_collection("intake_contributors")

    intake = await intakes_col.find_one({"_id": ObjectId(intakeId)})
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    now = datetime.now(timezone.utc)
    pin = generate_pin()

    contributor_doc = {
        "intakeId": intakeId,
        "accountId": current_user["accountId"],
        "displayName": body.display_name,
        "email": body.email,
        "phone": body.phone,
        "preferredContactMethod": (
            body.preferred_contact_method.value
            if body.preferred_contact_method
            else None
        ),
        "isPrimaryPointPerson": body.is_primary_point_person,
        "pin": pin,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await contributors_col.insert_one(contributor_doc)

    return ResponseEnvelope(
        data=ContributorResponse(
            intakeContributorId=str(result.inserted_id),
            intakeId=intakeId,
            displayName=body.display_name,
            email=body.email,
            phone=body.phone,
            preferredContactMethod=body.preferred_contact_method,
            isPrimaryPointPerson=body.is_primary_point_person,
            pin=pin,
            createdAt=now,
            updatedAt=now,
        )
    )


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/contributors
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/contributors",
    response_model=ResponseEnvelope[list[ContributorResponse]],
    summary="List contributors with progress",
)
async def list_contributors(
    intakeId: str,
    current_user: dict = Depends(get_current_user),
):
    """List all contributors for an intake with their answer progress."""
    contributors_col = get_collection("intake_contributors")
    revisions_col = get_collection("answer_revisions")

    cursor = contributors_col.find({"intakeId": intakeId}).sort("createdAt", 1)

    contributors = []
    async for doc in cursor:
        contributor_id = str(doc["_id"])

        # Count distinct questions answered by this contributor (via sessions)
        # We look for answer revisions where the source session belongs to this
        # contributor or where the createdBy matches.
        answer_count = await revisions_col.count_documents(
            {
                "intakeId": intakeId,
                "$or": [
                    {"contributorId": contributor_id},
                    {"sourceContributorId": contributor_id},
                ],
                "isCurrent": True,
            }
        )

        contributors.append(
            ContributorResponse(
                intakeContributorId=contributor_id,
                intakeId=intakeId,
                displayName=doc["displayName"],
                email=doc.get("email"),
                phone=doc.get("phone"),
                preferredContactMethod=doc.get("preferredContactMethod"),
                isPrimaryPointPerson=doc.get("isPrimaryPointPerson", False),
                pin=None,  # Do not expose PIN after creation
                createdAt=doc["createdAt"],
                updatedAt=doc["updatedAt"],
            )
        )

    return ResponseEnvelope(data=contributors)


# ---------------------------------------------------------------------------
# PATCH /intakes/{intakeId}/contributors/{contributorId}
# ---------------------------------------------------------------------------

@router.patch(
    "/intakes/{intakeId}/contributors/{contributorId}",
    response_model=ResponseEnvelope[ContributorResponse],
    summary="Update a contributor",
)
async def update_contributor(
    intakeId: str,
    contributorId: str,
    body: ContributorCreate,
    current_user: dict = Depends(get_current_user),
):
    """Update contributor details."""
    contributors_col = get_collection("intake_contributors")

    contributor = await contributors_col.find_one(
        {"_id": ObjectId(contributorId), "intakeId": intakeId}
    )
    if not contributor:
        raise HTTPException(status_code=404, detail="Contributor not found")

    now = datetime.now(timezone.utc)
    update_fields: dict = {"updatedAt": now}

    if body.display_name is not None:
        update_fields["displayName"] = body.display_name
    if body.email is not None:
        update_fields["email"] = body.email
    if body.phone is not None:
        update_fields["phone"] = body.phone
    if body.preferred_contact_method is not None:
        update_fields["preferredContactMethod"] = body.preferred_contact_method.value
    update_fields["isPrimaryPointPerson"] = body.is_primary_point_person

    await contributors_col.update_one(
        {"_id": ObjectId(contributorId)},
        {"$set": update_fields},
    )

    updated = await contributors_col.find_one({"_id": ObjectId(contributorId)})

    return ResponseEnvelope(
        data=ContributorResponse(
            intakeContributorId=str(updated["_id"]),
            intakeId=intakeId,
            displayName=updated["displayName"],
            email=updated.get("email"),
            phone=updated.get("phone"),
            preferredContactMethod=updated.get("preferredContactMethod"),
            isPrimaryPointPerson=updated.get("isPrimaryPointPerson", False),
            pin=None,
            createdAt=updated["createdAt"],
            updatedAt=updated["updatedAt"],
        )
    )


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/assignments
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/assignments",
    response_model=ResponseEnvelope[AssignmentResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Assign contributor to a section",
)
async def create_assignment(
    intakeId: str,
    body: AssignmentCreate,
    current_user: dict = Depends(get_current_user),
):
    """Assign a contributor to a section instance."""
    assignments_col = get_collection("assignments")
    contributors_col = get_collection("intake_contributors")

    # Verify contributor exists
    contributor = await contributors_col.find_one(
        {"_id": ObjectId(body.intake_contributor_id), "intakeId": intakeId}
    )
    if not contributor:
        raise HTTPException(status_code=404, detail="Contributor not found")

    now = datetime.now(timezone.utc)

    assignment_doc = {
        "intakeId": intakeId,
        "intakeContributorId": body.intake_contributor_id,
        "intakeSectionInstanceId": body.intake_section_instance_id,
        "assignmentPolicy": body.assignment_policy.value,
        "assignedBy": current_user["userId"],
        "createdAt": now,
        "updatedAt": now,
    }

    result = await assignments_col.insert_one(assignment_doc)

    return ResponseEnvelope(
        data=AssignmentResponse(
            assignmentId=str(result.inserted_id),
            intakeContributorId=body.intake_contributor_id,
            intakeSectionInstanceId=body.intake_section_instance_id,
            assignmentPolicy=body.assignment_policy,
            createdAt=now,
            updatedAt=now,
        )
    )


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/assignments
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/assignments",
    response_model=ResponseEnvelope[list[AssignmentResponse]],
    summary="List section assignments",
)
async def list_assignments(
    intakeId: str,
    current_user: dict = Depends(get_current_user),
):
    """List all contributor-to-section assignments for an intake."""
    assignments_col = get_collection("assignments")

    cursor = assignments_col.find({"intakeId": intakeId}).sort("createdAt", 1)

    assignments = []
    async for doc in cursor:
        assignments.append(
            AssignmentResponse(
                assignmentId=str(doc["_id"]),
                intakeContributorId=doc["intakeContributorId"],
                intakeSectionInstanceId=doc["intakeSectionInstanceId"],
                assignmentPolicy=doc["assignmentPolicy"],
                createdAt=doc["createdAt"],
                updatedAt=doc["updatedAt"],
            )
        )

    return ResponseEnvelope(data=assignments)
