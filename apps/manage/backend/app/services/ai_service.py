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
        use_case_config = await self.ai_client.get_use_case_config(self.USE_CASE)

        # Check if we got actual config or defaults (use_case won't match if defaulted)
        if use_case_config.use_case != self.USE_CASE:
            logger.info(f"Use case '{self.USE_CASE}' not found in config, trying fallback")
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

    SYSTEM_PROMPT = """You are a task title generator for David's task management system. Given a Slack message where David was mentioned, generate a short, actionable task title from David's perspective — what does David need to do?

Guidelines:
1. Start with an action verb (Review, Respond to, Approve, Decide on, Follow up on, Join, etc.)
2. Keep it under 60 characters
3. Capture the essence of what David needs to do
4. Don't include @mentions, Slack markup, or user IDs
5. Write from David's perspective as a task he needs to complete
6. If no clear action, use "Review: [brief topic summary]"

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

        prompt = f"Slack message: {message_text}"
        if context:
            prompt += f"\n\nContext:\n{context}"

        try:
            title = await self._call_with_fallback(
                self.SYSTEM_PROMPT, prompt, 100, 0.3,
                fallback_fn=lambda: self._fallback_title(message_text)
            )
            # Clean up response
            title = title.strip().strip('"').strip("'")
            if len(title) > 80:
                title = title[:77] + "..."
            return title
        except Exception as e:
            logger.warning(f"AI title generation failed: {e}")
            return self._fallback_title(message_text)

    DESCRIPTION_SYSTEM_PROMPT = """You are a task description writer for David's task management system. Given a Slack message (and optionally thread context of up to 5 messages), write a thorough, actionable task description from David's perspective.

The goal is to write a description complete enough that David can understand and respond WITHOUT having to click through to the original Slack message most of the time.

Guidelines:
1. Start with a one-line summary of what David needs to do
2. Then provide the key context: who is asking, what they need, and any relevant background from the thread
3. Include specific details: names, deadlines, links mentioned, exact questions asked, options being considered
4. If the thread shows a conversation, summarize the progression so David understands where things stand
5. End with the specific ask or next step David should take
6. Aim for a thorough but scannable description — use line breaks between sections
7. Don't include raw Slack markup, @mentions with user IDs, or channel codes
8. Replace user mentions with actual names where possible
9. Write in a professional, clear tone

Respond with ONLY the description text, nothing else."""

    ACTIONABILITY_SYSTEM_PROMPT = """You are a message classifier. Given a Slack message where someone mentioned David, determine if this message requires David to take any action or gives him new information he needs to act on.

Messages that are NOT actionable (respond "no"):
- Simple acknowledgments ("okay", "sure", "got it", "thanks")
- Bot-generated standup reports listing who didn't post
- Messages that are just CC'ing David with no new info for him
- Auto-generated notifications with no action needed

Messages that ARE actionable (respond "yes"):
- Requests for David to review, approve, or decide something
- Questions directed at David
- Information David needs to act on (incidents, updates, deadlines)
- Meeting requests or scheduling
- Follow-ups asking David to do something
- New information that changes David's work

Respond with ONLY "yes" or "no"."""

    async def is_actionable(self, message_text: str, context: Optional[str] = None) -> bool:
        """
        Determine if a Slack message is actionable for David.

        Returns True if the message requires action, False if it's just
        an acknowledgment or non-actionable notification.
        """
        if not self.is_configured():
            return self._fallback_actionability(message_text)

        prompt = f"Slack message: {message_text}"
        if context:
            prompt += f"\n\nThread context:\n{context}"

        try:
            response_text = await self._call_with_fallback(
                self.ACTIONABILITY_SYSTEM_PROMPT, prompt, 10, 0.0,
                fallback_fn=lambda: "yes" if self._fallback_actionability(message_text) else "no"
            )
            return response_text.strip().lower().startswith("yes")
        except Exception as e:
            logger.warning(f"AI actionability check failed: {e}")
            return self._fallback_actionability(message_text)

    def _fallback_actionability(self, message_text: str) -> bool:
        """Simple heuristic fallback for actionability check."""
        import re
        clean = re.sub(r'<@[A-Z0-9]+(\|[^>]+)?>', '', message_text).strip().lower()

        # Skip very short acknowledgments
        non_actionable = [
            "okay", "ok", "sure", "got it", "thanks", "thank you",
            "noted", "will do", "done", "yes", "no", "agreed",
        ]
        if clean.rstrip(".!") in non_actionable:
            return False

        # Skip standup bot reports
        if "did not post a standup for" in clean:
            return False

        return True

    async def generate_description(self, message_text: str, context: Optional[str] = None) -> str:
        """
        Generate a task description from a Slack message.

        Args:
            message_text: The main message text
            context: Optional context (thread messages, etc.)

        Returns:
            Generated task description
        """
        if not self.is_configured():
            return self._fallback_description(message_text)

        prompt = f"Slack message: {message_text}"
        if context:
            prompt += f"\n\nThread context:\n{context}"

        max_tokens = 500
        temperature = 0.3

        # Try providers in order of availability
        return await self._call_with_fallback(
            self.DESCRIPTION_SYSTEM_PROMPT, prompt, max_tokens, temperature,
            fallback_fn=lambda: self._fallback_description(message_text)
        )

    async def _call_with_fallback(
        self, system_prompt: str, prompt: str, max_tokens: int, temperature: float,
        fallback_fn=None
    ) -> str:
        """Try AI providers in order of availability, falling back gracefully."""
        import os

        # Try use case config first
        try:
            use_case_config = await self.ai_client.get_use_case_config(self.USE_CASE)
            model_id = use_case_config.model_id
            provider = use_case_config.provider_name

            if provider == "groq" and os.getenv("GROQ_API_KEY"):
                return (await self._call_groq_with_system(model_id, system_prompt, prompt, max_tokens, temperature)).strip()
            elif provider == "anthropic" and os.getenv("ANTHROPIC_API_KEY"):
                return (await self._call_anthropic_with_system(model_id, system_prompt, prompt, max_tokens, temperature)).strip()
            elif provider == "openai" and os.getenv("OPENAI_API_KEY"):
                return (await self._call_openai_with_system(model_id, system_prompt, prompt, max_tokens, temperature)).strip()
        except Exception as e:
            logger.warning(f"Primary AI provider failed: {e}")

        # Try available providers directly
        providers = [
            ("groq", "GROQ_API_KEY", "llama-3.3-70b-versatile"),
            ("openai", "OPENAI_API_KEY", "gpt-4o-mini"),
        ]
        for provider_name, env_key, default_model in providers:
            if os.getenv(env_key):
                try:
                    if provider_name == "groq":
                        return (await self._call_groq_with_system(default_model, system_prompt, prompt, max_tokens, temperature)).strip()
                    elif provider_name == "openai":
                        return (await self._call_openai_with_system(default_model, system_prompt, prompt, max_tokens, temperature)).strip()
                except Exception as e:
                    logger.warning(f"Fallback AI provider {provider_name} failed: {e}")
                    continue

        logger.warning("All AI providers failed, using fallback")
        if fallback_fn:
            return fallback_fn()
        return ""

    def _fallback_description(self, message_text: str) -> str:
        """Generate a simple fallback description."""
        import re
        clean_text = re.sub(r'<@[A-Z0-9]+(\|[^>]+)?>', lambda m: m.group(1)[1:] if m.group(1) else '', message_text).strip()
        if len(clean_text) > 500:
            clean_text = clean_text[:497] + "..."
        return clean_text

    def _fallback_title(self, message_text: str) -> str:
        """Generate a simple fallback title."""
        import re
        clean_text = re.sub(r'<@[A-Z0-9]+(\|[^>]+)?>', '', message_text).strip()

        if len(clean_text) > 50:
            return f"[Slack] {clean_text[:47]}..."
        elif clean_text:
            return f"[Slack] {clean_text}"
        return "[Slack] New mention"

    async def _call_groq(self, model_id: str, prompt: str, max_tokens: int, temperature: float) -> str:
        """Call Groq API."""
        return await self._call_groq_with_system(model_id, self.SYSTEM_PROMPT, prompt, max_tokens, temperature)

    async def _call_anthropic(self, model_id: str, prompt: str, max_tokens: int, temperature: float) -> str:
        """Call Anthropic API."""
        return await self._call_anthropic_with_system(model_id, self.SYSTEM_PROMPT, prompt, max_tokens, temperature)

    async def _call_openai(self, model_id: str, prompt: str, max_tokens: int, temperature: float) -> str:
        """Call OpenAI API."""
        return await self._call_openai_with_system(model_id, self.SYSTEM_PROMPT, prompt, max_tokens, temperature)

    async def _call_groq_with_system(self, model_id: str, system_prompt: str, prompt: str, max_tokens: int, temperature: float) -> str:
        """Call Groq API with a custom system prompt."""
        import os
        import openai

        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set")

        client = openai.OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
        response = client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content.strip()

    async def _call_anthropic_with_system(self, model_id: str, system_prompt: str, prompt: str, max_tokens: int, temperature: float) -> str:
        """Call Anthropic API with a custom system prompt."""
        client = self.ai_client.get_anthropic_client()
        response = client.messages.create(
            model=model_id,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()

    async def _call_openai_with_system(self, model_id: str, system_prompt: str, prompt: str, max_tokens: int, temperature: float) -> str:
        """Call OpenAI API with a custom system prompt."""
        client = self.ai_client.get_openai_client()
        response = client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "system", "content": system_prompt},
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
