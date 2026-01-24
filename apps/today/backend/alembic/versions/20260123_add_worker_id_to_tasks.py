"""Add worker_id to tasks for multi-agent support

Revision ID: 20260123_worker_id
Revises:
Create Date: 2026-01-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260123_worker_id'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add worker_id column to tasks table
    op.add_column('tasks', sa.Column('worker_id', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'worker_id')
