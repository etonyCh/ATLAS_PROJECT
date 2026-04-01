from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import require_role
from app.models.all_models import Notification
from app.models.annotation import DocumentAnnotation
from app.models.collaboration import ForumPost, ForumReply
from app.models.contribution import Contribution, DocumentVersion
from app.models.course import Course
from app.models.gamification import XPTransaction
from app.models.study_tools import FlashcardDeck, QuizSession
from app.models.user import User


router = APIRouter(tags=["Dashboard"])
REPORT_TITLE_PREFIX = "Feedback received: "


@router.get("/students/me/dashboard")
async def student_dashboard(
    current_user: User = Depends(require_role("STUDENT")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    quiz_count = (
        await db.execute(select(func.count(QuizSession.id)).where(QuizSession.student_id == current_user.id))
    ).scalar_one()
    deck_count = (
        await db.execute(select(func.count(FlashcardDeck.id)).where(FlashcardDeck.student_id == current_user.id))
    ).scalar_one()
    xp_total = (
        await db.execute(select(func.coalesce(func.sum(XPTransaction.amount), 0)).where(XPTransaction.user_id == current_user.id))
    ).scalar_one()
    return {
        "user": {
            "id": str(current_user.id),
            "full_name": current_user.full_name,
            "filiere": current_user.filiere,
            "level": current_user.level,
        },
        "stats": {
            "quizzes_taken": int(quiz_count or 0),
            "flashcard_decks": int(deck_count or 0),
            "xp_total": int(xp_total or 0),
        },
    }


@router.get("/students/me/history")
async def student_history(
    current_user: User = Depends(require_role("STUDENT")),
    db: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(XPTransaction).where(XPTransaction.user_id == current_user.id).order_by(desc(XPTransaction.created_at)).limit(100)
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(item.id),
            "type": item.type,
            "amount": item.amount,
            "created_at": item.created_at,
        }
        for item in rows
    ]


@router.get("/teacher/analytics")
async def teacher_analytics(
    current_user: User = Depends(require_role("TEACHER", "ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    quarter_start = now - timedelta(days=90)

    # Base contribution stats
    summary_row = (
        await db.execute(
            select(
                func.count(Contribution.id),
                func.count(func.distinct(Contribution.course_id)),
                func.sum(case((Contribution.status == "APPROVED", 1), else_=0)),
                func.sum(case((Contribution.status == "PENDING", 1), else_=0)),
                func.sum(case((Contribution.status == "REJECTED", 1), else_=0)),
                func.sum(case((Contribution.created_at >= week_start, 1), else_=0)),
                func.sum(case((Contribution.created_at >= month_start, 1), else_=0)),
            ).where(Contribution.uploader_id == current_user.id)
        )
    ).one()

    # Document version stats (views, downloads)
    doc_stats = (
        await db.execute(
            select(
                func.count(DocumentVersion.id),
                func.sum(DocumentVersion.view_count),
                func.sum(DocumentVersion.download_count),
            )
            .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
            .where(Contribution.uploader_id == current_user.id)
        )
    ).one()

    # Student engagement: annotations on teacher's documents
    annotation_count = (
        await db.execute(
            select(func.count(DocumentAnnotation.id))
            .join(DocumentVersion, DocumentVersion.id == DocumentAnnotation.document_version_id)
            .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
            .where(Contribution.uploader_id == current_user.id)
        )
    ).scalar_one()

    # Forum activity by teacher
    forum_posts = (
        await db.execute(
            select(func.count(ForumPost.id))
            .where(ForumPost.author_id == current_user.id)
        )
    ).scalar_one()
    forum_replies = (
        await db.execute(
            select(func.count(ForumReply.id))
            .where(ForumReply.author_id == current_user.id)
        )
    ).scalar_one()

    # Weekly trend data (last 12 weeks)
    weeks = 12
    trend_data = []
    for i in range(weeks):
        week_end = now - timedelta(weeks=i)
        week_begin = week_end - timedelta(weeks=1)
        trend_row = (
            await db.execute(
                select(
                    func.count(Contribution.id),
                    func.sum(case((Contribution.status == "APPROVED", 1), else_=0)),
                )
                .where(
                    Contribution.uploader_id == current_user.id,
                    Contribution.created_at >= week_begin,
                    Contribution.created_at < week_end,
                )
            )
        ).one()
        trend_data.append({
            "week": f"W-{weeks - i}",
            "uploads": int(trend_row[0] or 0),
            "approved": int(trend_row[1] or 0),
        })

    # Top courses with engagement metrics
    top_courses_rows = (
        await db.execute(
            select(
                Course.id,
                Course.title,
                Course.code,
                func.count(Contribution.id).label("uploads"),
                func.sum(case((Contribution.status == "APPROVED", 1), else_=0)).label("approved_uploads"),
                func.max(Contribution.created_at).label("last_submission_at"),
            )
            .join(Contribution, Contribution.course_id == Course.id)
            .where(Contribution.uploader_id == current_user.id)
            .group_by(Course.id, Course.title, Course.code)
            .order_by(desc("uploads"), desc("last_submission_at"))
            .limit(5)
        )
    ).all()

    # Calculate engagement rate (approved / total)
    total_uploads = int(summary_row[0] or 0)
    approved_uploads = int(summary_row[2] or 0)
    engagement_rate = (approved_uploads / total_uploads * 100) if total_uploads > 0 else 0.0

    return {
        "summary": {
            "total_courses": int(summary_row[1] or 0),
            "total_uploads": total_uploads,
            "approved_uploads": approved_uploads,
            "pending_uploads": int(summary_row[3] or 0),
            "rejected_uploads": int(summary_row[4] or 0),
            "engagement_rate": round(engagement_rate, 2),
        },
        "activity": {
            "recent_uploads_7d": int(summary_row[5] or 0),
            "recent_uploads_30d": int(summary_row[6] or 0),
            "weekly_trend": trend_data,
        },
        "engagement": {
            "total_document_views": int(doc_stats[1] or 0),
            "total_downloads": int(doc_stats[2] or 0),
            "student_annotations": int(annotation_count or 0),
            "forum_posts": int(forum_posts or 0),
            "forum_replies": int(forum_replies or 0),
            "total_interactions": int(annotation_count or 0) + int(forum_posts or 0) + int(forum_replies or 0),
        },
        "top_courses": [
            {
                "course_id": str(row[0]),
                "title": row[1],
                "code": row[2],
                "uploads": int(row[3] or 0),
                "approved_uploads": int(row[4] or 0),
                "last_submission_at": row[5],
            }
            for row in top_courses_rows
        ],
        "period": {
            "current_week_start": week_start.isoformat(),
            "current_month_start": month_start.isoformat(),
            "quarter_start": quarter_start.isoformat(),
        },
    }


@router.get("/teacher/courses/{course_id}/analytics")
async def teacher_course_analytics(
    course_id: UUID,
    _current_user: User = Depends(require_role("TEACHER", "ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    # Document version stats
    doc_stats = (
        await db.execute(
            select(
                func.count(DocumentVersion.id),
                func.sum(DocumentVersion.view_count),
                func.sum(DocumentVersion.download_count),
            )
            .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
            .where(Contribution.course_id == course_id)
        )
    ).one()

    # Student annotations on course documents
    annotation_count = (
        await db.execute(
            select(func.count(DocumentAnnotation.id))
            .join(DocumentVersion, DocumentVersion.id == DocumentAnnotation.document_version_id)
            .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
            .where(Contribution.course_id == course_id)
        )
    ).scalar_one()

    # Unique students who engaged with course materials
    unique_students = (
        await db.execute(
            select(func.count(func.distinct(DocumentAnnotation.user_id)))
            .join(DocumentVersion, DocumentVersion.id == DocumentAnnotation.document_version_id)
            .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
            .where(Contribution.course_id == course_id)
        )
    ).scalar_one()

    # Forum posts for this course
    forum_posts = (
        await db.execute(
            select(func.count(ForumPost.id))
            .where(ForumPost.course_id == course_id)
        )
    ).scalar_one()

    # Study tools activity
    flashcard_decks = (
        await db.execute(
            select(func.count(FlashcardDeck.id))
            .where(FlashcardDeck.course_id == course_id)
        )
    ).scalar_one()

    quiz_sessions = (
        await db.execute(
            select(func.count(QuizSession.id))
            .where(QuizSession.course_id == course_id)
        )
    ).scalar_one()

    return {
        "course_id": str(course_id),
        "documents": {
            "total_versions": int(doc_stats[0] or 0),
            "total_views": int(doc_stats[1] or 0),
            "total_downloads": int(doc_stats[2] or 0),
        },
        "engagement": {
            "total_annotations": int(annotation_count or 0),
            "unique_students_engaged": int(unique_students or 0),
            "forum_posts": int(forum_posts or 0),
            "study_tools": {
                "flashcard_decks_created": int(flashcard_decks or 0),
                "quiz_sessions_completed": int(quiz_sessions or 0),
            },
        },
    }


@router.get("/admin/dashboard")
async def admin_dashboard(
    _current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)

    # Basic totals
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_courses = (await db.execute(select(func.count(Course.id)))).scalar_one()
    total_contributions = (await db.execute(select(func.count(Contribution.id)))).scalar_one()

    # Status breakdown
    pending_contributions = (
        await db.execute(select(func.count(Contribution.id)).where(Contribution.status == "PENDING"))
    ).scalar_one()
    approved_contributions = (
        await db.execute(select(func.count(Contribution.id)).where(Contribution.status == "APPROVED"))
    ).scalar_one()
    rejected_contributions = (
        await db.execute(select(func.count(Contribution.id)).where(Contribution.status == "REJECTED"))
    ).scalar_one()

    # Time-based activity
    new_users_7d = (
        await db.execute(select(func.count(User.id)).where(User.created_at >= week_start))
    ).scalar_one()
    new_contributions_7d = (
        await db.execute(select(func.count(Contribution.id)).where(Contribution.created_at >= week_start))
    ).scalar_one()
    new_courses_7d = (
        await db.execute(select(func.count(Course.id)).where(Course.created_at >= week_start))
    ).scalar_one()

    # Reports and moderation
    total_reports = (
        await db.execute(
            select(func.count(Notification.id)).where(Notification.title.like(f"{REPORT_TITLE_PREFIX}%"))
        )
    ).scalar_one()
    pending_reports = (
        await db.execute(
            select(func.count(Notification.id)).where(
                Notification.title.like(f"{REPORT_TITLE_PREFIX}%"),
                Notification.is_read.is_(False),
            )
        )
    ).scalar_one()

    # Study tools activity
    total_quizzes = (await db.execute(select(func.count(QuizSession.id)))).scalar_one()
    total_flashcard_decks = (await db.execute(select(func.count(FlashcardDeck.id)))).scalar_one()
    quiz_sessions_7d = (
        await db.execute(select(func.count(QuizSession.id)).where(QuizSession.created_at >= week_start))
    ).scalar_one()

    # Forum activity
    total_forum_posts = (await db.execute(select(func.count(ForumPost.id)))).scalar_one()
    forum_posts_7d = (
        await db.execute(select(func.count(ForumPost.id)).where(ForumPost.created_at >= week_start))
    ).scalar_one()

    # User engagement metrics
    active_users_7d = (
        await db.execute(
            select(func.count(func.distinct(XPTransaction.user_id)))
            .where(XPTransaction.created_at >= week_start)
        )
    ).scalar_one()

    # Breakdown by role
    user_role_rows = (
        await db.execute(select(User.role, func.count(User.id)).group_by(User.role))
    ).all()

    # Contribution status breakdown
    contribution_status_rows = (
        await db.execute(
            select(Contribution.status, func.count(Contribution.id)).group_by(Contribution.status)
        )
    ).all()

    # Top active users by XP (last 30 days)
    top_users_rows = (
        await db.execute(
            select(
                User.id,
                User.full_name,
                User.email,
                func.sum(XPTransaction.amount).label("xp_earned"),
            )
            .join(XPTransaction, XPTransaction.user_id == User.id)
            .where(XPTransaction.created_at >= month_start)
            .group_by(User.id, User.full_name, User.email)
            .order_by(desc("xp_earned"))
            .limit(10)
        )
    ).all()

    # Most active courses by contributions
    top_courses_rows = (
        await db.execute(
            select(
                Course.id,
                Course.title,
                Course.code,
                func.count(Contribution.id).label("contribution_count"),
            )
            .join(Contribution, Contribution.course_id == Course.id)
            .group_by(Course.id, Course.title, Course.code)
            .order_by(desc("contribution_count"))
            .limit(10)
        )
    ).all()

    return {
        "totals": {
            "users": int(total_users or 0),
            "courses": int(total_courses or 0),
            "contributions": {
                "total": int(total_contributions or 0),
                "approved": int(approved_contributions or 0),
                "pending": int(pending_contributions or 0),
                "rejected": int(rejected_contributions or 0),
            },
            "reports": {
                "total": int(total_reports or 0),
                "pending": int(pending_reports or 0),
            },
        },
        "activity_7d": {
            "new_users": int(new_users_7d or 0),
            "new_contributions": int(new_contributions_7d or 0),
            "new_courses": int(new_courses_7d or 0),
            "quiz_sessions": int(quiz_sessions_7d or 0),
            "forum_posts": int(forum_posts_7d or 0),
            "active_users": int(active_users_7d or 0),
        },
        "study_tools": {
            "total_quizzes_taken": int(total_quizzes or 0),
            "total_flashcard_decks": int(total_flashcard_decks or 0),
        },
        "forum": {
            "total_posts": int(total_forum_posts or 0),
        },
        "breakdown": {
            "users_by_role": {str(role): int(count or 0) for role, count in user_role_rows},
            "contributions_by_status": {str(status): int(count or 0) for status, count in contribution_status_rows},
        },
        "top_performers": {
            "users_by_xp": [
                {
                    "id": str(row[0]),
                    "full_name": row[1],
                    "email": row[2],
                    "xp_earned_30d": int(row[3] or 0),
                }
                for row in top_users_rows
            ],
            "courses_by_contributions": [
                {
                    "id": str(row[0]),
                    "title": row[1],
                    "code": row[2],
                    "contribution_count": int(row[3] or 0),
                }
                for row in top_courses_rows
            ],
        },
        "period": {
            "week_start": week_start.isoformat(),
            "month_start": month_start.isoformat(),
        },
    }


@router.get("/admin/analytics/export")
async def export_admin_analytics(
    _current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> Response:
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_courses = (await db.execute(select(func.count(Course.id)))).scalar_one()
    total_contributions = (await db.execute(select(func.count(Contribution.id)))).scalar_one()
    pending_contributions = (
        await db.execute(select(func.count(Contribution.id)).where(Contribution.status == "PENDING"))
    ).scalar_one()
    total_reports = (
        await db.execute(
            select(func.count(Notification.id)).where(Notification.title.like(f"{REPORT_TITLE_PREFIX}%"))
        )
    ).scalar_one()
    pending_reports = (
        await db.execute(
            select(func.count(Notification.id)).where(
                Notification.title.like(f"{REPORT_TITLE_PREFIX}%"),
                Notification.is_read.is_(False),
            )
        )
    ).scalar_one()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["metric", "value"])
    writer.writerow(["total_users", int(total_users or 0)])
    writer.writerow(["total_courses", int(total_courses or 0)])
    writer.writerow(["total_contributions", int(total_contributions or 0)])
    writer.writerow(["pending_contributions", int(pending_contributions or 0)])
    writer.writerow(["total_reports", int(total_reports or 0)])
    writer.writerow(["pending_reports", int(pending_reports or 0)])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=atlas-admin-analytics.csv"},
    )
