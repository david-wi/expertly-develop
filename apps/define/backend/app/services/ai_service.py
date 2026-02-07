import json
import re
import base64
from typing import List, Optional
from pypdf import PdfReader
from io import BytesIO

from app.schemas.ai import FileContent, ExistingRequirement, ParsedRequirement, ContextUrl
from app.services.decomposition_guide import DECOMPOSITION_GUIDE
from artifacts import reflow_pdf_text
from app.utils.ai_config import get_ai_client


class AIService:
    def __init__(self):
        self.client = get_ai_client()

    def _extract_pdf_text(self, base64_content: str) -> str:
        """Extract text from PDF content."""
        try:
            pdf_bytes = base64.b64decode(base64_content)
            reader = PdfReader(BytesIO(pdf_bytes))
            text_parts = []
            for page in reader.pages:
                page_text = page.extract_text() or ""
                # Reflow text to join lines that are part of the same paragraph
                reflowed_text = reflow_pdf_text(page_text)
                text_parts.append(reflowed_text)
            return "\n\n".join(text_parts)
        except Exception as e:
            return f"[PDF content could not be extracted: {str(e)}]"

    def _build_tree_text(self, requirements: List[ExistingRequirement]) -> str:
        """Build an indented tree representation of existing requirements."""
        by_parent = {}
        roots = []

        for req in requirements:
            if req.parent_id:
                if req.parent_id not in by_parent:
                    by_parent[req.parent_id] = []
                by_parent[req.parent_id].append(req)
            else:
                roots.append(req)

        def render(items: List[ExistingRequirement], indent: int) -> str:
            lines = []
            for item in items:
                prefix = "  " * indent
                children = by_parent.get(item.id, [])
                child_text = "\n" + render(children, indent + 1) if children else ""
                node_type_label = f" [{item.node_type}]" if item.node_type else ""
                lines.append(f"{prefix}- [{item.stable_key}] {item.title}{node_type_label} (id: {item.id}){child_text}")
            return "\n".join(lines)

        return render(roots, 0) if roots else "(No existing requirements)"

    async def parse_requirements(
        self,
        description: str,
        files: Optional[List[FileContent]],
        existing_requirements: List[ExistingRequirement],
        target_parent_id: Optional[str],
        product_name: str,
        context_urls: Optional[List[ContextUrl]] = None,
        related_requirement_ids: Optional[List[str]] = None,
    ) -> List[ParsedRequirement]:
        """Parse requirements from description and files using AI."""

        # Build context about existing tree structure
        tree_text = self._build_tree_text(existing_requirements)

        # Process files
        file_context = ""
        images = []

        if files:
            for file in files:
                if file.type.startswith("image/"):
                    images.append({
                        "media_type": file.type,
                        "data": file.content,
                    })
                elif file.type == "application/pdf":
                    pdf_text = self._extract_pdf_text(file.content)
                    file_context += f"\n\n--- File: {file.name} (PDF) ---\n{pdf_text}"
                else:
                    file_context += f"\n\n--- File: {file.name} ---\n{file.content}"

        # Build URL context section
        url_context = ""
        if context_urls:
            url_context = "\n\n--- External Context (from URLs) ---"
            for url_item in context_urls:
                url_context += f"\n\n[{url_item.title}] ({url_item.url})\n{url_item.content[:3000]}"
                if len(url_item.content) > 3000:
                    url_context += "\n... (content truncated)"

        # Build related requirements context section
        related_reqs_context = ""
        if related_requirement_ids and existing_requirements:
            related_reqs = [r for r in existing_requirements if r.id in related_requirement_ids]
            if related_reqs:
                related_reqs_context = "\n\n--- Related Requirements for Context ---"
                related_reqs_context += "\nUse these existing requirements as context to ensure consistency in terminology and avoid duplicating functionality:\n"
                for req in related_reqs:
                    related_reqs_context += f"\n[{req.stable_key}] {req.title}"

        # Build system prompt with decomposition guide
        system_prompt = f"""You are an expert requirements analyst. Your job is to decompose concept documents and user descriptions into a well-structured tree of products, modules, features, requirements, and guardrails.

{DECOMPOSITION_GUIDE}

## Output format rules

For every node you create:
1. Set "node_type" to one of: "product", "module", "feature", "requirement", "guardrail"
2. Title should be clear and actionable
3. "what_this_does" should describe the capability in plain English. For requirements, start with "Users can..." or "The system..."
4. "why_this_exists" explains the reason in 1-2 sentences
5. "not_included" lists scope exclusions as bullet points (use \\n between bullets). Most useful for product/module/feature nodes. Requirements can omit this if not needed.
6. "acceptance_criteria" lists testable criteria as bullet points (use \\n between bullets). Required at every level. Product-level criteria are broad (4-8 items). Requirement-level criteria are specific and independently testable.
7. Priority should be: critical, high, medium, or low
8. Tags should be from: functional, nonfunctional, security, performance, usability, invariant

For hierarchical structure:
- Use parent_ref to build the tree: product at root, modules under product, features under modules, requirements under features
- parent_ref can be an existing requirement ID from the tree or a temp_id from another node you are creating in this batch
- Guardrails are separate root-level or module-level nodes. They should be tagged with "invariant".

When provided with external context (URLs or related requirements):
- Use the terminology and patterns from the context
- Ensure new nodes complement rather than conflict with existing ones

IMPORTANT — Deduplication rules:
- Carefully review the existing requirements tree before generating new ones
- Do NOT create nodes that duplicate or substantially overlap with existing ones
- Only generate nodes for functionality NOT already covered
- If an artifact describes something already captured in existing requirements, skip it
- When in doubt, err on the side of NOT creating a duplicate

IMPORTANT — Completeness rules:
- Read the ENTIRE input before generating nodes
- Cover every section, screen, API group, data entity, stated goal, edge case, and guardrail in the input
- Check your output against the sizing guide: a 500-1000 line document should produce 40-80 nodes; a 1000-2000 line document should produce 80-150 nodes
- If your output is significantly below the expected range, you have missed categories — go back and check

Respond ONLY with a valid JSON array. No explanation or markdown."""

        target_info = (
            f'\\nTarget parent: Place new requirements under the requirement with ID "{target_parent_id}"'
            if target_parent_id
            else "\\nTarget: Create at root level (no parent) unless the structure suggests nesting."
        )

        user_prompt_text = f"""Product: "{product_name}"

Existing requirements tree (DO NOT duplicate these — only create NEW requirements for uncovered functionality):
{tree_text}
{target_info}
{url_context}
{related_reqs_context}

User's description of new requirements:
{description}
{'\\n\\nAdditional context from files:' + file_context if file_context else ''}
{'\\n\\n(See attached images for additional context)' if images else ''}

Decompose the input into a structured tree. Return a JSON array with this exact structure:
[
  {{
    "temp_id": "temp-1",
    "node_type": "product",
    "title": "...",
    "what_this_does": "...",
    "why_this_exists": "...",
    "not_included": "- Point 1\\n- Point 2",
    "acceptance_criteria": "- Criterion 1\\n- Criterion 2",
    "priority": "critical",
    "tags": ["functional"],
    "parent_ref": null
  }},
  {{
    "temp_id": "temp-2",
    "node_type": "module",
    "title": "...",
    "what_this_does": "...",
    "why_this_exists": "...",
    "not_included": "- ...",
    "acceptance_criteria": "- ...",
    "priority": "high",
    "tags": ["functional"],
    "parent_ref": "temp-1"
  }},
  {{
    "temp_id": "temp-3",
    "node_type": "feature",
    "title": "...",
    "what_this_does": "...",
    "why_this_exists": "...",
    "acceptance_criteria": "- ...",
    "priority": "high",
    "tags": ["functional"],
    "parent_ref": "temp-2"
  }},
  {{
    "temp_id": "temp-4",
    "node_type": "requirement",
    "title": "...",
    "what_this_does": "Users can...",
    "why_this_exists": "...",
    "acceptance_criteria": "- Criterion 1\\n- Criterion 2",
    "priority": "medium",
    "tags": ["functional"],
    "parent_ref": "temp-3"
  }},
  {{
    "temp_id": "temp-5",
    "node_type": "guardrail",
    "title": "...",
    "what_this_does": "...",
    "why_this_exists": "...",
    "acceptance_criteria": "- ...",
    "priority": "critical",
    "tags": ["invariant"],
    "parent_ref": "temp-1"
  }}
]

node_type must be one of: "product", "module", "feature", "requirement", "guardrail".

For parent_ref, use either:
- An existing requirement ID from the tree above
- Another temp_id from this batch (e.g., "temp-1" if this is a child of the first node)
- null for root-level nodes

Respond with ONLY the JSON array, no other text."""

        # Call AI using multi-provider client
        text = await self.client.complete(
            use_case="requirements_parsing",
            system_prompt=system_prompt,
            user_content=user_prompt_text,
            images=images if images else None,
        )

        # Guard against None/empty responses
        if not text or not text.strip():
            raise ValueError(
                "AI returned an empty response. This may be a temporary issue — please try again. "
                "If the problem persists, the document may be too large for the current model's token limit."
            )

        # Parse JSON response
        json_match = re.search(r"\[[\s\S]*\]", text)
        if not json_match:
            raise ValueError(f"Failed to parse AI response: {text[:500]}")

        parsed = json.loads(json_match.group(0))
        if not isinstance(parsed, list):
            raise ValueError("Response is not an array")

        # Validate and convert to Pydantic models
        valid_node_types = {"product", "module", "feature", "requirement", "guardrail"}
        requirements = []
        for i, item in enumerate(parsed):
            if not item.get("temp_id"):
                item["temp_id"] = f"temp-{i + 1}"
            if not item.get("title"):
                raise ValueError(f"Requirement {i} missing title")
            if not item.get("priority"):
                item["priority"] = "medium"
            if not item.get("tags"):
                item["tags"] = ["functional"]
            # Default node_type to "requirement" if missing or invalid
            node_type = item.get("node_type", "requirement")
            if node_type not in valid_node_types:
                node_type = "requirement"

            requirements.append(ParsedRequirement(
                temp_id=item["temp_id"],
                node_type=node_type,
                title=item["title"],
                what_this_does=item.get("what_this_does"),
                why_this_exists=item.get("why_this_exists"),
                not_included=item.get("not_included"),
                acceptance_criteria=item.get("acceptance_criteria"),
                priority=item["priority"],
                tags=item["tags"],
                parent_ref=item.get("parent_ref"),
            ))

        return requirements
