import json
import re
from typing import Optional, Dict, Any, List
import logging

from app.config import get_settings
from app.models.quote_request import ExtractedField

logger = logging.getLogger(__name__)


class AIExtractionService:
    """Service for AI-powered email extraction and drafting."""

    def __init__(self):
        self.settings = get_settings()
        self._client = None

    def _get_client(self):
        """Lazily initialize Anthropic client."""
        if self._client is None:
            import anthropic
            self._client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)
        return self._client

    async def extract_shipment_details(
        self,
        email_subject: Optional[str],
        email_body: str,
        sender_email: Optional[str] = None,
    ) -> Dict[str, Optional[ExtractedField]]:
        """
        Extract shipment details from email content.

        Returns a dictionary of field names to ExtractedField objects,
        including confidence scores and evidence text.
        """
        if not self.settings.anthropic_api_key:
            logger.warning("Anthropic API key not configured, skipping extraction")
            return {}

        system_prompt = """You are an expert logistics analyst. Extract shipment details from rate request emails.

For each field you extract, provide:
1. The value
2. Your confidence (0.0-1.0)
3. The exact text from the email that supports this extraction
4. The source ("subject", "body", or "signature")

Respond with a JSON object containing these fields (set to null if not found):
- origin_city
- origin_state
- origin_zip
- destination_city
- destination_state
- destination_zip
- pickup_date (ISO format if found)
- delivery_date (ISO format if found)
- equipment_type (van, reefer, flatbed, etc.)
- weight_lbs
- commodity
- special_requirements (array of strings)
- missing_fields (array of field names that are typically needed but weren't found)

For each found field, use this structure:
{
  "value": "Chicago",
  "confidence": 0.95,
  "evidence_text": "picking up in Chicago, IL",
  "evidence_source": "body"
}

Only return the JSON object, no other text."""

        user_content = f"""Subject: {email_subject or '(no subject)'}
Sender: {sender_email or '(unknown)'}

Body:
{email_body}

Extract all shipment details you can find."""

        try:
            client = self._get_client()
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                system=system_prompt,
                messages=[{"role": "user", "content": user_content}],
            )

            # Parse the response
            text = response.content[0].text
            # Find JSON in response
            json_match = re.search(r'\{[\s\S]*\}', text)
            if not json_match:
                logger.error(f"No JSON found in extraction response: {text[:200]}")
                return {}

            data = json.loads(json_match.group(0))

            # Convert to ExtractedField objects
            result = {}
            field_mappings = {
                'origin_city': 'extracted_origin_city',
                'origin_state': 'extracted_origin_state',
                'origin_zip': 'extracted_origin_zip',
                'destination_city': 'extracted_destination_city',
                'destination_state': 'extracted_destination_state',
                'destination_zip': 'extracted_destination_zip',
                'pickup_date': 'extracted_pickup_date',
                'delivery_date': 'extracted_delivery_date',
                'equipment_type': 'extracted_equipment_type',
                'weight_lbs': 'extracted_weight',
                'commodity': 'extracted_commodity',
                'special_requirements': 'extracted_special_requirements',
            }

            for api_field, model_field in field_mappings.items():
                if api_field in data and data[api_field] is not None:
                    field_data = data[api_field]
                    if isinstance(field_data, dict) and 'value' in field_data:
                        result[model_field] = ExtractedField(
                            value=field_data['value'],
                            confidence=field_data.get('confidence', 0.5),
                            evidence_text=field_data.get('evidence_text'),
                            evidence_source=field_data.get('evidence_source', 'body'),
                        )
                    else:
                        # Simple value without evidence
                        result[model_field] = ExtractedField(
                            value=field_data,
                            confidence=0.5,
                            evidence_source='body',
                        )

            # Include missing fields
            if 'missing_fields' in data:
                result['missing_fields'] = data['missing_fields']

            return result

        except Exception as e:
            logger.error(f"Error extracting shipment details: {e}")
            return {}

    async def draft_quote_email(
        self,
        customer_name: str,
        origin: str,
        destination: str,
        equipment_type: str,
        pickup_date: Optional[str],
        total_price: int,
        special_instructions: Optional[str] = None,
    ) -> str:
        """Generate a professional quote email."""
        if not self.settings.anthropic_api_key:
            # Return a template if AI not available
            return f"""Dear {customer_name},

Thank you for your rate request. Please find our quote below:

Lane: {origin} → {destination}
Equipment: {equipment_type}
Pickup: {pickup_date or 'TBD'}
Rate: ${total_price / 100:.2f}

Please let us know if you would like to proceed with this shipment.

Best regards"""

        system_prompt = """You are a professional freight broker. Write a concise, professional quote email.
Keep it brief but warm. Include all the key details. Don't be overly formal or use jargon."""

        user_content = f"""Write a quote email with these details:
- Customer: {customer_name}
- Origin: {origin}
- Destination: {destination}
- Equipment: {equipment_type}
- Pickup date: {pickup_date or 'Flexible'}
- Rate: ${total_price / 100:.2f}
{f"- Special instructions: {special_instructions}" if special_instructions else ""}"""

        try:
            client = self._get_client()
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                system=system_prompt,
                messages=[{"role": "user", "content": user_content}],
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"Error drafting quote email: {e}")
            return f"Error generating email: {e}"

    async def draft_clarification_email(
        self,
        customer_name: str,
        missing_fields: List[str],
        original_request: str,
    ) -> str:
        """Generate an email asking for clarification on missing details."""
        if not self.settings.anthropic_api_key:
            fields_text = ", ".join(missing_fields)
            return f"""Dear {customer_name},

Thank you for your rate request. To provide you with an accurate quote, we need a few additional details:

{fields_text}

Please reply with this information at your earliest convenience.

Best regards"""

        system_prompt = """You are a professional freight broker. Write a friendly email asking for missing information.
Be specific about what's needed but keep it brief and professional."""

        user_content = f"""Write an email to {customer_name} asking for these missing details: {', '.join(missing_fields)}

Original request:
{original_request[:500]}..."""

        try:
            client = self._get_client()
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=400,
                system=system_prompt,
                messages=[{"role": "user", "content": user_content}],
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"Error drafting clarification email: {e}")
            return f"Error generating email: {e}"
