"""Initial schema with all core tables.

Revision ID: 001
Revises:
Create Date: 2026-01-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tenants
    op.create_table(
        'tenants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), unique=True, nullable=False),
        sa.Column('database_mode', sa.String(20), nullable=False, server_default='shared'),
        sa.Column('connection_config', sa.Text, nullable=True),
        sa.Column('tier', sa.String(50), nullable=False, server_default='standard'),
        sa.Column('settings', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('api_key', sa.String(64), unique=True, nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='member'),
        sa.Column('settings', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='UTC'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('tenant_id', 'email', name='uq_user_tenant_email'),
    )

    # Projects
    op.create_table(
        'projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('project_type', sa.String(50), nullable=False, server_default='project'),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('priority_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('success_criteria', sa.Text, nullable=True),
        sa.Column('target_date', sa.Date, nullable=True),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Questions (create before tasks due to FK)
    op.create_table(
        'questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('text', sa.Text, nullable=False),
        sa.Column('context', sa.Text, nullable=True),
        sa.Column('why_asking', sa.Text, nullable=True),
        sa.Column('what_claude_will_do', sa.Text, nullable=True),
        sa.Column('priority', sa.Integer, nullable=False, server_default='3'),
        sa.Column('priority_reason', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='unanswered'),
        sa.Column('answer', sa.Text, nullable=True),
        sa.Column('answered_at', sa.String(50), nullable=True),
        sa.Column('answered_by', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('priority >= 1 AND priority <= 5', name='ck_question_priority'),
    )

    # Tasks
    op.create_table(
        'tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('priority', sa.Integer, nullable=False, server_default='3'),
        sa.Column('status', sa.String(50), nullable=False, server_default='queued'),
        sa.Column('assignee', sa.String(50), nullable=False, server_default='claude'),
        sa.Column('due_date', sa.String(50), nullable=True),
        sa.Column('started_at', sa.String(50), nullable=True),
        sa.Column('completed_at', sa.String(50), nullable=True),
        sa.Column('blocking_question_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('questions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('context', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('output', sa.Text, nullable=True),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('priority >= 1 AND priority <= 5', name='ck_task_priority'),
    )

    # Question-Task unblock relationship
    op.create_table(
        'question_unblocks',
        sa.Column('question_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('questions.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
    )

    # Clients
    op.create_table(
        'clients',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # People
    op.create_table(
        'people',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('company', sa.String(255), nullable=True),
        sa.Column('relationship', sa.String(100), nullable=True),
        sa.Column('relationship_to_user', sa.Text, nullable=True),
        sa.Column('political_context', sa.Text, nullable=True),
        sa.Column('communication_notes', sa.Text, nullable=True),
        sa.Column('last_contact', sa.String(50), nullable=True),
        sa.Column('next_follow_up', sa.String(50), nullable=True),
        sa.Column('context_notes', sa.Text, nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Task-Person relationship
    op.create_table(
        'task_people',
        sa.Column('task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('person_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('people.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('role', sa.String(50), nullable=True),
    )

    # Drafts
    op.create_table(
        'drafts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='SET NULL'), nullable=True),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('recipient', sa.String(255), nullable=True),
        sa.Column('subject', sa.String(500), nullable=True),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('feedback', sa.Text, nullable=True),
        sa.Column('revision_of_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('drafts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('relationship_context', postgresql.JSONB, nullable=True),
        sa.Column('approved_at', sa.String(50), nullable=True),
        sa.Column('sent_at', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Playbooks
    op.create_table(
        'playbooks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('triggers', postgresql.ARRAY(sa.String), nullable=False, server_default='{}'),
        sa.Column('must_consult', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('scripts', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('references', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('examples', postgresql.JSONB, nullable=False, server_default='[]'),
        sa.Column('learned_from', sa.Text, nullable=True),
        sa.Column('source_task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='SET NULL'), nullable=True),
        sa.Column('last_used', sa.String(50), nullable=True),
        sa.Column('use_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Knowledge
    op.create_table(
        'knowledge',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source_task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='SET NULL'), nullable=True),
        sa.Column('source_type', sa.String(50), nullable=False),
        sa.Column('trigger_phrase', sa.String(255), nullable=True),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('routed_to_type', sa.String(50), nullable=True),
        sa.Column('routed_to_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='captured'),
        sa.Column('learned_at', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Recurring Tasks
    op.create_table(
        'recurring_tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('task_template', postgresql.JSONB, nullable=False),
        sa.Column('frequency', sa.String(50), nullable=False),
        sa.Column('cron_expression', sa.String(100), nullable=True),
        sa.Column('last_run', sa.String(50), nullable=True),
        sa.Column('next_run', sa.String(50), nullable=False),
        sa.Column('active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Waiting Items
    op.create_table(
        'waiting_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='SET NULL'), nullable=True),
        sa.Column('person_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('people.id', ondelete='SET NULL'), nullable=True),
        sa.Column('what', sa.Text, nullable=False),
        sa.Column('who', sa.String(255), nullable=True),
        sa.Column('since', sa.String(50), nullable=True),
        sa.Column('follow_up_date', sa.String(50), nullable=True),
        sa.Column('why_it_matters', sa.Text, nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='waiting'),
        sa.Column('resolved_at', sa.String(50), nullable=True),
        sa.Column('resolution_notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Sales Opportunities
    op.create_table(
        'sales_opportunities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('stage', sa.String(50), nullable=False, server_default='lead'),
        sa.Column('value', sa.Numeric(12, 2), nullable=True),
        sa.Column('probability', sa.Integer, nullable=True),
        sa.Column('expected_close_date', sa.Date, nullable=True),
        sa.Column('last_activity', sa.String(50), nullable=True),
        sa.Column('next_action', sa.Text, nullable=True),
        sa.Column('next_action_date', sa.Date, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('closed_at', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('probability IS NULL OR (probability >= 0 AND probability <= 100)', name='ck_opportunity_probability'),
    )

    # Logs
    op.create_table(
        'logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('timestamp', sa.String(50), nullable=False),
        sa.Column('actor', sa.String(50), nullable=False, server_default='claude'),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('details', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('session_id', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Indexes
    op.create_index('idx_tasks_next', 'tasks', ['tenant_id', 'status', 'priority', 'created_at'])
    op.create_index('idx_tasks_user_status', 'tasks', ['tenant_id', 'status'])
    op.create_index('idx_tasks_project', 'tasks', ['project_id'])
    op.create_index('idx_questions_unanswered', 'questions', ['tenant_id', 'priority', 'created_at'])
    op.create_index('idx_people_client', 'people', ['client_id'])
    op.create_index('idx_people_tenant', 'people', ['tenant_id'])
    op.create_index('idx_playbooks_tenant', 'playbooks', ['tenant_id'])
    op.create_index('idx_knowledge_status', 'knowledge', ['tenant_id', 'status'])
    op.create_index('idx_logs_user_time', 'logs', ['tenant_id', 'timestamp'])
    op.create_index('idx_logs_entity', 'logs', ['entity_type', 'entity_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_logs_entity')
    op.drop_index('idx_logs_user_time')
    op.drop_index('idx_knowledge_status')
    op.drop_index('idx_playbooks_tenant')
    op.drop_index('idx_people_tenant')
    op.drop_index('idx_people_client')
    op.drop_index('idx_questions_unanswered')
    op.drop_index('idx_tasks_project')
    op.drop_index('idx_tasks_user_status')
    op.drop_index('idx_tasks_next')

    # Drop tables in reverse order
    op.drop_table('logs')
    op.drop_table('sales_opportunities')
    op.drop_table('waiting_items')
    op.drop_table('recurring_tasks')
    op.drop_table('knowledge')
    op.drop_table('playbooks')
    op.drop_table('drafts')
    op.drop_table('task_people')
    op.drop_table('people')
    op.drop_table('clients')
    op.drop_table('question_unblocks')
    op.drop_table('tasks')
    op.drop_table('questions')
    op.drop_table('projects')
    op.drop_table('users')
    op.drop_table('tenants')
