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
6. If a project name is provided, weave it naturally into the title (e.g. "Review John's Portal deployment request" not "[Portal] Review John's deployment request")
7. When a sender name is provided, include it naturally when it adds context — e.g. "Review common skills contracts for Puneet" or "Help Jonah with deployment issue" rather than just "Review common skills contracts"
8. If no clear action, use "Review: [brief topic summary]"

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

    async def generate_title(self, message_text: str, context: Optional[str] = None, sender: Optional[str] = None, project_name: Optional[str] = None) -> str:
        """
        Generate a task title from a Slack message.

        Args:
            message_text: The main message text
            context: Optional context (thread messages, etc.)
            sender: Optional sender name (who wrote the message)
            project_name: Optional project name to incorporate into the title

        Returns:
            Generated task title
        """
        if not self.is_configured():
            return self._fallback_title(message_text, project_name=project_name)

        prompt = ""
        if sender:
            prompt += f"From: {sender}\n"
        if project_name:
            prompt += f"Project: {project_name}\n"
        prompt += f"Slack message: {message_text}"
        if context:
            prompt += f"\n\nContext:\n{context}"

        try:
            title = await self._call_with_fallback(
                self.SYSTEM_PROMPT, prompt, 100, 0.3,
                fallback_fn=lambda: self._fallback_title(message_text, project_name=project_name)
            )
            # Clean up response
            title = title.strip().strip('"').strip("'")
            if len(title) > 80:
                title = title[:77] + "..."
            return title
        except Exception as e:
            logger.warning(f"AI title generation failed: {e}")
            return self._fallback_title(message_text, project_name=project_name)

    DESCRIPTION_SYSTEM_PROMPT = """You are a task description writer for David's task management system. Given a Slack message (and optionally thread context), write a thorough, actionable task description from David's perspective.

The goal is to write a description complete enough that David can understand and act WITHOUT having to click through to the original Slack message.

Guidelines:
1. Start with a clear one-line summary of the specific action David needs to take
2. Include the key context: who is asking (by name), what exactly they need, and why
3. Preserve specific details verbatim: names, dates, deadlines, links, exact questions, options being considered, technical details
4. If the thread shows a conversation, summarize where things stand — what's been decided, what's still open
5. End with concrete next steps — not vague "review and discuss" but specific actions like "Reply to Sean with the meeting link" or "Send Jonah the updated timeline"
6. If multiple people are involved, note who is doing what and what's still unassigned
7. Don't pad with filler phrases like "The request is coming from an unknown team member" — if you don't know something, just omit it
8. Don't include raw Slack markup, @mentions with user IDs, or channel codes — use real names
9. Keep it scannable with line breaks between sections

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

    URGENCY_SYSTEM_PROMPT = """You are a message urgency classifier for David's task management system. Given a message (from Slack, email, or another source), determine if this message is particularly URGENT and should be starred/prioritized.

Messages that ARE urgent (respond "yes"):
- Explicit urgency language ("urgent", "ASAP", "immediately", "critical", "emergency", "time-sensitive", "blocking", "blocker")
- Production incidents, outages, or system-down situations
- Client/customer escalations or complaints requiring immediate attention
- Deadlines that are today or already past due
- Messages from leadership/executives requesting immediate action
- Security issues or data breaches
- Financial/billing emergencies
- Requests marked as high priority by the sender

Messages that are NOT urgent (respond "no"):
- Normal requests, questions, or follow-ups with no time pressure
- FYI or informational messages
- Scheduling requests for future dates
- General discussion or brainstorming
- Routine updates or status reports
- Standard review requests without deadline pressure

Respond with ONLY "yes" or "no"."""

    ALREADY_HANDLED_SYSTEM_PROMPT = """You are a message classifier. Given a Slack message where someone mentioned David, along with the thread context (subsequent replies), determine if the request has ALREADY been handled or resolved by someone in the thread.

A message IS already handled (respond "yes") if:
- Someone in the thread has already answered the question or fulfilled the request
- The original poster confirmed the issue is resolved
- Someone committed to handling it and followed through
- The thread shows the work was completed or the decision was made

A message is NOT already handled (respond "no") if:
- No one has responded yet
- The responses are only acknowledgments without actually handling it
- The request is still open/pending
- David was specifically asked to do something that hasn't been done
- The thread shows ongoing discussion without resolution

Respond with ONLY "yes" or "no"."""

    async def is_already_handled(self, message_text: str, context: Optional[str] = None) -> bool:
        """
        Determine if a Slack mention has already been handled by someone in the thread.

        Returns True if the request appears to be resolved, False otherwise.
        Defaults to False (not handled → create task) on failure.
        """
        if not self.is_configured():
            return False

        prompt = f"Slack message: {message_text}"
        if context:
            prompt += f"\n\nThread replies:\n{context}"

        try:
            response_text = await self._call_with_fallback(
                self.ALREADY_HANDLED_SYSTEM_PROMPT, prompt, 10, 0.0,
                fallback_fn=lambda: "no"
            )
            return response_text.strip().lower().startswith("yes")
        except Exception as e:
            logger.warning(f"AI already-handled check failed: {e}")
            return False

    async def is_urgent(self, message_text: str, context: Optional[str] = None) -> bool:
        """
        Determine if a message is particularly urgent and should be starred.

        Works across all providers (Slack, Gmail, Outlook, etc.).
        Returns True if the message seems urgent, False otherwise.
        Defaults to False (not urgent) on failure.
        """
        if not self.is_configured():
            return self._fallback_urgency(message_text)

        prompt = f"Message: {message_text}"
        if context:
            prompt += f"\n\nAdditional context:\n{context}"

        try:
            response_text = await self._call_with_fallback(
                self.URGENCY_SYSTEM_PROMPT, prompt, 10, 0.0,
                fallback_fn=lambda: "yes" if self._fallback_urgency(message_text) else "no"
            )
            return response_text.strip().lower().startswith("yes")
        except Exception as e:
            logger.warning(f"AI urgency check failed: {e}")
            return self._fallback_urgency(message_text)

    def _fallback_urgency(self, message_text: str) -> bool:
        """Simple heuristic fallback for urgency detection."""
        import re
        clean = re.sub(r'<@[A-Z0-9]+(\|[^>]+)?>', '', message_text).strip().lower()

        urgent_keywords = [
            "urgent", "asap", "immediately", "critical", "emergency",
            "time-sensitive", "blocking", "blocker", "outage", "down",
            "incident", "escalat", "p0", "p1", "sev1", "sev0",
            "production issue", "prod issue", "site down", "service down",
        ]
        for keyword in urgent_keywords:
            if keyword in clean:
                return True

        return False

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

    async def generate_description(self, message_text: str, context: Optional[str] = None, sender: Optional[str] = None) -> str:
        """
        Generate a task description from a Slack message.

        Args:
            message_text: The main message text
            context: Optional context (thread messages, etc.)
            sender: Optional sender name (who wrote the message)

        Returns:
            Generated task description
        """
        if not self.is_configured():
            return self._fallback_description(message_text)

        prompt = ""
        if sender:
            prompt += f"From: {sender}\n"
        prompt += f"Slack message: {message_text}"
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

    REPLY_DRAFT_SYSTEM_PROMPT = """You are drafting a Slack reply for David. Given a Slack message (and optionally thread context), write a substantive, helpful reply that actually addresses the request.

Your PRIMARY goal is to be genuinely useful — not just acknowledge the message. Analyze the situation and respond accordingly:

1. **If someone asks a question or raises a problem**: Analyze it and suggest a concrete solution with reasoning. Use the thread context to understand what's been tried or discussed.
2. **If someone needs a decision**: Provide David's recommendation with a clear rationale.
3. **If someone needs something done**: Confirm specifically what David will do and when, or delegate — e.g., "@personname could you handle this?" (use @name format for Slack mentions when delegating).
4. **If you need more info to give a real answer**: Ask specific clarifying questions — not vague ones. Say exactly what you need to know and why.
5. **If someone is sharing an update**: Respond to the substance — ask a follow-up, flag a concern, or confirm next steps.

Style:
- Match the thread's tone (casual channel = casual reply)
- Be direct and concise but substantive — a real reply, not a placeholder
- Use @mentions (e.g., @personname) when referring to or delegating to specific people
- It's fine to be brief if a brief answer is the right answer

Respond with ONLY the reply text, nothing else."""

    async def generate_reply_draft(
        self,
        message_text: str,
        context: Optional[str] = None,
        sender: Optional[str] = None,
        channel_name: Optional[str] = None,
    ) -> str:
        """
        Generate a draft reply to a Slack message.

        Args:
            message_text: The message to reply to
            context: Optional thread context
            sender: Who sent the message
            channel_name: Which channel it's in

        Returns:
            Draft reply text
        """
        if not self.is_configured():
            return self._fallback_reply(message_text)

        prompt = ""
        if sender:
            prompt += f"From: {sender}\n"
        if channel_name:
            prompt += f"Channel: #{channel_name}\n"
        prompt += f"Message: {message_text}"
        if context:
            prompt += f"\n\nThread context:\n{context}"

        try:
            reply = await self._call_with_fallback(
                self.REPLY_DRAFT_SYSTEM_PROMPT, prompt, 500, 0.5,
                fallback_fn=lambda: self._fallback_reply(message_text)
            )
            return reply.strip().strip('"').strip("'")
        except Exception as e:
            logger.warning(f"AI reply draft generation failed: {e}")
            return self._fallback_reply(message_text)

    def _fallback_reply(self, message_text: str) -> str:
        """Simple fallback reply."""
        return "Thanks for the heads up — I'll take a look and get back to you."

    def _fallback_description(self, message_text: str) -> str:
        """Generate a simple fallback description."""
        import re
        clean_text = re.sub(r'<@[A-Z0-9]+(\|[^>]+)?>', lambda m: m.group(1)[1:] if m.group(1) else '', message_text).strip()
        if len(clean_text) > 500:
            clean_text = clean_text[:497] + "..."
        return clean_text

    def _fallback_title(self, message_text: str, project_name: Optional[str] = None) -> str:
        """Generate a simple fallback title, incorporating project name when available."""
        import re
        clean_text = re.sub(r'<@[A-Z0-9]+(\|[^>]+)?>', '', message_text).strip()
        prefix = f"{project_name}: " if project_name else ""

        if len(clean_text) > 60:
            return f"{prefix}{clean_text[:57]}..."
        elif clean_text:
            return f"{prefix}{clean_text}"
        return f"{prefix}New mention"

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
