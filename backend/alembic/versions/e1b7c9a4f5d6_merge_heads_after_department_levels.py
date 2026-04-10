"""merge heads after department levels

Revision ID: e1b7c9a4f5d6
Revises: 185935515768, d4a8f6c1b2e3
Create Date: 2026-04-09 15:45:00.000000
"""

from typing import Sequence, Union


revision: str = "e1b7c9a4f5d6"
down_revision: Union[str, Sequence[str], None] = ("185935515768", "d4a8f6c1b2e3")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
