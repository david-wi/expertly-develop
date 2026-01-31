"""Add ideas table

Revision ID: 005
Revises: 004
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ideas table
    op.create_table(
        'ideas',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product', sa.String(50), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='new'),
        sa.Column('priority', sa.String(20), nullable=False, server_default='medium'),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_by_email', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create indexes
    op.create_index('ix_ideas_product', 'ideas', ['product'])
    op.create_index('ix_ideas_status', 'ideas', ['status'])
    op.create_index('ix_ideas_priority', 'ideas', ['priority'])
    op.create_index('ix_ideas_product_status', 'ideas', ['product', 'status'])


def downgrade() -> None:
    op.drop_index('ix_ideas_product_status')
    op.drop_index('ix_ideas_priority')
    op.drop_index('ix_ideas_status')
    op.drop_index('ix_ideas_product')
    op.drop_table('ideas')
