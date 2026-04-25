from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import atlas_error
from app.models.collaboration import ForumPost
from app.models.contribution import Contribution
from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.gamification import Badge, UserBadge, XPTransaction
from app.models.study_tools import FlashcardDeck, MindMap, QuizSession, Summary
from app.models.user import Establishment, User
from app.services.study_engine import gamification_service


router = APIRouter(tags=["Gamification"])


@router.get("/users/{user_id}/xp")
async def get_user_xp(
    user_id: UUID,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if user is None:
        raise atlas_error("USER_001", "User not found.", status_code=404)

    total_xp = await gamification_service.get_total_xp(db, user.id)
    level = gamification_service.get_level_for_xp(total_xp)
    establishment_name = None
    if user.establishment_id:
        establishment_name = (
            await db.execute(
                select(Establishment.name).where(Establishment.id == user.establishment_id)
            )
        ).scalar_one_or_none()
    transactions_result = await db.execute(
        select(XPTransaction).where(XPTransaction.user_id == user.id).order_by(desc(XPTransaction.created_at)).limit(50)
    )
    transactions = transactions_result.scalars().all()

    return {
        "user_id": str(user.id),
        "total_xp": total_xp,
        "level": level,
        "breakdown": [
            {
                "id": str(item.id),
                "type": item.transaction_type,
                "amount": item.amount,
                "created_at": item.created_at,
            }
            for item in transactions
        ],
    }


@router.get("/users/{user_id}/badges")
async def get_user_badges(
    user_id: UUID,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if user is None:
        raise atlas_error("USER_001", "User not found.", status_code=404)

    result = await db.execute(
        select(Badge, UserBadge)
        .join(UserBadge, UserBadge.badge_id == Badge.id)
        .where(UserBadge.user_id == user_id)
        .order_by(desc(UserBadge.awarded_at))
    )
    badges = result.all()
    return {
        "user_id": str(user_id),
        "items": [
            {
                "id": str(badge.id),
                "code": badge.code,
                "name": badge.name,
                "description": badge.description,
                "icon": badge.icon,
                "awarded_at": user_badge.awarded_at,
            }
            for badge, user_badge in badges
        ],
    }


@router.get("/leaderboard")
async def leaderboard(
    limit: int = 20,
    filiere: str | None = None,
    anonymous: bool = False,
    db: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    stmt = (
        select(User, func.coalesce(func.sum(XPTransaction.amount), 0).label("xp"))
        .outerjoin(XPTransaction, XPTransaction.user_id == User.id)
        .group_by(User.id)
        .order_by(desc("xp"))
        .limit(limit)
    )
    if filiere:
        stmt = stmt.where(User.filiere == filiere)

    rows = (await db.execute(stmt)).all()
    return [
        {
            "user_id": str(user.id),
            "name": f"User {index + 1}" if anonymous else (user.full_name or user.email),
            "filiere": user.filiere,
            "xp": int(xp or 0),
        }
        for index, (user, xp) in enumerate(rows)
    ]


@router.get("/profile/{username}")
async def public_profile(
    username: str,
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    result = await db.execute(
        select(User).where((User.full_name == username) | (User.email == username))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise atlas_error("USER_001", "User not found.", status_code=404)

    total_xp = await gamification_service.get_total_xp(db, user.id)
    level = gamification_service.get_level_for_xp(total_xp)
    establishment_name = None
    if user.establishment_id:
        establishment_name = (
            await db.execute(
                select(Establishment.name).where(Establishment.id == user.establishment_id)
            )
        ).scalar_one_or_none()

    badge_rows = (
        await db.execute(
            select(Badge, UserBadge)
            .join(UserBadge, UserBadge.badge_id == Badge.id)
            .where(UserBadge.user_id == user.id)
            .order_by(desc(UserBadge.awarded_at))
            .limit(6)
        )
    ).all()

    contribution_counts = (
        await db.execute(
            select(
                func.count(Contribution.id),
                func.sum(case((Contribution.status == "APPROVED", 1), else_=0)),
            ).where(Contribution.uploader_id == user.id)
        )
    ).one()

    forum_posts_count = (
        await db.execute(
            select(func.count(ForumPost.id)).where(ForumPost.author_id == user.id)
        )
    ).scalar_one()

    flashcard_decks_count = (
        await db.execute(
            select(func.count(FlashcardDeck.id)).where(FlashcardDeck.student_id == user.id)
        )
    ).scalar_one()
    quiz_sessions_count = (
        await db.execute(
            select(func.count(QuizSession.id)).where(QuizSession.student_id == user.id)
        )
    ).scalar_one()
    summaries_count = (
        await db.execute(
            select(func.count(Summary.id)).where(Summary.student_id == user.id)
        )
    ).scalar_one()
    mindmaps_count = (
        await db.execute(
            select(func.count(MindMap.id)).where(MindMap.student_id == user.id)
        )
    ).scalar_one()
    study_assets_count = int(
        (flashcard_decks_count or 0)
        + (quiz_sessions_count or 0)
        + (summaries_count or 0)
        + (mindmaps_count or 0)
    )

    recent_contributions = (
        await db.execute(
            select(Contribution)
            .where(Contribution.uploader_id == user.id)
            .order_by(desc(Contribution.created_at))
            .limit(5)
        )
    ).scalars().all()

    recent_posts = (
        await db.execute(
            select(ForumPost)
            .where(ForumPost.author_id == user.id)
            .order_by(desc(ForumPost.created_at))
            .limit(5)
        )
    ).scalars().all()

    recent_xp = (
        await db.execute(
            select(XPTransaction)
            .where(XPTransaction.user_id == user.id)
            .order_by(desc(XPTransaction.created_at))
            .limit(5)
        )
    ).scalars().all()

    recent_activity: list[dict[str, Any]] = []
    for contribution in recent_contributions:
        recent_activity.append(
            {
                "id": str(contribution.id),
                "type": "CONTRIBUTION",
                "title": contribution.title,
                "description": f"Contribution submitted with status {contribution.status}.",
                "created_at": contribution.created_at,
            }
        )
    for post in recent_posts:
        recent_activity.append(
            {
                "id": str(post.id),
                "type": "FORUM_POST",
                "title": post.title,
                "description": "Started a discussion in the forum.",
                "created_at": post.created_at,
            }
        )
    for transaction in recent_xp:
        recent_activity.append(
            {
                "id": str(transaction.id),
                "type": "XP",
                "title": f"{transaction.amount:+} XP",
                "description": transaction.description or transaction.transaction_type,
                "created_at": transaction.created_at,
            }
        )

    recent_activity.sort(key=lambda item: item["created_at"], reverse=True)

    return {
        "id": str(user.id),
        "username": user.full_name or user.email,
        "full_name": user.full_name,
        "role": user.role,
        "filiere": user.filiere,
        "level_label": user.level,
        "xp": total_xp,
        "level": level,
        "establishment_name": establishment_name,
        "created_at": user.created_at,
        "stats": {
            "badges_count": len(badge_rows),
            "contributions_count": int(contribution_counts[0] or 0),
            "approved_contributions_count": int(contribution_counts[1] or 0),
            "forum_posts_count": int(forum_posts_count or 0),
            "study_assets_count": study_assets_count,
        },
        "badges": [
            {
                "id": str(badge.id),
                "code": badge.code,
                "name": badge.name,
                "description": badge.description,
                "icon": badge.icon,
                "awarded_at": user_badge.awarded_at,
            }
            for badge, user_badge in badge_rows
        ],
        "recent_activity": recent_activity[:8],
    }
