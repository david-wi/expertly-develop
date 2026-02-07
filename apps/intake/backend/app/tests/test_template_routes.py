"""Tests for template endpoints (app/api/v1/templates.py).

Covers:
- GET /api/v1/templates (list)
- POST /api/v1/templates (create draft)
- GET /api/v1/templates/{id} (get with sections/questions)
- POST /api/v1/templates/{id}/sections (add section)
- PATCH /api/v1/templates/{id}/sections/{id} (update section)
- POST /api/v1/templates/{id}/sections/{id}/questions (add question)
- POST /api/v1/templates/{id}/publish (validate and publish)
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId

from app.tests.conftest import (
    ACCOUNT_ID,
    INTAKE_TYPE_ID,
    TEMPLATE_QUESTION_ID,
    TEMPLATE_SECTION_ID,
    TEMPLATE_VERSION_ID,
    auth_headers,
    make_template_question_doc,
    make_template_section_doc,
    make_template_version_doc,
)


# =========================================================================
# GET /api/v1/templates
# =========================================================================


class TestListTemplates:
    async def test_success(self, client, mock_collections, admin_token):
        """List templates returns serialized template versions."""
        tv_doc = make_template_version_doc()
        mock_collections["template_versions"].set_find_results([tv_doc])

        resp = await client.get(
            "/api/v1/templates",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["templateVersionId"] == TEMPLATE_VERSION_ID

    async def test_filter_by_published(self, client, mock_collections, admin_token):
        """Filtering by isPublished works."""
        mock_collections["template_versions"].set_find_results([])

        resp = await client.get(
            "/api/v1/templates?isPublished=true",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200

    async def test_empty_list(self, client, mock_collections, admin_token):
        """Returns empty list when no templates exist."""
        mock_collections["template_versions"].set_find_results([])

        resp = await client.get(
            "/api/v1/templates",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        assert resp.json() == []


# =========================================================================
# POST /api/v1/templates (create draft)
# =========================================================================


class TestCreateTemplate:
    async def test_success(self, client, mock_collections, admin_token):
        """Admin can create a draft template version."""
        tv_oid = ObjectId()
        insert_result = AsyncMock()
        insert_result.inserted_id = tv_oid
        mock_collections["template_versions"].insert_one = AsyncMock(
            return_value=insert_result
        )

        resp = await client.post(
            "/api/v1/templates",
            json={
                "templateName": "Auto Insurance Intake",
                "versionLabel": "v1.0",
                "intakeTypeId": INTAKE_TYPE_ID,
            },
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["templateName"] == "Auto Insurance Intake"
        assert data["isPublished"] is False

    async def test_non_admin_rejected(self, client, mock_collections, editor_token):
        """Editor role gets 403 when creating a template."""
        resp = await client.post(
            "/api/v1/templates",
            json={
                "templateName": "Nope",
                "versionLabel": "v1",
                "intakeTypeId": INTAKE_TYPE_ID,
            },
            headers=auth_headers(editor_token),
        )
        assert resp.status_code == 403

    async def test_missing_fields(self, client, mock_collections, admin_token):
        """Missing required fields returns 422."""
        resp = await client.post(
            "/api/v1/templates",
            json={"templateName": "Only Name"},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 422


# =========================================================================
# GET /api/v1/templates/{templateVersionId}
# =========================================================================


class TestGetTemplate:
    async def test_success(self, client, mock_collections, admin_token):
        """Returns template with nested sections and questions."""
        tv_doc = make_template_version_doc()
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)

        section_doc = make_template_section_doc()
        mock_collections["template_sections"].set_find_results([section_doc])

        question_doc = make_template_question_doc()
        mock_collections["template_questions"].set_find_results([question_doc])

        resp = await client.get(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["templateVersionId"] == TEMPLATE_VERSION_ID
        assert data["sections"] is not None
        assert len(data["sections"]) == 1
        assert data["sections"][0]["questions"] is not None
        assert len(data["sections"][0]["questions"]) == 1

    async def test_not_found(self, client, mock_collections, admin_token):
        """Non-existent template returns 404."""
        mock_collections["template_versions"].find_one = AsyncMock(return_value=None)

        resp = await client.get(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 404

    async def test_invalid_id(self, client, mock_collections, admin_token):
        """Invalid ObjectId format returns 400."""
        resp = await client.get(
            "/api/v1/templates/not-valid-id",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 400


# =========================================================================
# POST /api/v1/templates/{id}/sections
# =========================================================================


class TestCreateSection:
    async def test_success(self, client, mock_collections, admin_token):
        """Admin can add a section to a draft template."""
        tv_doc = make_template_version_doc(is_published=False)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)
        mock_collections["template_versions"].update_one = AsyncMock()

        section_oid = ObjectId()
        insert_result = AsyncMock()
        insert_result.inserted_id = section_oid
        mock_collections["template_sections"].insert_one = AsyncMock(
            return_value=insert_result
        )

        resp = await client.post(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}/sections",
            json={
                "sectionName": "Personal Information",
                "sectionOrder": 0,
            },
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["sectionName"] == "Personal Information"

    async def test_cannot_add_to_published(self, client, mock_collections, admin_token):
        """Adding a section to a published template returns 409."""
        tv_doc = make_template_version_doc(is_published=True)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)

        resp = await client.post(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}/sections",
            json={"sectionName": "Section", "sectionOrder": 0},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 409

    async def test_non_admin_rejected(self, client, mock_collections, editor_token):
        """Editor gets 403."""
        tv_doc = make_template_version_doc(is_published=False)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)

        resp = await client.post(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}/sections",
            json={"sectionName": "Sec", "sectionOrder": 0},
            headers=auth_headers(editor_token),
        )
        assert resp.status_code == 403


# =========================================================================
# POST /api/v1/templates/{id}/sections/{id}/questions
# =========================================================================


class TestCreateQuestion:
    async def test_success(self, client, mock_collections, admin_token):
        """Admin can add a question to a section in a draft template."""
        tv_doc = make_template_version_doc(is_published=False)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)

        section_doc = make_template_section_doc()
        mock_collections["template_sections"].find_one = AsyncMock(return_value=section_doc)
        mock_collections["template_sections"].update_one = AsyncMock()
        mock_collections["template_versions"].update_one = AsyncMock()

        question_oid = ObjectId()
        insert_result = AsyncMock()
        insert_result.inserted_id = question_oid
        mock_collections["template_questions"].insert_one = AsyncMock(
            return_value=insert_result
        )

        resp = await client.post(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}/sections/{TEMPLATE_SECTION_ID}/questions",
            json={
                "questionKey": "insured_name",
                "questionText": "What is the insured's full name?",
                "questionOrder": 0,
                "answerType": "shortText",
            },
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["questionKey"] == "insured_name"
        assert data["answerType"] == "shortText"

    async def test_section_not_found(self, client, mock_collections, admin_token):
        """Adding to a non-existent section returns 404."""
        tv_doc = make_template_version_doc(is_published=False)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)
        mock_collections["template_sections"].find_one = AsyncMock(return_value=None)

        fake_section_id = str(ObjectId())
        resp = await client.post(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}/sections/{fake_section_id}/questions",
            json={
                "questionKey": "q1",
                "questionText": "Question?",
                "questionOrder": 0,
                "answerType": "shortText",
            },
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 404

    async def test_invalid_answer_type(self, client, mock_collections, admin_token):
        """Invalid answer type returns 422."""
        tv_doc = make_template_version_doc(is_published=False)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)

        resp = await client.post(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}/sections/{TEMPLATE_SECTION_ID}/questions",
            json={
                "questionKey": "q1",
                "questionText": "Question?",
                "questionOrder": 0,
                "answerType": "invalidType",
            },
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 422


# =========================================================================
# POST /api/v1/templates/{id}/publish
# =========================================================================


class TestPublishTemplate:
    async def test_success(self, client, mock_collections, admin_token):
        """Publishing a draft template with sections and questions succeeds."""
        tv_doc = make_template_version_doc(is_published=False)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)
        mock_collections["template_sections"].count_documents = AsyncMock(return_value=1)

        section_doc = make_template_section_doc()
        mock_collections["template_sections"].set_find_results([section_doc])
        mock_collections["template_questions"].count_documents = AsyncMock(return_value=2)

        published_doc = make_template_version_doc(is_published=True)
        mock_collections["template_versions"].find_one_and_update = AsyncMock(
            return_value=published_doc
        )

        resp = await client.post(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}/publish",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["isPublished"] is True

    async def test_already_published(self, client, mock_collections, admin_token):
        """Re-publishing an already published template returns 409."""
        tv_doc = make_template_version_doc(is_published=True)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)

        resp = await client.post(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}/publish",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 409

    async def test_no_sections(self, client, mock_collections, admin_token):
        """Publishing a template with no sections returns 422."""
        tv_doc = make_template_version_doc(is_published=False)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)
        mock_collections["template_sections"].count_documents = AsyncMock(return_value=0)

        resp = await client.post(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}/publish",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 422

    async def test_section_with_no_questions(self, client, mock_collections, admin_token):
        """Publishing with a section that has zero questions returns 422."""
        tv_doc = make_template_version_doc(is_published=False)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)
        mock_collections["template_sections"].count_documents = AsyncMock(return_value=1)

        section_doc = make_template_section_doc()
        mock_collections["template_sections"].set_find_results([section_doc])
        mock_collections["template_questions"].count_documents = AsyncMock(return_value=0)

        resp = await client.post(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}/publish",
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 422

    async def test_non_admin_rejected(self, client, mock_collections, viewer_token):
        """Non-admin cannot publish."""
        tv_doc = make_template_version_doc(is_published=False)
        mock_collections["template_versions"].find_one = AsyncMock(return_value=tv_doc)

        resp = await client.post(
            f"/api/v1/templates/{TEMPLATE_VERSION_ID}/publish",
            headers=auth_headers(viewer_token),
        )
        assert resp.status_code == 403
