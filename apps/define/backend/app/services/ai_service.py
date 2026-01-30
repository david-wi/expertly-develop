import anthropic
import json
import base64
from typing import List, Optional
from pypdf import PdfReader
from io import BytesIO

from app.config import get_settings
from app.schemas.ai import FileContent, ExistingRequirement, ParsedRequirement, ContextUrl

settings = get_settings()


class AIService:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def _extract_pdf_text(self, base64_content: str) -> str:
        """Extract text from PDF content."""
        try:
            pdf_bytes = base64.b64decode(base64_content)
            reader = PdfReader(BytesIO(pdf_bytes))
            text_parts = []
            for page in reader.pages:
                text_parts.append(page.extract_text() or "")
            return "\n".join(text_parts)
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
                lines.append(f"{prefix}- [{item.stable_key}] {item.title} (id: {item.id}){child_text}")
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
        """Parse requirements from description and files using Claude."""

        # Build context about existing tree structure
        tree_text = self._build_tree_text(existing_requirements)

        # Process files
        file_context = ""
        image_blocks = []

        if files:
            for file in files:
                if file.type.startswith("image/"):
                    image_blocks.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": file.type,
                            "data": file.content,
                        },
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

        # Build system prompt
        system_prompt = """You are an expert requirements analyst. Your job is to parse user descriptions and create well-structured software requirements.

When creating requirements:
1. Each requirement should have a clear, actionable title
2. "what_this_does" should be a single sentence starting with "Users can..."
3. "why_this_exists" explains the business value in 1-2 sentences
4. "not_included" lists scope exclusions as bullet points (use \\n between bullets)
5. "acceptance_criteria" lists testable criteria as bullet points (use \\n between bullets)
6. Priority should be: critical, high, medium, or low
7. Tags should be from: functional, nonfunctional, security, performance, usability, invariant

For hierarchical structure:
- Create parent requirements for major features
- Create child requirements for sub-features
- Use parent_ref to link children to parents (either an existing ID or a temp_id from another requirement you're creating)

When provided with external context (URLs or related requirements):
- Use the terminology and patterns from the context
- Avoid duplicating existing functionality
- Ensure new requirements complement rather than conflict with existing ones

Respond ONLY with a valid JSON array of requirements. No explanation or markdown."""

        target_info = (
            f'\nTarget parent: Place new requirements under the requirement with ID "{target_parent_id}"'
            if target_parent_id
            else "\nTarget: Create at root level (no parent) unless the structure suggests nesting."
        )

        user_prompt_text = f"""Product: "{product_name}"

Existing requirements tree:
{tree_text}
{target_info}
{url_context}
{related_reqs_context}

User's description of new requirements:
{description}
{f'\n\nAdditional context from files:{file_context}' if file_context else ''}
{'\n\n(See attached images for additional context)' if image_blocks else ''}

Generate structured requirements based on this input. Return a JSON array with this exact structure:
[
  {{
    "temp_id": "temp-1",
    "title": "...",
    "what_this_does": "Users can...",
    "why_this_exists": "...",
    "not_included": "- Point 1\\n- Point 2",
    "acceptance_criteria": "- Criterion 1\\n- Criterion 2",
    "priority": "medium",
    "tags": ["functional"],
    "parent_ref": null
  }}
]

For child requirements, set parent_ref to either:
- An existing requirement ID from the tree above
- Another temp_id from this batch (e.g., "temp-1" if this is a child of the first requirement)

Respond with ONLY the JSON array, no other text."""

        # Build content blocks
        content_blocks = []
        for image_block in image_blocks:
            content_blocks.append(image_block)
        content_blocks.append({"type": "text", "text": user_prompt_text})

        # Get model configuration for requirements parsing
        from app.utils.ai_config import get_use_case_config
        use_case_config = get_use_case_config("requirements_parsing")

        # Call Claude
        response = self.client.messages.create(
            model=use_case_config.model_id,
            max_tokens=use_case_config.max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": content_blocks}],
        )

        # Extract text from response
        text_block = next((b for b in response.content if b.type == "text"), None)
        if not text_block:
            raise ValueError("No text response from AI")

        text = text_block.text

        # Parse JSON response
        import re
        json_match = re.search(r"\[[\s\S]*\]", text)
        if not json_match:
            raise ValueError(f"Failed to parse AI response: {text[:200]}")

        parsed = json.loads(json_match.group(0))
        if not isinstance(parsed, list):
            raise ValueError("Response is not an array")

        # Validate and convert to Pydantic models
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

            requirements.append(ParsedRequirement(
                temp_id=item["temp_id"],
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
