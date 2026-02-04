"""
Document Processing Service - OCR and AI Extraction

Uses Claude's vision capabilities to:
1. Extract text from scanned documents
2. Classify document types
3. Extract structured fields based on document type
4. Suggest shipment matches
"""

import os
import base64
import json
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from bson import ObjectId

import anthropic

from app.models.document import (
    Document,
    DocumentType,
    ExtractionStatus,
    ExtractedDocumentField,
)
from app.database import get_database


# Document type extraction templates
EXTRACTION_PROMPTS = {
    DocumentType.BOL: """Extract the following fields from this Bill of Lading:
- pro_number: The PRO or tracking number
- shipper_name: Name of the shipping company
- shipper_address: Full shipper address
- consignee_name: Name of the receiving company
- consignee_address: Full consignee address
- pickup_date: Date of pickup (YYYY-MM-DD format)
- pieces: Number of pieces/pallets
- weight: Total weight (include unit)
- commodity: Description of goods
- reference_numbers: Any PO, SO, or reference numbers (as array)
- special_instructions: Any special handling notes""",

    DocumentType.POD: """Extract the following fields from this Proof of Delivery:
- delivery_date: Date delivered (YYYY-MM-DD format)
- delivery_time: Time delivered (HH:MM format)
- receiver_name: Name of person who signed
- receiver_signature_present: true/false if signature is visible
- pieces_received: Number of pieces received
- condition: Condition notes (good, damaged, short, etc.)
- reference_numbers: Any reference numbers
- exceptions: Any exceptions or damage noted""",

    DocumentType.RATE_CONFIRMATION: """Extract the following fields from this Rate Confirmation:
- carrier_name: Name of the carrier
- mc_number: MC or DOT number
- rate_amount: Agreed rate (just the number)
- rate_currency: Currency (USD, CAD, etc.)
- pickup_date: Pickup date (YYYY-MM-DD)
- delivery_date: Delivery date (YYYY-MM-DD)
- origin_city: Pickup city
- origin_state: Pickup state
- destination_city: Delivery city
- destination_state: Delivery state
- equipment_type: Type of trailer
- reference_numbers: Any reference or load numbers
- accessorials: Any additional charges listed""",

    DocumentType.COMMERCIAL_INVOICE: """Extract the following fields from this Commercial Invoice:
- invoice_number: Invoice number
- invoice_date: Invoice date (YYYY-MM-DD)
- shipper_name: Exporter/seller name
- shipper_address: Exporter address
- shipper_country: Exporter country
- consignee_name: Importer/buyer name
- consignee_address: Importer address
- consignee_country: Importer country
- total_value: Total declared value (number only)
- currency: Currency code
- incoterms: Shipping terms (FOB, CIF, etc.)
- country_of_origin: Country where goods were made
- hts_codes: List of HTS/HS codes mentioned
- line_items: Array of {description, quantity, unit_price, total}""",

    DocumentType.LUMPER_RECEIPT: """Extract the following fields from this Lumper Receipt:
- receipt_date: Date of service (YYYY-MM-DD)
- amount: Amount charged (number only)
- facility_name: Name of warehouse/facility
- reference_numbers: Any reference numbers
- services: Description of services provided""",

    DocumentType.SCALE_TICKET: """Extract the following fields from this Scale Ticket:
- ticket_date: Date weighed (YYYY-MM-DD)
- ticket_number: Scale ticket number
- gross_weight: Gross weight
- tare_weight: Tare weight
- net_weight: Net weight
- weight_unit: Unit (lbs, kg)
- facility_name: Scale location""",

    DocumentType.CARRIER_INVOICE: """Extract the following fields from this Carrier Invoice:
- invoice_number: Invoice number
- invoice_date: Invoice date (YYYY-MM-DD)
- carrier_name: Carrier company name
- carrier_mc_number: MC or DOT number
- total_amount: Total invoice amount (number only)
- reference_numbers: Load/shipment reference numbers
- line_items: Array of {description, amount}
- payment_terms: Payment terms if mentioned""",

    DocumentType.INSURANCE_CERTIFICATE: """Extract the following fields from this Certificate of Insurance:
- carrier_name: Insured carrier name
- policy_number: Policy number
- effective_date: Policy start date (YYYY-MM-DD)
- expiration_date: Policy end date (YYYY-MM-DD)
- auto_liability_limit: Auto liability coverage amount
- cargo_limit: Cargo coverage amount
- general_liability_limit: General liability amount
- insurance_company: Name of insurance provider""",
}


class DocumentProcessor:
    """Processes documents using AI for extraction and classification."""

    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
        self.db = get_database()

    async def process_document(self, document_id: str) -> Document:
        """
        Process a document: OCR, classify, extract fields, and suggest matches.

        Args:
            document_id: The document ID to process

        Returns:
            Updated Document with extraction results
        """
        # Get document from database
        doc_data = await self.db.documents.find_one({"_id": ObjectId(document_id)})
        if not doc_data:
            raise ValueError(f"Document {document_id} not found")

        # Update status to processing
        await self.db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {
                "$set": {
                    "extraction_status": ExtractionStatus.PROCESSING.value,
                    "extraction_started_at": datetime.utcnow(),
                }
            }
        )

        try:
            # Read the file
            file_path = doc_data["storage_path"]
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")

            # Get file content as base64
            with open(file_path, "rb") as f:
                file_content = f.read()
            file_base64 = base64.standard_b64encode(file_content).decode("utf-8")

            # Determine media type
            mime_type = doc_data.get("mime_type", "image/jpeg")
            if mime_type not in ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]:
                # Skip unsupported types
                await self.db.documents.update_one(
                    {"_id": ObjectId(document_id)},
                    {
                        "$set": {
                            "extraction_status": ExtractionStatus.SKIPPED.value,
                            "extraction_error": f"Unsupported file type: {mime_type}",
                        }
                    }
                )
                return await self._get_document(document_id)

            # Step 1: Classify and extract text
            classification, ocr_text, ocr_confidence = await self._classify_document(
                file_base64, mime_type, doc_data.get("document_type")
            )

            # Step 2: Extract fields based on document type
            doc_type = classification or DocumentType(doc_data.get("document_type", "other"))
            extracted_fields = await self._extract_fields(
                file_base64, mime_type, doc_type
            )

            # Step 3: Find matching shipments
            suggested_shipments, match_confidence = await self._find_matching_shipments(
                extracted_fields, doc_type
            )

            # Update document with results
            update_data = {
                "extraction_status": ExtractionStatus.COMPLETE.value,
                "extraction_completed_at": datetime.utcnow(),
                "ocr_text": ocr_text,
                "ocr_confidence": ocr_confidence,
                "extracted_fields": [f.model_dump() for f in extracted_fields] if extracted_fields else [],
            }

            if classification and classification != DocumentType(doc_data.get("document_type", "other")):
                update_data["ai_classified_type"] = classification.value
                update_data["classification_confidence"] = ocr_confidence

            if suggested_shipments:
                update_data["suggested_shipment_ids"] = suggested_shipments
                update_data["match_confidence"] = match_confidence
                if match_confidence and match_confidence > 0.9 and len(suggested_shipments) == 1:
                    # High confidence single match - auto-link
                    update_data["shipment_id"] = suggested_shipments[0]
                    update_data["auto_matched"] = True
                else:
                    update_data["needs_review"] = True

            await self.db.documents.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": update_data}
            )

            return await self._get_document(document_id)

        except Exception as e:
            # Update with error
            await self.db.documents.update_one(
                {"_id": ObjectId(document_id)},
                {
                    "$set": {
                        "extraction_status": ExtractionStatus.FAILED.value,
                        "extraction_error": str(e),
                    }
                }
            )
            raise

    async def _classify_document(
        self,
        file_base64: str,
        mime_type: str,
        existing_type: Optional[str] = None
    ) -> Tuple[Optional[DocumentType], str, float]:
        """Classify document type and extract OCR text."""

        prompt = """Analyze this document image and:

1. CLASSIFY the document type as one of:
   - bol (Bill of Lading)
   - pod (Proof of Delivery)
   - rate_confirmation (Rate Confirmation/Contract)
   - commercial_invoice (Commercial Invoice for customs)
   - lumper_receipt (Lumper/Unloading Receipt)
   - scale_ticket (Weight Scale Ticket)
   - carrier_invoice (Invoice from Carrier)
   - insurance_certificate (Certificate of Insurance)
   - packing_list (Packing List)
   - certificate_of_origin (Certificate of Origin)
   - other (if none of the above)

2. EXTRACT all visible text from the document (OCR).

3. Estimate your CONFIDENCE in the classification (0.0 to 1.0).

Respond in JSON format:
{
  "document_type": "bol",
  "confidence": 0.95,
  "ocr_text": "Full extracted text here..."
}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": file_base64,
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        },
                    ],
                }
            ],
        )

        # Parse response
        response_text = response.content[0].text
        try:
            # Find JSON in response
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(response_text[start:end])
                doc_type_str = data.get("document_type", "other")
                try:
                    doc_type = DocumentType(doc_type_str)
                except ValueError:
                    doc_type = DocumentType.OTHER

                return (
                    doc_type,
                    data.get("ocr_text", ""),
                    data.get("confidence", 0.5),
                )
        except json.JSONDecodeError:
            pass

        return None, "", 0.0

    async def _extract_fields(
        self,
        file_base64: str,
        mime_type: str,
        doc_type: DocumentType
    ) -> List[ExtractedDocumentField]:
        """Extract structured fields based on document type."""

        extraction_prompt = EXTRACTION_PROMPTS.get(doc_type)
        if not extraction_prompt:
            return []

        prompt = f"""{extraction_prompt}

Return the extracted data as a JSON object. For each field:
- Use null if not found
- Include confidence (0.0-1.0) for each field
- Include the exact text from the document as evidence

Format:
{{
  "fields": {{
    "field_name": {{
      "value": "extracted value",
      "confidence": 0.95,
      "evidence": "exact text from document"
    }}
  }}
}}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": file_base64,
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        },
                    ],
                }
            ],
        )

        # Parse response
        response_text = response.content[0].text
        extracted_fields = []

        try:
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(response_text[start:end])
                fields_data = data.get("fields", data)  # Handle both formats

                for field_name, field_info in fields_data.items():
                    if isinstance(field_info, dict):
                        value = field_info.get("value")
                        confidence = field_info.get("confidence", 0.5)
                        evidence = field_info.get("evidence")
                    else:
                        value = field_info
                        confidence = 0.5
                        evidence = None

                    if value is not None:
                        extracted_fields.append(ExtractedDocumentField(
                            field_name=field_name,
                            value=value,
                            confidence=confidence,
                            evidence_text=evidence,
                        ))
        except json.JSONDecodeError:
            pass

        return extracted_fields

    async def _find_matching_shipments(
        self,
        extracted_fields: List[ExtractedDocumentField],
        doc_type: DocumentType
    ) -> Tuple[List[ObjectId], Optional[float]]:
        """Find shipments that might match this document."""

        if not extracted_fields:
            return [], None

        # Build a field lookup
        fields = {f.field_name: f.value for f in extracted_fields}

        # Try to match by reference numbers first
        reference_numbers = fields.get("reference_numbers", [])
        if isinstance(reference_numbers, str):
            reference_numbers = [reference_numbers]
        pro_number = fields.get("pro_number")
        if pro_number:
            reference_numbers.append(pro_number)

        matched_ids = []
        match_confidence = 0.0

        # Search by reference numbers
        if reference_numbers:
            for ref in reference_numbers:
                if not ref:
                    continue
                cursor = self.db.shipments.find({
                    "$or": [
                        {"shipment_number": {"$regex": ref, "$options": "i"}},
                        {"reference_numbers": {"$elemMatch": {"$regex": ref, "$options": "i"}}},
                        {"pro_number": {"$regex": ref, "$options": "i"}},
                    ]
                })
                async for shipment in cursor:
                    sid = shipment["_id"]
                    if sid not in matched_ids:
                        matched_ids.append(sid)
                        match_confidence = max(match_confidence, 0.9)

        # Try matching by carrier MC number (for rate confirmations, carrier invoices)
        mc_number = fields.get("mc_number") or fields.get("carrier_mc_number")
        if mc_number and not matched_ids:
            carrier = await self.db.carriers.find_one({"mc_number": mc_number})
            if carrier:
                cursor = self.db.shipments.find({"carrier_id": carrier["_id"]})
                async for shipment in cursor:
                    if shipment["_id"] not in matched_ids:
                        matched_ids.append(shipment["_id"])
                        match_confidence = max(match_confidence, 0.7)

        # Try matching by origin/destination (for rate confirmations)
        origin_city = fields.get("origin_city")
        dest_city = fields.get("destination_city")
        if origin_city and dest_city and not matched_ids:
            cursor = self.db.shipments.find({
                "stops.0.city": {"$regex": origin_city, "$options": "i"},
                "stops.-1.city": {"$regex": dest_city, "$options": "i"},
            })
            async for shipment in cursor:
                if shipment["_id"] not in matched_ids:
                    matched_ids.append(shipment["_id"])
                    match_confidence = max(match_confidence, 0.6)

        return matched_ids[:5], match_confidence if matched_ids else None

    async def _get_document(self, document_id: str) -> Document:
        """Get document from database."""
        doc_data = await self.db.documents.find_one({"_id": ObjectId(document_id)})
        if doc_data:
            doc_data["id"] = str(doc_data.pop("_id"))
            return Document(**doc_data)
        raise ValueError(f"Document {document_id} not found")


# Singleton instance
_processor: Optional[DocumentProcessor] = None


def get_document_processor() -> DocumentProcessor:
    """Get or create the document processor singleton."""
    global _processor
    if _processor is None:
        _processor = DocumentProcessor()
    return _processor
