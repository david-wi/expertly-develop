"""Tests for AI service - two-phase requirement generation and error handling."""

import json
import pytest
from unittest.mock import AsyncMock, patch

from app.services.ai_service import AIService


@pytest.fixture
def ai_service():
    """Create AIService with mocked AI client."""
    with patch("app.services.ai_service.get_ai_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        service = AIService()
        yield service, mock_client


# --- _parse_json_array tests ---

def test_parse_json_array_empty(ai_service):
    """Empty string should raise clear error."""
    service, _ = ai_service
    with pytest.raises(ValueError, match="AI returned an empty response"):
        service._parse_json_array("")


def test_parse_json_array_none(ai_service):
    """None should raise clear error."""
    service, _ = ai_service
    with pytest.raises(ValueError, match="AI returned an empty response"):
        service._parse_json_array(None)


def test_parse_json_array_whitespace(ai_service):
    """Whitespace-only should raise clear error."""
    service, _ = ai_service
    with pytest.raises(ValueError, match="AI returned an empty response"):
        service._parse_json_array("   \n\n   ")


def test_parse_json_array_no_json(ai_service):
    """No JSON array should raise with preview."""
    service, _ = ai_service
    with pytest.raises(ValueError, match="Failed to parse AI response"):
        service._parse_json_array("I cannot generate requirements.")


def test_parse_json_array_valid(ai_service):
    """Valid JSON array should parse correctly."""
    service, _ = ai_service
    result = service._parse_json_array('[{"title": "Test"}]')
    assert len(result) == 1
    assert result[0]["title"] == "Test"


def test_parse_json_array_markdown_wrapped(ai_service):
    """JSON wrapped in markdown fences should still parse."""
    service, _ = ai_service
    result = service._parse_json_array('```json\n[{"title": "Test"}]\n```')
    assert len(result) == 1


# --- Two-phase generation tests ---

@pytest.mark.asyncio
async def test_two_phase_generation(ai_service):
    """Full two-phase flow: skeleton then enrichment."""
    service, mock_client = ai_service

    skeleton_response = json.dumps([
        {"temp_id": "temp-1", "node_type": "product", "title": "Test Product", "parent_ref": None, "priority": "critical", "tags": ["functional"]},
        {"temp_id": "temp-2", "node_type": "module", "title": "Auth Module", "parent_ref": "temp-1", "priority": "high", "tags": ["functional"]},
        {"temp_id": "temp-3", "node_type": "feature", "title": "Login Feature", "parent_ref": "temp-2", "priority": "high", "tags": ["functional"]},
    ])

    enriched_response = json.dumps([
        {"temp_id": "temp-1", "node_type": "product", "title": "Test Product", "parent_ref": None, "priority": "critical", "tags": ["functional"], "what_this_does": "A test product", "why_this_exists": "For testing", "acceptance_criteria": "- Works correctly"},
        {"temp_id": "temp-2", "node_type": "module", "title": "Auth Module", "parent_ref": "temp-1", "priority": "high", "tags": ["functional"], "what_this_does": "Handles authentication", "why_this_exists": "Security", "acceptance_criteria": "- Users can log in"},
        {"temp_id": "temp-3", "node_type": "feature", "title": "Login Feature", "parent_ref": "temp-2", "priority": "high", "tags": ["functional"], "what_this_does": "Users can log in", "why_this_exists": "Access control", "acceptance_criteria": "- Email/password login works"},
    ])

    mock_client.complete.side_effect = [skeleton_response, enriched_response]

    progress_calls = []

    async def track_progress(phase, detail):
        progress_calls.append((phase, detail))

    result = await service.parse_requirements(
        description="Build a login page",
        files=None,
        existing_requirements=[],
        target_parent_id=None,
        product_name="Test Product",
        on_progress=track_progress,
    )

    assert len(result) == 3
    assert result[0].title == "Test Product"
    assert result[0].node_type == "product"
    assert result[0].what_this_does == "A test product"
    assert result[1].title == "Auth Module"
    assert result[2].acceptance_criteria == "- Email/password login works"

    # Verify progress callbacks
    phases = [p[0] for p in progress_calls]
    assert "skeleton" in phases
    assert "enriching" in phases
    assert "complete" in phases

    # 1 skeleton call + 1 enrichment batch
    assert mock_client.complete.call_count == 2


@pytest.mark.asyncio
async def test_skeleton_failure_propagates(ai_service):
    """When skeleton generation fails, error should propagate."""
    service, mock_client = ai_service
    mock_client.complete.return_value = ""

    with pytest.raises(ValueError, match="AI returned an empty response"):
        await service.parse_requirements(
            description="Build something",
            files=None,
            existing_requirements=[],
            target_parent_id=None,
            product_name="Test",
        )


@pytest.mark.asyncio
async def test_large_skeleton_creates_multiple_batches(ai_service):
    """Skeleton with >10 nodes should create multiple enrichment batches."""
    service, mock_client = ai_service

    skeleton_nodes = [
        {"temp_id": f"temp-{i}", "node_type": "requirement", "title": f"Req {i}", "parent_ref": None, "priority": "medium", "tags": ["functional"]}
        for i in range(1, 16)
    ]

    batch1_enriched = [
        {**n, "what_this_does": f"Does {n['title']}", "acceptance_criteria": "- Works"}
        for n in skeleton_nodes[:10]
    ]
    batch2_enriched = [
        {**n, "what_this_does": f"Does {n['title']}", "acceptance_criteria": "- Works"}
        for n in skeleton_nodes[10:]
    ]

    mock_client.complete.side_effect = [
        json.dumps(skeleton_nodes),
        json.dumps(batch1_enriched),
        json.dumps(batch2_enriched),
    ]

    result = await service.parse_requirements(
        description="Build many features",
        files=None,
        existing_requirements=[],
        target_parent_id=None,
        product_name="Test",
    )

    assert len(result) == 15
    # 1 skeleton + 2 enrichment batches
    assert mock_client.complete.call_count == 3
    assert all(r.what_this_does is not None for r in result)


@pytest.mark.asyncio
async def test_works_without_progress_callback(ai_service):
    """Should work fine when no progress callback is provided."""
    service, mock_client = ai_service

    mock_client.complete.side_effect = [
        json.dumps([{"temp_id": "temp-1", "node_type": "requirement", "title": "Test", "parent_ref": None, "priority": "medium", "tags": ["functional"]}]),
        json.dumps([{"temp_id": "temp-1", "node_type": "requirement", "title": "Test", "parent_ref": None, "priority": "medium", "tags": ["functional"], "what_this_does": "Does test", "acceptance_criteria": "- Works"}]),
    ]

    result = await service.parse_requirements(
        description="Test",
        files=None,
        existing_requirements=[],
        target_parent_id=None,
        product_name="Test",
    )

    assert len(result) == 1
    assert result[0].what_this_does == "Does test"
