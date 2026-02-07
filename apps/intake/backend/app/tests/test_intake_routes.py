"""Tests for intake CRUD endpoints (app/api/v1/intakes.py).

Covers:
- POST /api/v1/intakes (create with template instantiation)
- GET /api/v1/intakes (list with filtering)
- GET /api/v1/intakes/{id} (get with progress)
- PATCH /api/v1/intakes/{id} (update)
- POST /api/v1/intakes/{id}/rotateCode
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId

from app.tests.conftest import (
    ACCOUNT_ID,
    INTAKE_ID,
    INTAKE_TYPE_ID,
    SECTION_INSTANCE_ID,
    TEMPLATE_SECTION_ID,
    TEMPLATE_VERSION_ID,
    USER_ID,
    auth_headers,
    make_intake_doc,
    make_section_instance_doc,
    make_template_question_doc,
    make_template_section_doc,
    make_template_version_doc,
)


# =========================================================================
# POST /api/v1/intakes
# =========================================================================


class TestCreateIntake:
    async def test_success(self, client, mock_collections, admin_token):
        """Create an intake with a published template -- should return
        the intake with progress summary and the one-time plain code."""
        tv_doc = make_template_version_doc(is_published=True)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)

        # Template sections
        section_doc = make_template_section_doc()
        mock_collections["template_sections"].set_find_results([section_doc])

        # Template questions for the section
        question_doc = make_template_question_doc()
        mock_collections["template_questions"].set_find_results([question_doc])

        # Insert results
        intake_oid = ObjectId()
        insert_result = AsyncMock()
        insert_result.inserted_id = intake_oid
        mock_collections["intakes"].insert_one = AsyncMock(return_value=insert_result)

        si_oid = ObjectId()
        si_result = AsyncMock()
        si_result.inserted_id = si_oid
        mock_collections["intake_section_instances"].insert_one = AsyncMock(
            return_value=si_result
        )
        mock_collections["intake_question_instances"].insert_many = AsyncMock()

        # Progress summary needs section instance find
        mock_collections["intake_section_instances"].set_find_results([
            make_section_instance_doc(si_id=str(si_oid), intake_id=str(intake_oid))
        ])

        resp = await client.post(
            "/api/v1/intakes",
            json={
                "intakeTypeId": INTAKE_TYPE_ID,
                "templateVersionId": TEMPLATE_VERSION_ID,
                "intakeName": "New Client Intake",
            },
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "intakeId" in data
        assert "intakeCode" in data
        assert "intakePortalUrl" in data

    async def test_missing_required_fields(self, client, mock_collections, admin_token):
        """Missing intakeTypeId or templateVersionId returns 422."""
        resp = await client.post(
            "/api/v1/intakes",
            json={"intakeName": "No Template"},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 422

    async def test_template_not_found(self, client, mock_collections, admin_token):
        """Non-existent template version returns 404."""
        mock_collections["template_versions"].find_one = AsyncMock(return_value=None)

        resp = await client.post(
            "/api/v1/intakes",
            json={
                "intakeTypeId": INTAKE_TYPE_ID,
                "templateVersionId": TEMPLATE_VERSION_ID,
            },
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 404

    async def test_unpublished_template_rejected(self, client, mock_collections, admin_token):
        """Unpublished template returns 422."""
        tv_doc = make_template_version_doc(is_published=False)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)

        resp = await client.post(
            "/api/v1/intakes",
            json={
                "intakeTypeId": INTAKE_TYPE_ID,
                "templateVersionId": TEMPLATE_VERSION_ID,
            },
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 422

    async def test_invalid_template_id_format(self, client, mock_collections, admin_token):
        """Invalid ObjectId format for templateVersionId returns 400."""
        resp = await client.post(
            "/api/v1/intakes",
            json={
                "intakeTypeId": INTAKE_TYPE_ID,
                "templateVersionId": "not-a-valid-objectid",
            },
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 400

    async def test_no_auth(self, client, mock_collections):
        """Unauthenticated request returns 401 or 403."""
        resp = await client.post(
            "/api/v1/intakes",
            json={
                "intakeTypeId": INTAKE_TYPE_ID,
                "templateVersionId": TEMPLATE_VERSION_ID,
            },
        )
        assert resp.status_code in (401, 403)


# =========================================================================
# GET /api/v1/intakes
# =========================================================================


class TestListIntakes:
    async def test_success(self, client, mock_collections, admin_token):
        """Lists intakes with progress rollups."""
        intake_doc = make_intake_doc()
        mock_collections["intakes"].set_find_results([intake_doc])
        mock_collections["intake_section_instances"].set_find_results([
            make_section_instance_doc()
        ])

        resp = await client.get("/api/v1/intakes", headers=auth_headers(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["intakeId"] == INTAKE_ID

    async def test_with_status_filter(self, client, mock_collections, admin_token):
        """Status filter is passed to the query."""
        mock_collections["intakes"].set_find_results([])
        mock_collections["intake_section_instances"].set_find_results([])

        resp = await client.get(
            "/api/v1/intakes?status=open",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200

    async def test_empty_list(self, client, mock_collections, admin_token):
        """Returns empty list when no intakes exist."""
        mock_collections["intakes"].set_find_results([])

        resp = await client.get("/api/v1/intakes", headers=auth_headers(admin_token))
        assert resp.status_code == 200
        assert resp.json() == []


# =========================================================================
# GET /api/v1/intakes/{intakeId}
# =========================================================================


class TestGetIntake:
    async def test_success(self, client, mock_collections, admin_token):
        """Returns full intake details with progress."""
        intake_doc = make_intake_doc()
        mock_collections["intakes"].find_one = AsyncMock(return_value=intake_doc)
        mock_collections["intake_section_instances"].set_find_results([
            make_section_instance_doc()
        ])

        resp = await client.get(
            f"/api/v1/intakes/{INTAKE_ID}",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["intakeId"] == INTAKE_ID
        assert "progress" in data

    async def test_not_found(self, client, mock_collections, admin_token):
        """Non-existent intake returns 404."""
        mock_collections["intakes"].find_one = AsyncMock(return_value=None)

        resp = await client.get(
            f"/api/v1/intakes/{INTAKE_ID}",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 404

    async def test_invalid_id_format(self, client, mock_collections, admin_token):
        """Invalid ObjectId format returns 400."""
        resp = await client.get(
            "/api/v1/intakes/not-a-valid-id",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 400


# =========================================================================
# PATCH /api/v1/intakes/{intakeId}
# =========================================================================


class TestUpdateIntake:
    async def test_success(self, client, mock_collections, admin_token):
        """Update intake name returns updated document."""
        updated_doc = make_intake_doc(intake_name="Updated Name")
        mock_collections["intakes"].find_one_and_update = AsyncMock(return_value=updated_doc)
        mock_collections["intake_section_instances"].set_find_results([
            make_section_instance_doc()
        ])

        resp = await client.patch(
            f"/api/v1/intakes/{INTAKE_ID}",
            json={"intakeName": "Updated Name"},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["intakeName"] == "Updated Name"

    async def test_no_fields_to_update(self, client, mock_collections, admin_token):
        """Empty update body (no recognized fields) returns 400."""
        resp = await client.patch(
            f"/api/v1/intakes/{INTAKE_ID}",
            json={"bogusField": "value"},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 400

    async def test_not_found(self, client, mock_collections, admin_token):
        """Updating a non-existent intake returns 404."""
        mock_collections["intakes"].find_one_and_update = AsyncMock(return_value=None)

        resp = await client.patch(
            f"/api/v1/intakes/{INTAKE_ID}",
            json={"intakeName": "New Name"},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 404

    async def test_update_status(self, client, mock_collections, admin_token):
        """Can update the status field."""
        updated_doc = make_intake_doc(status_val="closed")
        mock_collections["intakes"].find_one_and_update = AsyncMock(return_value=updated_doc)
        mock_collections["intake_section_instances"].set_find_results([])

        resp = await client.patch(
            f"/api/v1/intakes/{INTAKE_ID}",
            json={"status": "closed"},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200


# =========================================================================
# POST /api/v1/intakes/{intakeId}/rotateCode
# =========================================================================


class TestRotateCode:
    async def test_success(self, client, mock_collections, admin_token):
        """Rotate code returns a new plain code and portal URL."""
        intake_doc = make_intake_doc()
        mock_collections["intakes"].find_one = AsyncMock(return_value=intake_doc)

        # find_one_and_update returns the updated doc
        updated_doc = make_intake_doc()
        updated_doc["intakeCode"] = "NEWCODE"
        mock_collections["intakes"].find_one_and_update = AsyncMock(
            return_value=updated_doc
        )

        resp = await client.post(
            f"/api/v1/intakes/{INTAKE_ID}/rotateCode",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        # The route generates a new code, so intakeCode should be present
        assert "intakeCode" in data
        assert "intakePortalUrl" in data

    async def test_intake_not_found(self, client, mock_collections, admin_token):
        """Rotating code on a non-existent intake returns 404."""
        mock_collections["intakes"].find_one = AsyncMock(return_value=None)

        resp = await client.post(
            f"/api/v1/intakes/{INTAKE_ID}/rotateCode",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 404

    async def test_invalid_id(self, client, mock_collections, admin_token):
        """Invalid ObjectId returns 400."""
        resp = await client.post(
            "/api/v1/intakes/bad-id/rotateCode",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 400
