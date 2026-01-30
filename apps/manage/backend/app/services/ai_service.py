"""
AI service for generating playbook steps using OpenAI.
"""
import json
import logging
from typing import Optional

from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)


class PlaybookAIService:
    """Service for AI-assisted playbook step generation."""

    SYSTEM_PROMPT = """You are an expert at creating clear, actionable process documentation.
Your task is to generate high-quality playbook steps for repeatable business processes.

Guidelines for generating steps:
1. **Actionable titles**: Use imperative verbs (e.g., "Review customer information", "Send confirmation email")
2. **Clear instructions**: Each step should explain WHAT to do and HOW to do it
3. **Logical sequencing**: Steps should flow naturally from start to finish
4. **Quality checkpoints**: Include verification steps where appropriate
5. **Failure prevention**: Note common pitfalls or things to watch out for
6. **Appropriate granularity**: Not too detailed (every click) or too vague (just "do the thing")

Respond ONLY with a valid JSON array of step objects. Each step should have:
- "title": string (required) - A clear, actionable title starting with an imperative verb
- "description": string (optional) - Detailed instructions for completing the step
- "when_to_perform": string (optional) - Conditions or timing for when this step applies

Example response format:
[
  {
    "title": "Review customer request",
    "description": "Open the customer ticket and review their specific requirements. Check for any attachments or additional context they may have provided.",
    "when_to_perform": "As soon as a new request is assigned to you"
  },
  {
    "title": "Verify account status",
    "description": "Look up the customer in the CRM system and confirm their account is active and in good standing.",
    "when_to_perform": null
  }
]

Do not include any text before or after the JSON array."""

    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[OpenAI] = None

    @property
    def client(self) -> OpenAI:
        """Lazy initialization of OpenAI client."""
        if self._client is None:
            if not self.settings.openai_api_key:
                raise ValueError("OPENAI_API_KEY not configured")
            self._client = OpenAI(api_key=self.settings.openai_api_key)
        return self._client

    def is_configured(self) -> bool:
        """Check if the AI service is properly configured."""
        return bool(self.settings.openai_api_key)

    async def generate_steps(
        self,
        playbook_name: str,
        playbook_description: Optional[str] = None,
        existing_steps: Optional[list[dict]] = None,
        user_prompt: Optional[str] = None,
    ) -> list[dict]:
        """
        Generate playbook steps using OpenAI.

        Args:
            playbook_name: Name of the playbook
            playbook_description: Optional description of the playbook
            existing_steps: Optional list of existing steps for context
            user_prompt: Optional additional instructions from the user

        Returns:
            List of generated step dictionaries with title, description, when_to_perform
        """
        # Build the user message
        message_parts = [f"Generate steps for a playbook named: \"{playbook_name}\""]

        if playbook_description:
            message_parts.append(f"\nPlaybook description: {playbook_description}")

        if existing_steps and len(existing_steps) > 0:
            steps_summary = "\n".join(
                f"- {s.get('title', 'Untitled')}" for s in existing_steps
            )
            message_parts.append(
                f"\nExisting steps for context (improve upon these):\n{steps_summary}"
            )

        if user_prompt:
            message_parts.append(f"\nAdditional instructions: {user_prompt}")

        user_message = "\n".join(message_parts)

        logger.info(f"Generating steps for playbook: {playbook_name}")

        # Call OpenAI API
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=4096,
            temperature=0.7,
        )

        # Extract the response text
        response_text = response.choices[0].message.content.strip()

        # Parse the JSON response
        try:
            steps = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            logger.debug(f"Response text: {response_text}")
            raise ValueError("AI returned invalid response format") from e

        # Validate the response structure
        if not isinstance(steps, list):
            raise ValueError("AI response must be a list of steps")

        validated_steps = []
        for step in steps:
            if not isinstance(step, dict):
                continue
            if not step.get("title"):
                continue
            validated_steps.append({
                "title": str(step["title"]),
                "description": step.get("description"),
                "when_to_perform": step.get("when_to_perform"),
            })

        if not validated_steps:
            raise ValueError("AI returned no valid steps")

        logger.info(f"Generated {len(validated_steps)} steps for playbook: {playbook_name}")
        return validated_steps


# Singleton instance
_ai_service: Optional[PlaybookAIService] = None


def get_ai_service() -> PlaybookAIService:
    """Get the singleton AI service instance."""
    global _ai_service
    if _ai_service is None:
        _ai_service = PlaybookAIService()
    return _ai_service
