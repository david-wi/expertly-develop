"""Remove local users and organizations tables - use Identity service instead.

Revision ID: 003
Revises: 002
Create Date: 2026-02-02

This migration:
1. Drops foreign key constraints referencing users and organizations tables
2. Keeps organization_id columns (they store Identity organization UUIDs)
3. Drops the users and organizations tables (data now comes from Identity service)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop foreign key constraints on organization_id columns
    op.drop_constraint('fk_projects_organization_id', 'projects', type_='foreignkey')
    op.drop_constraint('fk_quick_start_sessions_organization_id', 'quick_start_sessions', type_='foreignkey')

    # Drop users table (shadow records no longer needed)
    op.drop_index('ix_users_role', table_name='users')
    op.drop_index('ix_users_organization_id', table_name='users')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')

    # Drop organizations table (data comes from Identity service)
    op.drop_index('ix_organizations_is_active', table_name='organizations')
    op.drop_index('ix_organizations_slug', table_name='organizations')
    op.drop_table('organizations')


def downgrade() -> None:
    # Recreate organizations table
    op.create_table(
        'organizations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), unique=True, nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('settings', postgresql.JSONB, default={}),
        sa.Column('is_active', sa.Boolean, default=True, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        sa.Column('deleted_at', sa.DateTime, nullable=True),
    )
    op.create_index('ix_organizations_slug', 'organizations', ['slug'], unique=True)
    op.create_index('ix_organizations_is_active', 'organizations', ['is_active'])

    # Recreate users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), default='member', nullable=False),
        sa.Column('is_active', sa.Boolean, default=True, nullable=False),
        sa.Column('is_verified', sa.Boolean, default=False, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        sa.Column('deleted_at', sa.DateTime, nullable=True),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_organization_id', 'users', ['organization_id'])
    op.create_index('ix_users_role', 'users', ['role'])

    # Recreate foreign key constraints
    op.create_foreign_key(
        'fk_projects_organization_id',
        'projects',
        'organizations',
        ['organization_id'],
        ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_quick_start_sessions_organization_id',
        'quick_start_sessions',
        'organizations',
        ['organization_id'],
        ['id'],
        ondelete='CASCADE'
    )
