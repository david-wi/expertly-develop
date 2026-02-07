import asyncio
import json
import logging
import re
import base64
from typing import List, Optional, Callable, Awaitable
from pypdf import PdfReader
from io import BytesIO

from app.schemas.ai import FileContent, ExistingRequirement, ParsedRequirement, ContextUrl
from app.services.decomposition_guide import DECOMPOSITION_GUIDE
from artifacts import reflow_pdf_text
from app.utils.ai_config import get_ai_client

logger = logging.getLogger(__name__)

# Batch size for parallel enrichment calls
ENRICHMENT_BATCH_SIZE = 10

# Progress callback type: async fn(phase, detail) -> None
ProgressCallback = Callable[[str, str], Awaitable[None]]


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

    def _parse_json_array(self, text: str) -> list:
        """Extract and parse a JSON array from AI response text."""
        if not text or not text.strip():
            raise ValueError(
                "AI returned an empty response. This may be a temporary issue — please try again. "
                "If the problem persists, the document may be too large for the current model's token limit."
            )

        json_match = re.search(r"\[[\s\S]*\]", text)
        if not json_match:
            raise ValueError(f"Failed to parse AI response: {text[:500]}")

        parsed = json.loads(json_match.group(0))
        if not isinstance(parsed, list):
            raise ValueError("Response is not an array")
        return parsed

    def _build_input_context(
        self,
        description: str,
        files: Optional[List[FileContent]],
        existing_requirements: List[ExistingRequirement],
        target_parent_id: Optional[str],
        product_name: str,
        context_urls: Optional[List[ContextUrl]] = None,
        related_requirement_ids: Optional[List[str]] = None,
    ) -> tuple:
        """Build shared context used by both phases. Returns (tree_text, file_context, images, url_context, related_reqs_context, target_info)."""
        tree_text = self._build_tree_text(existing_requirements)

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

        url_context = ""
        if context_urls:
            url_context = "\n\n--- External Context (from URLs) ---"
            for url_item in context_urls:
                url_context += f"\n\n[{url_item.title}] ({url_item.url})\n{url_item.content[:3000]}"
                if len(url_item.content) > 3000:
                    url_context += "\n... (content truncated)"

        related_reqs_context = ""
        if related_requirement_ids and existing_requirements:
            related_reqs = [r for r in existing_requirements if r.id in related_requirement_ids]
            if related_reqs:
                related_reqs_context = "\n\n--- Related Requirements for Context ---"
                related_reqs_context += "\nUse these existing requirements as context to ensure consistency in terminology and avoid duplicating functionality:\n"
                for req in related_reqs:
                    related_reqs_context += f"\n[{req.stable_key}] {req.title}"

        target_info = (
            f'\nTarget parent: Place new requirements under the requirement with ID "{target_parent_id}"'
            if target_parent_id
            else "\nTarget: Create at root level (no parent) unless the structure suggests nesting."
        )

        return tree_text, file_context, images, url_context, related_reqs_context, target_info

    async def _generate_skeleton(
        self,
        description: str,
        tree_text: str,
        file_context: str,
        images: list,
        url_context: str,
        related_reqs_context: str,
        target_info: str,
        product_name: str,
    ) -> list:
        """Phase 1: Generate a lightweight tree skeleton (titles + hierarchy only)."""

        system_prompt = f"""You are an expert requirements analyst. Your job is to decompose concept documents into a well-structured tree of products, modules, features, requirements, and guardrails.

{DECOMPOSITION_GUIDE}

## Output rules for this step

You are generating a SKELETON — titles and hierarchy only. Do NOT write descriptions or acceptance criteria yet.

For every node, output ONLY these fields:
- "temp_id": sequential ID like "temp-1", "temp-2", etc.
- "node_type": one of "product", "module", "feature", "requirement", "guardrail"
- "title": clear, actionable title
- "parent_ref": null for root, or another temp_id / existing requirement ID
- "priority": "critical", "high", "medium", or "low"
- "tags": array from ["functional", "nonfunctional", "security", "performance", "usability", "invariant"]

IMPORTANT — Deduplication:
- Review the existing requirements tree and do NOT duplicate what's already there
- Only generate nodes for functionality NOT already covered

IMPORTANT — Completeness:
- Cover every section, screen, API group, data entity, goal, edge case, and guardrail
- A 500-1000 line document should produce 40-80 nodes; 1000-2000 lines should produce 80-150 nodes

Respond with ONLY a JSON array. No explanation, no markdown fences."""

        user_prompt = f"""Product: "{product_name}"

Existing requirements tree (DO NOT duplicate):
{tree_text}
{target_info}
{url_context}
{related_reqs_context}

Document to decompose:
{description}
{'\\n\\nAdditional context from files:' + file_context if file_context else ''}
{'\\n\\n(See attached images for additional context)' if images else ''}

Return a JSON array of skeleton nodes:
[{{"temp_id": "temp-1", "node_type": "product", "title": "...", "parent_ref": null, "priority": "critical", "tags": ["functional"]}}, ...]"""

        text = await self.client.complete(
            use_case="requirements_parsing",
            system_prompt=system_prompt,
            user_content=user_prompt,
            images=images if images else None,
        )

        return self._parse_json_array(text)

    async def _enrich_batch(
        self,
        description: str,
        full_skeleton: list,
        batch_nodes: list,
        product_name: str,
    ) -> list:
        """Phase 2: Enrich a batch of skeleton nodes with full details."""

        # Build skeleton summary for context
        skeleton_summary = "\n".join(
            f"  {n.get('temp_id', '?')}: [{n.get('node_type', '?')}] {n.get('title', '?')} (parent: {n.get('parent_ref', 'root')})"
            for n in full_skeleton
        )

        # Build list of nodes to enrich
        batch_ids = [n.get("temp_id", f"temp-{i}") for i, n in enumerate(batch_nodes)]
        batch_list = "\n".join(
            f"  - {n.get('temp_id', '?')}: [{n.get('node_type', '?')}] {n.get('title', '?')}"
            for n in batch_nodes
        )

        system_prompt = """You are an expert requirements analyst. You will be given a tree skeleton and a subset of nodes to enrich with full details.

For each node, add:
1. "what_this_does" — plain English description. For requirements: "Users can..." or "The system..."
2. "why_this_exists" — 1-2 sentence explanation
3. "not_included" — scope exclusions as bullet points (use \\n between bullets). Most useful for product/module/feature nodes. Requirements can omit or set null.
4. "acceptance_criteria" — testable criteria as bullet points (use \\n between bullets). Product-level: 4-8 broad items. Requirement-level: specific, independently testable.

Keep all existing fields (temp_id, node_type, title, parent_ref, priority, tags) unchanged.

Respond with ONLY a JSON array of the enriched nodes. No other text."""

        user_prompt = f"""Product: "{product_name}"

Full tree skeleton for context:
{skeleton_summary}

Source document (reference for writing descriptions):
{description[:6000]}
{f'... (document truncated, {len(description)} chars total)' if len(description) > 6000 else ''}

Enrich ONLY these {len(batch_nodes)} nodes (return them with all fields filled in):
{batch_list}

Return a JSON array with the enriched nodes:
[{{"temp_id": "...", "node_type": "...", "title": "...", "parent_ref": ..., "priority": "...", "tags": [...], "what_this_does": "...", "why_this_exists": "...", "not_included": "...", "acceptance_criteria": "- ..."}}]"""

        text = await self.client.complete(
            use_case="requirements_parsing",
            system_prompt=system_prompt,
            user_content=user_prompt,
        )

        return self._parse_json_array(text)

    async def parse_requirements(
        self,
        description: str,
        files: Optional[List[FileContent]],
        existing_requirements: List[ExistingRequirement],
        target_parent_id: Optional[str],
        product_name: str,
        context_urls: Optional[List[ContextUrl]] = None,
        related_requirement_ids: Optional[List[str]] = None,
        on_progress: Optional[ProgressCallback] = None,
    ) -> List[ParsedRequirement]:
        """Parse requirements using two-phase approach:
        Phase 1: Generate tree skeleton (titles + hierarchy)
        Phase 2: Enrich details in parallel batches
        """

        # Build shared context
        tree_text, file_context, images, url_context, related_reqs_context, target_info = \
            self._build_input_context(
                description, files, existing_requirements, target_parent_id,
                product_name, context_urls, related_requirement_ids,
            )

        # --- Phase 1: Generate skeleton ---
        if on_progress:
            await on_progress("skeleton", "Generating requirement tree structure...")

        logger.info("Phase 1: Generating skeleton")
        skeleton = await self._generate_skeleton(
            description=description,
            tree_text=tree_text,
            file_context=file_context,
            images=images,
            url_context=url_context,
            related_reqs_context=related_reqs_context,
            target_info=target_info,
            product_name=product_name,
        )
        logger.info(f"Phase 1 complete: {len(skeleton)} nodes in skeleton")

        # Assign temp_ids if missing
        for i, node in enumerate(skeleton):
            if not node.get("temp_id"):
                node["temp_id"] = f"temp-{i + 1}"

        # --- Phase 2: Enrich in parallel batches ---
        batches = [
            skeleton[i:i + ENRICHMENT_BATCH_SIZE]
            for i in range(0, len(skeleton), ENRICHMENT_BATCH_SIZE)
        ]
        total_batches = len(batches)
        logger.info(f"Phase 2: Enriching {len(skeleton)} nodes in {total_batches} batches")

        if on_progress:
            await on_progress("enriching", f"Adding details to {len(skeleton)} requirements (0/{total_batches} batches)...")

        enriched_by_id = {}
        completed_batches = 0

        async def enrich_and_track(batch_nodes: list) -> None:
            nonlocal completed_batches
            result = await self._enrich_batch(
                description=description,
                full_skeleton=skeleton,
                batch_nodes=batch_nodes,
                product_name=product_name,
            )
            for node in result:
                if node.get("temp_id"):
                    enriched_by_id[node["temp_id"]] = node
            completed_batches += 1
            if on_progress:
                await on_progress(
                    "enriching",
                    f"Adding details to {len(skeleton)} requirements ({completed_batches}/{total_batches} batches)..."
                )

        # Run all batches concurrently
        await asyncio.gather(*(enrich_and_track(batch) for batch in batches))

        logger.info(f"Phase 2 complete: {len(enriched_by_id)} nodes enriched")

        # --- Merge: skeleton + enrichment ---
        valid_node_types = {"product", "module", "feature", "requirement", "guardrail"}
        requirements = []

        for i, skel_node in enumerate(skeleton):
            temp_id = skel_node.get("temp_id", f"temp-{i + 1}")
            enriched = enriched_by_id.get(temp_id, {})

            # Merge: enrichment overrides skeleton, skeleton provides defaults
            merged = {**skel_node, **enriched}

            if not merged.get("title"):
                continue  # skip nodes without title
            if not merged.get("priority"):
                merged["priority"] = "medium"
            if not merged.get("tags"):
                merged["tags"] = ["functional"]

            node_type = merged.get("node_type", "requirement")
            if node_type not in valid_node_types:
                node_type = "requirement"

            requirements.append(ParsedRequirement(
                temp_id=temp_id,
                node_type=node_type,
                title=merged["title"],
                what_this_does=merged.get("what_this_does"),
                why_this_exists=merged.get("why_this_exists"),
                not_included=merged.get("not_included"),
                acceptance_criteria=merged.get("acceptance_criteria"),
                priority=merged["priority"],
                tags=merged["tags"],
                parent_ref=merged.get("parent_ref"),
            ))

        if on_progress:
            await on_progress("complete", f"Generated {len(requirements)} requirements")

        return requirements
