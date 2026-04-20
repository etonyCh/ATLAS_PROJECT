"""Merge all heads

Revision ID: cf6fe33b8970
Revises: 9e2d7f1b3a5c, a7b3c1d9e5f0
Create Date: 2026-04-20 20:58:16.741989

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel # Added to support SQLModel specific types if needed


# revision identifiers, used by Alembic.
revision: str = 'cf6fe33b8970'
down_revision: Union[str, None] = ('9e2d7f1b3a5c', 'a7b3c1d9e5f0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass