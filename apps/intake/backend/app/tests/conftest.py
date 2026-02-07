"""Shared test fixtures for the Expertly Intake backend tests.

Provides:
- Mock MongoDB collections via AsyncMock
- Patched ``get_collection`` so services/routes never touch a real DB
- Mock Identity service authentication
- An authenticated httpx.AsyncClient
- Common test data factories
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient


# ---------------------------------------------------------------------------
# Reusable ObjectId constants
# ---------------------------------------------------------------------------

ACCOUNT_ID = str(ObjectId())
USER_ID = str(ObjectId())
INTAKE_TYPE_ID = str(ObjectId())
TEMPLATE_VERSION_ID = str(ObjectId())
TEMPLATE_SECTION_ID = str(ObjectId())
TEMPLATE_QUESTION_ID = str(ObjectId())
INTAKE_ID = str(ObjectId())
SECTION_INSTANCE_ID = str(ObjectId())
QUESTION_INSTANCE_ID = str(ObjectId())
REVISION_ID = str(ObjectId())
SESSION_ID = str(ObjectId())
CONTRIBUTOR_ID = str(ObjectId())


# ---------------------------------------------------------------------------
# Mock Identity User
# ---------------------------------------------------------------------------

class MockIdentityUser:
    """Mimics identity_client.models.User for testing."""

    def __init__(
        self,
        *,
        id: str = USER_ID,
        organization_id: str = ACCOUNT_ID,
        email: str = "admin@test.com",
        name: str = "Test Admin",
        role: str = "owner",
        is_active: bool = True,
    ):
        self.id = id
        self.organization_id = organization_id
        self.email = email
        self.name = name
        self.role = role
        self.is_active = is_active


# ---------------------------------------------------------------------------
# Identity auth mock fixtures
# ---------------------------------------------------------------------------

# Module-level reference to the mock identity user, set by fixtures
_current_identity_user: Optional[MockIdentityUser] = None


def _make_mock_get_current_user():
    """Create a mock get_current_user that returns a compat dict from the mock identity user."""
    from app.core.security import _map_role

    async def mock_get_current_user(request=None):
        if _current_identity_user is None:
            from fastapi import HTTPException
            raise HTTPException(status_code=401, detail="Not authenticated")
        user = _current_identity_user
        if not user.is_active:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="User account is disabled")
        return {
            "userId": str(user.id),
            "accountId": str(user.organization_id),
            "email": user.email,
            "role": _map_role(user.role),
            "name": user.name,
        }
    return mock_get_current_user


@pytest.fixture
def admin_identity_user():
    return MockIdentityUser(role="owner", email="admin@test.com", name="Test Admin")


@pytest.fixture
def editor_identity_user():
    return MockIdentityUser(role="member", email="editor@test.com", name="Test Editor")


@pytest.fixture
def viewer_identity_user():
    return MockIdentityUser(role="viewer", email="viewer@test.com", name="Test Viewer")


@pytest.fixture
def set_identity_user():
    """Returns a callable that sets the mock identity user for the current test."""
    def _set(user: Optional[MockIdentityUser]):
        global _current_identity_user
        _current_identity_user = user
    return _set


# Legacy fixtures for backward compatibility with existing route tests
@pytest.fixture
def admin_token(admin_identity_user, set_identity_user) -> str:
    set_identity_user(admin_identity_user)
    return "mock-admin-session-token"


@pytest.fixture
def editor_token(editor_identity_user, set_identity_user) -> str:
    set_identity_user(editor_identity_user)
    return "mock-editor-session-token"


@pytest.fixture
def viewer_token(viewer_identity_user, set_identity_user) -> str:
    set_identity_user(viewer_identity_user)
    return "mock-viewer-session-token"


@pytest.fixture
def expired_token(set_identity_user) -> str:
    set_identity_user(None)
    return "mock-expired-session-token"


# ---------------------------------------------------------------------------
# Auth headers helper
# ---------------------------------------------------------------------------

def auth_headers(token: str) -> dict[str, str]:
    """Return headers that simulate an Identity session cookie or header."""
    return {"Cookie": f"expertly_session={token}"}


# ---------------------------------------------------------------------------
# Mock MongoDB collections
# ---------------------------------------------------------------------------

_COLLECTION_NAMES = [
    "accounts",
    "users",
    "voice_profiles",
    "intake_types",
    "template_versions",
    "template_sections",
    "template_questions",
    "intakes",
    "intake_section_instances",
    "intake_question_instances",
    "answer_revisions",
    "current_answers",
    "sessions",
    "session_participants",
    "transcripts",
    "transcript_segments",
    "evidence_items",
    "intake_contributors",
    "section_assignments",
    "follow_up_plans",
    "usage_ledger",
    "file_assets",
    "url_sources",
    "url_snapshots",
    "proposals",
    "exports",
]


class MockCollection:
    """A lightweight mock that mimics a Motor collection."""

    def __init__(self, name: str = "mock"):
        self.name = name
        self.find_one = AsyncMock(return_value=None)
        self.insert_one = AsyncMock()
        self.insert_many = AsyncMock()
        self.update_one = AsyncMock()
        self.find_one_and_update = AsyncMock(return_value=None)
        self.delete_one = AsyncMock()
        self.count_documents = AsyncMock(return_value=0)
        self._find_results: list[dict] = []

    def find(self, *args, **kwargs) -> "MockCursor":
        return MockCursor(self._find_results)

    def set_find_results(self, results: list[dict]) -> None:
        self._find_results = list(results)

    def reset(self) -> None:
        """Reset all mocks to defaults for test isolation."""
        self.find_one = AsyncMock(return_value=None)
        self.insert_one = AsyncMock()
        self.insert_many = AsyncMock()
        self.update_one = AsyncMock()
        self.find_one_and_update = AsyncMock(return_value=None)
        self.delete_one = AsyncMock()
        self.count_documents = AsyncMock(return_value=0)
        self._find_results = []


class MockCursor:
    """Minimal async-iterable cursor returned by ``MockCollection.find()``."""

    def __init__(self, docs: list[dict]):
        self._docs = list(docs)
        self._sort_key = None
        self._sort_dir = 1
        self._limit_val = None

    def sort(self, key, direction=1) -> "MockCursor":
        self._sort_key = key
        self._sort_dir = direction
        return self

    def limit(self, n: int) -> "MockCursor":
        self._limit_val = n
        return self

    async def to_list(self, length=None) -> list[dict]:
        docs = self._docs
        if self._limit_val is not None:
            docs = docs[: self._limit_val]
        return docs

    def __aiter__(self):
        self._iter = iter(self._docs)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


# ---------------------------------------------------------------------------
# Module-level mock registry + monkey-patch
# ---------------------------------------------------------------------------

_MOCK_REGISTRY: dict[str, MockCollection] = {}


def _patched_get_collection(name: str) -> MockCollection:
    """Replacement for ``app.core.database.get_collection``."""
    if name not in _MOCK_REGISTRY:
        _MOCK_REGISTRY[name] = MockCollection(name)
    return _MOCK_REGISTRY[name]


import app.core.database as _db_mod  # noqa: E402

_original_get_collection = _db_mod.get_collection
_db_mod.get_collection = _patched_get_collection


@pytest.fixture(autouse=True)
def _reset_mock_registry():
    """Reset all mock collections and identity user before each test."""
    global _current_identity_user
    _current_identity_user = None
    _MOCK_REGISTRY.clear()
    for name in _COLLECTION_NAMES:
        _MOCK_REGISTRY[name] = MockCollection(name)
    yield


@pytest.fixture
def mock_collections() -> dict[str, MockCollection]:
    """Provide access to the mock collection registry for the current test."""
    return _MOCK_REGISTRY


# ---------------------------------------------------------------------------
# Async test client
# ---------------------------------------------------------------------------

@pytest.fixture
async def client():
    """Provide an httpx.AsyncClient wired to the FastAPI app.

    The identity auth is mocked so requests use the session set via fixtures.
    Uses FastAPI dependency_overrides to properly mock get_current_user
    (including for require_admin and other role-based dependencies).
    """
    with (
        patch("app.core.database.init_db", new_callable=AsyncMock),
        patch("app.core.database.close_db", new_callable=AsyncMock),
    ):
        from app.main import app
        from app.core.security import get_current_user

        mock_get_current_user = _make_mock_get_current_user()
        app.dependency_overrides[get_current_user] = mock_get_current_user

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as ac:
            yield ac

        app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# Common test data factories
# ---------------------------------------------------------------------------

def make_user_doc(
    *,
    user_id: str | None = None,
    account_id: str = ACCOUNT_ID,
    email: str = "admin@test.com",
    name: str = "Test Admin",
    role: str = "admin",
    password_hash: str = "",
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": ObjectId(user_id) if user_id else ObjectId(USER_ID),
        "accountId": account_id,
        "email": email,
        "name": name,
        "role": role,
        "passwordHash": password_hash,
        "phone": None,
        "mustResetPassword": False,
        "createdAt": now,
        "updatedAt": now,
        "lastLoginAt": None,
    }


def make_account_doc(
    *,
    account_id: str = ACCOUNT_ID,
    account_name: str = "Test Account",
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": ObjectId(account_id),
        "accountName": account_name,
        "isActive": True,
        "createdAt": now,
        "updatedAt": now,
    }


def make_template_version_doc(
    *,
    tv_id: str = TEMPLATE_VERSION_ID,
    account_id: str = ACCOUNT_ID,
    intake_type_id: str = INTAKE_TYPE_ID,
    is_published: bool = False,
    template_name: str = "Auto Intake Template",
    version_label: str = "v1.0",
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": ObjectId(tv_id),
        "accountId": account_id,
        "templateName": template_name,
        "versionLabel": version_label,
        "intakeTypeId": intake_type_id,
        "isPublished": is_published,
        "createdAt": now,
        "updatedAt": now,
    }


def make_template_section_doc(
    *,
    section_id: str = TEMPLATE_SECTION_ID,
    tv_id: str = TEMPLATE_VERSION_ID,
    section_name: str = "General Info",
    section_order: int = 0,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": ObjectId(section_id),
        "templateVersionId": tv_id,
        "sectionName": section_name,
        "sectionOrder": section_order,
        "isRepeatable": False,
        "repeatKeyName": None,
        "applicabilityRuleText": None,
        "createdAt": now,
        "updatedAt": now,
    }


def make_template_question_doc(
    *,
    question_id: str = TEMPLATE_QUESTION_ID,
    section_id: str = TEMPLATE_SECTION_ID,
    question_key: str = "insured_name",
    question_text: str = "What is the insured's name?",
    question_order: int = 0,
    answer_type: str = "shortText",
    is_required: bool = True,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": ObjectId(question_id),
        "templateSectionId": section_id,
        "questionKey": question_key,
        "questionText": question_text,
        "questionHelpText": None,
        "questionOrder": question_order,
        "isRequired": is_required,
        "answerType": answer_type,
        "applicabilityRuleText": None,
        "createdAt": now,
        "updatedAt": now,
    }


def make_intake_doc(
    *,
    intake_id: str = INTAKE_ID,
    account_id: str = ACCOUNT_ID,
    intake_type_id: str = INTAKE_TYPE_ID,
    tv_id: str = TEMPLATE_VERSION_ID,
    intake_name: str = "Test Intake",
    status_val: str = "open",
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": ObjectId(intake_id),
        "accountId": account_id,
        "intakeTypeId": intake_type_id,
        "templateVersionId": tv_id,
        "intakeName": intake_name,
        "intakeCodeHash": "$2b$12$fakehashfortesting",
        "status": status_val,
        "createdById": USER_ID,
        "createdAt": now,
        "updatedAt": now,
    }


def make_section_instance_doc(
    *,
    si_id: str = SECTION_INSTANCE_ID,
    intake_id: str = INTAKE_ID,
    section_id: str = TEMPLATE_SECTION_ID,
    status_val: str = "not_started",
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": ObjectId(si_id),
        "intakeId": intake_id,
        "accountId": ACCOUNT_ID,
        "templateSectionId": section_id,
        "sectionName": "General Info",
        "sectionOrder": 0,
        "status": status_val,
        "repeatInstanceIndex": 0,
        "createdAt": now,
        "updatedAt": now,
    }


def make_question_instance_doc(
    *,
    qi_id: str = QUESTION_INSTANCE_ID,
    si_id: str = SECTION_INSTANCE_ID,
    question_id: str = TEMPLATE_QUESTION_ID,
    question_status: str = "unanswered",
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "_id": ObjectId(qi_id),
        "intakeId": INTAKE_ID,
        "accountId": ACCOUNT_ID,
        "intakeSectionInstanceId": si_id,
        "templateQuestionId": question_id,
        "questionKey": "insured_name",
        "questionText": "What is the insured's name?",
        "questionOrder": 0,
        "isRequired": True,
        "answerType": "shortText",
        "status": "unanswered",
        "questionStatus": question_status,
        "currentAnswer": None,
        "createdAt": now,
        "updatedAt": now,
    }
