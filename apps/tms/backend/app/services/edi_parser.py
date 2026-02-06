"""EDI Parser service for parsing and generating EDI 204/214/210/990 messages.

This implements simple parsers that extract key fields from segment-delimited
EDI format. Each EDI message uses segment terminators (typically ~) and element
separators (typically *) to delimit data.

EDI Transaction Sets:
- 204: Motor Carrier Load Tender (shipper sends load details to carrier)
- 214: Transportation Carrier Shipment Status (carrier sends status updates)
- 210: Motor Carrier Freight Details and Invoice (carrier invoices for transport)
- 990: Response to a Load Tender (carrier accepts/declines a 204)
"""

import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


def parse_edi_segments(raw_content: str, segment_terminator: str = "~",
                       element_separator: str = "*") -> list[list[str]]:
    """Split raw EDI content into a list of segments, each split into elements."""
    # Clean up whitespace/newlines that may be mixed in
    cleaned = raw_content.replace("\n", "").replace("\r", "").strip()
    # Split into segments
    raw_segments = cleaned.split(segment_terminator)
    segments = []
    for seg in raw_segments:
        seg = seg.strip()
        if seg:
            elements = seg.split(element_separator)
            segments.append(elements)
    return segments


def _find_segments(segments: list[list[str]], segment_id: str) -> list[list[str]]:
    """Find all segments matching the given segment ID."""
    return [s for s in segments if s and s[0] == segment_id]


def _get_element(segment: list[str], index: int, default: str = "") -> str:
    """Safely get an element from a segment by index."""
    if index < len(segment):
        return segment[index]
    return default


def _parse_edi_date(date_str: str) -> Optional[str]:
    """Parse EDI date formats (YYYYMMDD or YYMMDD) to ISO format."""
    if not date_str:
        return None
    try:
        if len(date_str) == 8:
            dt = datetime.strptime(date_str, "%Y%m%d")
        elif len(date_str) == 6:
            dt = datetime.strptime(date_str, "%y%m%d")
        else:
            return date_str
        return dt.isoformat()
    except ValueError:
        return date_str


def _parse_edi_time(time_str: str) -> Optional[str]:
    """Parse EDI time format (HHMM) to HH:MM."""
    if not time_str or len(time_str) < 4:
        return None
    return f"{time_str[:2]}:{time_str[2:4]}"


def parse_interchange_envelope(segments: list[list[str]]) -> dict:
    """Extract ISA/GS envelope information."""
    envelope = {}

    isa_segs = _find_segments(segments, "ISA")
    if isa_segs:
        isa = isa_segs[0]
        envelope["isa_sender_qualifier"] = _get_element(isa, 5)
        envelope["isa_sender_id"] = _get_element(isa, 6).strip()
        envelope["isa_receiver_qualifier"] = _get_element(isa, 7)
        envelope["isa_receiver_id"] = _get_element(isa, 8).strip()
        envelope["isa_date"] = _get_element(isa, 9)
        envelope["isa_time"] = _get_element(isa, 10)
        envelope["isa_control_number"] = _get_element(isa, 13)

    gs_segs = _find_segments(segments, "GS")
    if gs_segs:
        gs = gs_segs[0]
        envelope["gs_functional_id"] = _get_element(gs, 1)
        envelope["gs_sender_code"] = _get_element(gs, 2)
        envelope["gs_receiver_code"] = _get_element(gs, 3)
        envelope["gs_date"] = _get_element(gs, 4)
        envelope["gs_time"] = _get_element(gs, 5)
        envelope["gs_control_number"] = _get_element(gs, 6)

    st_segs = _find_segments(segments, "ST")
    if st_segs:
        st = st_segs[0]
        envelope["st_transaction_set"] = _get_element(st, 1)
        envelope["st_control_number"] = _get_element(st, 2)

    return envelope


def parse_204(raw_content: str, element_separator: str = "*",
              segment_terminator: str = "~") -> dict:
    """Parse EDI 204 - Motor Carrier Load Tender.

    Key segments:
    - B2: Beginning segment (standard carrier alpha code, reference identification)
    - B2A: Set purpose (original, change, cancellation)
    - L11: Business instructions/reference numbers
    - NTE: Notes
    - N1/N3/N4: Name/address (shipper, consignee, etc.)
    - N7: Equipment details
    - S5: Stop-off details (stop sequence, reason)
    - G62: Date/time
    - AT8: Shipment weight/packaging/quantity data
    - L5: Description marks and numbers
    """
    segments = parse_edi_segments(raw_content, segment_terminator, element_separator)
    envelope = parse_interchange_envelope(segments)

    result = {
        "transaction_type": "204",
        "envelope": envelope,
        "purpose": None,
        "reference_numbers": [],
        "stops": [],
        "equipment": {},
        "weight": {},
        "notes": [],
        "parties": [],
    }

    # B2 - Beginning segment
    b2_segs = _find_segments(segments, "B2")
    if b2_segs:
        b2 = b2_segs[0]
        result["scac"] = _get_element(b2, 2)
        result["shipment_id"] = _get_element(b2, 4)

    # B2A - Set purpose
    b2a_segs = _find_segments(segments, "B2A")
    if b2a_segs:
        purpose_code = _get_element(b2a_segs[0], 1)
        purpose_map = {"00": "original", "01": "cancellation", "04": "change"}
        result["purpose"] = purpose_map.get(purpose_code, purpose_code)

    # L11 - Reference numbers
    for l11 in _find_segments(segments, "L11"):
        ref_num = _get_element(l11, 1)
        ref_qual = _get_element(l11, 2)
        if ref_num:
            result["reference_numbers"].append({
                "number": ref_num,
                "qualifier": ref_qual,
            })

    # NTE - Notes
    for nte in _find_segments(segments, "NTE"):
        note_code = _get_element(nte, 1)
        note_text = _get_element(nte, 2)
        if note_text:
            result["notes"].append({"code": note_code, "text": note_text})

    # N1/N3/N4 - Party/address blocks
    current_party: Optional[dict] = None
    for seg in segments:
        seg_id = seg[0] if seg else ""
        if seg_id == "N1":
            if current_party:
                result["parties"].append(current_party)
            entity_code = _get_element(seg, 1)
            entity_map = {
                "SH": "shipper", "CN": "consignee", "SF": "ship_from",
                "ST": "ship_to", "BT": "bill_to", "CA": "carrier",
            }
            current_party = {
                "role": entity_map.get(entity_code, entity_code),
                "name": _get_element(seg, 2),
                "id_qualifier": _get_element(seg, 3),
                "id_number": _get_element(seg, 4),
            }
        elif seg_id == "N3" and current_party:
            current_party["address_line1"] = _get_element(seg, 1)
            current_party["address_line2"] = _get_element(seg, 2)
        elif seg_id == "N4" and current_party:
            current_party["city"] = _get_element(seg, 1)
            current_party["state"] = _get_element(seg, 2)
            current_party["zip_code"] = _get_element(seg, 3)
            current_party["country"] = _get_element(seg, 4)
    if current_party:
        result["parties"].append(current_party)

    # S5 - Stop-off details
    current_stop: Optional[dict] = None
    for seg in segments:
        seg_id = seg[0] if seg else ""
        if seg_id == "S5":
            if current_stop:
                result["stops"].append(current_stop)
            stop_seq = _get_element(seg, 1)
            reason_code = _get_element(seg, 2)
            reason_map = {"LD": "pickup", "UL": "delivery", "CL": "complete_load", "CU": "complete_unload"}
            current_stop = {
                "stop_sequence": int(stop_seq) if stop_seq.isdigit() else 0,
                "reason": reason_map.get(reason_code, reason_code),
                "weight": _get_element(seg, 3),
                "weight_qualifier": _get_element(seg, 4),
            }
        elif seg_id == "G62" and current_stop:
            date_qual = _get_element(seg, 1)
            date_val = _get_element(seg, 2)
            time_val = _get_element(seg, 4) if len(seg) > 4 else ""
            date_type = "pickup_date" if date_qual in ("10", "37", "64") else "delivery_date"
            current_stop[date_type] = _parse_edi_date(date_val)
            if time_val:
                current_stop[f"{date_type}_time"] = _parse_edi_time(time_val)
    if current_stop:
        result["stops"].append(current_stop)

    # N7 - Equipment
    n7_segs = _find_segments(segments, "N7")
    if n7_segs:
        n7 = n7_segs[0]
        result["equipment"] = {
            "equipment_number": _get_element(n7, 1),
            "equipment_type": _get_element(n7, 5) if len(n7) > 5 else "",
            "length": _get_element(n7, 7) if len(n7) > 7 else "",
        }

    # AT8 - Weight/packaging data
    at8_segs = _find_segments(segments, "AT8")
    if at8_segs:
        at8 = at8_segs[0]
        result["weight"] = {
            "weight_qualifier": _get_element(at8, 1),
            "weight_unit": _get_element(at8, 2),
            "weight": _get_element(at8, 3),
            "lading_quantity": _get_element(at8, 5) if len(at8) > 5 else "",
        }

    return result


def parse_214(raw_content: str, element_separator: str = "*",
              segment_terminator: str = "~") -> dict:
    """Parse EDI 214 - Transportation Carrier Shipment Status Message.

    Key segments:
    - B10: Beginning segment (reference ID, shipment ID, SCAC)
    - L11: Reference numbers
    - AT7: Shipment status details (status code, reason, date/time, location)
    - MS1: Equipment/container/gen code (city, state)
    - MS2: Equipment or container status
    """
    segments = parse_edi_segments(raw_content, segment_terminator, element_separator)
    envelope = parse_interchange_envelope(segments)

    result = {
        "transaction_type": "214",
        "envelope": envelope,
        "reference_numbers": [],
        "status_updates": [],
    }

    # B10 - Beginning segment
    b10_segs = _find_segments(segments, "B10")
    if b10_segs:
        b10 = b10_segs[0]
        result["reference_id"] = _get_element(b10, 1)
        result["shipment_id"] = _get_element(b10, 2)
        result["scac"] = _get_element(b10, 3)

    # L11 - Reference numbers
    for l11 in _find_segments(segments, "L11"):
        ref_num = _get_element(l11, 1)
        ref_qual = _get_element(l11, 2)
        if ref_num:
            result["reference_numbers"].append({
                "number": ref_num,
                "qualifier": ref_qual,
            })

    # AT7 - Shipment status details
    for at7 in _find_segments(segments, "AT7"):
        status_code = _get_element(at7, 1)
        reason_code = _get_element(at7, 2)
        date_val = _get_element(at7, 5) if len(at7) > 5 else ""
        time_val = _get_element(at7, 6) if len(at7) > 6 else ""

        status_map = {
            "AF": "carrier_departed_pickup",
            "AG": "estimated_delivery",
            "AI": "in_transit_to_destination",
            "AM": "arrived_at_delivery",
            "AP": "arrived_at_pickup",
            "AV": "available_for_delivery",
            "CD": "carrier_departed",
            "D1": "delivered",
            "OA": "out_for_delivery",
            "PR": "pickup_request",
            "RL": "rail_departure",
            "X1": "arrived_at_customs",
            "X3": "customs_released",
            "X6": "en_route_to_delivery",
        }

        update = {
            "status_code": status_code,
            "status_description": status_map.get(status_code, status_code),
            "reason_code": reason_code,
            "date": _parse_edi_date(date_val),
            "time": _parse_edi_time(time_val),
        }
        result["status_updates"].append(update)

    # MS1 - Equipment, Shipment or Real Property Location
    ms1_segs = _find_segments(segments, "MS1")
    if ms1_segs:
        ms1 = ms1_segs[0]
        result["location"] = {
            "city": _get_element(ms1, 1),
            "state": _get_element(ms1, 2),
            "country": _get_element(ms1, 3),
        }

    return result


def parse_210(raw_content: str, element_separator: str = "*",
              segment_terminator: str = "~") -> dict:
    """Parse EDI 210 - Motor Carrier Freight Details and Invoice.

    Key segments:
    - B3: Beginning segment (invoice number, shipment ID, payment method, amounts)
    - N1/N3/N4: Parties (remit to, bill to, shipper, consignee)
    - N9: Reference numbers
    - L5: Description of commodity
    - L0: Line item - quantity and weight
    - L1: Rate and charges
    - L3: Total weight and charges
    """
    segments = parse_edi_segments(raw_content, segment_terminator, element_separator)
    envelope = parse_interchange_envelope(segments)

    result = {
        "transaction_type": "210",
        "envelope": envelope,
        "reference_numbers": [],
        "parties": [],
        "line_items": [],
        "charges": [],
        "total": {},
    }

    # B3 - Beginning segment for carrier invoice
    b3_segs = _find_segments(segments, "B3")
    if b3_segs:
        b3 = b3_segs[0]
        result["invoice_number"] = _get_element(b3, 2)
        result["shipment_id"] = _get_element(b3, 3)
        result["payment_method"] = _get_element(b3, 4)
        result["total_amount"] = _get_element(b3, 6)
        result["invoice_date"] = _parse_edi_date(_get_element(b3, 7))
        result["net_amount_due"] = _get_element(b3, 9) if len(b3) > 9 else ""
        result["delivery_date"] = _parse_edi_date(_get_element(b3, 12)) if len(b3) > 12 else None

    # N9 - Reference numbers
    for n9 in _find_segments(segments, "N9"):
        ref_qual = _get_element(n9, 1)
        ref_num = _get_element(n9, 2)
        if ref_num:
            result["reference_numbers"].append({
                "qualifier": ref_qual,
                "number": ref_num,
            })

    # N1/N3/N4 - Party/address blocks
    current_party: Optional[dict] = None
    for seg in segments:
        seg_id = seg[0] if seg else ""
        if seg_id == "N1":
            if current_party:
                result["parties"].append(current_party)
            entity_code = _get_element(seg, 1)
            entity_map = {
                "RE": "remit_to", "BT": "bill_to", "SH": "shipper",
                "CN": "consignee", "CA": "carrier",
            }
            current_party = {
                "role": entity_map.get(entity_code, entity_code),
                "name": _get_element(seg, 2),
            }
        elif seg_id == "N3" and current_party:
            current_party["address_line1"] = _get_element(seg, 1)
        elif seg_id == "N4" and current_party:
            current_party["city"] = _get_element(seg, 1)
            current_party["state"] = _get_element(seg, 2)
            current_party["zip_code"] = _get_element(seg, 3)
    if current_party:
        result["parties"].append(current_party)

    # L5 / L0 / L1 - Line items and charges
    current_item: Optional[dict] = None
    for seg in segments:
        seg_id = seg[0] if seg else ""
        if seg_id == "L5":
            if current_item:
                result["line_items"].append(current_item)
            current_item = {
                "lading_line_number": _get_element(seg, 1),
                "description": _get_element(seg, 2),
                "commodity_code": _get_element(seg, 3),
            }
        elif seg_id == "L0" and current_item:
            current_item["billed_weight"] = _get_element(seg, 4)
            current_item["weight_qualifier"] = _get_element(seg, 5)
        elif seg_id == "L1":
            charge = {
                "freight_rate": _get_element(seg, 2) if len(seg) > 2 else "",
                "rate_basis": _get_element(seg, 3) if len(seg) > 3 else "",
                "charge": _get_element(seg, 4) if len(seg) > 4 else "",
                "special_charge_code": _get_element(seg, 8) if len(seg) > 8 else "",
            }
            result["charges"].append(charge)
    if current_item:
        result["line_items"].append(current_item)

    # L3 - Total weight and charges
    l3_segs = _find_segments(segments, "L3")
    if l3_segs:
        l3 = l3_segs[0]
        result["total"] = {
            "weight": _get_element(l3, 1),
            "weight_qualifier": _get_element(l3, 2),
            "freight_rate": _get_element(l3, 3),
            "rate_basis": _get_element(l3, 4),
            "total_charge": _get_element(l3, 5),
        }

    return result


def parse_990(raw_content: str, element_separator: str = "*",
              segment_terminator: str = "~") -> dict:
    """Parse EDI 990 - Response to a Load Tender.

    Key segments:
    - B1: Beginning segment (SCAC, shipment ID, date)
    - N9: Reference numbers
    """
    segments = parse_edi_segments(raw_content, segment_terminator, element_separator)
    envelope = parse_interchange_envelope(segments)

    result = {
        "transaction_type": "990",
        "envelope": envelope,
        "reference_numbers": [],
    }

    # B1 - Beginning segment
    b1_segs = _find_segments(segments, "B1")
    if b1_segs:
        b1 = b1_segs[0]
        result["scac"] = _get_element(b1, 1)
        result["shipment_id"] = _get_element(b1, 2)
        result["date"] = _parse_edi_date(_get_element(b1, 3))

    # N9 - Reference numbers (including response code)
    for n9 in _find_segments(segments, "N9"):
        ref_qual = _get_element(n9, 1)
        ref_num = _get_element(n9, 2)
        if ref_num:
            result["reference_numbers"].append({
                "qualifier": ref_qual,
                "number": ref_num,
            })
        # If qualifier is "2I" (response code), parse as acceptance/decline
        if ref_qual == "2I":
            response_map = {"A": "accepted", "D": "declined", "C": "conditional"}
            result["response"] = response_map.get(ref_num, ref_num)

    return result


def parse_edi_message(raw_content: str, message_type: Optional[str] = None,
                      element_separator: str = "*",
                      segment_terminator: str = "~") -> dict:
    """Parse an EDI message, auto-detecting type if not specified.

    Args:
        raw_content: The raw EDI content string
        message_type: Optional message type override ("204", "214", "210", "990")
        element_separator: Element separator character (default: *)
        segment_terminator: Segment terminator character (default: ~)

    Returns:
        Parsed data dictionary with extracted fields
    """
    # Auto-detect message type from ST segment if not specified
    if not message_type:
        segments = parse_edi_segments(raw_content, segment_terminator, element_separator)
        st_segs = _find_segments(segments, "ST")
        if st_segs:
            message_type = _get_element(st_segs[0], 1)

    if not message_type:
        return {"error": "Could not determine EDI message type", "raw_content": raw_content}

    parsers = {
        "204": parse_204,
        "214": parse_214,
        "210": parse_210,
        "990": parse_990,
    }

    parser = parsers.get(message_type)
    if not parser:
        return {"error": f"Unsupported EDI message type: {message_type}", "raw_content": raw_content}

    try:
        return parser(raw_content, element_separator, segment_terminator)
    except Exception as e:
        logger.error(f"Error parsing EDI {message_type}: {e}")
        return {
            "error": f"Parse error: {str(e)}",
            "transaction_type": message_type,
            "raw_content": raw_content,
        }


def generate_997_acknowledgment(original_message: dict,
                                accept: bool = True,
                                error_codes: Optional[list[str]] = None,
                                element_separator: str = "*",
                                segment_terminator: str = "~") -> str:
    """Generate an EDI 997 Functional Acknowledgment for a received message.

    Args:
        original_message: The parsed original message (must contain envelope info)
        accept: Whether to accept (A) or reject (R) the message
        error_codes: Optional list of error codes for rejection
        element_separator: Element separator character
        segment_terminator: Segment terminator character

    Returns:
        Raw EDI 997 content string
    """
    sep = element_separator
    term = segment_terminator

    envelope = original_message.get("envelope", {})
    ack_status = "A" if accept else "R"

    # Build 997 segments
    lines = []
    lines.append(f"ST{sep}997{sep}0001{term}")
    lines.append(f"AK1{sep}{envelope.get('gs_functional_id', '')}{sep}{envelope.get('gs_control_number', '')}{term}")
    lines.append(f"AK2{sep}{envelope.get('st_transaction_set', '')}{sep}{envelope.get('st_control_number', '')}{term}")

    if error_codes:
        for code in error_codes:
            lines.append(f"AK3{sep}{code}{term}")

    lines.append(f"AK5{sep}{ack_status}{term}")
    lines.append(f"AK9{sep}{ack_status}{sep}1{sep}1{sep}{'1' if accept else '0'}{term}")
    lines.append(f"SE{sep}{len(lines) + 1}{sep}0001{term}")

    return "\n".join(lines)
