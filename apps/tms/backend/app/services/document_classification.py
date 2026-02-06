"""Document classification service using pattern matching.

Classifies incoming documents based on filename patterns and metadata.
This is a rule-based approach that can later be upgraded with actual AI/ML.
"""

import re
import logging
from typing import Optional, Tuple, Dict, Any

logger = logging.getLogger(__name__)


# Filename pattern rules for classification
CLASSIFICATION_PATTERNS: list[Tuple[str, str, float]] = [
    # (regex_pattern, classification, base_confidence)
    (r"(?i)bol|bill.?of.?lading|b\.o\.l", "bol", 0.85),
    (r"(?i)pod|proof.?of.?delivery|delivery.?receipt", "pod", 0.85),
    (r"(?i)rate.?con|rate.?confirmation|rc[-_]", "rate_confirmation", 0.90),
    (r"(?i)inv(oice)?[-_\s]|billing|payment.?due", "invoice", 0.80),
    (r"(?i)insurance|cert.?of.?ins|coi|liability", "insurance_cert", 0.85),
    (r"(?i)customs|import|export|duty|tariff|hts|hs.?code", "customs_doc", 0.80),
]

# Metadata-based extraction patterns
METADATA_EXTRACTORS: Dict[str, list[Tuple[str, str]]] = {
    "bol": [
        (r"(?i)shipper[:\s]+(.+)", "shipper_name"),
        (r"(?i)consignee[:\s]+(.+)", "consignee_name"),
        (r"(?i)pro\s*#?\s*:?\s*(\w+)", "pro_number"),
        (r"(?i)weight[:\s]+(\d[\d,.]+)", "weight"),
    ],
    "pod": [
        (r"(?i)delivered\s+(?:on|at|to)[:\s]+(.+)", "delivery_info"),
        (r"(?i)received\s+by[:\s]+(.+)", "received_by"),
        (r"(?i)date[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", "delivery_date"),
    ],
    "rate_confirmation": [
        (r"(?i)rate[:\s]*\$?([\d,.]+)", "rate"),
        (r"(?i)carrier[:\s]+(.+)", "carrier_name"),
        (r"(?i)load\s*#?\s*:?\s*(\w+)", "load_number"),
    ],
    "invoice": [
        (r"(?i)invoice\s*#?\s*:?\s*(\w+[-]?\w*)", "invoice_number"),
        (r"(?i)amount\s*(?:due)?[:\s]*\$?([\d,.]+)", "amount"),
        (r"(?i)due\s*(?:date)?[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", "due_date"),
    ],
    "insurance_cert": [
        (r"(?i)policy\s*#?\s*:?\s*(\w+)", "policy_number"),
        (r"(?i)expir(?:es|ation)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", "expiration_date"),
        (r"(?i)insured[:\s]+(.+)", "insured_name"),
    ],
}


def classify_document(
    filename: str,
    file_type: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> Tuple[str, float, Dict[str, Any]]:
    """
    Classify a document based on filename patterns and metadata.

    Args:
        filename: The filename of the document
        file_type: The file type (pdf, image, csv, excel)
        metadata: Optional additional metadata (e.g., email subject, body text)

    Returns:
        Tuple of (classification, confidence, extracted_data)
    """
    best_classification = "unknown"
    best_confidence = 0.0
    extracted_data: Dict[str, Any] = {}

    # Step 1: Classify by filename patterns
    for pattern, classification, base_confidence in CLASSIFICATION_PATTERNS:
        if re.search(pattern, filename):
            if base_confidence > best_confidence:
                best_classification = classification
                best_confidence = base_confidence
                logger.info(
                    "Classified '%s' as '%s' via filename pattern (confidence: %.2f)",
                    filename, classification, base_confidence,
                )

    # Step 2: Check metadata (email subject, body, etc.) for additional signals
    if metadata:
        metadata_text = " ".join(str(v) for v in metadata.values() if v)
        for pattern, classification, base_confidence in CLASSIFICATION_PATTERNS:
            if re.search(pattern, metadata_text):
                # Metadata match is slightly lower confidence than filename
                adjusted_confidence = base_confidence * 0.9
                if adjusted_confidence > best_confidence:
                    best_classification = classification
                    best_confidence = adjusted_confidence
                    logger.info(
                        "Classified '%s' as '%s' via metadata (confidence: %.2f)",
                        filename, classification, adjusted_confidence,
                    )

    # Step 3: Extract data fields based on classification
    if best_classification in METADATA_EXTRACTORS and metadata:
        metadata_text = " ".join(str(v) for v in metadata.values() if v)
        for pattern, field_name in METADATA_EXTRACTORS[best_classification]:
            match = re.search(pattern, metadata_text)
            if match:
                extracted_data[field_name] = match.group(1).strip()

    # If still unknown, try to guess by file extension / type
    if best_classification == "unknown" and best_confidence == 0.0:
        best_confidence = 0.1  # Very low confidence for unknown

    return best_classification, best_confidence, extracted_data


def suggest_link(
    classification: str,
    extracted_data: Dict[str, Any],
) -> Tuple[Optional[str], Optional[str]]:
    """
    Suggest which entity type this document should be linked to.

    Args:
        classification: The document classification
        extracted_data: Data extracted from the document

    Returns:
        Tuple of (entity_type, entity_id_or_None)
        entity_id is None when we can suggest the type but not the specific entity
    """
    # Map classification to entity type
    classification_to_entity: Dict[str, str] = {
        "bol": "shipment",
        "pod": "shipment",
        "rate_confirmation": "shipment",
        "invoice": "invoice",
        "insurance_cert": "carrier",
        "customs_doc": "shipment",
    }

    entity_type = classification_to_entity.get(classification)

    if not entity_type:
        return None, None

    # We cannot determine the specific entity_id from pattern matching alone
    # In a real implementation, we'd query the database to find matching entities
    # based on extracted fields like pro_number, load_number, invoice_number, etc.
    return entity_type, None
