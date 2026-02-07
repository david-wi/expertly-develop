"""AI-powered template suggestion service.

Accepts uploaded documents (PDF, DOCX, TXT), extracts text, and calls
Claude to generate suggested sections and questions for an intake template.
"""

import io
import json
import logging
from typing import Optional

import anthropic

from ..config import settings
from ..schemas.ai_template import SuggestedQuestion, SuggestedSection
from ..schemas.template import AnswerType

logger = logging.getLogger(__name__)

# Valid answer type values for prompt instruction
_ANSWER_TYPE_VALUES = [e.value for e in AnswerType]


# ---------------------------------------------------------------------------
# Text extraction helpers
# ---------------------------------------------------------------------------


def extract_text(file_bytes: bytes, mime_type: str, filename: str) -> str:
    """Extract plain text from an uploaded file.

    Supported types:
    - application/pdf → pypdf
    - application/vnd.openxmlformats-officedocument.wordprocessingml.document → python-docx
    - text/plain, text/csv → direct decode
    """
    if mime_type == "application/pdf":
        return _extract_pdf(file_bytes)
    elif mime_type == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        return _extract_docx(file_bytes)
    elif mime_type in ("text/plain", "text/csv"):
        return file_bytes.decode("utf-8", errors="replace")
    else:
        raise ValueError(f"Unsupported file type: {mime_type} ({filename})")


def _extract_pdf(file_bytes: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(file_bytes))
    parts: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            parts.append(text)
    return "\n\n".join(parts)


def _extract_docx(file_bytes: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())


# ---------------------------------------------------------------------------
# AI suggestion generation
# ---------------------------------------------------------------------------


async def generate_suggestions(
    documents: list[dict],
    existing_sections: Optional[list[dict]],
    template_name: str,
) -> tuple[list[SuggestedSection], str]:
    """Call Claude to generate template section/question suggestions.

    Args:
        documents: List of {"filename": str, "text": str} dicts.
        existing_sections: Existing template sections (None or list of dicts
            with sectionName, questions, etc.) for "improve" mode.
        template_name: The template name for context.

    Returns:
        (sections, mode) where mode is "generate" or "improve".
    """
    mode = "improve" if existing_sections else "generate"

    # Build the document text block
    doc_block = ""
    for doc in documents:
        doc_block += f"\n--- Document: {doc['filename']} ---\n{doc['text']}\n"

    # Build existing template block (for improve mode)
    existing_block = ""
    if existing_sections:
        existing_block = "\n\n## Current Template Structure\n"
        for sec in existing_sections:
            existing_block += f"\n### Section: {sec.get('sectionName', 'Unnamed')}\n"
            for q in sec.get("questions", []):
                existing_block += (
                    f"  - [{q.get('answerType', 'shortText')}] "
                    f"{q.get('questionText', '')}\n"
                )

    prompt = f"""You are an expert at designing intake questionnaire templates.

Analyze the uploaded document(s) and {"suggest improvements to the existing template" if mode == "improve" else "generate a complete set of sections and questions"} for an intake template called "{template_name}".

## Uploaded Documents
{doc_block}
{existing_block}

## Instructions

Return a JSON object with a "sections" array. Each section has:
- "sectionName": string (clear display name)
- "sectionOrder": integer (starting at 1)
- "isRepeatable": boolean (true if the section may have multiple instances, e.g. per vehicle)
- "repeatKeyName": string or null (label for repeats, e.g. "Vehicle")
- "applicabilityRuleText": string or null
- "questions": array of question objects

Each question has:
- "questionKey": string (snake_case machine key, e.g. "insured_full_name")
- "questionText": string (the question as shown to the user)
- "questionHelpText": string or null (additional guidance)
- "questionOrder": integer (starting at 1 within each section)
- "isRequired": boolean
- "answerType": one of {json.dumps(_ANSWER_TYPE_VALUES)}
- "applicabilityRuleText": string or null

Guidelines:
- Organize questions into logical sections based on the document content.
- Use appropriate answerType values (e.g. "date" for dates, "yesNo" for boolean, "number" for numeric, "longText" for free-form, "url" for links, "uploadRequested" for documents).
- Generate meaningful questionKey values in snake_case.
- Set isRequired=true for essential fields, false for optional ones.
- If improving, include both existing and new/modified sections. Keep existing structure where it works well.
- Aim for comprehensive coverage of the information in the documents.

Return ONLY the JSON object, no markdown fences or extra text.
"""

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8000,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = response.content[0].text

    # Parse JSON from response
    sections = _parse_sections_response(response_text)

    return sections, mode


def _parse_sections_response(response_text: str) -> list[SuggestedSection]:
    """Parse the AI response into validated SuggestedSection objects."""
    # Find JSON in response (handle possible markdown wrapping)
    text = response_text.strip()
    if text.startswith("```"):
        # Strip markdown code fences
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)

    start = text.find("{")
    end = text.rfind("}") + 1
    if start < 0 or end <= start:
        logger.error("No JSON object found in AI response: %s", text[:200])
        raise ValueError("AI did not return valid JSON")

    data = json.loads(text[start:end])
    raw_sections = data.get("sections", [])

    valid_answer_types = set(_ANSWER_TYPE_VALUES)
    sections: list[SuggestedSection] = []

    for raw_sec in raw_sections:
        questions: list[SuggestedQuestion] = []
        for raw_q in raw_sec.get("questions", []):
            # Validate / coerce answerType
            at = raw_q.get("answerType", "shortText")
            if at not in valid_answer_types:
                at = "shortText"
            raw_q["answerType"] = at

            questions.append(SuggestedQuestion(**raw_q))

        sections.append(
            SuggestedSection(
                sectionName=raw_sec.get("sectionName", "Untitled Section"),
                sectionOrder=raw_sec.get("sectionOrder", len(sections) + 1),
                isRepeatable=raw_sec.get("isRepeatable", False),
                repeatKeyName=raw_sec.get("repeatKeyName"),
                applicabilityRuleText=raw_sec.get("applicabilityRuleText"),
                questions=questions,
            )
        )

    if not sections:
        raise ValueError("AI returned no sections")

    return sections
