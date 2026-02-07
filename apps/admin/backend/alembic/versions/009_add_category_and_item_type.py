"""Add category and item_type columns to ideas table.

Revision ID: 009
Revises: 008
Create Date: 2026-02-07

Adds:
- category (String(100), nullable) — extracted from [Category] prefix in title
- item_type (String(20), default 'idea', not null) — 'idea' or 'feature'

Data migration:
- Parse titles matching [Category] prefix → set category, strip prefix from title
- Set item_type='feature' for all TMS ideas (intended as development tasks)
"""
import re
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None

# Pattern to match [Category] prefix in titles
CATEGORY_PATTERN = re.compile(r'^\[(.+?)\]\s*(.*)')


def upgrade() -> None:
    # Add new columns
    op.add_column(
        'ideas',
        sa.Column('category', sa.String(100), nullable=True)
    )
    op.add_column(
        'ideas',
        sa.Column('item_type', sa.String(20), nullable=False, server_default='idea')
    )

    # Add index for category queries
    op.create_index('ix_ideas_category', 'ideas', ['category'])
    op.create_index('ix_ideas_item_type', 'ideas', ['item_type'])

    # Data migration: parse [Category] from titles
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, title FROM ideas")).fetchall()

    for row in rows:
        match = CATEGORY_PATTERN.match(row.title)
        if match:
            category = match.group(1).strip()
            clean_title = match.group(2).strip()
            conn.execute(
                sa.text("UPDATE ideas SET category = :category, title = :title WHERE id = :id"),
                {"category": category, "title": clean_title, "id": row.id}
            )

    # Set item_type='feature' for all TMS ideas
    conn.execute(
        sa.text("UPDATE ideas SET item_type = 'feature' WHERE product = 'tms'")
    )


def downgrade() -> None:
    # Restore [Category] prefix to titles before dropping the column
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, title, category FROM ideas WHERE category IS NOT NULL")
    ).fetchall()

    for row in rows:
        restored_title = f"[{row.category}] {row.title}"
        conn.execute(
            sa.text("UPDATE ideas SET title = :title WHERE id = :id"),
            {"title": restored_title, "id": row.id}
        )

    op.drop_index('ix_ideas_item_type', table_name='ideas')
    op.drop_index('ix_ideas_category', table_name='ideas')
    op.drop_column('ideas', 'item_type')
    op.drop_column('ideas', 'category')
