"""add academic asset cache

Revision ID: a7b3c1d9e5f0
Revises: e1b7c9a4f5d6
Create Date: 2026-04-19 13:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a7b3c1d9e5f0"
down_revision: Union[str, Sequence[str], None] = "e1b7c9a4f5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


academicassettype = postgresql.ENUM(
    "FLASHCARDS",
    "QUIZ",
    "SUMMARY",
    "MINDMAP",
    name="academicassettype",
)


def upgrade() -> None:
    academicassettype.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "academicassetcache",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("asset_type", academicassettype, nullable=False),
        sa.Column("target_lang", sa.String(), nullable=False),
        sa.Column("profile", sa.String(), nullable=False),
        sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("chunk_count", sa.Integer(), nullable=False),
        sa.Column("source_pipeline_version", sa.String(), nullable=False),
        sa.Column("model_version", sa.String(), nullable=True),
        sa.Column("is_stale", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["document_version_id"],
            ["documentversion.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "document_version_id",
            "asset_type",
            "target_lang",
            "profile",
            name="uq_academicassetcache_doc_asset_lang_profile",
        ),
    )
    op.create_index(
        op.f("ix_academicassetcache_document_version_id"),
        "academicassetcache",
        ["document_version_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_academicassetcache_asset_type"),
        "academicassetcache",
        ["asset_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_academicassetcache_target_lang"),
        "academicassetcache",
        ["target_lang"],
        unique=False,
    )
    op.create_index(
        op.f("ix_academicassetcache_profile"),
        "academicassetcache",
        ["profile"],
        unique=False,
    )
    op.create_index(
        op.f("ix_academicassetcache_is_stale"),
        "academicassetcache",
        ["is_stale"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_academicassetcache_is_stale"), table_name="academicassetcache")
    op.drop_index(op.f("ix_academicassetcache_profile"), table_name="academicassetcache")
    op.drop_index(op.f("ix_academicassetcache_target_lang"), table_name="academicassetcache")
    op.drop_index(op.f("ix_academicassetcache_asset_type"), table_name="academicassetcache")
    op.drop_index(op.f("ix_academicassetcache_document_version_id"), table_name="academicassetcache")
    op.drop_table("academicassetcache")
    academicassettype.drop(op.get_bind(), checkfirst=True)
