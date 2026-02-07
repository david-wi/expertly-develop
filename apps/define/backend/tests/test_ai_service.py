"""Tests for AI service - three-phase requirement generation and error handling."""

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


# --- Three-phase generation tests ---

@pytest.mark.asyncio
async def test_three_phase_generation(ai_service):
    """Full three-phase flow: outline -> expand features -> enrich."""
    service, mock_client = ai_service

    # Phase 1: Outline (product, module, feature)
    outline_response = json.dumps([
        {"temp_id": "temp-1", "node_type": "product", "title": "Test Product", "parent_ref": None, "priority": "critical", "tags": ["functional"]},
        {"temp_id": "temp-2", "node_type": "module", "title": "Auth Module", "parent_ref": "temp-1", "priority": "high", "tags": ["functional"]},
        {"temp_id": "temp-3", "node_type": "feature", "title": "Login Feature", "parent_ref": "temp-2", "priority": "high", "tags": ["functional"]},
    ])

    # Phase 2: Expand feature into requirements
    expand_response = json.dumps([
        {"temp_id": "temp-4", "node_type": "requirement", "title": "Email/password login", "parent_ref": "temp-3", "priority": "high", "tags": ["functional"]},
        {"temp_id": "temp-5", "node_type": "requirement", "title": "Login error handling", "parent_ref": "temp-3", "priority": "medium", "tags": ["functional"]},
    ])

    # Phase 3: Enrich all nodes with details
    enriched_response = json.dumps([
        {"temp_id": "temp-1", "node_type": "product", "title": "Test Product", "parent_ref": None, "priority": "critical", "tags": ["functional"], "what_this_does": "A test product", "why_this_exists": "For testing", "acceptance_criteria": "- Works correctly"},
        {"temp_id": "temp-2", "node_type": "module", "title": "Auth Module", "parent_ref": "temp-1", "priority": "high", "tags": ["functional"], "what_this_does": "Handles authentication", "why_this_exists": "Security", "acceptance_criteria": "- Users can log in"},
        {"temp_id": "temp-3", "node_type": "feature", "title": "Login Feature", "parent_ref": "temp-2", "priority": "high", "tags": ["functional"], "what_this_does": "Users can log in", "why_this_exists": "Access control", "acceptance_criteria": "- Email/password login works"},
        {"temp_id": "temp-4", "node_type": "requirement", "title": "Email/password login", "parent_ref": "temp-3", "priority": "high", "tags": ["functional"], "what_this_does": "Allows email/pass auth", "why_this_exists": "Primary auth method", "acceptance_criteria": "- Correct creds logs in"},
        {"temp_id": "temp-5", "node_type": "requirement", "title": "Login error handling", "parent_ref": "temp-3", "priority": "medium", "tags": ["functional"], "what_this_does": "Shows login errors", "why_this_exists": "User feedback", "acceptance_criteria": "- Shows error on failure"},
    ])

    # Phase 1 outline + Phase 2 expand (1 feature) + Phase 3 enrich (1 batch of 5 nodes)
    mock_client.complete.side_effect = [outline_response, expand_response, enriched_response]

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

    assert len(result) == 5
    assert result[0].title == "Test Product"
    assert result[0].node_type == "product"
    assert result[0].what_this_does == "A test product"
    assert result[1].title == "Auth Module"
    assert result[1].node_type == "module"
    assert result[3].title == "Email/password login"
    assert result[3].node_type == "requirement"
    assert result[4].acceptance_criteria == "- Shows error on failure"

    # Verify progress callbacks
    phases = [p[0] for p in progress_calls]
    assert "outline" in phases
    assert "expanding" in phases
    assert "enriching" in phases
    assert "complete" in phases

    # 1 outline + 1 expand + 1 enrich batch
    assert mock_client.complete.call_count == 3


@pytest.mark.asyncio
async def test_outline_failure_propagates(ai_service):
    """When outline generation fails, error should propagate."""
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
async def test_multiple_features_expanded_in_parallel(ai_service):
    """Multiple features should each get their own expand call."""
    service, mock_client = ai_service

    # Phase 1: Outline with 3 features
    outline_response = json.dumps([
        {"temp_id": "temp-1", "node_type": "product", "title": "Product", "parent_ref": None, "priority": "critical", "tags": ["functional"]},
        {"temp_id": "temp-2", "node_type": "feature", "title": "Feature A", "parent_ref": "temp-1", "priority": "high", "tags": ["functional"]},
        {"temp_id": "temp-3", "node_type": "feature", "title": "Feature B", "parent_ref": "temp-1", "priority": "high", "tags": ["functional"]},
        {"temp_id": "temp-4", "node_type": "feature", "title": "Feature C", "parent_ref": "temp-1", "priority": "medium", "tags": ["functional"]},
    ])

    # Phase 2: 3 expand responses (one per feature)
    expand_a = json.dumps([
        {"temp_id": "temp-100", "node_type": "requirement", "title": "Req A1", "parent_ref": "temp-2", "priority": "high", "tags": ["functional"]},
    ])
    expand_b = json.dumps([
        {"temp_id": "temp-150", "node_type": "requirement", "title": "Req B1", "parent_ref": "temp-3", "priority": "high", "tags": ["functional"]},
    ])
    expand_c = json.dumps([
        {"temp_id": "temp-200", "node_type": "requirement", "title": "Req C1", "parent_ref": "temp-4", "priority": "medium", "tags": ["functional"]},
    ])

    # Phase 3: Enrich all 7 nodes in 1 batch
    enriched = json.dumps([
        {"temp_id": "temp-1", "what_this_does": "The product"},
        {"temp_id": "temp-2", "what_this_does": "Feature A desc"},
        {"temp_id": "temp-3", "what_this_does": "Feature B desc"},
        {"temp_id": "temp-4", "what_this_does": "Feature C desc"},
        {"temp_id": "temp-5", "what_this_does": "Req A1 desc"},
        {"temp_id": "temp-6", "what_this_does": "Req B1 desc"},
        {"temp_id": "temp-7", "what_this_does": "Req C1 desc"},
    ])

    mock_client.complete.side_effect = [outline_response, expand_a, expand_b, expand_c, enriched]

    result = await service.parse_requirements(
        description="Build features",
        files=None,
        existing_requirements=[],
        target_parent_id=None,
        product_name="Test",
    )

    assert len(result) == 7
    # 1 outline + 3 expand + 1 enrich batch
    assert mock_client.complete.call_count == 5


@pytest.mark.asyncio
async def test_large_tree_creates_multiple_enrich_batches(ai_service):
    """Trees with >10 nodes should create multiple enrichment batches."""
    service, mock_client = ai_service

    # Phase 1: Outline with 2 features
    outline_response = json.dumps([
        {"temp_id": "temp-1", "node_type": "product", "title": "Product", "parent_ref": None, "priority": "critical", "tags": ["functional"]},
        {"temp_id": "temp-2", "node_type": "module", "title": "Module", "parent_ref": "temp-1", "priority": "high", "tags": ["functional"]},
        {"temp_id": "temp-3", "node_type": "feature", "title": "Feature", "parent_ref": "temp-2", "priority": "high", "tags": ["functional"]},
    ])

    # Phase 2: Expand feature into 12 requirements (to force multiple enrich batches)
    expand_response = json.dumps([
        {"temp_id": f"temp-{100+i}", "node_type": "requirement", "title": f"Req {i}", "parent_ref": "temp-3", "priority": "medium", "tags": ["functional"]}
        for i in range(12)
    ])

    # Total nodes: 3 outline + 12 requirements = 15 -> 2 enrich batches (10 + 5)
    batch1_enriched = json.dumps([
        {"temp_id": f"temp-{i}", "what_this_does": f"Does thing {i}", "acceptance_criteria": "- Works"}
        for i in range(1, 11)  # temp-1 through temp-10
    ])
    batch2_enriched = json.dumps([
        {"temp_id": f"temp-{i}", "what_this_does": f"Does thing {i}", "acceptance_criteria": "- Works"}
        for i in range(11, 16)  # temp-11 through temp-15
    ])

    mock_client.complete.side_effect = [
        outline_response,
        expand_response,
        batch1_enriched,
        batch2_enriched,
    ]

    result = await service.parse_requirements(
        description="Build many features",
        files=None,
        existing_requirements=[],
        target_parent_id=None,
        product_name="Test",
    )

    assert len(result) == 15
    # 1 outline + 1 expand + 2 enrich batches
    assert mock_client.complete.call_count == 4
    assert all(r.what_this_does is not None for r in result)


@pytest.mark.asyncio
async def test_works_without_progress_callback(ai_service):
    """Should work fine when no progress callback is provided."""
    service, mock_client = ai_service

    outline = json.dumps([
        {"temp_id": "temp-1", "node_type": "product", "title": "Test", "parent_ref": None, "priority": "medium", "tags": ["functional"]},
        {"temp_id": "temp-2", "node_type": "feature", "title": "Feature", "parent_ref": "temp-1", "priority": "medium", "tags": ["functional"]},
    ])

    expand = json.dumps([
        {"temp_id": "temp-50", "node_type": "requirement", "title": "Req", "parent_ref": "temp-2", "priority": "medium", "tags": ["functional"]},
    ])

    enrich = json.dumps([
        {"temp_id": "temp-1", "what_this_does": "Product desc"},
        {"temp_id": "temp-2", "what_this_does": "Feature desc"},
        {"temp_id": "temp-3", "what_this_does": "Req desc"},
    ])

    mock_client.complete.side_effect = [outline, expand, enrich]

    result = await service.parse_requirements(
        description="Test",
        files=None,
        existing_requirements=[],
        target_parent_id=None,
        product_name="Test",
    )

    assert len(result) == 3
    assert result[0].what_this_does == "Product desc"


@pytest.mark.asyncio
async def test_no_features_skips_expand_phase(ai_service):
    """When outline has no features, Phase 2 should be skipped."""
    service, mock_client = ai_service

    # Outline with only product and module (no features)
    outline = json.dumps([
        {"temp_id": "temp-1", "node_type": "product", "title": "Product", "parent_ref": None, "priority": "critical", "tags": ["functional"]},
        {"temp_id": "temp-2", "node_type": "module", "title": "Module", "parent_ref": "temp-1", "priority": "high", "tags": ["functional"]},
    ])

    enrich = json.dumps([
        {"temp_id": "temp-1", "what_this_does": "The product", "acceptance_criteria": "- Works"},
        {"temp_id": "temp-2", "what_this_does": "The module", "acceptance_criteria": "- Works"},
    ])

    # 1 outline + 0 expand + 1 enrich batch
    mock_client.complete.side_effect = [outline, enrich]

    result = await service.parse_requirements(
        description="Test",
        files=None,
        existing_requirements=[],
        target_parent_id=None,
        product_name="Test",
    )

    assert len(result) == 2
    # 1 outline + 0 expand + 1 enrich
    assert mock_client.complete.call_count == 2


@pytest.mark.asyncio
async def test_nodes_missing_title_are_skipped(ai_service):
    """Nodes without a title should be filtered out in the final result."""
    service, mock_client = ai_service

    outline = json.dumps([
        {"temp_id": "temp-1", "node_type": "product", "title": "Product", "parent_ref": None, "priority": "critical", "tags": ["functional"]},
        {"temp_id": "temp-2", "node_type": "feature", "title": "", "parent_ref": "temp-1", "priority": "high", "tags": ["functional"]},
    ])

    # No features with non-empty title, so expand phase produces nothing meaningful
    # But the feature has an empty title, so it won't be a "feature" that triggers expansion
    # Actually, the code filters features by node_type=="feature" regardless of title
    # The empty-title node gets filtered in the merge step

    expand = json.dumps([
        {"temp_id": "temp-50", "node_type": "requirement", "title": "A Req", "parent_ref": "temp-2", "priority": "medium", "tags": ["functional"]},
    ])

    enrich = json.dumps([
        {"temp_id": "temp-1", "what_this_does": "The product"},
        {"temp_id": "temp-2"},  # Empty title remains empty
        {"temp_id": "temp-3", "what_this_does": "A requirement"},
    ])

    mock_client.complete.side_effect = [outline, expand, enrich]

    result = await service.parse_requirements(
        description="Test",
        files=None,
        existing_requirements=[],
        target_parent_id=None,
        product_name="Test",
    )

    # The empty-title node should be filtered out
    titles = [r.title for r in result]
    assert "" not in titles
    assert "Product" in titles
