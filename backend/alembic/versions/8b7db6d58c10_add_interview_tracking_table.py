"""add interview tracking table

Revision ID: 8b7db6d58c10
Revises: 7f2e4b1c9d10
Create Date: 2026-04-21
"""

from alembic import op
import sqlalchemy as sa


revision = '8b7db6d58c10'
down_revision = '7f2e4b1c9d10'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'interviews',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('candidate_id', sa.Integer(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('jd_id', sa.Integer(), sa.ForeignKey('job_descriptions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('force_sent_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('email_sent', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('token', name='uq_interviews_token'),
    )
    op.create_index('ix_interviews_id', 'interviews', ['id'])
    op.create_index('ix_interviews_candidate_id', 'interviews', ['candidate_id'])
    op.create_index('ix_interviews_jd_id', 'interviews', ['jd_id'])
    op.create_index('ix_interviews_token', 'interviews', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_interviews_token', table_name='interviews')
    op.drop_index('ix_interviews_jd_id', table_name='interviews')
    op.drop_index('ix_interviews_candidate_id', table_name='interviews')
    op.drop_index('ix_interviews_id', table_name='interviews')
    op.drop_table('interviews')
