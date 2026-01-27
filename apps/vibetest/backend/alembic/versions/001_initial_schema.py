"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-01-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('settings', postgresql.JSONB, default={}),
        sa.Column('status', sa.String(50), default='active', nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        sa.Column('deleted_at', sa.DateTime, nullable=True),
    )

    # Environments table
    op.create_table(
        'environments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), default='staging', nullable=False),
        sa.Column('base_url', sa.String(500), nullable=False),
        sa.Column('credentials_encrypted', sa.Text, nullable=True),
        sa.Column('is_default', sa.Boolean, default=False, nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )

    # Test cases table
    op.create_table(
        'test_cases',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('preconditions', sa.Text, nullable=True),
        sa.Column('steps', postgresql.JSONB, default=[]),
        sa.Column('expected_results', sa.Text, nullable=True),
        sa.Column('tags', postgresql.JSONB, default=[]),
        sa.Column('priority', sa.String(50), default='medium', nullable=False),
        sa.Column('status', sa.String(50), default='draft', nullable=False),
        sa.Column('execution_type', sa.String(50), default='manual', nullable=False),
        sa.Column('automation_config', postgresql.JSONB, nullable=True),
        sa.Column('created_by', sa.String(50), default='human', nullable=False),
        sa.Column('approved_by', sa.String(255), nullable=True),
        sa.Column('approved_at', sa.DateTime, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        sa.Column('deleted_at', sa.DateTime, nullable=True),
    )

    # Test case history table
    op.create_table(
        'test_cases_history',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('test_case_id', sa.String(36), sa.ForeignKey('test_cases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('changed_by', sa.String(255), nullable=True),
        sa.Column('changed_at', sa.DateTime, nullable=False),
        sa.Column('previous_data', postgresql.JSONB, nullable=True),
        sa.Column('change_type', sa.String(50), nullable=False),
    )

    # Test suites table
    op.create_table(
        'test_suites',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('type', sa.String(50), default='custom', nullable=False),
        sa.Column('test_case_ids', postgresql.JSONB, default=[]),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )

    # Test runs table
    op.create_table(
        'test_runs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('environment_id', sa.String(36), sa.ForeignKey('environments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('suite_id', sa.String(36), sa.ForeignKey('test_suites.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('status', sa.String(50), default='pending', nullable=False),
        sa.Column('started_at', sa.DateTime, nullable=True),
        sa.Column('completed_at', sa.DateTime, nullable=True),
        sa.Column('summary', postgresql.JSONB, nullable=True),
        sa.Column('triggered_by', sa.String(50), default='manual', nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )

    # Test results table
    op.create_table(
        'test_results',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('run_id', sa.String(36), sa.ForeignKey('test_runs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('test_case_id', sa.String(36), sa.ForeignKey('test_cases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(50), default='pending', nullable=False),
        sa.Column('duration_ms', sa.Integer, nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('steps_executed', postgresql.JSONB, nullable=True),
        sa.Column('ai_analysis', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )

    # Artifacts table
    op.create_table(
        'artifacts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('run_id', sa.String(36), sa.ForeignKey('test_runs.id', ondelete='CASCADE'), nullable=True),
        sa.Column('result_id', sa.String(36), sa.ForeignKey('test_results.id', ondelete='CASCADE'), nullable=True),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('metadata', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )

    # Quick start sessions table
    op.create_table(
        'quick_start_sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('credentials_encrypted', sa.Text, nullable=True),
        sa.Column('status', sa.String(50), default='pending', nullable=False),
        sa.Column('progress', sa.Float, default=0, nullable=False),
        sa.Column('progress_message', sa.Text, nullable=True),
        sa.Column('results', postgresql.JSONB, nullable=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )

    # Create indexes
    op.create_index('ix_projects_status', 'projects', ['status'])
    op.create_index('ix_environments_project_id', 'environments', ['project_id'])
    op.create_index('ix_test_cases_project_id', 'test_cases', ['project_id'])
    op.create_index('ix_test_cases_status', 'test_cases', ['status'])
    op.create_index('ix_test_runs_project_id', 'test_runs', ['project_id'])
    op.create_index('ix_test_runs_status', 'test_runs', ['status'])
    op.create_index('ix_test_results_run_id', 'test_results', ['run_id'])
    op.create_index('ix_artifacts_run_id', 'artifacts', ['run_id'])


def downgrade() -> None:
    op.drop_table('quick_start_sessions')
    op.drop_table('artifacts')
    op.drop_table('test_results')
    op.drop_table('test_runs')
    op.drop_table('test_suites')
    op.drop_table('test_cases_history')
    op.drop_table('test_cases')
    op.drop_table('environments')
    op.drop_table('projects')
