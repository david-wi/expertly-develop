"""Shared test fixtures for the Expertly Intake backend tests.

Provides:
- Mock MongoDB collections via AsyncMock
- Patched ``get_collection`` so services/routes never touch a real DB
- An authenticated httpx.AsyncClient backed by a test JWT token
- Common test data factories

The key design decision here is that the ``_MOCK_REGISTRY`` is a module-level
mutable dict. A single ``unittest.mock.patch`` is applied once at session scope
so that every import of ``get_collection`` (including cached route-module refs)
always resolves to the same function that looks up mocks from this registry.
Per-test fixtures then swap out MockCollection instances in the registry so
each test starts clean.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.core.security import create_access_token


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
# JWT token fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def admin_token_data() -> dict:
    return {
        "sub": USER_ID,
        "accountId": ACCOUNT_ID,
        "email": "admin@test.com",
        "role": "admin",
        "name": "Test Admin",
    }


@pytest.fixture
def editor_token_data() -> dict:
    return {
        "sub": USER_ID,
        "accountId": ACCOUNT_ID,
        "email": "editor@test.com",
        "role": "editor",
        "name": "Test Editor",
    }


@pytest.fixture
def viewer_token_data() -> dict:
    return {
        "sub": USER_ID,
        "accountId": ACCOUNT_ID,
        "email": "viewer@test.com",
        "role": "viewer",
        "name": "Test Viewer",
    }


@pytest.fixture
def admin_token(admin_token_data: dict) -> str:
    return create_access_token(admin_token_data)


@pytest.fixture
def editor_token(editor_token_data: dict) -> str:
    return create_access_token(editor_token_data)


@pytest.fixture
def viewer_token(viewer_token_data: dict) -> str:
    return create_access_token(viewer_token_data)


@pytest.fixture
def expired_token() -> str:
    return create_access_token(
        {
            "sub": USER_ID,
            "accountId": ACCOUNT_ID,
            "email": "expired@test.com",
            "role": "admin",
            "name": "Expired User",
        },
        expires_delta=timedelta(seconds=-10),
    )


# ---------------------------------------------------------------------------
# Auth headers helper
# ---------------------------------------------------------------------------

def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


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

# This dict is the single source of truth for mock collections. The
# ``_patched_get_collection`` function always reads from here.
_MOCK_REGISTRY: dict[str, MockCollection] = {}


def _patched_get_collection(name: str) -> MockCollection:
    """Replacement for ``app.core.database.get_collection``."""
    if name not in _MOCK_REGISTRY:
        _MOCK_REGISTRY[name] = MockCollection(name)
    return _MOCK_REGISTRY[name]


# Monkey-patch ``get_collection`` on the module BEFORE any route / service
# module imports it. This is done at conftest load time, which runs before
# any test module (and therefore before ``from app.main import app``).
# Because we replace the function object on the ``app.core.database``
# module, any ``from app.core.database import get_collection`` that
# happens later will pick up our replacement.
import app.core.database as _db_mod  # noqa: E402

_original_get_collection = _db_mod.get_collection
_db_mod.get_collection = _patched_get_collection


@pytest.fixture(autouse=True)
def _reset_mock_registry():
    """Reset all mock collections before each test for isolation."""
    _MOCK_REGISTRY.clear()
    for name in _COLLECTION_NAMES:
        _MOCK_REGISTRY[name] = MockCollection(name)
    yield
    # (cleanup not strictly needed since we clear on next test)


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

    The ``lifespan`` events (init_db / close_db) are patched out so the app
    never attempts to connect to a real MongoDB instance.
    """
    with (
        patch("app.core.database.init_db", new_callable=AsyncMock),
        patch("app.core.database.close_db", new_callable=AsyncMock),
    ):
        from app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as ac:
            yield ac


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
