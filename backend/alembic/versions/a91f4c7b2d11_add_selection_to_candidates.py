"""add_selection_to_candidates

Revision ID: a91f4c7b2d11
Revises: 64cad042c585
Create Date: 2026-04-22 22:05:00
"""

from alembic import op
import sqlalchemy as sa


revision = 'a91f4c7b2d11'
down_revision = '64cad042c585'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('candidates', sa.Column('selection', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('candidates', 'selection')
