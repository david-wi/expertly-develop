"""Document classification service using pattern matching and content analysis.

Classifies incoming documents based on filename patterns, metadata, and content.
Supports types: POD, BOL, Rate Con, Carrier Invoice, Insurance Cert, W9.
Auto-routes documents based on classification to appropriate workflows.
"""

import re
import logging
from typing import Optional, Tuple, Dict, Any, List

logger = logging.getLogger(__name__)


# Supported document classification types
SUPPORTED_CLASSIFICATIONS = [
    "bol", "pod", "rate_confirmation", "carrier_invoice",
    "insurance_cert", "w9", "invoice", "customs_doc", "unknown",
]

# Workflow routing map: classification -> department/queue
WORKFLOW_ROUTING: Dict[str, Dict[str, Any]] = {
    "bol": {
        "department": "operations",
        "auto_link": "shipment",
        "priority": "normal",
        "action": "attach_to_shipment",
    },
    "pod": {
        "department": "operations",
        "auto_link": "shipment",
        "priority": "high",
        "action": "verify_delivery",
    },
    "rate_confirmation": {
        "department": "operations",
        "auto_link": "shipment",
        "priority": "high",
        "action": "confirm_rate",
    },
    "carrier_invoice": {
        "department": "billing",
        "auto_link": "carrier",
        "priority": "normal",
        "action": "match_to_shipment",
    },
    "insurance_cert": {
        "department": "compliance",
        "auto_link": "carrier",
        "priority": "normal",
        "action": "update_carrier_compliance",
    },
    "w9": {
        "department": "compliance",
        "auto_link": "carrier",
        "priority": "low",
        "action": "update_carrier_tax_info",
    },
    "invoice": {
        "department": "billing",
        "auto_link": "invoice",
        "priority": "normal",
        "action": "process_invoice",
    },
    "customs_doc": {
        "department": "customs",
        "auto_link": "shipment",
        "priority": "normal",
        "action": "attach_customs_document",
    },
}

# Filename pattern rules for classification
CLASSIFICATION_PATTERNS: list[Tuple[str, str, float]] = [
    # (regex_pattern, classification, base_confidence)
    (r"(?i)bol|bill.?of.?lading|b\.o\.l", "bol", 0.85),
    (r"(?i)pod|proof.?of.?delivery|delivery.?receipt", "pod", 0.85),
    (r"(?i)rate.?con|rate.?confirmation|rc[-_]", "rate_confirmation", 0.90),
    (r"(?i)carrier.?inv|carrier.?bill|freight.?bill", "carrier_invoice", 0.85),
    (r"(?i)inv(oice)?[-_\s]|billing|payment.?due", "invoice", 0.80),
    (r"(?i)insurance|cert.?of.?ins|coi|liability|acord", "insurance_cert", 0.85),
    (r"(?i)w[-_]?9|tax.?form|taxpayer.?id|tin.?cert|request.?for.?taxpayer", "w9", 0.90),
    (r"(?i)customs|import|export|duty|tariff|hts|hs.?code", "customs_doc", 0.80),
]

# Content-based classification patterns (for OCR text / email body)
CONTENT_CLASSIFICATION_PATTERNS: list[Tuple[str, str, float]] = [
    # BOL indicators
    (r"(?i)STRAIGHT\s+BILL\s+OF\s+LADING", "bol", 0.95),
    (r"(?i)BILL\s+OF\s+LADING.*?ORIGINAL", "bol", 0.92),
    (r"(?i)SHIPPER.*?CONSIGNEE.*?CARRIER", "bol", 0.80),
    (r"(?i)NMFC\s*#|FREIGHT\s+CLASS", "bol", 0.85),
    # POD indicators
    (r"(?i)PROOF\s+OF\s+DELIVERY", "pod", 0.95),
    (r"(?i)RECEIVED\s+(?:IN\s+)?GOOD\s+(?:ORDER|CONDITION)", "pod", 0.90),
    (r"(?i)DELIVERY\s+RECEIPT", "pod", 0.90),
    (r"(?i)SIGNED\s+BY.*?DATE.*?TIME", "pod", 0.85),
    # Rate Confirmation indicators
    (r"(?i)RATE\s+CONFIRMATION", "rate_confirmation", 0.95),
    (r"(?i)LOAD\s+CONFIRMATION|LOAD\s+TENDER", "rate_confirmation", 0.90),
    (r"(?i)CARRIER\s+AGREES.*?RATE", "rate_confirmation", 0.85),
    (r"(?i)LINE\s*HAUL.*?\$[\d,.]+", "rate_confirmation", 0.80),
    # Carrier Invoice indicators
    (r"(?i)CARRIER\s+INVOICE|FREIGHT\s+INVOICE", "carrier_invoice", 0.92),
    (r"(?i)REMIT\s+(?:PAYMENT\s+)?TO.*?CARRIER", "carrier_invoice", 0.85),
    (r"(?i)BILL\s+TO.*?BROKER|FREIGHT\s+CHARGES", "carrier_invoice", 0.80),
    # Insurance Certificate indicators
    (r"(?i)CERTIFICATE\s+OF\s+(?:LIABILITY\s+)?INSURANCE", "insurance_cert", 0.95),
    (r"(?i)ACORD\s+25|ACORD\s+CERTIFICATE", "insurance_cert", 0.95),
    (r"(?i)POLICY\s+NUMBER.*?EFFECTIVE.*?EXPIR", "insurance_cert", 0.88),
    (r"(?i)AUTO\s+LIABILITY.*?CARGO.*?GENERAL\s+LIABILITY", "insurance_cert", 0.85),
    # W9 indicators
    (r"(?i)REQUEST\s+FOR\s+TAXPAYER\s+IDENTIFICATION", "w9", 0.98),
    (r"(?i)FORM\s+W-?9", "w9", 0.95),
    (r"(?i)TAXPAYER\s+IDENTIFICATION\s+NUMBER.*?CERTIFICATION", "w9", 0.92),
    (r"(?i)EMPLOYER\s+IDENTIFICATION\s+NUMBER.*?EIN", "w9", 0.85),
    # Invoice indicators
    (r"(?i)INVOICE\s+(?:#|NUMBER|NO)", "invoice", 0.80),
    (r"(?i)AMOUNT\s+DUE.*?PAYMENT\s+TERMS", "invoice", 0.78),
    # Customs indicators
    (r"(?i)COMMERCIAL\s+INVOICE|CUSTOMS\s+ENTRY", "customs_doc", 0.88),
    (r"(?i)HARMONIZED\s+TARIFF|HTS\s+CODE", "customs_doc", 0.85),
    (r"(?i)COUNTRY\s+OF\s+ORIGIN.*?INCOTERMS", "customs_doc", 0.82),
]

# Metadata-based extraction patterns
METADATA_EXTRACTORS: Dict[str, list[Tuple[str, str]]] = {
    "bol": [
        (r"(?i)shipper[:\s]+(.+)", "shipper_name"),
        (r"(?i)consignee[:\s]+(.+)", "consignee_name"),
        (r"(?i)pro\s*#?\s*:?\s*(\w+)", "pro_number"),
        (r"(?i)weight[:\s]+(\d[\d,.]+)", "weight"),
        (r"(?i)pieces[:\s]+(\d+)", "pieces"),
        (r"(?i)freight\s*class[:\s]+(\d+)", "freight_class"),
    ],
    "pod": [
        (r"(?i)delivered\s+(?:on|at|to)[:\s]+(.+)", "delivery_info"),
        (r"(?i)received\s+by[:\s]+(.+)", "received_by"),
        (r"(?i)date[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", "delivery_date"),
        (r"(?i)pieces\s*(?:received)?[:\s]+(\d+)", "pieces_received"),
    ],
    "rate_confirmation": [
        (r"(?i)rate[:\s]*\$?([\d,.]+)", "rate"),
        (r"(?i)carrier[:\s]+(.+)", "carrier_name"),
        (r"(?i)load\s*#?\s*:?\s*(\w+)", "load_number"),
        (r"(?i)mc\s*#?\s*:?\s*(\d+)", "mc_number"),
    ],
    "carrier_invoice": [
        (r"(?i)invoice\s*#?\s*:?\s*(\w+[-]?\w*)", "invoice_number"),
        (r"(?i)(?:total|amount)\s*(?:due)?[:\s]*\$?([\d,.]+)", "total_amount"),
        (r"(?i)carrier[:\s]+(.+)", "carrier_name"),
        (r"(?i)load\s*#?\s*:?\s*(\w+)", "load_number"),
        (r"(?i)pro\s*#?\s*:?\s*(\w+)", "pro_number"),
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
        (r"(?i)auto\s*liability[:\s]*\$?([\d,.]+)", "auto_liability_limit"),
        (r"(?i)cargo[:\s]*\$?([\d,.]+)", "cargo_limit"),
    ],
    "w9": [
        (r"(?i)name[:\s]+(.+)", "entity_name"),
        (r"(?i)(?:ein|employer.+number)[:\s]*(\d{2}-?\d{7})", "ein"),
        (r"(?i)(?:ssn|social\s+security)[:\s]*(\d{3}-?\d{2}-?\d{4})", "ssn_partial"),
        (r"(?i)address[:\s]+(.+)", "address"),
    ],
}


def classify_document(
    filename: str,
    file_type: str,
    metadata: Optional[Dict[str, Any]] = None,
    content_text: Optional[str] = None,
) -> Tuple[str, float, Dict[str, Any]]:
    """
    Classify a document based on filename patterns, metadata, and content text.

    Supports types: POD, BOL, Rate Con, Carrier Invoice, Insurance Cert, W9.
    Uses a multi-signal approach: filename -> metadata -> content -> combined scoring.

    Args:
        filename: The filename of the document
        file_type: The file type (pdf, image, csv, excel)
        metadata: Optional additional metadata (e.g., email subject, body text)
        content_text: Optional OCR or extracted text content from the document

    Returns:
        Tuple of (classification, confidence, extracted_data)
    """
    # Track all classification signals for ensemble scoring
    signals: List[Tuple[str, float, str]] = []  # (classification, confidence, source)
    extracted_data: Dict[str, Any] = {}

    # Step 1: Classify by filename patterns
    for pattern, classification, base_confidence in CLASSIFICATION_PATTERNS:
        if re.search(pattern, filename):
            signals.append((classification, base_confidence, "filename"))
            logger.info(
                "Classified '%s' as '%s' via filename pattern (confidence: %.2f)",
                filename, classification, base_confidence,
            )

    # Step 2: Check metadata (email subject, body, etc.)
    if metadata:
        metadata_text = " ".join(str(v) for v in metadata.values() if v)
        for pattern, classification, base_confidence in CLASSIFICATION_PATTERNS:
            if re.search(pattern, metadata_text):
                adjusted_confidence = base_confidence * 0.9
                signals.append((classification, adjusted_confidence, "metadata"))

        # Also check content patterns against metadata text
        for pattern, classification, base_confidence in CONTENT_CLASSIFICATION_PATTERNS:
            if re.search(pattern, metadata_text):
                adjusted_confidence = base_confidence * 0.85
                signals.append((classification, adjusted_confidence, "metadata_content"))

    # Step 3: Classify by document content (OCR text)
    if content_text:
        for pattern, classification, base_confidence in CONTENT_CLASSIFICATION_PATTERNS:
            if re.search(pattern, content_text):
                signals.append((classification, base_confidence, "content"))
                logger.info(
                    "Classified '%s' as '%s' via content pattern (confidence: %.2f)",
                    filename, classification, base_confidence,
                )

    # Step 4: Ensemble scoring - combine all signals
    best_classification = "unknown"
    best_confidence = 0.0

    if signals:
        # Group signals by classification
        classification_scores: Dict[str, List[float]] = {}
        for cls, conf, _source in signals:
            if cls not in classification_scores:
                classification_scores[cls] = []
            classification_scores[cls].append(conf)

        # Pick the classification with the highest combined score
        for cls, scores in classification_scores.items():
            # Use max score boosted by number of agreeing signals
            max_score = max(scores)
            signal_bonus = min(0.05 * (len(scores) - 1), 0.10)  # Up to +0.10 for multiple signals
            combined = min(max_score + signal_bonus, 0.99)

            if combined > best_confidence:
                best_classification = cls
                best_confidence = combined

    # Step 5: Extract data fields based on classification
    all_text = ""
    if metadata:
        all_text += " ".join(str(v) for v in metadata.values() if v) + " "
    if content_text:
        all_text += content_text

    if best_classification in METADATA_EXTRACTORS and all_text:
        for pattern, field_name in METADATA_EXTRACTORS[best_classification]:
            match = re.search(pattern, all_text)
            if match:
                extracted_data[field_name] = match.group(1).strip()

    # If still unknown, set very low confidence
    if best_classification == "unknown" and best_confidence == 0.0:
        best_confidence = 0.1

    # Add routing info to extracted data
    routing = get_workflow_routing(best_classification)
    if routing:
        extracted_data["_routing"] = routing

    return best_classification, best_confidence, extracted_data


def classify_document_content(
    filename: str,
    content_text: str,
    file_type: str = "pdf",
) -> Tuple[str, float, Dict[str, Any]]:
    """
    Convenience function: classify a document primarily from its OCR/extracted text.

    Args:
        filename: The filename
        content_text: The full text content of the document
        file_type: The file type

    Returns:
        Tuple of (classification, confidence, extracted_data)
    """
    return classify_document(
        filename=filename,
        file_type=file_type,
        content_text=content_text,
    )


def get_workflow_routing(classification: str) -> Optional[Dict[str, Any]]:
    """
    Get the workflow routing configuration for a document classification.

    Args:
        classification: The document classification type

    Returns:
        Dict with department, auto_link entity type, priority, and action
    """
    return WORKFLOW_ROUTING.get(classification)


def get_auto_route_action(classification: str) -> Optional[str]:
    """
    Determine the auto-route action for a classified document.

    Returns:
        Action string describing what should happen with this document,
        or None if no auto-routing is configured.
    """
    routing = WORKFLOW_ROUTING.get(classification)
    if not routing:
        return None
    return routing.get("action")


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
        "carrier_invoice": "carrier",
        "invoice": "invoice",
        "insurance_cert": "carrier",
        "w9": "carrier",
        "customs_doc": "shipment",
    }

    entity_type = classification_to_entity.get(classification)

    if not entity_type:
        return None, None

    return entity_type, None


def get_supported_classifications() -> List[Dict[str, str]]:
    """Return the list of supported document classifications with labels."""
    labels = {
        "bol": "Bill of Lading",
        "pod": "Proof of Delivery",
        "rate_confirmation": "Rate Confirmation",
        "carrier_invoice": "Carrier Invoice",
        "insurance_cert": "Insurance Certificate",
        "w9": "W-9 Tax Form",
        "invoice": "Invoice",
        "customs_doc": "Customs Document",
        "unknown": "Unknown",
    }
    return [
        {"value": cls, "label": labels.get(cls, cls)}
        for cls in SUPPORTED_CLASSIFICATIONS
    ]
