"""Remove local users and tenants tables - use Identity service instead.

Revision ID: 20260202_identity
Revises: 20260123_add_worker_id_to_tasks
Create Date: 2026-02-02

This migration:
1. Drops foreign key constraints referencing users and tenants tables
2. Keeps tenant_id and user_id columns (they store Identity UUIDs)
3. Drops the users and tenants tables (data now comes from Identity service)
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260202_identity'
down_revision = '20260123_add_worker_id_to_tasks'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop foreign key constraints on tenant_id columns
    # Note: constraint names may vary - using naming convention from SQLAlchemy

    # Tasks table
    op.drop_constraint('tasks_tenant_id_fkey', 'tasks', type_='foreignkey')
    op.drop_constraint('tasks_user_id_fkey', 'tasks', type_='foreignkey')

    # Projects table
    op.drop_constraint('projects_tenant_id_fkey', 'projects', type_='foreignkey')
    op.drop_constraint('projects_user_id_fkey', 'projects', type_='foreignkey')

    # Drafts table
    op.drop_constraint('drafts_tenant_id_fkey', 'drafts', type_='foreignkey')
    op.drop_constraint('drafts_user_id_fkey', 'drafts', type_='foreignkey')

    # Questions table
    op.drop_constraint('questions_tenant_id_fkey', 'questions', type_='foreignkey')
    op.drop_constraint('questions_user_id_fkey', 'questions', type_='foreignkey')

    # Logs table
    op.drop_constraint('logs_tenant_id_fkey', 'logs', type_='foreignkey')
    op.drop_constraint('logs_user_id_fkey', 'logs', type_='foreignkey')

    # Other tables with tenant_id only
    op.drop_constraint('waiting_items_tenant_id_fkey', 'waiting_items', type_='foreignkey')
    op.drop_constraint('knowledge_tenant_id_fkey', 'knowledge', type_='foreignkey')
    op.drop_constraint('recurring_tasks_tenant_id_fkey', 'recurring_tasks', type_='foreignkey')
    op.drop_constraint('clients_tenant_id_fkey', 'clients', type_='foreignkey')
    op.drop_constraint('sales_opportunities_tenant_id_fkey', 'sales_opportunities', type_='foreignkey')
    op.drop_constraint('playbooks_tenant_id_fkey', 'playbooks', type_='foreignkey')
    op.drop_constraint('people_tenant_id_fkey', 'people', type_='foreignkey')

    # Users table has tenant_id FK
    op.drop_constraint('users_tenant_id_fkey', 'users', type_='foreignkey')

    # Now drop the users and tenants tables
    op.drop_table('users')
    op.drop_table('tenants')


def downgrade() -> None:
    # Recreate tenants table
    op.create_table(
        'tenants',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('database_mode', sa.String(20), nullable=False, server_default='shared'),
        sa.Column('connection_config', sa.Text(), nullable=True),
        sa.Column('tier', sa.String(50), nullable=False, server_default='standard'),
        sa.Column('settings', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )

    # Recreate users table
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('api_key', sa.String(64), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='member'),
        sa.Column('settings', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='UTC'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('api_key'),
        sa.UniqueConstraint('tenant_id', 'email', name='uq_user_tenant_email'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE')
    )

    # Recreate foreign key constraints
    op.create_foreign_key('users_tenant_id_fkey', 'users', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('people_tenant_id_fkey', 'people', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('playbooks_tenant_id_fkey', 'playbooks', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('sales_opportunities_tenant_id_fkey', 'sales_opportunities', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('clients_tenant_id_fkey', 'clients', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('recurring_tasks_tenant_id_fkey', 'recurring_tasks', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('knowledge_tenant_id_fkey', 'knowledge', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('waiting_items_tenant_id_fkey', 'waiting_items', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('logs_user_id_fkey', 'logs', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('logs_tenant_id_fkey', 'logs', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('questions_user_id_fkey', 'questions', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('questions_tenant_id_fkey', 'questions', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('drafts_user_id_fkey', 'drafts', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('drafts_tenant_id_fkey', 'drafts', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('projects_user_id_fkey', 'projects', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('projects_tenant_id_fkey', 'projects', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('tasks_user_id_fkey', 'tasks', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('tasks_tenant_id_fkey', 'tasks', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
