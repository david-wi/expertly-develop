"""Seed script to populate initial AI configuration (providers, models, use cases)."""

import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.config import get_settings
from app.models.ai_config import AIProvider, AIModel, AIUseCaseConfig


# Provider data
PROVIDERS_DATA = [
    {
        "name": "anthropic",
        "display_name": "Anthropic",
        "api_key_env_var": "ANTHROPIC_API_KEY",
        "base_url": None,
    },
    {
        "name": "openai",
        "display_name": "OpenAI",
        "api_key_env_var": "OPENAI_API_KEY",
        "base_url": None,
    },
]

# Model data - model_id is the actual API model identifier
MODELS_DATA = [
    # Anthropic Models
    {
        "provider_name": "anthropic",
        "model_id": "claude-sonnet-4-0-latest",
        "display_name": "Claude Sonnet 4 (Latest)",
        "capabilities": ["text", "vision", "tools", "coding"],
    },
    {
        "provider_name": "anthropic",
        "model_id": "claude-sonnet-4-20250514",
        "display_name": "Claude Sonnet 4 (2025-05-14)",
        "capabilities": ["text", "vision", "tools", "coding"],
    },
    {
        "provider_name": "anthropic",
        "model_id": "claude-3-5-sonnet-latest",
        "display_name": "Claude 3.5 Sonnet (Latest)",
        "capabilities": ["text", "vision", "tools", "coding"],
    },
    {
        "provider_name": "anthropic",
        "model_id": "claude-haiku-3-5-latest",
        "display_name": "Claude Haiku 3.5 (Latest)",
        "capabilities": ["text", "tools"],
    },
    {
        "provider_name": "anthropic",
        "model_id": "claude-opus-4-0-latest",
        "display_name": "Claude Opus 4 (Latest)",
        "capabilities": ["text", "vision", "tools", "coding", "complex_reasoning"],
    },
    # OpenAI Models
    {
        "provider_name": "openai",
        "model_id": "gpt-4o",
        "display_name": "GPT-4o",
        "capabilities": ["text", "vision", "tools"],
    },
    {
        "provider_name": "openai",
        "model_id": "gpt-4o-mini",
        "display_name": "GPT-4o Mini",
        "capabilities": ["text", "vision", "tools"],
    },
    {
        "provider_name": "openai",
        "model_id": "dall-e-3",
        "display_name": "DALL-E 3",
        "capabilities": ["image_generation"],
    },
]

# Use case configurations - maps use cases to default models
USE_CASES_DATA = [
    {
        "use_case": "coding",
        "description": "Code generation and editing, Claude Code-like functionality",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 8192,
        "temperature": 0.3,
    },
    {
        "use_case": "analysis_heavy",
        "description": "Complex analysis, research, deep reasoning tasks",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 8192,
        "temperature": 0.7,
    },
    {
        "use_case": "analysis_medium",
        "description": "Standard analysis tasks requiring good reasoning",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 4096,
        "temperature": 0.7,
    },
    {
        "use_case": "categorization",
        "description": "Classification, tagging, and categorization tasks",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 2048,
        "temperature": 0.3,
    },
    {
        "use_case": "summarization",
        "description": "Text summarization and condensing content",
        "model_id": "claude-haiku-3-5-latest",
        "max_tokens": 4096,
        "temperature": 0.5,
    },
    {
        "use_case": "extraction_simple",
        "description": "Simple data extraction from text",
        "model_id": "claude-haiku-3-5-latest",
        "max_tokens": 2048,
        "temperature": 0.2,
    },
    {
        "use_case": "decisions_simple",
        "description": "Quick yes/no decisions and simple classifications",
        "model_id": "claude-haiku-3-5-latest",
        "max_tokens": 1024,
        "temperature": 0.2,
    },
    {
        "use_case": "image_generation",
        "description": "Avatar and image creation using DALL-E",
        "model_id": "dall-e-3",
        "max_tokens": 0,  # N/A for image generation
        "temperature": 0.0,  # N/A for image generation
    },
    {
        "use_case": "vision",
        "description": "Image analysis and visual understanding",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 4096,
        "temperature": 0.5,
    },
    {
        "use_case": "requirements_parsing",
        "description": "Parsing and extracting requirements from documents",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 8192,
        "temperature": 0.3,
    },
    {
        "use_case": "file_conversion",
        "description": "Converting files to markdown and other formats",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 8192,
        "temperature": 0.2,
    },
    {
        "use_case": "jira_generation",
        "description": "Generating Jira stories and tickets",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 4096,
        "temperature": 0.5,
    },
    {
        "use_case": "page_analysis",
        "description": "Analyzing web pages and UI screenshots",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 4096,
        "temperature": 0.3,
    },
    {
        "use_case": "test_generation",
        "description": "Generating test scripts and test cases",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 8192,
        "temperature": 0.3,
    },
    {
        "use_case": "failure_analysis",
        "description": "Analyzing test failures and suggesting fixes",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 4096,
        "temperature": 0.5,
    },
    {
        "use_case": "code_session",
        "description": "Interactive coding sessions (Vibecode)",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 8192,
        "temperature": 0.3,
    },
    {
        "use_case": "chat",
        "description": "General conversational AI chat",
        "model_id": "claude-sonnet-4-0-latest",
        "max_tokens": 4096,
        "temperature": 0.7,
    },
]


async def seed_ai_config(db: AsyncSession):
    """Seed the initial AI configuration."""
    now = datetime.now(timezone.utc)
    provider_map = {}
    model_map = {}

    # Create providers
    print("Creating providers...")
    for provider_data in PROVIDERS_DATA:
        provider_id = uuid.uuid4()
        provider = AIProvider(
            id=provider_id,
            name=provider_data["name"],
            display_name=provider_data["display_name"],
            api_key_env_var=provider_data["api_key_env_var"],
            base_url=provider_data["base_url"],
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(provider)
        provider_map[provider_data["name"]] = provider_id
        print(f"  Created provider: {provider_data['display_name']}")

    await db.flush()

    # Create models
    print("\nCreating models...")
    for model_data in MODELS_DATA:
        provider_id = provider_map.get(model_data["provider_name"])
        if not provider_id:
            print(f"  Warning: Provider '{model_data['provider_name']}' not found, skipping model")
            continue

        model_uuid = uuid.uuid4()
        model = AIModel(
            id=model_uuid,
            provider_id=provider_id,
            model_id=model_data["model_id"],
            display_name=model_data["display_name"],
            capabilities=model_data["capabilities"],
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(model)
        model_map[model_data["model_id"]] = model_uuid
        print(f"  Created model: {model_data['display_name']}")

    await db.flush()

    # Create use case configurations
    print("\nCreating use case configurations...")
    for uc_data in USE_CASES_DATA:
        model_uuid = model_map.get(uc_data["model_id"])
        if not model_uuid:
            print(f"  Warning: Model '{uc_data['model_id']}' not found, skipping use case '{uc_data['use_case']}'")
            continue

        use_case = AIUseCaseConfig(
            id=uuid.uuid4(),
            use_case=uc_data["use_case"],
            description=uc_data["description"],
            model_id=model_uuid,
            max_tokens=uc_data["max_tokens"],
            temperature=uc_data["temperature"],
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(use_case)
        print(f"  Created use case: {uc_data['use_case']} -> {uc_data['model_id']}")

    await db.commit()
    print("\nAI config seed completed successfully!")


async def main():
    """Main entry point."""
    settings = get_settings()

    engine = create_async_engine(settings.database_url, echo=True)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        await seed_ai_config(session)


if __name__ == "__main__":
    asyncio.run(main())
