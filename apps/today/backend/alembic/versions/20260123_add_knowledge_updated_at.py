"""Add updated_at to knowledge table

Revision ID: 20260123_knowledge_updated_at
Revises: 20260123_worker_id
Create Date: 2026-01-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone


# revision identifiers, used by Alembic.
revision: str = '20260123_knowledge_updated_at'
down_revision: Union[str, None] = '20260123_worker_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add updated_at column to knowledge table
    op.add_column('knowledge', sa.Column('updated_at', sa.DateTime(timezone=True),
                                         server_default=sa.func.now(), nullable=True))

    # Update existing rows to have updated_at = created_at
    op.execute("UPDATE knowledge SET updated_at = created_at WHERE updated_at IS NULL")


def downgrade() -> None:
    op.drop_column('knowledge', 'updated_at')
