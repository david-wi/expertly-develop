"""
AI service for generating playbook steps using the centralized AI config.
"""
import json
import logging
from typing import Optional

from ai_config import AIConfigClient, get_ai_config_client

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

    # Use case for playbook step generation - falls back to analysis_medium if not defined
    USE_CASE = "playbook_generation"
    FALLBACK_USE_CASE = "analysis_medium"

    def __init__(self):
        self._ai_client: Optional[AIConfigClient] = None

    @property
    def ai_client(self) -> AIConfigClient:
        """Get the AI config client."""
        if self._ai_client is None:
            self._ai_client = get_ai_config_client()
        return self._ai_client

    def is_configured(self) -> bool:
        """Check if the AI service is properly configured."""
        import os
        # Check if at least one AI provider is configured
        return bool(os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY") or os.getenv("GROQ_API_KEY"))

    async def generate_steps(
        self,
        playbook_name: str,
        playbook_description: Optional[str] = None,
        existing_steps: Optional[list[dict]] = None,
        user_prompt: Optional[str] = None,
    ) -> list[dict]:
        """
        Generate playbook steps using the configured AI model.

        Args:
            playbook_name: Name of the playbook
            playbook_description: Optional description of the playbook
            existing_steps: Optional list of existing steps for context
            user_prompt: Optional additional instructions from the user

        Returns:
            List of generated step dictionaries with title, description, when_to_perform
        """
        # Get the model configuration for this use case
        try:
            use_case_config = await self.ai_client.get_use_case_config(self.USE_CASE)
        except Exception:
            logger.info(f"Use case '{self.USE_CASE}' not found, trying fallback")
            use_case_config = await self.ai_client.get_use_case_config(self.FALLBACK_USE_CASE)

        model_id = use_case_config.model_id
        provider = use_case_config.provider_name
        max_tokens = use_case_config.max_tokens
        temperature = use_case_config.temperature

        logger.info(f"Generating steps for playbook '{playbook_name}' using {provider}/{model_id}")

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

        # Call the appropriate AI provider
        if provider == "anthropic":
            response_text = await self._call_anthropic(
                model_id, user_message, max_tokens, temperature
            )
        elif provider == "groq":
            response_text = await self._call_groq(
                model_id, user_message, max_tokens, temperature
            )
        else:
            response_text = await self._call_openai(
                model_id, user_message, max_tokens, temperature
            )

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

    async def _call_anthropic(
        self, model_id: str, user_message: str, max_tokens: int, temperature: float
    ) -> str:
        """Call Anthropic API."""
        client = self.ai_client.get_anthropic_client()
        response = client.messages.create(
            model=model_id,
            max_tokens=max_tokens,
            temperature=temperature,
            system=self.SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text.strip()

    async def _call_openai(
        self, model_id: str, user_message: str, max_tokens: int, temperature: float
    ) -> str:
        """Call OpenAI API."""
        client = self.ai_client.get_openai_client()
        response = client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content.strip()

    async def _call_groq(
        self, model_id: str, user_message: str, max_tokens: int, temperature: float
    ) -> str:
        """Call Groq API (OpenAI-compatible)."""
        import os
        try:
            import openai
        except ImportError:
            raise ImportError("openai package not installed. Run: pip install openai")

        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable not set")

        # Groq uses OpenAI-compatible API
        client = openai.OpenAI(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1"
        )
        response = client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content.strip()


class SlackMentionTitleService:
    """Service for generating task titles from Slack mentions using AI."""

    SYSTEM_PROMPT = """You are a task title generator. Given a Slack message where someone was mentioned, generate a short, actionable task title.

Guidelines:
1. Start with an action verb when possible (Review, Respond to, Help with, etc.)
2. Keep it under 60 characters
3. Capture the essence of what's being asked
4. Don't include the @mention itself
5. If no clear action, use "Review Slack message from [topic/context]"

Respond with ONLY the task title, nothing else."""

    USE_CASE = "categorization"
    FALLBACK_USE_CASE = "analysis_small"

    def __init__(self):
        self._ai_client: Optional[AIConfigClient] = None

    @property
    def ai_client(self) -> AIConfigClient:
        """Get the AI config client."""
        if self._ai_client is None:
            self._ai_client = get_ai_config_client()
        return self._ai_client

    def is_configured(self) -> bool:
        """Check if the AI service is properly configured."""
        import os
        return bool(os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY") or os.getenv("GROQ_API_KEY"))

    async def generate_title(self, message_text: str, context: Optional[str] = None) -> str:
        """
        Generate a task title from a Slack message.

        Args:
            message_text: The main message text
            context: Optional context (thread messages, etc.)

        Returns:
            Generated task title
        """
        if not self.is_configured():
            return self._fallback_title(message_text)

        try:
            use_case_config = await self.ai_client.get_use_case_config(self.USE_CASE)
        except Exception:
            try:
                use_case_config = await self.ai_client.get_use_case_config(self.FALLBACK_USE_CASE)
            except Exception:
                return self._fallback_title(message_text)

        model_id = use_case_config.model_id
        provider = use_case_config.provider_name
        max_tokens = min(use_case_config.max_tokens, 100)  # Title should be short
        temperature = use_case_config.temperature

        # Build prompt
        prompt = f"Slack message: {message_text}"
        if context:
            prompt += f"\n\nContext:\n{context}"

        try:
            if provider == "groq":
                response_text = await self._call_groq(model_id, prompt, max_tokens, temperature)
            elif provider == "anthropic":
                response_text = await self._call_anthropic(model_id, prompt, max_tokens, temperature)
            else:
                response_text = await self._call_openai(model_id, prompt, max_tokens, temperature)

            # Clean up response
            title = response_text.strip().strip('"').strip("'")
            if len(title) > 80:
                title = title[:77] + "..."
            return title

        except Exception as e:
            logger.warning(f"AI title generation failed: {e}")
            return self._fallback_title(message_text)

    def _fallback_title(self, message_text: str) -> str:
        """Generate a simple fallback title."""
        # Remove mentions
        import re
        clean_text = re.sub(r'<@[A-Z0-9]+>', '', message_text).strip()

        if len(clean_text) > 50:
            return f"[Slack] {clean_text[:47]}..."
        elif clean_text:
            return f"[Slack] {clean_text}"
        return "[Slack] New mention"

    async def _call_groq(self, model_id: str, prompt: str, max_tokens: int, temperature: float) -> str:
        """Call Groq API."""
        import os
        import openai

        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set")

        client = openai.OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
        response = client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content.strip()

    async def _call_anthropic(self, model_id: str, prompt: str, max_tokens: int, temperature: float) -> str:
        """Call Anthropic API."""
        client = self.ai_client.get_anthropic_client()
        response = client.messages.create(
            model=model_id,
            max_tokens=max_tokens,
            temperature=temperature,
            system=self.SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()

    async def _call_openai(self, model_id: str, prompt: str, max_tokens: int, temperature: float) -> str:
        """Call OpenAI API."""
        client = self.ai_client.get_openai_client()
        response = client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content.strip()


# Singleton instances
_ai_service: Optional[PlaybookAIService] = None
_slack_title_service: Optional[SlackMentionTitleService] = None


def get_ai_service() -> PlaybookAIService:
    """Get the singleton AI service instance."""
    global _ai_service
    if _ai_service is None:
        _ai_service = PlaybookAIService()
    return _ai_service


def get_slack_title_service() -> SlackMentionTitleService:
    """Get the singleton Slack title service instance."""
    global _slack_title_service
    if _slack_title_service is None:
        _slack_title_service = SlackMentionTitleService()
    return _slack_title_service
