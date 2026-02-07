"""Tests for intake type endpoints (app/api/v1/intake_types.py).

Covers:
- GET /api/v1/intake-types (list)
- POST /api/v1/intake-types (create)
- GET /api/v1/intake-types/{id} (get)
- PATCH /api/v1/intake-types/{id} (update)
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId

from app.tests.conftest import (
    ACCOUNT_ID,
    INTAKE_TYPE_ID,
    auth_headers,
)


def make_intake_type_doc(
    *,
    intake_type_id: str = INTAKE_TYPE_ID,
    account_id: str = ACCOUNT_ID,
    intake_type_name: str = "General",
    description: str | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": ObjectId(intake_type_id),
        "accountId": account_id,
        "intakeTypeName": intake_type_name,
        "description": description,
        "defaultTemplateVersionId": None,
        "defaultVoiceProfileId": None,
        "defaultsRecordingEnabled": True,
        "defaultsTranscriptionEnabled": True,
        "defaultsContinueRecordingAfterTransfer": False,
        "createdAt": now,
        "updatedAt": now,
    }


# =========================================================================
# GET /api/v1/intake-types
# =========================================================================


class TestListIntakeTypes:
    async def test_success(self, client, mock_collections, admin_token):
        """Returns a list of intake types for the account."""
        doc = make_intake_type_doc()
        mock_collections["intake_types"].set_find_results([doc])

        resp = await client.get(
            "/api/v1/intake-types",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["intakeTypeId"] == INTAKE_TYPE_ID
        assert data[0]["intakeTypeName"] == "General"

    async def test_empty_list(self, client, mock_collections, admin_token):
        """Returns empty list when no intake types exist."""
        mock_collections["intake_types"].set_find_results([])

        resp = await client.get(
            "/api/v1/intake-types",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_no_auth(self, client, mock_collections):
        """Unauthenticated request returns 401."""
        resp = await client.get("/api/v1/intake-types")
        assert resp.status_code in (401, 403)


# =========================================================================
# POST /api/v1/intake-types
# =========================================================================


class TestCreateIntakeType:
    async def test_success(self, client, mock_collections, admin_token):
        """Admin can create an intake type."""
        oid = ObjectId()
        insert_result = AsyncMock()
        insert_result.inserted_id = oid
        mock_collections["intake_types"].insert_one = AsyncMock(
            return_value=insert_result
        )

        resp = await client.post(
            "/api/v1/intake-types",
            json={"intakeTypeName": "Hotel Intake"},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["intakeTypeName"] == "Hotel Intake"
        assert data["intakeTypeId"] == str(oid)

    async def test_non_admin_rejected(self, client, mock_collections, editor_token):
        """Non-admin gets 403."""
        resp = await client.post(
            "/api/v1/intake-types",
            json={"intakeTypeName": "Nope"},
            headers=auth_headers(editor_token),
        )
        assert resp.status_code == 403

    async def test_missing_name(self, client, mock_collections, admin_token):
        """Missing required field returns 422."""
        resp = await client.post(
            "/api/v1/intake-types",
            json={},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 422


# =========================================================================
# GET /api/v1/intake-types/{intakeTypeId}
# =========================================================================


class TestGetIntakeType:
    async def test_success(self, client, mock_collections, admin_token):
        """Returns a single intake type."""
        doc = make_intake_type_doc()
        mock_collections["intake_types"].find_one = AsyncMock(return_value=doc)

        resp = await client.get(
            f"/api/v1/intake-types/{INTAKE_TYPE_ID}",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["intakeTypeId"] == INTAKE_TYPE_ID

    async def test_not_found(self, client, mock_collections, admin_token):
        """Non-existent intake type returns 404."""
        mock_collections["intake_types"].find_one = AsyncMock(return_value=None)

        resp = await client.get(
            f"/api/v1/intake-types/{INTAKE_TYPE_ID}",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 404

    async def test_invalid_id(self, client, mock_collections, admin_token):
        """Invalid ObjectId returns 400."""
        resp = await client.get(
            "/api/v1/intake-types/not-valid",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 400


# =========================================================================
# PATCH /api/v1/intake-types/{intakeTypeId}
# =========================================================================


class TestUpdateIntakeType:
    async def test_success(self, client, mock_collections, admin_token):
        """Admin can update an intake type."""
        updated_doc = make_intake_type_doc(intake_type_name="Updated Name")
        mock_collections["intake_types"].find_one_and_update = AsyncMock(
            return_value=updated_doc
        )

        resp = await client.patch(
            f"/api/v1/intake-types/{INTAKE_TYPE_ID}",
            json={"intakeTypeName": "Updated Name"},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["intakeTypeName"] == "Updated Name"

    async def test_no_fields(self, client, mock_collections, admin_token):
        """Empty update returns 400."""
        resp = await client.patch(
            f"/api/v1/intake-types/{INTAKE_TYPE_ID}",
            json={},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 400

    async def test_non_admin_rejected(self, client, mock_collections, editor_token):
        """Non-admin gets 403."""
        resp = await client.patch(
            f"/api/v1/intake-types/{INTAKE_TYPE_ID}",
            json={"intakeTypeName": "Nope"},
            headers=auth_headers(editor_token),
        )
        assert resp.status_code == 403
