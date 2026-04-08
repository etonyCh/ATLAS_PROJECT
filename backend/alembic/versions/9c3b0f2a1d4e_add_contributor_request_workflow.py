"""add contributor request workflow

Revision ID: 9c3b0f2a1d4e
Revises: 6d8a2f4d1b21
Create Date: 2026-04-04 12:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "9c3b0f2a1d4e"
down_revision: Union[str, None] = "6d8a2f4d1b21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    contributorrequeststatus = postgresql.ENUM(
        "PENDING",
        "APPROVED",
        "REJECTED",
        name="contributorrequeststatus",
    )
    contributorrequeststatus.create(op.get_bind(), checkfirst=True)
    contributorrequeststatus_column = postgresql.ENUM(
        "PENDING",
        "APPROVED",
        "REJECTED",
        name="contributorrequeststatus",
        create_type=False,
    )

    op.add_column(
        "user",
        sa.Column("is_contributor", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "user",
        sa.Column("contributor_badge_awarded_at", sa.DateTime(), nullable=True),
    )
    op.create_index(op.f("ix_user_is_contributor"), "user", ["is_contributor"], unique=False)

    op.add_column(
        "contribution",
        sa.Column("is_demo_submission", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        op.f("ix_contribution_is_demo_submission"),
        "contribution",
        ["is_demo_submission"],
        unique=False,
    )

    op.create_table(
        "contributorrequest",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("demo_contribution_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            contributorrequeststatus_column,
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("ocr_quality_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("review_note", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["user.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["demo_contribution_id"], ["contribution.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("demo_contribution_id"),
    )
    op.create_index(
        op.f("ix_contributorrequest_student_id"),
        "contributorrequest",
        ["student_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_contributorrequest_demo_contribution_id"),
        "contributorrequest",
        ["demo_contribution_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_contributorrequest_status"),
        "contributorrequest",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_contributorrequest_created_at"),
        "contributorrequest",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_contributorrequest_created_at"), table_name="contributorrequest")
    op.drop_index(op.f("ix_contributorrequest_status"), table_name="contributorrequest")
    op.drop_index(op.f("ix_contributorrequest_demo_contribution_id"), table_name="contributorrequest")
    op.drop_index(op.f("ix_contributorrequest_student_id"), table_name="contributorrequest")
    op.drop_table("contributorrequest")

    op.drop_index(op.f("ix_contribution_is_demo_submission"), table_name="contribution")
    op.drop_column("contribution", "is_demo_submission")

    op.drop_index(op.f("ix_user_is_contributor"), table_name="user")
    op.drop_column("user", "contributor_badge_awarded_at")
    op.drop_column("user", "is_contributor")

    contributorrequeststatus = postgresql.ENUM(
        "PENDING",
        "APPROVED",
        "REJECTED",
        name="contributorrequeststatus",
    )
    contributorrequeststatus.drop(op.get_bind(), checkfirst=True)
