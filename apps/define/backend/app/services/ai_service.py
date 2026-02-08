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
ENRICHMENT_BATCH_SIZE = 25

# Max concurrent AI calls — kept low to avoid starving the event loop
# and blocking Identity-service auth calls for other requests.
# This server has 2 vCPUs; more than 2 concurrent calls saturates it.
MAX_CONCURRENCY = 2

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
                reflowed_text = reflow_pdf_text(page_text)
                text_parts.append(reflowed_text)
            return "\n\n".join(text_parts)
        except Exception as e:
            return f"[PDF content could not be extracted: {str(e)}]"

    def _build_tree_text(self, requirements: List[ExistingRequirement]) -> str:
        """Build an indented tree representation of existing requirements.

        For large trees (>200 nodes), renders only the structural nodes
        (product/module/feature/guardrail) with requirement counts, to
        keep the prompt manageable for deduplication.
        """
        by_parent: dict[str | None, list[ExistingRequirement]] = {}
        roots: list[ExistingRequirement] = []

        for req in requirements:
            if req.parent_id:
                by_parent.setdefault(req.parent_id, []).append(req)
            else:
                roots.append(req)

        summarize = len(requirements) > 200
        structural_types = {"product", "module", "feature", "guardrail"}

        def render(items: List[ExistingRequirement], indent: int) -> str:
            lines = []
            for item in items:
                children = by_parent.get(item.id, [])
                is_structural = item.node_type in structural_types

                # In summary mode, collapse individual requirements
                if summarize and not is_structural:
                    continue

                prefix = "  " * indent
                node_type_label = f" [{item.node_type}]" if item.node_type else ""

                if summarize and is_structural:
                    # Count requirement children (not shown individually)
                    req_children = [c for c in children if c.node_type not in structural_types]
                    struct_children = [c for c in children if c.node_type in structural_types]
                    count_note = f" ({len(req_children)} requirements)" if req_children else ""
                    lines.append(f"{prefix}- [{item.stable_key}] {item.title}{node_type_label} (id: {item.id}){count_note}")
                    if struct_children:
                        child_text = render(struct_children, indent + 1)
                        if child_text:
                            lines.append(child_text)
                else:
                    child_text = "\n" + render(children, indent + 1) if children else ""
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
        """Build shared context. Returns (tree_text, file_context, images, url_context, related_reqs_context, target_info)."""
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

    # ---- Phase 1: High-level outline (product → modules → features + guardrails) ----

    async def generate_outline(
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
        """Phase 1: Generate high-level outline — product, modules, features, guardrails only.
        Does NOT generate individual requirements (those come in Phase 2)."""

        system_prompt = f"""You are an expert requirements analyst. Decompose concept documents into a high-level tree of products, modules, features, and guardrails.

{DECOMPOSITION_GUIDE}

## Output rules for this step

Generate ONLY the high-level outline: product, module, feature, and guardrail nodes.
Do NOT generate individual "requirement" nodes — those will be generated separately for each feature.

For every node, output ONLY these fields:
- "temp_id": sequential ID like "temp-1", "temp-2", etc.
- "node_type": one of "product", "module", "feature", "guardrail" (NOT "requirement")
- "title": clear, actionable title
- "parent_ref": null for root, or another temp_id / existing requirement ID
- "priority": "critical", "high", "medium", or "low"
- "tags": array from ["functional", "nonfunctional", "security", "performance", "usability", "invariant"]

IMPORTANT — Deduplication:
- Review the existing requirements tree and do NOT duplicate what's already there

IMPORTANT — Completeness:
- Cover every section, screen, API group, data entity, goal, and guardrail
- A typical product has 4-12 modules, each with 3-10 features
- Make sure every topic in the document has a corresponding feature node

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

Return a JSON array of outline nodes (product, modules, features, guardrails — no requirements):
[{{"temp_id": "temp-1", "node_type": "product", "title": "...", "parent_ref": null, "priority": "critical", "tags": ["functional"]}}, ...]"""

        text = await self.client.complete(
            use_case="requirements_parsing",
            system_prompt=system_prompt,
            user_content=user_prompt,
            images=images if images else None,
        )

        return self._parse_json_array(text)

    # ---- Phase 2: Expand features into requirements (parallel per feature) ----

    async def expand_feature(
        self,
        description: str,
        outline: list,
        feature_node: dict,
        product_name: str,
        next_temp_id_start: int,
        existing_children: list[ExistingRequirement] | None = None,
    ) -> list:
        """Generate requirement nodes for a single feature.

        If existing_children is provided, performs a gap analysis — only
        generates requirements that are missing, not duplicates of what
        already exists.
        """

        # Build outline summary for context
        outline_summary = "\n".join(
            f"  {n.get('temp_id', '?')}: [{n.get('node_type', '?')}] {n.get('title', '?')} (parent: {n.get('parent_ref', 'root')})"
            for n in outline
        )

        feature_id = feature_node.get("temp_id", "?")
        feature_title = feature_node.get("title", "?")

        # Build existing requirements context for gap analysis
        existing_section = ""
        if existing_children:
            existing_list = "\n".join(
                f"  - [{r.stable_key}] {r.title}"
                for r in existing_children
            )
            existing_section = f"""
This feature already has {len(existing_children)} requirements:
{existing_list}

IMPORTANT: Do NOT duplicate any of these existing requirements.
Only generate requirements that are MISSING — gaps not yet covered.
If coverage is already complete, return an empty array: []
"""

        system_prompt = """You are an expert requirements analyst. Generate detailed requirement nodes for a specific feature.

Each requirement should be a single, testable statement of behavior.

For every requirement node, output these fields:
- "temp_id": sequential ID starting from the number provided
- "node_type": "requirement"
- "title": clear, actionable title
- "parent_ref": the feature's temp_id (provided below)
- "priority": "critical", "high", "medium", or "low"
- "tags": array from ["functional", "nonfunctional", "security", "performance", "usability"]

Generate requirements covering:
- Core behaviors and user actions
- Edge cases and error handling
- Validation rules
- Permission/access considerations if relevant

If existing requirements are provided, only generate what's MISSING.
If nothing is missing, return an empty array: []

Respond with ONLY a JSON array. No explanation, no markdown fences."""

        user_prompt = f"""Product: "{product_name}"

Full outline for context:
{outline_summary}

Source document (reference):
{description[:6000]}
{f'... (document truncated, {len(description)} chars total)' if len(description) > 6000 else ''}

Generate requirements for this feature:
  Feature: {feature_id} — "{feature_title}"
  Parent ref for all requirements: "{feature_id}"
  Start temp_id numbering at: temp-{next_temp_id_start}
{existing_section}
Return a JSON array of requirement nodes (or [] if nothing is missing):
[{{"temp_id": "temp-{next_temp_id_start}", "node_type": "requirement", "title": "...", "parent_ref": "{feature_id}", "priority": "medium", "tags": ["functional"]}}, ...]"""

        text = await self.client.complete(
            use_case="requirements_parsing",
            system_prompt=system_prompt,
            user_content=user_prompt,
        )

        return self._parse_json_array(text)

    # ---- Phase 3: Enrich nodes with details (parallel batches) ----

    async def enrich_batch(
        self,
        description: str,
        all_nodes: list,
        batch_nodes: list,
        product_name: str,
    ) -> list:
        """Enrich a batch of nodes with descriptions, acceptance criteria, etc."""

        # Build compact tree summary (limit to 200 lines for very large trees)
        all_lines = [
            f"  {n.get('temp_id', '?')}: [{n.get('node_type', '?')}] {n.get('title', '?')}"
            for n in all_nodes
        ]
        if len(all_lines) > 200:
            tree_summary = "\n".join(all_lines[:100]) + f"\n  ... ({len(all_lines) - 200} nodes omitted) ...\n" + "\n".join(all_lines[-100:])
        else:
            tree_summary = "\n".join(all_lines)

        batch_list = "\n".join(
            f"  - {n.get('temp_id', '?')}: [{n.get('node_type', '?')}] {n.get('title', '?')}"
            for n in batch_nodes
        )

        system_prompt = """You are an expert requirements analyst. Enrich the given nodes with full details.

For each node, add:
1. "what_this_does" — plain English description. For requirements: "Users can..." or "The system..."
2. "why_this_exists" — 1-2 sentence explanation
3. "not_included" — scope exclusions as bullet points (use \\n between bullets). Useful for product/module/feature nodes. Requirements can set null.
4. "acceptance_criteria" — testable criteria as bullet points (use \\n between bullets). Product-level: 4-8 broad items. Requirement-level: specific, independently testable.

Keep all existing fields (temp_id, node_type, title, parent_ref, priority, tags) unchanged.

Respond with ONLY a JSON array of the enriched nodes. No other text."""

        user_prompt = f"""Product: "{product_name}"

Tree structure for context:
{tree_summary}

Source document (reference):
{description[:6000]}
{f'... (document truncated, {len(description)} chars total)' if len(description) > 6000 else ''}

Enrich ONLY these {len(batch_nodes)} nodes:
{batch_list}

Return a JSON array with enriched nodes."""

        text = await self.client.complete(
            use_case="requirements_parsing",
            system_prompt=system_prompt,
            user_content=user_prompt,
        )

        return self._parse_json_array(text)

    # ---- Main orchestrator ----

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
        """Parse requirements using three-phase hierarchical approach:
        Phase 1: Generate high-level outline (product → modules → features)
        Phase 2: Expand each feature into requirements (parallel)
        Phase 3: Enrich all nodes with details (parallel batches)
        """

        tree_text, file_context, images, url_context, related_reqs_context, target_info = \
            self._build_input_context(
                description, files, existing_requirements, target_parent_id,
                product_name, context_urls, related_requirement_ids,
            )

        # ---- Phase 1: Generate outline ----
        if on_progress:
            await on_progress("outline", "Generating high-level structure (product, modules, features)...")

        logger.info("Phase 1: Generating outline")
        outline = await self.generate_outline(
            description=description,
            tree_text=tree_text,
            file_context=file_context,
            images=images,
            url_context=url_context,
            related_reqs_context=related_reqs_context,
            target_info=target_info,
            product_name=product_name,
        )

        # Assign temp_ids if missing
        for i, node in enumerate(outline):
            if not node.get("temp_id"):
                node["temp_id"] = f"temp-{i + 1}"

        logger.info(f"Phase 1 complete: {len(outline)} outline nodes")

        # ---- Phase 2: Expand features into requirements ----
        features = [n for n in outline if n.get("node_type") == "feature"]
        logger.info(f"Phase 2: Expanding {len(features)} features into requirements")

        if on_progress:
            await on_progress("expanding", f"Generating requirements for {len(features)} features (0/{len(features)})...")

        # Calculate starting temp_id for requirements (after outline IDs)
        max_outline_id = 0
        for n in outline:
            tid = n.get("temp_id", "")
            if tid.startswith("temp-"):
                try:
                    max_outline_id = max(max_outline_id, int(tid.split("-")[1]))
                except ValueError:
                    pass
        next_id = max_outline_id + 1

        # Assign ID ranges for each feature expansion
        feature_tasks = []
        semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
        completed_features = 0
        all_requirement_nodes = []

        async def expand_and_track(feature_node: dict, start_id: int) -> None:
            nonlocal completed_features
            async with semaphore:
                nodes = await self.expand_feature(
                    description=description,
                    outline=outline,
                    feature_node=feature_node,
                    product_name=product_name,
                    next_temp_id_start=start_id,
                )
                all_requirement_nodes.extend(nodes)
                completed_features += 1
                if on_progress:
                    await on_progress(
                        "expanding",
                        f"Generating requirements for {len(features)} features ({completed_features}/{len(features)})..."
                    )

        # Each feature gets a block of 50 IDs to avoid collisions
        ID_BLOCK_SIZE = 50
        tasks = []
        for i, feature in enumerate(features):
            start = next_id + (i * ID_BLOCK_SIZE)
            tasks.append(expand_and_track(feature, start))

        await asyncio.gather(*tasks)

        # Re-number all requirement nodes to avoid gaps and collisions
        for i, node in enumerate(all_requirement_nodes):
            node["temp_id"] = f"temp-{next_id + i}"

        logger.info(f"Phase 2 complete: {len(all_requirement_nodes)} requirements generated")

        # Combine outline + requirements
        all_nodes = outline + all_requirement_nodes

        # ---- Phase 3: Enrich all nodes with details ----
        batches = [
            all_nodes[i:i + ENRICHMENT_BATCH_SIZE]
            for i in range(0, len(all_nodes), ENRICHMENT_BATCH_SIZE)
        ]
        total_batches = len(batches)
        logger.info(f"Phase 3: Enriching {len(all_nodes)} nodes in {total_batches} batches")

        if on_progress:
            await on_progress("enriching", f"Adding details to {len(all_nodes)} nodes (0/{total_batches} batches)...")

        enriched_by_id = {}
        completed_batches = 0

        async def enrich_and_track(batch_nodes: list) -> None:
            nonlocal completed_batches
            async with semaphore:
                result = await self.enrich_batch(
                    description=description,
                    all_nodes=all_nodes,
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
                        f"Adding details to {len(all_nodes)} nodes ({completed_batches}/{total_batches} batches)..."
                    )

        await asyncio.gather(*(enrich_and_track(batch) for batch in batches))

        logger.info(f"Phase 3 complete: {len(enriched_by_id)} nodes enriched")

        # ---- Merge and build final result ----
        valid_node_types = {"product", "module", "feature", "requirement", "guardrail"}
        requirements = []

        for node in all_nodes:
            temp_id = node.get("temp_id", "")
            enriched = enriched_by_id.get(temp_id, {})
            merged = {**node, **enriched}

            if not merged.get("title"):
                continue
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
