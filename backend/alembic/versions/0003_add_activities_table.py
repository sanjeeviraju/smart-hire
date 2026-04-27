"""add activities table

Revision ID: 0003_add_activities_table
Revises: 3700e73b96b1
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa


revision = '0003_add_activities_table'
down_revision = '3700e73b96b1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'activities',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('hr_user_id', sa.Integer(), sa.ForeignKey('hr_users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('message', sa.String(length=500), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_activities_hr_user_id', 'activities', ['hr_user_id'])


def downgrade() -> None:
    op.drop_index('ix_activities_hr_user_id', table_name='activities')
    op.drop_table('activities')
