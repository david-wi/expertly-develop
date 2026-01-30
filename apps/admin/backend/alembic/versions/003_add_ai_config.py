"""Add AI configuration tables

Revision ID: 003
Revises: 002
Create Date: 2025-01-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ai_providers table
    op.create_table(
        'ai_providers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('display_name', sa.String(100), nullable=False),
        sa.Column('api_key_env_var', sa.String(100), nullable=False),
        sa.Column('base_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_ai_providers_name'),
    )

    # Create ai_models table
    op.create_table(
        'ai_models',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('model_id', sa.String(100), nullable=False),
        sa.Column('display_name', sa.String(100), nullable=False),
        sa.Column('capabilities', postgresql.JSONB(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['provider_id'], ['ai_providers.id'], ondelete='CASCADE'),
    )

    # Create ai_use_case_configs table
    op.create_table(
        'ai_use_case_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('use_case', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('max_tokens', sa.Integer(), nullable=False, server_default='4096'),
        sa.Column('temperature', sa.Float(), nullable=False, server_default='0.7'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['model_id'], ['ai_models.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('use_case', name='uq_ai_use_case_configs_use_case'),
    )

    # Create indexes
    op.create_index('ix_ai_providers_name', 'ai_providers', ['name'])
    op.create_index('ix_ai_providers_is_active', 'ai_providers', ['is_active'])
    op.create_index('ix_ai_models_provider_id', 'ai_models', ['provider_id'])
    op.create_index('ix_ai_models_model_id', 'ai_models', ['model_id'])
    op.create_index('ix_ai_models_is_active', 'ai_models', ['is_active'])
    op.create_index('ix_ai_use_case_configs_use_case', 'ai_use_case_configs', ['use_case'])
    op.create_index('ix_ai_use_case_configs_model_id', 'ai_use_case_configs', ['model_id'])
    op.create_index('ix_ai_use_case_configs_is_active', 'ai_use_case_configs', ['is_active'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_ai_use_case_configs_is_active')
    op.drop_index('ix_ai_use_case_configs_model_id')
    op.drop_index('ix_ai_use_case_configs_use_case')
    op.drop_index('ix_ai_models_is_active')
    op.drop_index('ix_ai_models_model_id')
    op.drop_index('ix_ai_models_provider_id')
    op.drop_index('ix_ai_providers_is_active')
    op.drop_index('ix_ai_providers_name')

    # Drop tables
    op.drop_table('ai_use_case_configs')
    op.drop_table('ai_models')
    op.drop_table('ai_providers')
