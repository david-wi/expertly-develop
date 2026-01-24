"""Add multi-tenancy support

Revision ID: 002
Revises: 001
Create Date: 2026-01-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create organizations table
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

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
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

    # Create David's organization and user account
    # Password is 'david123' hashed with bcrypt
    op.execute("""
        INSERT INTO organizations (id, name, slug, is_active, created_at, updated_at)
        VALUES (
            'david-org-00000-0000-000000000001',
            'David''s Organization',
            'david',
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
    """)

    op.execute("""
        INSERT INTO users (id, organization_id, email, password_hash, full_name, role, is_active, is_verified, created_at, updated_at)
        VALUES (
            'david-user-0000-0000-000000000001',
            'david-org-00000-0000-000000000001',
            'david@bodnick.com',
            '$2b$12$dsX.g0R7VMBUiUT4KQP9se5s5RMyVpkGXlTMyiJPGsW/ZlK0kuI1C',
            'David',
            'owner',
            true,
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
    """)

    # Create a default organization for any existing data (legacy migration)
    op.execute("""
        INSERT INTO organizations (id, name, slug, is_active, created_at, updated_at)
        SELECT
            'default-org-00000-00000-00000000',
            'Default Organization',
            'default',
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        WHERE EXISTS (SELECT 1 FROM projects LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'default')
    """)

    # Add organization_id to projects (nullable initially)
    op.add_column('projects', sa.Column('organization_id', sa.String(36), nullable=True))

    # Migrate existing projects to default organization
    op.execute("""
        UPDATE projects
        SET organization_id = 'default-org-00000-00000-00000000'
        WHERE organization_id IS NULL
    """)

    # Make organization_id NOT NULL and add foreign key
    op.alter_column('projects', 'organization_id', nullable=False)
    op.create_foreign_key(
        'fk_projects_organization_id',
        'projects',
        'organizations',
        ['organization_id'],
        ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_projects_organization_id', 'projects', ['organization_id'])

    # Add organization_id to quick_start_sessions (nullable for unauthenticated sessions)
    op.add_column('quick_start_sessions', sa.Column('organization_id', sa.String(36), nullable=True))
    op.create_foreign_key(
        'fk_quick_start_sessions_organization_id',
        'quick_start_sessions',
        'organizations',
        ['organization_id'],
        ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_quick_start_sessions_organization_id', 'quick_start_sessions', ['organization_id'])


def downgrade() -> None:
    # Remove organization_id from quick_start_sessions
    op.drop_index('ix_quick_start_sessions_organization_id', table_name='quick_start_sessions')
    op.drop_constraint('fk_quick_start_sessions_organization_id', 'quick_start_sessions', type_='foreignkey')
    op.drop_column('quick_start_sessions', 'organization_id')

    # Remove organization_id from projects
    op.drop_index('ix_projects_organization_id', table_name='projects')
    op.drop_constraint('fk_projects_organization_id', 'projects', type_='foreignkey')
    op.drop_column('projects', 'organization_id')

    # Drop users table
    op.drop_index('ix_users_role', table_name='users')
    op.drop_index('ix_users_organization_id', table_name='users')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')

    # Drop organizations table
    op.drop_index('ix_organizations_is_active', table_name='organizations')
    op.drop_index('ix_organizations_slug', table_name='organizations')
    op.drop_table('organizations')
