"""AI-powered communications service for drafting emails and messages."""
import os
import json
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

import anthropic

from app.database import get_database
from app.models.base import utc_now


class AICommunicationsService:
    """Service for AI-generated communications."""

    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )

    async def draft_quote_email(
        self,
        quote_id: str,
        tone: str = "professional",  # professional, friendly, formal
    ) -> dict:
        """Generate a quote email to send to customer."""
        db = get_database()

        quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
        if not quote:
            raise ValueError("Quote not found")

        customer = await db.customers.find_one({"_id": quote["customer_id"]})
        customer_name = customer.get("name") if customer else "Customer"

        # Get primary contact
        contact_name = "there"
        if customer and customer.get("contacts"):
            primary = next((c for c in customer["contacts"] if c.get("is_primary")), None)
            if primary:
                contact_name = primary.get("name", "there").split()[0]  # First name

        prompt = f"""Draft a {tone} email to send a freight quote to a customer.

Customer: {customer_name}
Contact: {contact_name}
Quote Number: {quote.get('quote_number')}

Route: {quote.get('origin_city')}, {quote.get('origin_state')} → {quote.get('destination_city')}, {quote.get('destination_state')}
Equipment: {quote.get('equipment_type', 'Dry Van')}
Pickup Date: {quote.get('pickup_date', 'TBD')}
Total Price: ${quote.get('total_price', 0) / 100:.2f}

Line Items:
{json.dumps(quote.get('line_items', []), indent=2)}

Generate a professional email with:
1. Greeting
2. Quote summary
3. Key details (route, dates, equipment)
4. Price and validity period
5. Call to action to confirm
6. Sign-off

Return JSON:
{{
  "subject": "email subject line",
  "body": "email body text",
  "key_points": ["list of key points to highlight"]
}}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.content[0].text
        try:
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response_text[start:end])
        except json.JSONDecodeError:
            pass

        return {
            "subject": f"Freight Quote {quote.get('quote_number')} - {quote.get('origin_state')} to {quote.get('destination_state')}",
            "body": response_text,
            "key_points": [],
        }

    async def draft_tender_email(
        self,
        tender_id: str,
        tone: str = "professional",
    ) -> dict:
        """Generate a tender/rate confirmation email to send to carrier."""
        db = get_database()

        tender = await db.tenders.find_one({"_id": ObjectId(tender_id)})
        if not tender:
            raise ValueError("Tender not found")

        shipment = await db.shipments.find_one({"_id": tender["shipment_id"]})
        carrier = await db.carriers.find_one({"_id": tender["carrier_id"]})

        carrier_name = carrier.get("name") if carrier else "Carrier"
        contact_name = "there"
        if carrier and carrier.get("contacts"):
            primary = next((c for c in carrier["contacts"] if c.get("is_primary")), None)
            if primary:
                contact_name = primary.get("name", "there").split()[0]

        stops = shipment.get("stops", []) if shipment else []
        origin = next((s for s in stops if s.get("stop_type") == "pickup"), {})
        dest = next((s for s in stops if s.get("stop_type") == "delivery"), {})

        prompt = f"""Draft a {tone} email to tender a load to a carrier.

Carrier: {carrier_name}
Contact: {contact_name}
Load Number: {shipment.get('shipment_number') if shipment else 'N/A'}

Route: {origin.get('city', 'TBD')}, {origin.get('state', '')} → {dest.get('city', 'TBD')}, {dest.get('state', '')}
Pickup: {shipment.get('pickup_date', 'TBD') if shipment else 'TBD'}
Delivery: {shipment.get('delivery_date', 'TBD') if shipment else 'TBD'}
Equipment: {shipment.get('equipment_type', 'Dry Van') if shipment else 'Dry Van'}
Weight: {shipment.get('weight_lbs', 'TBD') if shipment else 'TBD'} lbs
Rate: ${tender.get('offered_rate', 0) / 100:.2f}

Pickup Address: {origin.get('address', '')}, {origin.get('city', '')}, {origin.get('state', '')} {origin.get('zip_code', '')}
Delivery Address: {dest.get('address', '')}, {dest.get('city', '')}, {dest.get('state', '')} {dest.get('zip_code', '')}

Generate a professional email with:
1. Greeting
2. Load offer summary
3. Route and timing details
4. Rate offered
5. Request for confirmation
6. Sign-off

Return JSON:
{{
  "subject": "email subject line",
  "body": "email body text"
}}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.content[0].text
        try:
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response_text[start:end])
        except json.JSONDecodeError:
            pass

        return {
            "subject": f"Load Tender - {origin.get('city', '')} to {dest.get('city', '')}",
            "body": response_text,
        }

    async def draft_check_call_message(
        self,
        shipment_id: str,
        channel: str = "sms",  # sms, email
    ) -> dict:
        """Generate a check call request message."""
        db = get_database()

        shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
        if not shipment:
            raise ValueError("Shipment not found")

        carrier = await db.carriers.find_one({"_id": shipment.get("carrier_id")})
        carrier_name = carrier.get("name") if carrier else "Driver"

        stops = shipment.get("stops", [])
        dest = next((s for s in stops if s.get("stop_type") == "delivery"), {})

        if channel == "sms":
            prompt = f"""Generate a brief, professional SMS check call request for a trucking load.

Load: {shipment.get('shipment_number')}
Delivering to: {dest.get('city', 'destination')}, {dest.get('state', '')}
Expected delivery: {shipment.get('delivery_date', 'soon')}

The SMS should:
- Be under 160 characters
- Ask for current location/ETA
- Be professional but friendly
- Include the load number

Return JSON:
{{
  "message": "the sms text"
}}"""
        else:
            prompt = f"""Generate a professional email check call request for a trucking load.

Carrier: {carrier_name}
Load: {shipment.get('shipment_number')}
Delivering to: {dest.get('city', '')}, {dest.get('state', '')}
Expected delivery: {shipment.get('delivery_date', 'TBD')}

The email should:
- Be concise
- Request current location and ETA
- Be professional

Return JSON:
{{
  "subject": "email subject",
  "body": "email body"
}}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.content[0].text
        try:
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response_text[start:end])
        except json.JSONDecodeError:
            pass

        return {"message": response_text}

    async def draft_exception_notification(
        self,
        shipment_id: str,
        exception_type: str,
        exception_details: str,
        recipient: str = "customer",  # customer, carrier
    ) -> dict:
        """Generate an exception notification message."""
        db = get_database()

        shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
        if not shipment:
            raise ValueError("Shipment not found")

        if recipient == "customer":
            entity = await db.customers.find_one({"_id": shipment.get("customer_id")})
            entity_name = entity.get("name") if entity else "Customer"
        else:
            entity = await db.carriers.find_one({"_id": shipment.get("carrier_id")})
            entity_name = entity.get("name") if entity else "Carrier"

        prompt = f"""Generate a professional notification email about a shipment exception.

Recipient: {entity_name} ({recipient})
Shipment: {shipment.get('shipment_number')}
Exception Type: {exception_type}
Details: {exception_details}

The email should:
- Be clear about what happened
- Explain any impact
- Provide next steps if applicable
- Maintain a professional, solution-oriented tone
- NOT be overly apologetic

Return JSON:
{{
  "subject": "email subject",
  "body": "email body"
}}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.content[0].text
        try:
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response_text[start:end])
        except json.JSONDecodeError:
            pass

        return {
            "subject": f"Shipment Update - {shipment.get('shipment_number')}",
            "body": response_text,
        }

    async def summarize_email_thread(
        self,
        emails: List[dict],
    ) -> dict:
        """Summarize an email thread and extract action items."""
        email_text = "\n\n---\n\n".join([
            f"From: {e.get('from_email')}\nSubject: {e.get('subject')}\nDate: {e.get('received_at')}\n\n{e.get('body_text', '')}"
            for e in emails
        ])

        prompt = f"""Summarize this email thread and extract action items.

Email Thread:
{email_text[:5000]}  # Limit length

Return JSON:
{{
  "summary": "brief summary of the conversation",
  "key_points": ["list of key points"],
  "action_items": ["list of action items"],
  "sentiment": "positive/neutral/negative",
  "urgency": "high/medium/low"
}}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.content[0].text
        try:
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response_text[start:end])
        except json.JSONDecodeError:
            pass

        return {
            "summary": response_text,
            "key_points": [],
            "action_items": [],
            "sentiment": "neutral",
            "urgency": "medium",
        }


# Singleton instance
_service: Optional[AICommunicationsService] = None


def get_ai_communications_service() -> AICommunicationsService:
    """Get or create the AI communications service singleton."""
    global _service
    if _service is None:
        _service = AICommunicationsService()
    return _service
