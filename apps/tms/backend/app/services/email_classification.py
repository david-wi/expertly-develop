"""
Email Classification Service - AI-powered email categorization and matching.

Uses Claude to classify incoming emails, extract relevant information,
and match them to the appropriate shipments, customers, or carriers.
"""

import os
import re
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime

from anthropic import Anthropic


# Email classification prompt
CLASSIFICATION_PROMPT = """You are an AI assistant for a Transportation Management System (TMS) used by freight brokers.

Analyze the following email and:
1. Classify it into one of these categories:
   - quote_request: Customer asking for a shipping rate
   - quote_response: Customer responding to a quote we sent
   - shipment_update: Status update about an active load
   - carrier_communication: Communication from/to a carrier
   - customer_communication: General communication from/to a customer
   - invoice_related: Payment or invoice discussion
   - document_attached: Has relevant shipping documents (BOL, POD, rate con)
   - booking_confirmation: Confirmation that a load is booked
   - tracking_update: Check call or tracking information
   - claim_related: Damage or freight claim discussion
   - uncategorized: Does not fit any category

2. Extract any reference numbers that could help match this to records:
   - Shipment/Load numbers (often PRO#, Load#, BOL#)
   - Quote numbers
   - PO numbers
   - Carrier MC# or DOT#

3. Summarize the key action needed (if any) in one sentence.

4. Provide a confidence score (0.0 to 1.0) for your classification.

Email:
From: {from_email} ({from_name})
Subject: {subject}
Body:
{body}

Respond in JSON format:
{{
  "category": "string",
  "confidence": 0.0,
  "reference_numbers": {{
    "shipment_numbers": [],
    "quote_numbers": [],
    "po_numbers": [],
    "mc_numbers": [],
    "dot_numbers": [],
    "other_refs": []
  }},
  "summary": "string - one sentence summary of what this email is about",
  "action_needed": "string or null - what action the user should take",
  "urgency": "low|medium|high - how urgent is this email"
}}"""


class EmailClassificationService:
    """Service for classifying emails and matching them to TMS entities."""

    def __init__(self):
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

    async def classify_email(
        self,
        from_email: str,
        from_name: Optional[str],
        subject: str,
        body: str,
    ) -> Dict[str, Any]:
        """
        Classify an email and extract relevant information.

        Returns:
            Dict with category, confidence, reference_numbers, summary, action_needed
        """
        prompt = CLASSIFICATION_PROMPT.format(
            from_email=from_email,
            from_name=from_name or "Unknown",
            subject=subject,
            body=body[:4000],  # Limit body length
        )

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )

            # Parse JSON from response
            response_text = response.content[0].text

            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'```json?\s*([\s\S]*?)\s*```', response_text)
            if json_match:
                response_text = json_match.group(1)

            import json
            result = json.loads(response_text)

            return {
                "category": result.get("category", "uncategorized"),
                "confidence": result.get("confidence", 0.5),
                "reference_numbers": result.get("reference_numbers", {}),
                "summary": result.get("summary", ""),
                "action_needed": result.get("action_needed"),
                "urgency": result.get("urgency", "medium"),
            }

        except Exception as e:
            print(f"Email classification error: {e}")
            return {
                "category": "uncategorized",
                "confidence": 0.0,
                "reference_numbers": {},
                "summary": "",
                "action_needed": None,
                "urgency": "medium",
            }

    async def match_email_to_entities(
        self,
        db,
        reference_numbers: Dict[str, List[str]],
        from_email: str,
        subject: str,
    ) -> Dict[str, Any]:
        """
        Try to match an email to existing TMS entities.

        Args:
            db: MongoDB database
            reference_numbers: Extracted reference numbers from classification
            from_email: Sender email address
            subject: Email subject

        Returns:
            Dict with matched entity IDs and match confidence
        """
        matches = {
            "shipment_id": None,
            "shipment_ids": [],
            "quote_id": None,
            "quote_request_id": None,
            "customer_id": None,
            "carrier_id": None,
            "match_confidence": 0.0,
            "auto_matched": False,
        }

        # Try to match by shipment numbers
        shipment_refs = reference_numbers.get("shipment_numbers", [])
        for ref in shipment_refs:
            # Try exact match on shipment_number
            shipment = await db.shipments.find_one({
                "$or": [
                    {"shipment_number": ref},
                    {"shipment_number": {"$regex": ref, "$options": "i"}},
                    {"customer_ref": ref},
                ]
            })
            if shipment:
                matches["shipment_id"] = str(shipment["_id"])
                matches["shipment_ids"].append(str(shipment["_id"]))
                matches["match_confidence"] = 0.9
                matches["auto_matched"] = True

        # Try to match by quote numbers
        quote_refs = reference_numbers.get("quote_numbers", [])
        for ref in quote_refs:
            quote = await db.quotes.find_one({
                "$or": [
                    {"quote_number": ref},
                    {"quote_number": {"$regex": ref, "$options": "i"}},
                ]
            })
            if quote:
                matches["quote_id"] = str(quote["_id"])
                if not matches["auto_matched"]:
                    matches["match_confidence"] = 0.85
                    matches["auto_matched"] = True

        # Try to match by carrier MC/DOT
        mc_numbers = reference_numbers.get("mc_numbers", [])
        dot_numbers = reference_numbers.get("dot_numbers", [])

        for mc in mc_numbers:
            carrier = await db.carriers.find_one({"mc_number": mc})
            if carrier:
                matches["carrier_id"] = str(carrier["_id"])
                if not matches["auto_matched"]:
                    matches["match_confidence"] = 0.8
                    matches["auto_matched"] = True

        for dot in dot_numbers:
            carrier = await db.carriers.find_one({"dot_number": dot})
            if carrier:
                matches["carrier_id"] = str(carrier["_id"])
                if not matches["auto_matched"]:
                    matches["match_confidence"] = 0.8
                    matches["auto_matched"] = True

        # Try to match by email domain to customer/carrier
        email_domain = from_email.split("@")[-1] if "@" in from_email else None

        if email_domain and not matches["customer_id"]:
            # Check if we know this email
            customer = await db.customers.find_one({
                "$or": [
                    {"email": from_email},
                    {"billing_email": from_email},
                    {"contacts.email": from_email},
                ]
            })
            if customer:
                matches["customer_id"] = str(customer["_id"])
                if not matches["auto_matched"]:
                    matches["match_confidence"] = 0.7
                    matches["auto_matched"] = True

        if email_domain and not matches["carrier_id"]:
            carrier = await db.carriers.find_one({
                "$or": [
                    {"email": from_email},
                    {"dispatch_email": from_email},
                    {"contacts.email": from_email},
                ]
            })
            if carrier:
                matches["carrier_id"] = str(carrier["_id"])
                if not matches["auto_matched"]:
                    matches["match_confidence"] = 0.7
                    matches["auto_matched"] = True

        # Check subject line for shipment numbers (common pattern)
        if not matches["shipment_id"]:
            # Look for patterns like "RE: Load 12345" or "Shipment SHP-00001"
            subject_patterns = [
                r'(?:load|shipment|ship|shp|pro)[#:\s-]*(\w+-?\d+)',
                r'(?:quote|qt)[#:\s-]*(\w+-?\d+)',
            ]
            for pattern in subject_patterns:
                match = re.search(pattern, subject, re.IGNORECASE)
                if match:
                    ref = match.group(1)
                    shipment = await db.shipments.find_one({
                        "$or": [
                            {"shipment_number": {"$regex": ref, "$options": "i"}},
                            {"customer_ref": {"$regex": ref, "$options": "i"}},
                        ]
                    })
                    if shipment:
                        matches["shipment_id"] = str(shipment["_id"])
                        matches["shipment_ids"].append(str(shipment["_id"]))
                        matches["match_confidence"] = 0.75
                        matches["auto_matched"] = True
                        break

        return matches


# Singleton instance
email_classifier = EmailClassificationService()
