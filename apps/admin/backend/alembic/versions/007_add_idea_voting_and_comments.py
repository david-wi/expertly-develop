"""Add idea voting and comments tables.

Revision ID: 007_add_idea_voting_and_comments
Revises: 006_add_test_scenarios
Create Date: 2026-02-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add vote_count column to ideas table
    op.add_column('ideas', sa.Column('vote_count', sa.Integer(), nullable=False, server_default='0'))

    # Create idea_votes table
    op.create_table(
        'idea_votes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('idea_id', UUID(as_uuid=True), sa.ForeignKey('ideas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_email', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_idea_votes_idea_id', 'idea_votes', ['idea_id'])
    op.create_unique_constraint('uq_idea_vote_user', 'idea_votes', ['idea_id', 'user_email'])

    # Create idea_comments table
    op.create_table(
        'idea_comments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('idea_id', UUID(as_uuid=True), sa.ForeignKey('ideas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_email', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_idea_comments_idea_id', 'idea_comments', ['idea_id'])


def downgrade() -> None:
    # Drop idea_comments table
    op.drop_index('ix_idea_comments_idea_id', table_name='idea_comments')
    op.drop_table('idea_comments')

    # Drop idea_votes table
    op.drop_constraint('uq_idea_vote_user', 'idea_votes', type_='unique')
    op.drop_index('ix_idea_votes_idea_id', table_name='idea_votes')
    op.drop_table('idea_votes')

    # Remove vote_count column from ideas
    op.drop_column('ideas', 'vote_count')
