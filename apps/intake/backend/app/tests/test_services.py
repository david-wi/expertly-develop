"""Tests for the service layer modules.

Covers:
- intake_service: create_intake, calculate_progress, rotate_intake_code,
  instantiate_template, verify_code, get_intake_portal_url
- answer_service: create_revision, choose_current, mark_question_status,
  detect_conflicts, _hashable
- progress_service: get_intake_progress, get_section_progress,
  get_question_status_counts, generate_narrative_summary
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from bson import ObjectId

from app.tests.conftest import (
    ACCOUNT_ID,
    INTAKE_ID,
    INTAKE_TYPE_ID,
    QUESTION_INSTANCE_ID,
    REVISION_ID,
    SECTION_INSTANCE_ID,
    TEMPLATE_QUESTION_ID,
    TEMPLATE_SECTION_ID,
    TEMPLATE_VERSION_ID,
    USER_ID,
    MockCollection,
    MockCursor,
    make_question_instance_doc,
    make_section_instance_doc,
    make_template_question_doc,
    make_template_section_doc,
)


NOW = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Fixture to wire up mock collections for all services
# ---------------------------------------------------------------------------


@pytest.fixture
def service_collections(mock_collections):
    """Alias for mock_collections -- services use the same global registry."""
    return mock_collections


# =========================================================================
# intake_service
# =========================================================================


class TestIntakeServiceCreateIntake:
    async def test_creates_intake_and_instantiates_template(self, service_collections):
        from app.services.intake_service import create_intake

        cols = service_collections

        # insert_one for the intake doc
        intake_oid = ObjectId(INTAKE_ID)
        insert_result = AsyncMock()
        insert_result.inserted_id = intake_oid
        cols["intakes"].insert_one = AsyncMock(return_value=insert_result)

        # Template section to instantiate
        section_doc = make_template_section_doc()
        cols["template_sections"].set_find_results([section_doc])

        # Template question
        question_doc = make_template_question_doc()
        cols["template_questions"].set_find_results([question_doc])

        # Section instance insert
        si_oid = ObjectId(SECTION_INSTANCE_ID)
        si_result = AsyncMock()
        si_result.inserted_id = si_oid
        cols["intake_section_instances"].insert_one = AsyncMock(return_value=si_result)
        cols["intake_question_instances"].insert_many = AsyncMock()

        result = await create_intake(
            account_id=ACCOUNT_ID,
            intake_type_id=INTAKE_TYPE_ID,
            template_version_id=TEMPLATE_VERSION_ID,
            title="Test Intake",
            created_by_user_id=USER_ID,
        )

        assert result["intakeId"] == INTAKE_ID
        assert "intakeCode" in result
        assert len(result["intakeCode"]) == 6
        cols["intakes"].insert_one.assert_awaited_once()
        cols["intake_section_instances"].insert_one.assert_awaited_once()
        cols["intake_question_instances"].insert_many.assert_awaited_once()

    async def test_creates_intake_with_description(self, service_collections):
        from app.services.intake_service import create_intake

        cols = service_collections

        intake_oid = ObjectId()
        insert_result = AsyncMock()
        insert_result.inserted_id = intake_oid
        cols["intakes"].insert_one = AsyncMock(return_value=insert_result)
        cols["template_sections"].set_find_results([])

        result = await create_intake(
            account_id=ACCOUNT_ID,
            intake_type_id=INTAKE_TYPE_ID,
            template_version_id=TEMPLATE_VERSION_ID,
            title="Intake With Desc",
            created_by_user_id=USER_ID,
            description="A detailed description",
        )

        call_args = cols["intakes"].insert_one.call_args
        doc = call_args[0][0]
        assert doc["description"] == "A detailed description"


class TestIntakeServiceCalculateProgress:
    async def test_empty_intake(self, service_collections):
        """Intake with no section instances returns zero counts."""
        from app.services.intake_service import calculate_progress

        service_collections["intake_section_instances"].set_find_results([])

        result = await calculate_progress(INTAKE_ID)
        assert result["totalQuestions"] == 0
        assert result["percentComplete"] == 0.0
        assert result["totalSections"] == 0

    async def test_all_answered(self, service_collections):
        """All questions answered yields 100% complete."""
        from app.services.intake_service import calculate_progress

        si_doc = make_section_instance_doc()
        service_collections["intake_section_instances"].set_find_results([si_doc])

        q1 = make_question_instance_doc(question_status="answered")
        q2 = make_question_instance_doc(
            qi_id=str(ObjectId()), question_status="answered"
        )
        service_collections["intake_question_instances"].set_find_results([q1, q2])

        result = await calculate_progress(INTAKE_ID)
        assert result["totalQuestions"] == 2
        assert result["answeredQuestions"] == 2
        assert result["percentComplete"] == 100.0

    async def test_mixed_statuses(self, service_collections):
        """Mixed statuses are counted correctly."""
        from app.services.intake_service import calculate_progress

        si_doc = make_section_instance_doc()
        service_collections["intake_section_instances"].set_find_results([si_doc])

        questions = [
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="answered"),
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="skipped"),
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="later"),
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="unanswered"),
        ]
        service_collections["intake_question_instances"].set_find_results(questions)

        result = await calculate_progress(INTAKE_ID)
        assert result["totalQuestions"] == 4
        assert result["answeredQuestions"] == 1
        assert result["skippedQuestions"] == 1
        assert result["laterQuestions"] == 1
        assert result["unansweredQuestions"] == 1
        assert result["percentComplete"] == 25.0


class TestIntakeServiceRotateCode:
    async def test_rotates_code(self, service_collections):
        from app.services.intake_service import rotate_intake_code

        service_collections["intakes"].update_one = AsyncMock()

        new_code = await rotate_intake_code(INTAKE_ID)
        assert len(new_code) == 6
        assert new_code.isalnum()
        service_collections["intakes"].update_one.assert_awaited_once()


class TestIntakeServiceVerifyCode:
    def test_verify_correct(self):
        from app.services.intake_service import generate_intake_code_pair, verify_code

        plain, hashed = generate_intake_code_pair()
        assert verify_code(plain, hashed) is True

    def test_verify_wrong(self):
        from app.services.intake_service import generate_intake_code_pair, verify_code

        _, hashed = generate_intake_code_pair()
        assert verify_code("ZZZZZZ", hashed) is False


class TestIntakeServicePortalUrl:
    def test_portal_url(self):
        from app.services.intake_service import get_intake_portal_url

        url = get_intake_portal_url("abc123")
        assert "abc123" in url
        assert url.startswith("https://")


# =========================================================================
# answer_service
# =========================================================================


class TestAnswerServiceCreateRevision:
    async def test_creates_revision_and_sets_current(self, service_collections):
        from app.services.answer_service import create_revision

        cols = service_collections

        # insert answer revision
        rev_oid = ObjectId(REVISION_ID)
        rev_result = AsyncMock()
        rev_result.inserted_id = rev_oid
        cols["answer_revisions"].insert_one = AsyncMock(return_value=rev_result)

        # upsert current answer
        cols["current_answers"].update_one = AsyncMock()
        current_doc = {"_id": ObjectId(), "intakeQuestionInstanceId": QUESTION_INSTANCE_ID}
        cols["current_answers"].find_one = AsyncMock(return_value=current_doc)

        # update question status
        cols["intake_question_instances"].update_one = AsyncMock()

        result = await create_revision(
            question_instance_id=QUESTION_INSTANCE_ID,
            answer_value="John Doe",
            source="manual",
        )

        assert result["answerRevisionId"] == REVISION_ID
        assert result["currentAnswerId"] is not None
        cols["intake_question_instances"].update_one.assert_awaited_once()

    async def test_creates_revision_without_setting_current(self, service_collections):
        from app.services.answer_service import create_revision

        cols = service_collections

        rev_oid = ObjectId(REVISION_ID)
        rev_result = AsyncMock()
        rev_result.inserted_id = rev_oid
        cols["answer_revisions"].insert_one = AsyncMock(return_value=rev_result)

        result = await create_revision(
            question_instance_id=QUESTION_INSTANCE_ID,
            answer_value="Draft answer",
            set_as_current=False,
        )

        assert result["answerRevisionId"] == REVISION_ID
        assert result["currentAnswerId"] is None
        cols["current_answers"].update_one.assert_not_awaited()


class TestAnswerServiceChooseCurrent:
    async def test_success(self, service_collections):
        from app.services.answer_service import choose_current

        cols = service_collections

        revision_doc = {
            "_id": ObjectId(REVISION_ID),
            "intakeQuestionInstanceId": QUESTION_INSTANCE_ID,
            "answerValue": "The answer",
        }
        cols["answer_revisions"].find_one = AsyncMock(return_value=revision_doc)
        cols["current_answers"].update_one = AsyncMock()
        current_doc = {"_id": ObjectId(), "intakeQuestionInstanceId": QUESTION_INSTANCE_ID}
        cols["current_answers"].find_one = AsyncMock(return_value=current_doc)
        cols["intake_question_instances"].update_one = AsyncMock()

        result = await choose_current(QUESTION_INSTANCE_ID, REVISION_ID)
        assert result["answerRevisionId"] == REVISION_ID

    async def test_revision_not_found(self, service_collections):
        from app.services.answer_service import choose_current

        service_collections["answer_revisions"].find_one = AsyncMock(return_value=None)

        with pytest.raises(ValueError, match="not found"):
            await choose_current(QUESTION_INSTANCE_ID, REVISION_ID)

    async def test_revision_wrong_question(self, service_collections):
        from app.services.answer_service import choose_current

        wrong_revision = {
            "_id": ObjectId(REVISION_ID),
            "intakeQuestionInstanceId": "other-question-id",
            "answerValue": "something",
        }
        service_collections["answer_revisions"].find_one = AsyncMock(
            return_value=wrong_revision
        )

        with pytest.raises(ValueError, match="does not belong"):
            await choose_current(QUESTION_INSTANCE_ID, REVISION_ID)


class TestAnswerServiceMarkQuestionStatus:
    async def test_valid_statuses(self, service_collections):
        from app.services.answer_service import mark_question_status

        cols = service_collections
        cols["intake_question_instances"].update_one = AsyncMock()

        for status in ("skipped", "later", "notApplicable"):
            result = await mark_question_status(QUESTION_INSTANCE_ID, status)
            assert result["questionStatus"] == status

    async def test_invalid_status_raises(self, service_collections):
        from app.services.answer_service import mark_question_status

        with pytest.raises(ValueError, match="Invalid status"):
            await mark_question_status(QUESTION_INSTANCE_ID, "answered")

    async def test_with_reason(self, service_collections):
        from app.services.answer_service import mark_question_status

        cols = service_collections
        cols["intake_question_instances"].update_one = AsyncMock()

        result = await mark_question_status(
            QUESTION_INSTANCE_ID, "skipped", reason="Not applicable to this client"
        )
        assert result["questionStatus"] == "skipped"

        # Verify the reason was included in the update
        call_args = cols["intake_question_instances"].update_one.call_args
        update_dict = call_args[0][1]["$set"]
        assert update_dict["statusReason"] == "Not applicable to this client"


class TestAnswerServiceDetectConflicts:
    async def test_no_conflicts_single_contributor(self, service_collections):
        from app.services.answer_service import detect_conflicts

        cols = service_collections

        si_doc = make_section_instance_doc()
        cols["intake_section_instances"].set_find_results([si_doc])

        qi_doc = make_question_instance_doc()
        cols["intake_question_instances"].set_find_results([qi_doc])

        # Two revisions from the same contributor
        revisions = [
            {
                "_id": ObjectId(),
                "intakeQuestionInstanceId": QUESTION_INSTANCE_ID,
                "contributorId": ACCOUNT_ID,
                "answerValue": "Answer A",
                "createdAt": NOW,
            },
            {
                "_id": ObjectId(),
                "intakeQuestionInstanceId": QUESTION_INSTANCE_ID,
                "contributorId": ACCOUNT_ID,
                "answerValue": "Answer B",
                "createdAt": NOW,
            },
        ]
        cols["answer_revisions"].set_find_results(revisions)

        conflicts = await detect_conflicts(INTAKE_ID)
        assert len(conflicts) == 0

    async def test_conflict_detected(self, service_collections):
        from app.services.answer_service import detect_conflicts

        cols = service_collections

        si_doc = make_section_instance_doc()
        cols["intake_section_instances"].set_find_results([si_doc])

        qi_doc = make_question_instance_doc()
        cols["intake_question_instances"].set_find_results([qi_doc])

        contributor_a = str(ObjectId())
        contributor_b = str(ObjectId())
        revisions = [
            {
                "_id": ObjectId(),
                "intakeQuestionInstanceId": QUESTION_INSTANCE_ID,
                "contributorId": contributor_a,
                "answerValue": "Answer A",
                "createdAt": NOW,
            },
            {
                "_id": ObjectId(),
                "intakeQuestionInstanceId": QUESTION_INSTANCE_ID,
                "contributorId": contributor_b,
                "answerValue": "Different Answer",
                "createdAt": NOW,
            },
        ]
        cols["answer_revisions"].set_find_results(revisions)

        conflicts = await detect_conflicts(INTAKE_ID)
        assert len(conflicts) == 1
        assert conflicts[0]["questionInstanceId"] == QUESTION_INSTANCE_ID

    async def test_no_conflicts_same_answer(self, service_collections):
        """Two contributors with the same answer should not be a conflict."""
        from app.services.answer_service import detect_conflicts

        cols = service_collections

        si_doc = make_section_instance_doc()
        cols["intake_section_instances"].set_find_results([si_doc])

        qi_doc = make_question_instance_doc()
        cols["intake_question_instances"].set_find_results([qi_doc])

        contributor_a = str(ObjectId())
        contributor_b = str(ObjectId())
        revisions = [
            {
                "_id": ObjectId(),
                "intakeQuestionInstanceId": QUESTION_INSTANCE_ID,
                "contributorId": contributor_a,
                "answerValue": "Same Answer",
                "createdAt": NOW,
            },
            {
                "_id": ObjectId(),
                "intakeQuestionInstanceId": QUESTION_INSTANCE_ID,
                "contributorId": contributor_b,
                "answerValue": "Same Answer",
                "createdAt": NOW,
            },
        ]
        cols["answer_revisions"].set_find_results(revisions)

        conflicts = await detect_conflicts(INTAKE_ID)
        assert len(conflicts) == 0

    async def test_no_sections(self, service_collections):
        """Intake with no sections returns empty conflicts."""
        from app.services.answer_service import detect_conflicts

        service_collections["intake_section_instances"].set_find_results([])

        conflicts = await detect_conflicts(INTAKE_ID)
        assert conflicts == []


class TestHashable:
    """Unit tests for the _hashable helper function."""

    def test_string(self):
        from app.services.answer_service import _hashable

        assert _hashable("hello") == "hello"

    def test_number(self):
        from app.services.answer_service import _hashable

        assert _hashable(42) == 42

    def test_dict(self):
        from app.services.answer_service import _hashable

        result = _hashable({"b": 2, "a": 1})
        assert isinstance(result, tuple)

    def test_list(self):
        from app.services.answer_service import _hashable

        result = _hashable([1, 2, 3])
        assert result == (1, 2, 3)

    def test_nested(self):
        from app.services.answer_service import _hashable

        result = _hashable({"a": [1, {"b": 2}]})
        assert isinstance(result, tuple)

    def test_none(self):
        from app.services.answer_service import _hashable

        assert _hashable(None) is None


# =========================================================================
# progress_service
# =========================================================================


class TestProgressServiceGetIntakeProgress:
    async def test_empty_intake(self, service_collections):
        from app.services.progress_service import get_intake_progress

        service_collections["intake_section_instances"].set_find_results([])

        result = await get_intake_progress(INTAKE_ID)
        assert result["totalSections"] == 0
        assert result["totalQuestions"] == 0
        assert result["percentComplete"] == 0.0
        assert result["sections"] == []

    async def test_with_sections_and_questions(self, service_collections):
        from app.services.progress_service import get_intake_progress

        cols = service_collections

        si_doc = make_section_instance_doc()
        cols["intake_section_instances"].set_find_results([si_doc])

        # For get_section_progress: section instance lookup
        cols["intake_section_instances"].find_one = AsyncMock(return_value=si_doc)

        # Template section for name/order
        ts_doc = make_template_section_doc()
        cols["template_sections"].find_one = AsyncMock(return_value=ts_doc)

        # Questions in the section
        q1 = make_question_instance_doc(qi_id=str(ObjectId()), question_status="answered")
        q2 = make_question_instance_doc(qi_id=str(ObjectId()), question_status="unanswered")
        cols["intake_question_instances"].set_find_results([q1, q2])

        result = await get_intake_progress(INTAKE_ID)
        assert result["totalSections"] == 1
        assert result["totalQuestions"] == 2
        assert result["answeredQuestions"] == 1
        assert result["unansweredQuestions"] == 1
        assert result["percentComplete"] == 50.0
        assert len(result["sections"]) == 1


class TestProgressServiceGetSectionProgress:
    async def test_complete_section(self, service_collections):
        from app.services.progress_service import get_section_progress

        cols = service_collections

        si_doc = make_section_instance_doc()
        cols["intake_section_instances"].find_one = AsyncMock(return_value=si_doc)

        ts_doc = make_template_section_doc(section_name="Vehicle Details")
        cols["template_sections"].find_one = AsyncMock(return_value=ts_doc)

        # All answered
        questions = [
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="answered"),
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="answered"),
        ]
        cols["intake_question_instances"].set_find_results(questions)

        result = await get_section_progress(SECTION_INSTANCE_ID)
        assert result["isComplete"] is True
        assert result["sectionName"] == "Vehicle Details"
        assert result["answeredQuestions"] == 2

    async def test_incomplete_section(self, service_collections):
        from app.services.progress_service import get_section_progress

        cols = service_collections

        si_doc = make_section_instance_doc()
        cols["intake_section_instances"].find_one = AsyncMock(return_value=si_doc)

        ts_doc = make_template_section_doc()
        cols["template_sections"].find_one = AsyncMock(return_value=ts_doc)

        questions = [
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="answered"),
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="later"),
        ]
        cols["intake_question_instances"].set_find_results(questions)

        result = await get_section_progress(SECTION_INSTANCE_ID)
        assert result["isComplete"] is False
        assert result["laterQuestions"] == 1


class TestProgressServiceQuestionStatusCounts:
    async def test_counts_all_statuses(self, service_collections):
        from app.services.progress_service import get_question_status_counts

        questions = [
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="answered"),
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="answered"),
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="skipped"),
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="later"),
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="notApplicable"),
            make_question_instance_doc(qi_id=str(ObjectId()), question_status="unanswered"),
        ]
        service_collections["intake_question_instances"].set_find_results(questions)

        counts = await get_question_status_counts(SECTION_INSTANCE_ID)
        assert counts["answered"] == 2
        assert counts["skipped"] == 1
        assert counts["later"] == 1
        assert counts["notApplicable"] == 1
        assert counts["unanswered"] == 1

    async def test_empty_section(self, service_collections):
        from app.services.progress_service import get_question_status_counts

        service_collections["intake_question_instances"].set_find_results([])

        counts = await get_question_status_counts(SECTION_INSTANCE_ID)
        assert counts == {
            "unanswered": 0,
            "answered": 0,
            "skipped": 0,
            "later": 0,
            "notApplicable": 0,
        }


class TestProgressServiceNarrativeSummary:
    async def test_no_section_found(self, service_collections):
        from app.services.progress_service import generate_narrative_summary

        service_collections["intake_section_instances"].find_one = AsyncMock(
            return_value=None
        )

        result = await generate_narrative_summary(SECTION_INSTANCE_ID)
        assert result == "Section not found."

    async def test_no_answers_yet(self, service_collections):
        from app.services.progress_service import generate_narrative_summary

        cols = service_collections

        si_doc = make_section_instance_doc()
        cols["intake_section_instances"].find_one = AsyncMock(return_value=si_doc)

        ts_doc = make_template_section_doc(section_name="General Info")
        cols["template_sections"].find_one = AsyncMock(return_value=ts_doc)

        # No answered questions
        cols["intake_question_instances"].set_find_results([])

        result = await generate_narrative_summary(SECTION_INSTANCE_ID)
        assert "No answers have been captured yet" in result
        assert "General Info" in result

    async def test_with_answers(self, service_collections):
        from app.services.progress_service import generate_narrative_summary

        cols = service_collections

        si_doc = make_section_instance_doc()
        cols["intake_section_instances"].find_one = AsyncMock(return_value=si_doc)

        ts_doc = make_template_section_doc(section_name="Vehicle Section")
        cols["template_sections"].find_one = AsyncMock(return_value=ts_doc)

        qi_id = str(ObjectId())
        question = make_question_instance_doc(qi_id=qi_id, question_status="answered")
        cols["intake_question_instances"].set_find_results([question])

        # Template question for text
        tq_doc = make_template_question_doc(
            question_text="What is the VIN?"
        )
        # find_one is called for template question
        # We need to be careful since multiple find_one calls happen
        # For this test, template_questions.find_one returns the question
        cols["template_questions"].find_one = AsyncMock(return_value=tq_doc)

        # Current answer
        current_answer = {
            "_id": ObjectId(),
            "intakeQuestionInstanceId": qi_id,
            "answerValue": "1HGBH41JXMN109186",
        }
        cols["current_answers"].find_one = AsyncMock(return_value=current_answer)

        result = await generate_narrative_summary(SECTION_INSTANCE_ID)
        assert "Vehicle Section" in result
        assert "What is the VIN?" in result
        assert "1HGBH41JXMN109186" in result
        assert "Progress:" in result
