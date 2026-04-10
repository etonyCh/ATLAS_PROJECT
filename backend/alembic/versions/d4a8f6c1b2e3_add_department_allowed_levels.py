"""add department allowed levels

Revision ID: d4a8f6c1b2e3
Revises: c2f4b8d9e1a7
Create Date: 2026-04-09 15:35:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4a8f6c1b2e3"
down_revision: Union[str, Sequence[str], None] = "c2f4b8d9e1a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "department",
        sa.Column(
            "allowed_levels",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )
    op.alter_column("department", "allowed_levels", server_default=None)


def downgrade() -> None:
    op.drop_column("department", "allowed_levels")
