"""add hiring status to job descriptions

Revision ID: b12f9d4e6a21
Revises: a91f4c7b2d11
Create Date: 2026-04-27 18:25:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b12f9d4e6a21'
down_revision = 'a91f4c7b2d11'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'job_descriptions',
        sa.Column('hiring_status', sa.String(length=32), nullable=False, server_default='active'),
    )
    op.execute(
        "UPDATE job_descriptions SET hiring_status = 'active' "
        "WHERE hiring_status IS NULL OR hiring_status = ''"
    )
    op.alter_column('job_descriptions', 'hiring_status', server_default=None)


def downgrade() -> None:
    op.drop_column('job_descriptions', 'hiring_status')
