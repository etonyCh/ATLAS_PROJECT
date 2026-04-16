"""Migrate course metadata to contribution

Revision ID: 9e2d7f1b3a5c
Revises: 31f866632366
Create Date: 2026-04-15 15:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9e2d7f1b3a5c'
down_revision: Union[str, None] = '31f866632366'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add columns to contribution table
    # We use existing enums coursetype and courselanguage
    op.add_column('contribution', sa.Column('course_type', postgresql.ENUM('LECTURE', 'TD', 'TP', 'EXAM', 'SUMMARY', 'OTHER', name='coursetype', create_type=False), nullable=True))
    op.add_column('contribution', sa.Column('language', postgresql.ENUM('FR', 'EN', 'AR', name='courselanguage', create_type=False), nullable=True))
    
    # 2. Update existing contributions to reasonable defaults (Optional, but good for safety)
    op.execute("UPDATE contribution SET course_type = 'LECTURE' WHERE course_type IS NULL")
    op.execute("UPDATE contribution SET language = 'FR' WHERE language IS NULL")
    
    # 3. Apply NOT NULL constraints after defaults (optional, but keep nullable to match new logic)
    # Actually, keep them nullable for now or set them to match your model defaults.
    # In my model I set them with defaults in Python, but it's better to have them as NOT NULL in DB if possible.
    # Let's keep them nullable to avoid issues during the very first deployment step.
    
    # 4. Remove columns from course table
    op.drop_index(op.f('ix_course_course_type'), table_name='course')
    op.drop_index(op.f('ix_course_language'), table_name='course')
    op.drop_column('course', 'course_type')
    op.drop_column('course', 'language')
    
    # 5. Add indices to contribution for the new fields
    op.create_index(op.f('ix_contribution_course_type'), 'contribution', ['course_type'], unique=False)
    op.create_index(op.f('ix_contribution_language'), 'contribution', ['language'], unique=False)


def downgrade() -> None:
    # Downgrade logic to restore columns to course table
    op.add_column('course', sa.Column('language', postgresql.ENUM('FR', 'EN', 'AR', name='courselanguage', create_type=False), autoincrement=False, nullable=True))
    op.add_column('course', sa.Column('course_type', postgresql.ENUM('LECTURE', 'TD', 'TP', 'EXAM', 'SUMMARY', 'OTHER', name='coursetype', create_type=False), autoincrement=False, nullable=True))
    
    op.create_index(op.f('ix_course_language'), 'course', ['language'], unique=False)
    op.create_index(op.f('ix_course_course_type'), 'course', ['course_type'], unique=False)
    
    # Remove columns from contribution
    op.drop_index(op.f('ix_contribution_language'), table_name='contribution')
    op.drop_index(op.f('ix_contribution_course_type'), table_name='contribution')
    op.drop_column('contribution', 'language')
    op.drop_column('contribution', 'course_type')
