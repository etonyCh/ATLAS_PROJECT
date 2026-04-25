"""Add analytics materialized views

Revision ID: 5f8a3e1b9c2d
Revises: 412e8feb15b2
Create Date: 2026-04-25 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5f8a3e1b9c2d"
down_revision: Union[str, None] = "412e8feb15b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_contributions AS
        SELECT
            DATE(created_at) as date,
            status,
            COUNT(*) as count
        FROM contribution
        WHERE is_deleted = false
        GROUP BY DATE(created_at), status
    """)

    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_activity_summary AS
        SELECT
            u.id as user_id,
            u.role,
            COALESCE(contrib.count, 0) as total_contributions,
            COALESCE(contrib.approved_count, 0) as approved_contributions,
            COALESCE(flash.count, 0) as total_flashcard_reviews,
            COALESCE(streak.current_streak, 0) as current_streak
        FROM "user" u
        LEFT JOIN (
            SELECT uploader_id, COUNT(*) as count,
                   SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_count
            FROM contribution
            WHERE is_deleted = false
            GROUP BY uploader_id
        ) contrib ON contrib.uploader_id = u.id
        LEFT JOIN (
            SELECT student_id, COUNT(*) as count
            FROM flashcard_review_log
            GROUP BY student_id
        ) flash ON flash.student_id = u.id
        LEFT JOIN userstreak streak ON streak.user_id = u.id
    """)

    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_course_activity AS
        SELECT
            c.id as course_id,
            c.title as course_title,
            COUNT(DISTINCT ce.user_id) as enrolled_students,
            COUNT(DISTINCT contrib.id) as total_contributions,
            COUNT(DISTINCT CASE WHEN contrib.status = 'APPROVED' THEN contrib.id END) as approved_contributions
        FROM course c
        LEFT JOIN course_enrollment ce ON ce.course_id = c.id
        LEFT JOIN contribution ON contribution.course_id = c.id AND contribution.is_deleted = false
        WHERE c.is_deleted = false
        GROUP BY c.id, c.title
    """)

    op.execute("""
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_weekly_stats AS
        SELECT
            date_trunc('week', created_at) as week_start,
            COUNT(*) as total_users,
            SUM(CASE WHEN event_type = 'CONTRIBUTION' THEN 1 ELSE 0 END) as contributions,
            SUM(CASE WHEN event_type = 'REVIEW' THEN 1 ELSE 0 END) as reviews
        FROM activity_log
        WHERE created_at >= NOW() - INTERVAL '90 days'
        GROUP BY date_trunc('week', created_at)
    """)

    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_mv_daily_contributions_date ON mv_daily_contributions(date)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_mv_user_activity_user_id ON mv_user_activity_summary(user_id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_mv_course_activity_course_id ON mv_course_activity(course_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_mv_weekly_stats_week ON mv_weekly_stats(week_start)")


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_weekly_stats CASCADE")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_course_activity CASCADE")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_user_activity_summary CASCADE")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_daily_contributions CASCADE")