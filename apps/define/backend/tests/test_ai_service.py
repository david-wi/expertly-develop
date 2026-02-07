"""Tests for AI service - response parsing and error handling."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.ai_service import AIService
from app.schemas.ai import ExistingRequirement


@pytest.fixture
def ai_service():
    """Create AIService with mocked AI client."""
    with patch("app.services.ai_service.get_ai_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        service = AIService()
        yield service, mock_client


@pytest.mark.asyncio
async def test_parse_requirements_empty_response(ai_service):
    """When AI returns empty string, should raise clear error."""
    service, mock_client = ai_service
    mock_client.complete.return_value = ""

    with pytest.raises(ValueError, match="AI returned an empty response"):
        await service.parse_requirements(
            description="Build a login page",
            files=None,
            existing_requirements=[],
            target_parent_id=None,
            product_name="Test Product",
        )


@pytest.mark.asyncio
async def test_parse_requirements_none_response(ai_service):
    """When AI returns None, should raise clear error."""
    service, mock_client = ai_service
    mock_client.complete.return_value = None

    with pytest.raises(ValueError, match="AI returned an empty response"):
        await service.parse_requirements(
            description="Build a login page",
            files=None,
            existing_requirements=[],
            target_parent_id=None,
            product_name="Test Product",
        )


@pytest.mark.asyncio
async def test_parse_requirements_whitespace_response(ai_service):
    """When AI returns only whitespace, should raise clear error."""
    service, mock_client = ai_service
    mock_client.complete.return_value = "   \n\n   "

    with pytest.raises(ValueError, match="AI returned an empty response"):
        await service.parse_requirements(
            description="Build a login page",
            files=None,
            existing_requirements=[],
            target_parent_id=None,
            product_name="Test Product",
        )


@pytest.mark.asyncio
async def test_parse_requirements_no_json_array(ai_service):
    """When AI response has no JSON array, should raise with response preview."""
    service, mock_client = ai_service
    mock_client.complete.return_value = "I cannot generate requirements from this document."

    with pytest.raises(ValueError, match="Failed to parse AI response"):
        await service.parse_requirements(
            description="Build a login page",
            files=None,
            existing_requirements=[],
            target_parent_id=None,
            product_name="Test Product",
        )


@pytest.mark.asyncio
async def test_parse_requirements_valid_response(ai_service):
    """When AI returns valid JSON array, should parse successfully."""
    service, mock_client = ai_service
    mock_client.complete.return_value = """[
        {
            "temp_id": "temp-1",
            "node_type": "requirement",
            "title": "User Login",
            "what_this_does": "Users can log in",
            "why_this_exists": "Authentication is needed",
            "acceptance_criteria": "- User can enter credentials",
            "priority": "high",
            "tags": ["functional"],
            "parent_ref": null
        }
    ]"""

    result = await service.parse_requirements(
        description="Build a login page",
        files=None,
        existing_requirements=[],
        target_parent_id=None,
        product_name="Test Product",
    )

    assert len(result) == 1
    assert result[0].title == "User Login"
    assert result[0].node_type == "requirement"


@pytest.mark.asyncio
async def test_parse_requirements_json_with_markdown_wrapper(ai_service):
    """When AI wraps JSON in markdown code fences, should still parse."""
    service, mock_client = ai_service
    mock_client.complete.return_value = """```json
[
    {
        "temp_id": "temp-1",
        "node_type": "feature",
        "title": "Dashboard",
        "what_this_does": "Shows overview",
        "why_this_exists": "Users need quick access",
        "acceptance_criteria": "- Dashboard loads",
        "priority": "medium",
        "tags": ["functional"],
        "parent_ref": null
    }
]
```"""

    result = await service.parse_requirements(
        description="Build a dashboard",
        files=None,
        existing_requirements=[],
        target_parent_id=None,
        product_name="Test Product",
    )

    assert len(result) == 1
    assert result[0].title == "Dashboard"
