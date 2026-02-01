"""Add test scenarios and test runs tables

Revision ID: 006
Revises: 005
Create Date: 2026-02-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create test_scenarios table
    op.create_table(
        'test_scenarios',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('scenario_key', sa.String(100), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('app_name', sa.String(50), nullable=False),
        sa.Column('category', sa.String(20), nullable=False, server_default='e2e'),
        sa.Column('test_file', sa.String(500), nullable=True),
        sa.Column('steps', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('scenario_key'),
    )

    # Create indexes for test_scenarios
    op.create_index('ix_test_scenarios_scenario_key', 'test_scenarios', ['scenario_key'])
    op.create_index('ix_test_scenarios_app_name', 'test_scenarios', ['app_name'])
    op.create_index('ix_test_scenarios_app_category', 'test_scenarios', ['app_name', 'category'])

    # Create test_runs table
    op.create_table(
        'test_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('scenario_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='running'),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('failed_step', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_stack', sa.Text(), nullable=True),
        sa.Column('step_results', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('environment', sa.String(50), nullable=True),
        sa.Column('run_id', sa.String(100), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['scenario_id'], ['test_scenarios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create indexes for test_runs
    op.create_index('ix_test_runs_scenario_id', 'test_runs', ['scenario_id'])
    op.create_index('ix_test_runs_run_id', 'test_runs', ['run_id'])
    op.create_index('ix_test_runs_scenario_status', 'test_runs', ['scenario_id', 'status'])
    op.create_index('ix_test_runs_environment', 'test_runs', ['environment'])


def downgrade() -> None:
    # Drop test_runs indexes and table
    op.drop_index('ix_test_runs_environment')
    op.drop_index('ix_test_runs_scenario_status')
    op.drop_index('ix_test_runs_run_id')
    op.drop_index('ix_test_runs_scenario_id')
    op.drop_table('test_runs')

    # Drop test_scenarios indexes and table
    op.drop_index('ix_test_scenarios_app_category')
    op.drop_index('ix_test_scenarios_app_name')
    op.drop_index('ix_test_scenarios_scenario_key')
    op.drop_table('test_scenarios')
