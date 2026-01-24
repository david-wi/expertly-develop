"""Pydantic schemas for API request/response validation."""
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    TokenRefresh,
    UserResponse,
    OrganizationResponse,
)
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    ProjectDetailResponse,
    ProjectStats,
)
from app.schemas.environment import (
    EnvironmentCreate,
    EnvironmentUpdate,
    EnvironmentResponse,
    Credentials,
)
from app.schemas.test_case import (
    TestCaseCreate,
    TestCaseUpdate,
    TestCaseResponse,
    TestStep,
)
from app.schemas.test_suite import (
    TestSuiteCreate,
    TestSuiteUpdate,
    TestSuiteResponse,
)
from app.schemas.test_run import (
    TestRunCreate,
    TestRunResponse,
    TestRunDetailResponse,
    RunSummary,
)
from app.schemas.test_result import (
    TestResultResponse,
    StepResult,
)
from app.schemas.quick_start import (
    QuickStartCreate,
    QuickStartResponse,
    QuickStartResultResponse,
    QuickStartResults,
    PageInfo,
    SuggestedTest,
    Issue,
)

__all__ = [
    # Auth
    "UserRegister",
    "UserLogin",
    "TokenResponse",
    "TokenRefresh",
    "UserResponse",
    "OrganizationResponse",
    # Project
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectResponse",
    "ProjectListResponse",
    "ProjectDetailResponse",
    "ProjectStats",
    # Environment
    "EnvironmentCreate",
    "EnvironmentUpdate",
    "EnvironmentResponse",
    "Credentials",
    # Test Case
    "TestCaseCreate",
    "TestCaseUpdate",
    "TestCaseResponse",
    "TestStep",
    # Test Suite
    "TestSuiteCreate",
    "TestSuiteUpdate",
    "TestSuiteResponse",
    # Test Run
    "TestRunCreate",
    "TestRunResponse",
    "TestRunDetailResponse",
    "RunSummary",
    # Test Result
    "TestResultResponse",
    "StepResult",
    # Quick Start
    "QuickStartCreate",
    "QuickStartResponse",
    "QuickStartResultResponse",
    "QuickStartResults",
    "PageInfo",
    "SuggestedTest",
    "Issue",
]
