"""Tests for Pydantic schema validation across all schema modules.

Verifies:
- Valid data instantiation
- Required field enforcement
- Enum constraints
- Alias resolution (camelCase <-> snake_case)
- The ResponseEnvelope generic pattern
"""

from datetime import date, datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas.common import (
    ErrorDetail,
    PaginatedResponse,
    PaginationParams,
    PyObjectId,
    ResponseEnvelope,
    TimestampMixin,
)
from app.schemas.auth import (
    AccountResponse,
    CreateUserRequest,
    LoginRequest,
    LoginResponse,
    UserResponse,
)
from app.schemas.voice_profile import (
    VoiceProfileCreate,
    VoiceProfileResponse,
    VoiceProfileUpdate,
)
from app.schemas.intake_type import (
    IntakeTypeCreate,
    IntakeTypeResponse,
    IntakeTypeUpdate,
)
from app.schemas.template import (
    AnswerType,
    TemplateQuestionCreate,
    TemplateQuestionResponse,
    TemplateSectionCreate,
    TemplateSectionResponse,
    TemplateVersionCreate,
    TemplateVersionResponse,
)
from app.schemas.intake import (
    IntakeCreate,
    IntakeProgressSummary,
    IntakeQuestionInstanceResponse,
    IntakeResponse,
    IntakeSectionInstanceResponse,
    IntakeStatus,
    IntakeUpdate,
    QuestionInstanceStatus,
    SectionInstanceStatus,
)
from app.schemas.answer import (
    AnswerRevisionCreate,
    AnswerRevisionResponse,
    ChooseCurrentRequest,
    CurrentAnswerResponse,
    RevisionType,
)
from app.schemas.session import (
    SessionCreate,
    SessionParticipantResponse,
    SessionResponse,
    SessionStatus,
    SessionType,
    SessionUpdate,
    TranscriptCreate,
    TranscriptSegmentData,
)
from app.schemas.evidence import (
    EvidenceCreate,
    EvidenceResponse,
    EvidenceType,
)
from app.schemas.contributor import (
    AssignmentCreate,
    AssignmentPolicy,
    AssignmentResponse,
    ContactMethod,
    ContributorCreate,
    ContributorResponse,
)
from app.schemas.follow_up import (
    FollowUpContactMethod,
    FollowUpCreate,
    FollowUpResponse,
    FollowUpStatus,
)
from app.schemas.usage import (
    UsageReportResponse,
    UsageResponse,
    UsageRollup,
)
from app.schemas.file import (
    FileAssetResponse,
    FileListResponse,
    FileProcessingStatus,
    FileUploadRequest,
    FileUploadResponse,
)
from app.schemas.url import (
    RefreshPolicy,
    UrlFetchStatus,
    UrlSnapshotResponse,
    UrlSourceCreate,
    UrlSourceResponse,
)
from app.schemas.proposal import (
    ProposalRejectRequest,
    ProposalResponse,
    ProposalStatus,
)
from app.schemas.voice_call import (
    AnswerSubmitRequest,
    AnswerSubmitResponse,
    AuthenticateRequest,
    AuthenticateResponse,
    CallEndRequest,
    CallEndResponse,
    CallStartRequest,
    CallStartResponse,
    NextStepRequest,
    NextStepResponse,
)
from app.schemas.timeline import (
    TimelineEvent,
    TimelineEventType,
    TimelineResponse,
)
from app.schemas.export import (
    ExportFormat,
    ExportRequest,
    ExportResponse,
    ExportStatus,
)


NOW = datetime.now(timezone.utc)


# =========================================================================
# Common schemas
# =========================================================================


class TestPyObjectId:
    def test_valid_objectid_string(self):
        val = PyObjectId.validate("507f1f77bcf86cd799439011")
        assert val == "507f1f77bcf86cd799439011"

    def test_invalid_string_raises(self):
        with pytest.raises(ValueError, match="Invalid ObjectId"):
            PyObjectId.validate("not-an-objectid")

    def test_non_string_raises(self):
        with pytest.raises(ValueError, match="Cannot convert"):
            PyObjectId.validate(12345)


class TestTimestampMixin:
    def test_defaults_are_set(self):
        m = TimestampMixin()
        assert m.created_at is not None
        assert m.updated_at is not None

    def test_alias_population(self):
        m = TimestampMixin(createdAt=NOW, updatedAt=NOW)
        assert m.created_at == NOW


class TestPaginationParams:
    def test_defaults(self):
        p = PaginationParams()
        assert p.limit == 50
        assert p.cursor is None

    def test_limit_bounds(self):
        with pytest.raises(ValidationError):
            PaginationParams(limit=0)
        with pytest.raises(ValidationError):
            PaginationParams(limit=201)


class TestPaginatedResponse:
    def test_with_items(self):
        resp = PaginatedResponse[str](items=["a", "b"], nextCursor="abc", totalCount=10)
        assert len(resp.items) == 2
        assert resp.next_cursor == "abc"
        assert resp.total_count == 10

    def test_empty(self):
        resp = PaginatedResponse[str](items=[])
        assert resp.items == []
        assert resp.next_cursor is None


class TestResponseEnvelope:
    def test_success(self):
        env = ResponseEnvelope[str](success=True, data="hello")
        assert env.success is True
        assert env.data == "hello"

    def test_error(self):
        env = ResponseEnvelope(success=False, message="fail", errors=[{"code": "ERR"}])
        assert env.success is False
        assert len(env.errors) == 1


class TestErrorDetail:
    def test_fields(self):
        err = ErrorDetail(field="email", code="DUPLICATE", message="Already exists")
        assert err.field == "email"
        assert err.code == "DUPLICATE"


# =========================================================================
# Auth schemas
# =========================================================================


class TestLoginRequest:
    def test_valid(self):
        req = LoginRequest(email="user@example.com", password="secret")
        assert req.email == "user@example.com"

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="not-an-email", password="secret")

    def test_password_required(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="user@example.com", password="")


class TestUserResponse:
    def test_valid(self):
        u = UserResponse(
            userId="abc",
            accountId="def",
            email="u@t.com",
            name="User",
            role="admin",
            createdAt=NOW,
        )
        assert u.user_id == "abc"

    def test_missing_required(self):
        with pytest.raises(ValidationError):
            UserResponse(userId="abc", email="u@t.com", name="User")


class TestAccountResponse:
    def test_valid(self):
        a = AccountResponse(
            accountId="abc",
            accountName="Acme",
            isActive=True,
            createdAt=NOW,
            updatedAt=NOW,
        )
        assert a.account_id == "abc"
        assert a.account_name == "Acme"


class TestCreateUserRequest:
    def test_valid(self):
        req = CreateUserRequest(email="new@test.com", name="New User")
        assert req.role == "member"  # default

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            CreateUserRequest(email="new@test.com", name="")


class TestLoginResponse:
    def test_valid(self):
        user = UserResponse(
            userId="u1", accountId="a1", email="u@t.com", name="U", role="admin", createdAt=NOW
        )
        resp = LoginResponse(
            token="jwt.token.here", tokenType="bearer", expiresAt=NOW, user=user
        )
        assert resp.token_type == "bearer"


# =========================================================================
# Voice Profile schemas
# =========================================================================


class TestVoiceProfileCreate:
    def test_valid(self):
        vp = VoiceProfileCreate(voiceProfileName="Soothing Voice", vapiVoiceId="vapi-123")
        assert vp.voice_profile_name == "Soothing Voice"

    def test_name_too_long(self):
        with pytest.raises(ValidationError):
            VoiceProfileCreate(voiceProfileName="x" * 201, vapiVoiceId="vapi-123")


class TestVoiceProfileUpdate:
    def test_all_optional(self):
        vp = VoiceProfileUpdate()
        assert vp.voice_profile_name is None


class TestVoiceProfileResponse:
    def test_valid(self):
        vp = VoiceProfileResponse(
            voiceProfileId="vp1",
            accountId="a1",
            voiceProfileName="Test",
            vapiVoiceId="vapi-1",
            isEnabled=True,
            createdAt=NOW,
            updatedAt=NOW,
        )
        assert vp.is_enabled is True


# =========================================================================
# Intake Type schemas
# =========================================================================


class TestIntakeTypeCreate:
    def test_valid(self):
        it = IntakeTypeCreate(intakeTypeName="Auto Insurance")
        assert it.intake_type_name == "Auto Insurance"
        assert it.defaults_recording_enabled is True  # default

    def test_name_required(self):
        with pytest.raises(ValidationError):
            IntakeTypeCreate(intakeTypeName="")


class TestIntakeTypeUpdate:
    def test_all_optional(self):
        itu = IntakeTypeUpdate()
        assert itu.intake_type_name is None


class TestIntakeTypeResponse:
    def test_valid(self):
        itr = IntakeTypeResponse(
            intakeTypeId="it1",
            accountId="a1",
            intakeTypeName="Auto",
            defaultsRecordingEnabled=True,
            defaultsTranscriptionEnabled=True,
            defaultsContinueRecordingAfterTransfer=False,
            createdAt=NOW,
            updatedAt=NOW,
        )
        assert itr.intake_type_name == "Auto"


# =========================================================================
# Template schemas
# =========================================================================


class TestAnswerType:
    def test_enum_values(self):
        assert AnswerType.SHORT_TEXT == "shortText"
        assert AnswerType.UPLOAD_REQUESTED == "uploadRequested"

    def test_invalid_value(self):
        with pytest.raises(ValueError):
            AnswerType("invalid_value")


class TestTemplateVersionCreate:
    def test_valid(self):
        tvc = TemplateVersionCreate(
            templateName="My Template", versionLabel="v1.0", intakeTypeId="it1"
        )
        assert tvc.template_name == "My Template"

    def test_missing_fields(self):
        with pytest.raises(ValidationError):
            TemplateVersionCreate(templateName="Only Name")


class TestTemplateSectionCreate:
    def test_valid(self):
        tsc = TemplateSectionCreate(
            sectionName="General", sectionOrder=0
        )
        assert tsc.is_repeatable is False  # default

    def test_order_negative_rejected(self):
        with pytest.raises(ValidationError):
            TemplateSectionCreate(sectionName="Neg", sectionOrder=-1)


class TestTemplateQuestionCreate:
    def test_valid(self):
        tqc = TemplateQuestionCreate(
            questionKey="insured_name",
            questionText="What is the insured's name?",
            questionOrder=0,
            answerType=AnswerType.SHORT_TEXT,
        )
        assert tqc.is_required is True  # default

    def test_invalid_answer_type(self):
        with pytest.raises(ValidationError):
            TemplateQuestionCreate(
                questionKey="k",
                questionText="q",
                questionOrder=0,
                answerType="bogus",
            )


class TestTemplateVersionResponse:
    def test_valid(self):
        tvr = TemplateVersionResponse(
            templateVersionId="tv1",
            accountId="a1",
            templateName="T",
            versionLabel="v1",
            intakeTypeId="it1",
            isPublished=False,
            createdAt=NOW,
            updatedAt=NOW,
        )
        assert tvr.is_published is False


class TestTemplateSectionResponse:
    def test_valid(self):
        tsr = TemplateSectionResponse(
            templateSectionId="ts1",
            templateVersionId="tv1",
            sectionName="Section A",
            sectionOrder=0,
            isRepeatable=False,
            createdAt=NOW,
            updatedAt=NOW,
        )
        assert tsr.section_name == "Section A"


class TestTemplateQuestionResponse:
    def test_valid(self):
        tqr = TemplateQuestionResponse(
            templateQuestionId="tq1",
            templateSectionId="ts1",
            questionKey="key1",
            questionText="What?",
            questionOrder=0,
            isRequired=True,
            answerType=AnswerType.YES_NO,
            createdAt=NOW,
            updatedAt=NOW,
        )
        assert tqr.answer_type == AnswerType.YES_NO


# =========================================================================
# Intake schemas
# =========================================================================


class TestIntakeStatus:
    def test_all_values(self):
        assert IntakeStatus.DRAFT == "draft"
        assert IntakeStatus.IN_PROGRESS == "inProgress"
        assert IntakeStatus.COMPLETED == "completed"
        assert IntakeStatus.CANCELLED == "cancelled"


class TestQuestionInstanceStatus:
    def test_all_values(self):
        assert QuestionInstanceStatus.UNANSWERED == "unanswered"
        assert QuestionInstanceStatus.ANSWERED == "answered"
        assert QuestionInstanceStatus.NOT_APPLICABLE == "notApplicable"


class TestSectionInstanceStatus:
    def test_all_values(self):
        assert SectionInstanceStatus.NOT_STARTED == "notStarted"
        assert SectionInstanceStatus.COMPLETE == "complete"


class TestIntakeCreate:
    def test_valid(self):
        ic = IntakeCreate(intakeName="Client Intake", intakeTypeId="it1")
        assert ic.timezone == "UTC"

    def test_name_too_long(self):
        with pytest.raises(ValidationError):
            IntakeCreate(intakeName="x" * 401, intakeTypeId="it1")


class TestIntakeUpdate:
    def test_all_optional(self):
        iu = IntakeUpdate()
        assert iu.intake_name is None
        assert iu.intake_status is None


class TestIntakeProgressSummary:
    def test_valid(self):
        ps = IntakeProgressSummary(
            totalQuestions=10, answered=5, percentComplete=50.0
        )
        assert ps.total_questions == 10

    def test_percent_bounds(self):
        with pytest.raises(ValidationError):
            IntakeProgressSummary(totalQuestions=10, percentComplete=101.0)
        with pytest.raises(ValidationError):
            IntakeProgressSummary(totalQuestions=10, percentComplete=-1.0)


class TestIntakeResponse:
    def test_valid(self):
        ir = IntakeResponse(
            intakeId="i1",
            accountId="a1",
            intakeName="Intake",
            intakeTypeId="it1",
            templateVersionId="tv1",
            intakeStatus=IntakeStatus.DRAFT,
            timezone="UTC",
            createdAt=NOW,
            updatedAt=NOW,
        )
        assert ir.intake_id == "i1"


# =========================================================================
# Answer schemas
# =========================================================================


class TestRevisionType:
    def test_values(self):
        assert RevisionType.PROPOSED_FROM_CALL == "proposedFromCall"
        assert RevisionType.MANUAL_EDIT == "manualEdit"


class TestAnswerRevisionCreate:
    def test_valid(self):
        arc = AnswerRevisionCreate(
            intakeQuestionInstanceId="qi1",
            revisionType=RevisionType.MANUAL_EDIT,
            answerText="John Doe",
        )
        assert arc.make_current is False

    def test_confidence_bounds(self):
        with pytest.raises(ValidationError):
            AnswerRevisionCreate(
                intakeQuestionInstanceId="qi1",
                revisionType=RevisionType.CONFIRMED,
                confidenceScore=1.5,
            )

    def test_confidence_lower_bound(self):
        with pytest.raises(ValidationError):
            AnswerRevisionCreate(
                intakeQuestionInstanceId="qi1",
                revisionType=RevisionType.CONFIRMED,
                confidenceScore=-0.1,
            )


class TestAnswerRevisionResponse:
    def test_valid(self):
        arr = AnswerRevisionResponse(
            answerRevisionId="ar1",
            intakeQuestionInstanceId="qi1",
            revisionType=RevisionType.CONFIRMED,
            isCurrent=True,
            createdAt=NOW,
        )
        assert arr.is_current is True


class TestChooseCurrentRequest:
    def test_valid(self):
        ccr = ChooseCurrentRequest(
            intakeQuestionInstanceId="qi1", answerRevisionId="ar1"
        )
        assert ccr.answer_revision_id == "ar1"


class TestCurrentAnswerResponse:
    def test_valid(self):
        car = CurrentAnswerResponse(
            answerRevisionId="ar1", chosenAt=NOW
        )
        assert car.answer_revision_id == "ar1"


# =========================================================================
# Session schemas
# =========================================================================


class TestSessionType:
    def test_values(self):
        assert SessionType.PHONE_CALL == "phoneCall"
        assert SessionType.FILE_UPLOAD == "fileUpload"


class TestSessionStatus:
    def test_values(self):
        assert SessionStatus.ACTIVE == "active"
        assert SessionStatus.FAILED == "failed"


class TestSessionCreate:
    def test_valid(self):
        sc = SessionCreate(sessionType=SessionType.PHONE_CALL)
        assert sc.external_provider_id is None


class TestSessionUpdate:
    def test_all_optional(self):
        su = SessionUpdate()
        assert su.ended_at is None

    def test_duration_negative_rejected(self):
        with pytest.raises(ValidationError):
            SessionUpdate(durationSeconds=-1)


class TestTranscriptSegmentData:
    def test_valid(self):
        seg = TranscriptSegmentData(
            startMs=0, endMs=5000, speakerLabel="agent", text="Hello"
        )
        assert seg.start_ms == 0

    def test_negative_time_rejected(self):
        with pytest.raises(ValidationError):
            TranscriptSegmentData(
                startMs=-1, endMs=5000, speakerLabel="agent", text="Hello"
            )


class TestTranscriptCreate:
    def test_valid(self):
        tc = TranscriptCreate(transcriptText="Full text here")
        assert tc.segments is None


# =========================================================================
# Evidence schemas
# =========================================================================


class TestEvidenceType:
    def test_values(self):
        assert EvidenceType.TRANSCRIPT_EXCERPT == "transcriptExcerpt"
        assert EvidenceType.OTHER == "other"


class TestEvidenceCreate:
    def test_valid(self):
        ec = EvidenceCreate(
            sessionId="s1", evidenceType=EvidenceType.TRANSCRIPT_EXCERPT
        )
        assert ec.excerpt_text is None


# =========================================================================
# Contributor schemas
# =========================================================================


class TestContactMethod:
    def test_values(self):
        assert ContactMethod.PHONE == "phone"
        assert ContactMethod.SMS == "sms"


class TestAssignmentPolicy:
    def test_values(self):
        assert AssignmentPolicy.ASK_ONLY_IF_MISSING == "askOnlyIfMissing"


class TestContributorCreate:
    def test_valid(self):
        cc = ContributorCreate(displayName="Jane Doe")
        assert cc.is_primary_point_person is False

    def test_name_required(self):
        with pytest.raises(ValidationError):
            ContributorCreate(displayName="")


class TestAssignmentCreate:
    def test_valid(self):
        ac = AssignmentCreate(
            intakeContributorId="c1",
            intakeSectionInstanceId="si1",
        )
        assert ac.assignment_policy == AssignmentPolicy.ASK_ONLY_IF_MISSING


# =========================================================================
# Follow-up schemas
# =========================================================================


class TestFollowUpStatus:
    def test_values(self):
        assert FollowUpStatus.SCHEDULED == "scheduled"
        assert FollowUpStatus.MISSED == "missed"


class TestFollowUpContactMethod:
    def test_values(self):
        assert FollowUpContactMethod.PHONE == "phone"


class TestFollowUpCreate:
    def test_valid(self):
        fc = FollowUpCreate(nextContactAt=NOW)
        assert fc.contact_method == FollowUpContactMethod.PHONE  # default


# =========================================================================
# Usage schemas
# =========================================================================


class TestUsageRollup:
    def test_defaults(self):
        ur = UsageRollup()
        assert ur.call_seconds == 0
        assert ur.url_refresh_count == 0


class TestUsageResponse:
    def test_valid(self):
        usage = UsageResponse(intakeId="i1", usage=UsageRollup())
        assert usage.period_start is None


class TestUsageReportResponse:
    def test_valid(self):
        urr = UsageReportResponse(
            accountId="a1",
            dateRangeStart=date(2025, 1, 1),
            dateRangeEnd=date(2025, 1, 31),
            totalUsage=UsageRollup(),
            generatedAt=NOW,
        )
        assert urr.per_intake is None


# =========================================================================
# File schemas
# =========================================================================


class TestFileProcessingStatus:
    def test_values(self):
        assert FileProcessingStatus.PENDING == "pending"
        assert FileProcessingStatus.COMPLETED == "completed"


class TestFileUploadRequest:
    def test_valid(self):
        fur = FileUploadRequest(
            fileName="doc.pdf", fileType="application/pdf", fileSizeBytes=1024
        )
        assert fur.file_name == "doc.pdf"

    def test_zero_size_rejected(self):
        with pytest.raises(ValidationError):
            FileUploadRequest(
                fileName="doc.pdf", fileType="application/pdf", fileSizeBytes=0
            )


class TestFileUploadResponse:
    def test_valid(self):
        fur = FileUploadResponse(
            fileAssetId="fa1",
            uploadUrl="https://example.com/upload",
            fileName="doc.pdf",
            fileType="application/pdf",
            fileSizeBytes=1024,
            processingStatus=FileProcessingStatus.PENDING,
            createdAt=NOW,
        )
        assert fur.file_asset_id == "fa1"


# =========================================================================
# URL schemas
# =========================================================================


class TestRefreshPolicy:
    def test_values(self):
        assert RefreshPolicy.MANUAL == "manual"
        assert RefreshPolicy.WEEKLY == "weekly"


class TestUrlFetchStatus:
    def test_values(self):
        assert UrlFetchStatus.PENDING == "pending"
        assert UrlFetchStatus.SUCCESS == "success"


class TestUrlSourceCreate:
    def test_valid(self):
        usc = UrlSourceCreate(url="https://example.com")
        assert usc.refresh_policy == RefreshPolicy.MANUAL

    def test_url_required(self):
        with pytest.raises(ValidationError):
            UrlSourceCreate(url="")


# =========================================================================
# Proposal schemas
# =========================================================================


class TestProposalStatus:
    def test_values(self):
        assert ProposalStatus.PENDING == "pending"
        assert ProposalStatus.SUPERSEDED == "superseded"


class TestProposalRejectRequest:
    def test_optional_reason(self):
        prr = ProposalRejectRequest()
        assert prr.reason is None


# =========================================================================
# Voice Call schemas
# =========================================================================


class TestCallStartRequest:
    def test_valid(self):
        csr = CallStartRequest(
            externalCallId="call-123",
            fromPhone="+15551234567",
            toPhone="+15559876543",
        )
        assert csr.external_call_id == "call-123"


class TestCallStartResponse:
    def test_valid(self):
        csr = CallStartResponse(sessionId="s1", initialPrompt="Hello!")
        assert csr.initial_prompt == "Hello!"


class TestAuthenticateRequest:
    def test_valid(self):
        ar = AuthenticateRequest(intakeCode="ABC123", pin="1234")
        assert ar.intake_code == "ABC123"


class TestCallEndRequest:
    def test_valid(self):
        cer = CallEndRequest(durationSeconds=120)
        assert cer.wants_to_continue_later is False

    def test_negative_duration_rejected(self):
        with pytest.raises(ValidationError):
            CallEndRequest(durationSeconds=-1)


class TestCallEndResponse:
    def test_valid(self):
        cer = CallEndResponse(summary="Call done", questionsAnswered=5)
        assert cer.questions_answered == 5


class TestAnswerSubmitRequest:
    def test_valid(self):
        asr = AnswerSubmitRequest(
            intakeQuestionInstanceId="qi1",
            rawUtteranceText="My name is John",
        )
        assert asr.transcript_segment is None


class TestNextStepResponse:
    def test_valid(self):
        nsr = NextStepResponse(
            say="What is your name?",
            isEndOfSection=False,
            isEndOfIntake=False,
        )
        assert nsr.expected_answer_type is None


# =========================================================================
# Timeline schemas
# =========================================================================


class TestTimelineEventType:
    def test_values(self):
        assert TimelineEventType.INTAKE_CREATED == "intakeCreated"
        assert TimelineEventType.EXPORT_GENERATED == "exportGenerated"


class TestTimelineEvent:
    def test_valid(self):
        te = TimelineEvent(
            eventId="e1",
            intakeId="i1",
            eventType=TimelineEventType.INTAKE_CREATED,
            timestamp=NOW,
            description="Intake created",
        )
        assert te.event_type == TimelineEventType.INTAKE_CREATED


class TestTimelineResponse:
    def test_valid(self):
        tr = TimelineResponse(events=[], totalCount=0)
        assert tr.next_cursor is None


# =========================================================================
# Export schemas
# =========================================================================


class TestExportFormat:
    def test_values(self):
        assert ExportFormat.DOCX == "docx"
        assert ExportFormat.JSON == "json"


class TestExportStatus:
    def test_values(self):
        assert ExportStatus.QUEUED == "queued"
        assert ExportStatus.COMPLETED == "completed"


class TestExportRequest:
    def test_valid(self):
        er = ExportRequest(format=ExportFormat.PDF)
        assert er.include_evidence is False

    def test_invalid_format(self):
        with pytest.raises(ValidationError):
            ExportRequest(format="txt")


class TestExportResponse:
    def test_valid(self):
        er = ExportResponse(
            exportId="ex1",
            intakeId="i1",
            accountId="a1",
            format=ExportFormat.DOCX,
            includeEvidence=False,
            status=ExportStatus.COMPLETED,
            requestedAt=NOW,
        )
        assert er.download_url is None
