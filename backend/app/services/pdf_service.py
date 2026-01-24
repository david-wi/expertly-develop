"""PDF generation service using ReportLab."""

from io import BytesIO
from typing import List, Optional
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Image,
    Table,
    TableStyle,
    PageBreak,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from app.services.browser_service import Screenshot


class PDFService:
    """Service for generating PDF reports."""

    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        """Set up custom paragraph styles."""
        self.styles.add(
            ParagraphStyle(
                name="CustomTitle",
                parent=self.styles["Title"],
                fontSize=24,
                spaceAfter=30,
                textColor=colors.HexColor("#1a1a2e"),
            )
        )

        self.styles.add(
            ParagraphStyle(
                name="CustomHeading",
                parent=self.styles["Heading1"],
                fontSize=16,
                spaceAfter=12,
                spaceBefore=20,
                textColor=colors.HexColor("#16213e"),
            )
        )

        self.styles.add(
            ParagraphStyle(
                name="StepTitle",
                parent=self.styles["Heading2"],
                fontSize=14,
                spaceAfter=8,
                spaceBefore=15,
                textColor=colors.HexColor("#0f3460"),
            )
        )

        self.styles.add(
            ParagraphStyle(
                name="CustomBody",
                parent=self.styles["Normal"],
                fontSize=11,
                spaceAfter=10,
                leading=14,
            )
        )

        self.styles.add(
            ParagraphStyle(
                name="Caption",
                parent=self.styles["Normal"],
                fontSize=9,
                textColor=colors.gray,
                alignment=TA_CENTER,
                spaceBefore=5,
                spaceAfter=15,
            )
        )

    def generate_walkthrough_pdf(
        self,
        title: str,
        description: Optional[str],
        screenshots: List[Screenshot],
        observations: Optional[List[str]] = None,
        project_name: Optional[str] = None,
        generated_at: Optional[datetime] = None,
    ) -> bytes:
        """
        Generate a PDF walkthrough report.

        Returns the PDF as bytes.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=0.75 * inch,
        )

        story = []

        # Title
        story.append(Paragraph(title, self.styles["CustomTitle"]))

        # Metadata
        if project_name:
            story.append(Paragraph(f"<b>Project:</b> {project_name}", self.styles["CustomBody"]))

        if generated_at:
            date_str = generated_at.strftime("%Y-%m-%d %H:%M:%S")
            story.append(Paragraph(f"<b>Generated:</b> {date_str}", self.styles["CustomBody"]))

        if description:
            story.append(Spacer(1, 12))
            story.append(Paragraph(description, self.styles["CustomBody"]))

        story.append(Spacer(1, 20))

        # Summary
        story.append(Paragraph("Summary", self.styles["CustomHeading"]))
        story.append(Paragraph(f"Total steps captured: {len(screenshots)}", self.styles["CustomBody"]))

        # Observations section (if any)
        if observations:
            story.append(Spacer(1, 15))
            story.append(Paragraph("Observations to Note", self.styles["CustomHeading"]))
            for obs in observations:
                story.append(Paragraph(f"• {obs}", self.styles["CustomBody"]))

        story.append(PageBreak())

        # Screenshots section
        story.append(Paragraph("Walkthrough Steps", self.styles["CustomHeading"]))

        for idx, screenshot in enumerate(screenshots, 1):
            # Step header
            story.append(Paragraph(f"Step {idx}: {screenshot.step}", self.styles["StepTitle"]))

            # Description
            if screenshot.description:
                story.append(Paragraph(screenshot.description, self.styles["CustomBody"]))

            # URL
            story.append(Paragraph(f"<i>URL: {screenshot.url}</i>", self.styles["Caption"]))

            # Screenshot image
            try:
                img_buffer = BytesIO(screenshot.image_data)
                img = Image(img_buffer)

                # Scale image to fit page width while maintaining aspect ratio
                max_width = 6.5 * inch
                max_height = 4.5 * inch

                aspect = img.imageWidth / img.imageHeight
                if img.imageWidth > max_width:
                    img._width = max_width
                    img._height = max_width / aspect

                if img._height > max_height:
                    img._height = max_height
                    img._width = max_height * aspect

                story.append(img)
                story.append(Paragraph(f"Screenshot {idx}", self.styles["Caption"]))

            except Exception as e:
                story.append(Paragraph(f"[Error loading screenshot: {e}]", self.styles["CustomBody"]))

            story.append(Spacer(1, 20))

            # Page break after every 2 screenshots
            if idx % 2 == 0 and idx < len(screenshots):
                story.append(PageBreak())

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()

    def generate_simple_report(
        self,
        title: str,
        content: str,
        metadata: Optional[dict] = None,
    ) -> bytes:
        """Generate a simple text-based PDF report."""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=0.75 * inch,
        )

        story = []

        # Title
        story.append(Paragraph(title, self.styles["CustomTitle"]))

        # Metadata
        if metadata:
            for key, value in metadata.items():
                story.append(Paragraph(f"<b>{key}:</b> {value}", self.styles["CustomBody"]))
            story.append(Spacer(1, 20))

        # Content
        for paragraph in content.split("\n\n"):
            if paragraph.strip():
                story.append(Paragraph(paragraph.strip(), self.styles["CustomBody"]))
                story.append(Spacer(1, 10))

        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()


# Singleton instance
pdf_service = PDFService()
