"""add teacher verification requests

Revision ID: 6d8a2f4d1b21
Revises: 4700fd57582d
Create Date: 2026-04-02 16:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = "6d8a2f4d1b21"
down_revision: Union[str, None] = "4700fd57582d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teacherverificationrequest",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("requested_department", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("requested_domain", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("establishment_id", sa.Uuid(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("PENDING", "APPROVED", "REJECTED", name="teacherrequeststatus"),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("review_note", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["establishment_id"], ["establishment.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["user.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        op.f("ix_teacherverificationrequest_requested_department"),
        "teacherverificationrequest",
        ["requested_department"],
        unique=False,
    )
    op.create_index(
        op.f("ix_teacherverificationrequest_requested_domain"),
        "teacherverificationrequest",
        ["requested_domain"],
        unique=False,
    )
    op.create_index(
        op.f("ix_teacherverificationrequest_status"),
        "teacherverificationrequest",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_teacherverificationrequest_status"), table_name="teacherverificationrequest")
    op.drop_index(op.f("ix_teacherverificationrequest_requested_domain"), table_name="teacherverificationrequest")
    op.drop_index(op.f("ix_teacherverificationrequest_requested_department"), table_name="teacherverificationrequest")
    op.drop_table("teacherverificationrequest")
