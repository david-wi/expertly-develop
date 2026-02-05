"""Add organization_id to ideas table for org-specific backlogs.

Revision ID: 008
Revises: 007
Create Date: 2026-02-04

This migration adds organization_id to support organization-specific backlogs.
NULL = product-wide idea (shared across all orgs)
non-NULL = organization-private backlog item
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add organization_id column (nullable - NULL means product-wide idea)
    op.add_column(
        'ideas',
        sa.Column('organization_id', UUID(as_uuid=True), nullable=True)
    )

    # Add index for efficient filtering by organization
    op.create_index('ix_ideas_organization_id', 'ideas', ['organization_id'])

    # Composite index for org + status queries
    op.create_index('ix_ideas_org_status', 'ideas', ['organization_id', 'status'])


def downgrade() -> None:
    op.drop_index('ix_ideas_org_status', table_name='ideas')
    op.drop_index('ix_ideas_organization_id', table_name='ideas')
    op.drop_column('ideas', 'organization_id')
