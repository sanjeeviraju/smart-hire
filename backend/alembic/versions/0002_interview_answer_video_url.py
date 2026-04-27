"""add interview answer video url

Revision ID: 0002_interview_answer_video_url
Revises: 0001_initial
Create Date: 2026-04-11
"""

from alembic import op
import sqlalchemy as sa


revision = '0002_interview_answer_video_url'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('interview_answers', sa.Column('video_url', sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column('interview_answers', 'video_url')
