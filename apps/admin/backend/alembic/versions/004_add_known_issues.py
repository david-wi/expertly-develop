"""Add known_issues table

Revision ID: 004
Revises: 003
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create known_issues table
    op.create_table(
        'known_issues',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('app_name', sa.String(50), nullable=True),
        sa.Column('severity', sa.String(20), nullable=False, server_default='minor'),
        sa.Column('status', sa.String(20), nullable=False, server_default='open'),
        sa.Column('workaround', sa.Text(), nullable=True),
        sa.Column('affected_version', sa.String(50), nullable=True),
        sa.Column('resolved_version', sa.String(50), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create indexes
    op.create_index('ix_known_issues_app_name', 'known_issues', ['app_name'])
    op.create_index('ix_known_issues_status', 'known_issues', ['status'])
    op.create_index('ix_known_issues_severity', 'known_issues', ['severity'])
    op.create_index('ix_known_issues_app_status', 'known_issues', ['app_name', 'status'])


def downgrade() -> None:
    op.drop_index('ix_known_issues_app_status')
    op.drop_index('ix_known_issues_severity')
    op.drop_index('ix_known_issues_status')
    op.drop_index('ix_known_issues_app_name')
    op.drop_table('known_issues')
