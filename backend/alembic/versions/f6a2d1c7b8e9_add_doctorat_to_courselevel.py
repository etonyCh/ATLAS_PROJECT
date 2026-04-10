"""add Doctorat to course level enum

Revision ID: f6a2d1c7b8e9
Revises: e1b7c9a4f5d6
Create Date: 2026-04-09 20:20:00.000000
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f6a2d1c7b8e9"
down_revision: Union[str, Sequence[str], None] = "e1b7c9a4f5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE courselevel ADD VALUE IF NOT EXISTS 'Doctorat'")


def downgrade() -> None:
    # PostgreSQL enum value removal is destructive and intentionally omitted.
    pass
