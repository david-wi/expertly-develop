"""Add error_logs table

Revision ID: 002
Revises: 001
Create Date: 2025-01-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create error_logs table
    op.create_table(
        'error_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('app_name', sa.String(50), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=False),
        sa.Column('stack_trace', sa.Text(), nullable=True),
        sa.Column('url', sa.String(500), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_email', sa.String(255), nullable=True),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('browser_info', sa.String(500), nullable=True),
        sa.Column('additional_context', postgresql.JSONB(), nullable=True),
        sa.Column('severity', sa.String(20), nullable=False, server_default='error'),
        sa.Column('status', sa.String(20), nullable=False, server_default='new'),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create indexes
    op.create_index('ix_error_logs_app_name', 'error_logs', ['app_name'])
    op.create_index('ix_error_logs_occurred_at', 'error_logs', ['occurred_at'])
    op.create_index('ix_error_logs_status', 'error_logs', ['status'])
    op.create_index('ix_error_logs_severity', 'error_logs', ['severity'])
    op.create_index('ix_error_logs_app_status', 'error_logs', ['app_name', 'status'])


def downgrade() -> None:
    op.drop_index('ix_error_logs_app_status')
    op.drop_index('ix_error_logs_severity')
    op.drop_index('ix_error_logs_status')
    op.drop_index('ix_error_logs_occurred_at')
    op.drop_index('ix_error_logs_app_name')
    op.drop_table('error_logs')
