from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.annotation import DocumentAnnotation
from app.models.collaboration import ForumPost, ForumReply
from app.models.contribution import Contribution
from app.models.gamification import Badge, UserBadge, UserStreak, XPTransaction
from app.models.study_tools import FlashcardDeck, QuizSession
from app.models.user import User


router = APIRouter(tags=["Users"])


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    filiere: str | None = None
    onboarding_completed: bool | None = None


@router.patch("/users/me")
async def update_me(
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.filiere is not None:
        current_user.filiere = payload.filiere
    if payload.onboarding_completed is not None:
        current_user.onboarding_completed = payload.onboarding_completed

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "filiere": current_user.filiere,
        "role": current_user.role,
        "onboarding_completed": current_user.onboarding_completed,
    }


@router.get("/users/{user_id}/profile")
async def get_public_profile(
    user_id: UUID,
    db: AsyncSession = Depends(get_session),
    _current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Get public profile with badges, achievements, and activity for a user."""
    user = await db.get(User, user_id)
    if user is None:
        from app.core.exceptions import atlas_error
        raise atlas_error("USER_001", "User not found.", status_code=404)

    # XP and Level
    xp_total = (
        await db.execute(
            select(func.coalesce(func.sum(XPTransaction.amount), 0)).where(XPTransaction.user_id == user_id)
        )
    ).scalar_one()
    level = min(50, 1 + (int(xp_total) // 1000))

    # Badges earned
    badges_result = await db.execute(
        select(Badge, UserBadge.awarded_at)
        .join(UserBadge, UserBadge.badge_id == Badge.id)
        .where(UserBadge.user_id == user_id)
        .order_by(desc(UserBadge.awarded_at))
    )
    badges = [
        {
            "id": str(badge.id),
            "name": badge.name,
            "description": badge.description,
            "icon": badge.icon or "trophy",
            "awarded_at": awarded_at,
        }
        for badge, awarded_at in badges_result.all()
    ]

    # Current streak
    streak = (
        await db.execute(select(UserStreak).where(UserStreak.user_id == user_id))
    ).scalar_one_or_none()
    current_streak = streak.current_streak if streak else 0
    longest_streak = streak.longest_streak if streak else 0

    # Activity stats
    total_contributions = (
        await db.execute(select(func.count(Contribution.id)).where(Contribution.uploader_id == user_id))
    ).scalar_one()

    total_flashcards = (
        await db.execute(select(func.count(FlashcardDeck.id)).where(FlashcardDeck.student_id == user_id))
    ).scalar_one()

    total_quizzes = (
        await db.execute(select(func.count(QuizSession.id)).where(QuizSession.student_id == user_id))
    ).scalar_one()

    total_annotations = (
        await db.execute(select(func.count(DocumentAnnotation.id)).where(DocumentAnnotation.user_id == user_id))
    ).scalar_one()

    total_forum_posts = (
        await db.execute(select(func.count(ForumPost.id)).where(ForumPost.author_id == user_id))
    ).scalar_one()

    total_replies = (
        await db.execute(select(func.count(ForumReply.id)).where(ForumReply.author_id == user_id))
    ).scalar_one()

    # Recent activity (last 30 days)
    from datetime import datetime, timedelta
    month_ago = datetime.utcnow() - timedelta(days=30)

    recent_xp = (
        await db.execute(
            select(func.coalesce(func.sum(XPTransaction.amount), 0))
            .where(XPTransaction.user_id == user_id, XPTransaction.created_at >= month_ago)
        )
    ).scalar_one()

    # Recent transactions for activity feed
    recent_transactions = await db.execute(
        select(XPTransaction)
        .where(XPTransaction.user_id == user_id)
        .order_by(desc(XPTransaction.created_at))
        .limit(10)
    )

    activity_feed = [
        {
            "id": str(tx.id),
            "type": tx.transaction_type,
            "amount": tx.amount,
            "description": tx.description or f"Earned {tx.amount} XP",
            "created_at": tx.created_at,
        }
        for tx in recent_transactions.scalars().all()
    ]

    # Social proof: rank among users
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    users_with_more_xp = (
        await db.execute(
            select(func.count(func.distinct(XPTransaction.user_id)))
            .group_by(XPTransaction.user_id)
            .having(func.sum(XPTransaction.amount) > xp_total)
        )
    ).scalar() or 0
    rank_percentile = max(0, 100 - (int(users_with_more_xp) / max(1, int(total_users)) * 100))

    return {
        "user": {
            "id": str(user.id),
            "full_name": user.full_name,
            "role": user.role,
            "filiere": user.filiere,
            "is_verified": user.is_verified,
            "created_at": user.created_at,
        },
        "gamification": {
            "xp_total": int(xp_total or 0),
            "level": level,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "badges_earned": len(badges),
            "rank_percentile": round(rank_percentile, 1),
        },
        "badges": badges,
        "stats": {
            "total_contributions": int(total_contributions or 0),
            "flashcard_decks_created": int(total_flashcards or 0),
            "quizzes_completed": int(total_quizzes or 0),
            "annotations_made": int(total_annotations or 0),
            "forum_posts": int(total_forum_posts or 0),
            "forum_replies": int(total_replies or 0),
            "total_interactions": int(total_annotations or 0)
            + int(total_forum_posts or 0)
            + int(total_replies or 0),
        },
        "recent_activity": {
            "xp_earned_30d": int(recent_xp or 0),
            "activity_feed": activity_feed,
        },
    }


@router.get("/users/me/profile")
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Get full profile for the current user (same as public but for self)."""
    # Reuse public profile logic
    from uuid import UUID
    return await get_public_profile(UUID(str(current_user.id)), db, current_user)
