"""add_domain_manager

Revision ID: af53086ec5c1
Revises: fdc6de22aac0
Create Date: 2026-04-13 16:55:35.160732

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel # Added to support SQLModel specific types if needed


# revision identifiers, used by Alembic.
revision: str = 'af53086ec5c1'
down_revision: Union[str, None] = 'fdc6de22aac0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass