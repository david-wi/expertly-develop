import anthropic
import base64
import re
from typing import Tuple, Optional
from io import BytesIO
from pypdf import PdfReader

from app.config import get_settings

settings = get_settings()


def reflow_pdf_text(text: str) -> str:
    """
    Reflow PDF-extracted text to join lines that are part of the same paragraph.

    PDFs often have hard line breaks at visual line boundaries, causing text to appear
    as 2-3 words per line. This function joins such lines while preserving:
    - Paragraph breaks (blank lines)
    - List items (lines starting with bullets, numbers, or letters)
    - Headings (short lines that look like titles)
    """
    if not text:
        return text

    lines = text.split('\n')
    result_lines = []
    current_paragraph = []

    def is_list_item(line: str) -> bool:
        """Check if line starts with a list marker."""
        stripped = line.strip()
        # Bullet points
        if stripped.startswith(('•', '-', '*', '–', '—', '○', '●', '▪', '▸')):
            return True
        # Numbered lists: 1. or 1) or (1) or a. or a) or (a)
        if re.match(r'^[\(\[]?\d+[\.\)\]]', stripped):
            return True
        if re.match(r'^[\(\[]?[a-zA-Z][\.\)\]]', stripped):
            return True
        return False

    def is_likely_heading(line: str, prev_blank: bool) -> bool:
        """Check if line looks like a heading."""
        stripped = line.strip()
        if not stripped:
            return False
        # Short lines after blank lines that don't end with common sentence endings
        if prev_blank and len(stripped) < 80 and not stripped.endswith((',', ';')):
            # Looks like a title if it's short and doesn't have lowercase continuation
            if stripped[0].isupper() and not stripped.endswith(('.', ':', '?', '!')):
                return True
        # All caps short lines
        if stripped.isupper() and len(stripped) < 60:
            return True
        return False

    def flush_paragraph():
        """Join current paragraph lines and add to result."""
        if current_paragraph:
            # Join with space, but preserve intentional spacing
            joined = ' '.join(current_paragraph)
            # Clean up multiple spaces
            joined = re.sub(r' +', ' ', joined)
            result_lines.append(joined)
            current_paragraph.clear()

    prev_was_blank = True  # Start as if there was a blank line before

    for line in lines:
        stripped = line.strip()

        # Blank line = paragraph break
        if not stripped:
            flush_paragraph()
            if result_lines and result_lines[-1] != '':
                result_lines.append('')
            prev_was_blank = True
            continue

        # List items get their own line
        if is_list_item(stripped):
            flush_paragraph()
            result_lines.append(stripped)
            prev_was_blank = False
            continue

        # Headings get their own line
        if is_likely_heading(stripped, prev_was_blank):
            flush_paragraph()
            result_lines.append(stripped)
            prev_was_blank = False
            continue

        # Check if this line should start a new paragraph
        # (previous line ended with sentence-ending punctuation and this starts with capital)
        if current_paragraph:
            last_para_text = current_paragraph[-1]
            ends_sentence = last_para_text.rstrip().endswith(('.', '!', '?', ':'))
            starts_capital = stripped[0].isupper() if stripped else False

            # If previous ended a sentence AND this is a short line that ended,
            # it might be a new paragraph
            if ends_sentence and starts_capital and len(last_para_text) < 50:
                flush_paragraph()

        # Add to current paragraph
        current_paragraph.append(stripped)
        prev_was_blank = False

    # Flush any remaining paragraph
    flush_paragraph()

    # Join with newlines, collapsing multiple blank lines
    result = '\n'.join(result_lines)
    result = re.sub(r'\n{3,}', '\n\n', result)

    return result.strip()


class ArtifactConversionService:
    """Service for converting various file types to markdown using AI."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    async def convert_to_markdown(
        self,
        file_content: bytes,
        filename: str,
        mime_type: str,
    ) -> Tuple[str, bool]:
        """
        Convert file content to markdown.

        Returns:
            Tuple of (markdown_content, success)
        """
        try:
            # Route to appropriate converter based on mime type
            if mime_type.startswith("image/"):
                return await self._convert_image(file_content, filename, mime_type)
            elif mime_type == "application/pdf":
                return await self._convert_pdf(file_content, filename)
            elif mime_type in (
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/msword",
            ):
                return await self._convert_docx(file_content, filename)
            elif mime_type in (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-excel",
            ):
                return await self._convert_xlsx(file_content, filename)
            elif mime_type in (
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "application/vnd.ms-powerpoint",
            ):
                return await self._convert_pptx(file_content, filename)
            elif mime_type.startswith("text/") or mime_type in (
                "application/json",
                "application/xml",
                "application/javascript",
            ):
                return await self._convert_text(file_content, filename, mime_type)
            else:
                return await self._convert_unknown(file_content, filename, mime_type)
        except Exception as e:
            return f"# Conversion Error\n\nFailed to convert `{filename}`: {str(e)}", False

    async def _convert_image(
        self, file_content: bytes, filename: str, mime_type: str
    ) -> Tuple[str, bool]:
        """Convert image to markdown with AI-generated description."""
        from app.utils.ai_config import get_use_case_config

        base64_content = base64.b64encode(file_content).decode("utf-8")

        # Get model configuration for file-to-markdown conversion
        use_case_config = get_use_case_config("file_to_markdown")

        try:
            response = self.client.messages.create(
                model=use_case_config.model_id,
                max_tokens=use_case_config.max_tokens,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": mime_type,
                                    "data": base64_content,
                                },
                            },
                            {
                                "type": "text",
                                "text": """Analyze this image and create a detailed markdown description.

If this is a document or specification:
- Extract all text content
- Preserve any structure (headings, lists, tables)
- Describe any diagrams, charts, or visual elements

If this is a diagram or wireframe:
- Describe the overall purpose
- List all components and their relationships
- Note any labels, text, or annotations

If this is a screenshot:
- Describe what the interface shows
- Note any important UI elements
- Capture any visible text

Format your response as clean markdown with appropriate headings.""",
                            },
                        ],
                    }
                ],
            )

            text_block = next((b for b in response.content if b.type == "text"), None)
            if not text_block:
                return f"# {filename}\n\n*Image could not be analyzed*", False

            markdown = f"# {filename}\n\n{text_block.text}"
            return markdown, True

        except anthropic.RateLimitError:
            return (
                f"# {filename}\n\n*AI service rate limit exceeded. Please wait a moment and try again.*",
                False,
            )
        except anthropic.BadRequestError as e:
            error_msg = str(e).lower()
            if "image" in error_msg or "media" in error_msg:
                return (
                    f"# {filename}\n\n*Invalid image format or size. Please ensure images are JPEG, PNG, GIF, or WebP and under 5MB each.*",
                    False,
                )
            return (
                f"# {filename}\n\n*Invalid request: {str(e)}*",
                False,
            )
        except anthropic.AuthenticationError:
            return (
                f"# {filename}\n\n*AI service authentication failed. Please check the API key configuration.*",
                False,
            )
        except anthropic.APIStatusError as e:
            if e.status_code in (500, 502, 503):
                return (
                    f"# {filename}\n\n*AI service is temporarily unavailable. Please try again in a few moments.*",
                    False,
                )
            return (
                f"# {filename}\n\n*AI service error ({e.status_code}): {str(e)}*",
                False,
            )

    async def _convert_pdf(
        self, file_content: bytes, filename: str
    ) -> Tuple[str, bool]:
        """Convert PDF to markdown, using Vision for image-heavy pages."""
        try:
            reader = PdfReader(BytesIO(file_content))
            text_parts = []
            has_content = False

            for i, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                if page_text.strip():
                    has_content = True
                    # Reflow the text to join lines that are part of the same paragraph
                    reflowed_text = reflow_pdf_text(page_text)
                    text_parts.append(f"## Page {i + 1}\n\n{reflowed_text}")

            if not has_content:
                # PDF might be image-based, use Vision
                return await self._convert_pdf_with_vision(file_content, filename)

            markdown = f"# {filename}\n\n" + "\n\n".join(text_parts)
            return markdown, True

        except Exception as e:
            return f"# {filename}\n\n*PDF extraction failed: {str(e)}*", False

    async def _convert_pdf_with_vision(
        self, file_content: bytes, filename: str
    ) -> Tuple[str, bool]:
        """Convert image-based PDF using Claude Vision."""
        # For now, return a placeholder - full PDF-to-image conversion
        # would require additional dependencies like pdf2image/poppler
        return (
            f"# {filename}\n\n*This PDF appears to be image-based. "
            "Text extraction was not possible. Consider uploading individual page images.*",
            False,
        )

    async def _convert_docx(
        self, file_content: bytes, filename: str
    ) -> Tuple[str, bool]:
        """Convert Word document to markdown."""
        try:
            from docx import Document

            doc = Document(BytesIO(file_content))
            parts = [f"# {filename}"]

            for para in doc.paragraphs:
                text = para.text.strip()
                if not text:
                    continue

                # Handle headings
                if para.style.name.startswith("Heading"):
                    level = para.style.name.replace("Heading", "").strip()
                    try:
                        level_num = int(level) + 1  # Convert to markdown heading
                    except ValueError:
                        level_num = 2
                    parts.append(f"{'#' * level_num} {text}")
                else:
                    parts.append(text)

            # Handle tables
            for table in doc.tables:
                table_md = self._table_to_markdown(table)
                if table_md:
                    parts.append(table_md)

            markdown = "\n\n".join(parts)
            return markdown, True

        except ImportError:
            return (
                f"# {filename}\n\n*python-docx not installed. Cannot convert Word documents.*",
                False,
            )
        except Exception as e:
            return f"# {filename}\n\n*Word document conversion failed: {str(e)}*", False

    def _table_to_markdown(self, table) -> Optional[str]:
        """Convert a docx table to markdown format."""
        rows = []
        for row in table.rows:
            cells = [cell.text.strip().replace("|", "\\|") for cell in row.cells]
            rows.append("| " + " | ".join(cells) + " |")

        if not rows:
            return None

        # Add header separator after first row
        if len(rows) > 0:
            col_count = len(table.rows[0].cells)
            separator = "| " + " | ".join(["---"] * col_count) + " |"
            rows.insert(1, separator)

        return "\n".join(rows)

    async def _convert_xlsx(
        self, file_content: bytes, filename: str
    ) -> Tuple[str, bool]:
        """Convert Excel spreadsheet to markdown tables."""
        try:
            from openpyxl import load_workbook

            wb = load_workbook(BytesIO(file_content), data_only=True)
            parts = [f"# {filename}"]

            for sheet_name in wb.sheetnames:
                sheet = wb[sheet_name]
                parts.append(f"## {sheet_name}")

                rows = []
                for row in sheet.iter_rows(values_only=True):
                    # Skip empty rows
                    if all(cell is None for cell in row):
                        continue
                    cells = [
                        str(cell if cell is not None else "").replace("|", "\\|")
                        for cell in row
                    ]
                    rows.append("| " + " | ".join(cells) + " |")

                if rows:
                    # Add header separator
                    col_count = len(rows[0].split("|")) - 2
                    separator = "| " + " | ".join(["---"] * col_count) + " |"
                    rows.insert(1, separator)
                    parts.append("\n".join(rows))
                else:
                    parts.append("*Empty sheet*")

            markdown = "\n\n".join(parts)
            return markdown, True

        except ImportError:
            return (
                f"# {filename}\n\n*openpyxl not installed. Cannot convert Excel files.*",
                False,
            )
        except Exception as e:
            return (
                f"# {filename}\n\n*Excel conversion failed: {str(e)}*",
                False,
            )

    async def _convert_pptx(
        self, file_content: bytes, filename: str
    ) -> Tuple[str, bool]:
        """Convert PowerPoint presentation to markdown."""
        try:
            from pptx import Presentation

            prs = Presentation(BytesIO(file_content))
            parts = [f"# {filename}"]

            for i, slide in enumerate(prs.slides, 1):
                parts.append(f"## Slide {i}")
                slide_texts = []

                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        slide_texts.append(shape.text.strip())

                if slide_texts:
                    parts.append("\n\n".join(slide_texts))
                else:
                    parts.append("*No text content*")

            markdown = "\n\n".join(parts)
            return markdown, True

        except ImportError:
            return (
                f"# {filename}\n\n*python-pptx not installed. Cannot convert PowerPoint files.*",
                False,
            )
        except Exception as e:
            return (
                f"# {filename}\n\n*PowerPoint conversion failed: {str(e)}*",
                False,
            )

    async def _convert_text(
        self, file_content: bytes, filename: str, mime_type: str
    ) -> Tuple[str, bool]:
        """Convert text/code files to markdown with code blocks."""
        try:
            text = file_content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = file_content.decode("latin-1")
            except Exception:
                return (
                    f"# {filename}\n\n*Could not decode text content*",
                    False,
                )

        # Determine language for code block
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        lang_map = {
            "py": "python",
            "js": "javascript",
            "ts": "typescript",
            "tsx": "typescript",
            "jsx": "javascript",
            "json": "json",
            "xml": "xml",
            "html": "html",
            "css": "css",
            "sql": "sql",
            "sh": "bash",
            "yaml": "yaml",
            "yml": "yaml",
            "md": "markdown",
        }

        if ext in lang_map:
            lang = lang_map[ext]
            markdown = f"# {filename}\n\n```{lang}\n{text}\n```"
        elif mime_type == "text/plain" or ext == "txt":
            markdown = f"# {filename}\n\n{text}"
        else:
            markdown = f"# {filename}\n\n```\n{text}\n```"

        return markdown, True

    async def _convert_unknown(
        self, file_content: bytes, filename: str, mime_type: str
    ) -> Tuple[str, bool]:
        """Handle unknown file types."""
        size_kb = len(file_content) / 1024
        return (
            f"# {filename}\n\n"
            f"**File Type:** {mime_type}\n"
            f"**Size:** {size_kb:.1f} KB\n\n"
            "*This file type cannot be converted to markdown. "
            "The original file is available for download.*",
            False,
        )
