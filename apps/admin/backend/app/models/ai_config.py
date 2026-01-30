"""AI configuration models for managing AI providers, models, and use case mappings."""

import uuid
from sqlalchemy import Column, String, Text, Boolean, ForeignKey, Float, Integer
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUID, JSONB


class AIProvider(Base, TimestampMixin):
    """
    AI provider configuration (Anthropic, OpenAI, etc.).

    Stores provider metadata and the environment variable name for the API key.
    The actual API key is never stored in the database - apps read it from
    their own environment at runtime.
    """

    __tablename__ = "ai_providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Provider identification
    name = Column(String(50), unique=True, nullable=False)  # "anthropic", "openai"
    display_name = Column(String(100), nullable=False)  # "Anthropic", "OpenAI"

    # API configuration - stores env var NAME, not the actual key
    api_key_env_var = Column(String(100), nullable=False)  # "ANTHROPIC_API_KEY"
    base_url = Column(String(500), nullable=True)  # Optional custom endpoint

    # State
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    models = relationship(
        "AIModel",
        back_populates="provider",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<AIProvider {self.name}>"


class AIModel(Base, TimestampMixin):
    """
    Available AI models with their capabilities.

    Each model belongs to a provider and can have specific capabilities
    like text generation, vision, tool use, etc.
    """

    __tablename__ = "ai_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Provider relationship
    provider_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_providers.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Model identification
    model_id = Column(String(100), nullable=False)  # "claude-sonnet-4-0-latest"
    display_name = Column(String(100), nullable=False)  # "Claude Sonnet 4"

    # Model capabilities
    capabilities = Column(JSONB, default=list)  # ["text", "vision", "tools"]

    # State
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    provider = relationship("AIProvider", back_populates="models")
    use_case_configs = relationship(
        "AIUseCaseConfig",
        back_populates="model",
    )

    def __repr__(self) -> str:
        return f"<AIModel {self.model_id}>"


class AIUseCaseConfig(Base, TimestampMixin):
    """
    Maps use cases to models with configuration.

    Use cases like "coding", "analysis_heavy", "summarization" are mapped
    to specific models with optional configuration like max_tokens and temperature.
    """

    __tablename__ = "ai_use_case_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Use case identification
    use_case = Column(String(50), unique=True, nullable=False)  # "coding", "analysis_heavy"
    description = Column(Text, nullable=True)

    # Model mapping
    model_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_models.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Configuration defaults
    max_tokens = Column(Integer, default=4096, nullable=False)
    temperature = Column(Float, default=0.7, nullable=False)

    # State
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    model = relationship("AIModel", back_populates="use_case_configs")

    def __repr__(self) -> str:
        return f"<AIUseCaseConfig {self.use_case}>"
