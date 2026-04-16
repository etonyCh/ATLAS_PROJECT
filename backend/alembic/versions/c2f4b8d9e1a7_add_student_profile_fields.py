"""add student profile fields

Revision ID: c2f4b8d9e1a7
Revises: b5d6a4f3c210
Create Date: 2026-04-09 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c2f4b8d9e1a7"
down_revision = "b5d6a4f3c210"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user", sa.Column("student_id", sa.String(), nullable=True))
    op.add_column("user", sa.Column("program", sa.String(), nullable=True))
    op.add_column("user", sa.Column("academic_year", sa.String(), nullable=True))
    op.add_column("user", sa.Column("date_of_birth", sa.Date(), nullable=True))
    op.add_column("user", sa.Column("gender", sa.String(), nullable=True))
    op.add_column("user", sa.Column("phone_number", sa.String(), nullable=True))
    op.add_column("user", sa.Column("address", sa.String(), nullable=True))
    op.add_column("user", sa.Column("preferred_language", sa.String(), nullable=True))
    op.add_column("user", sa.Column("profile_picture_url", sa.String(), nullable=True))
    op.create_index(op.f("ix_user_student_id"), "user", ["student_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_student_id"), table_name="user")
    op.drop_column("user", "profile_picture_url")
    op.drop_column("user", "preferred_language")
    op.drop_column("user", "address")
    op.drop_column("user", "phone_number")
    op.drop_column("user", "gender")
    op.drop_column("user", "date_of_birth")
    op.drop_column("user", "academic_year")
    op.drop_column("user", "program")
    op.drop_column("user", "student_id")
