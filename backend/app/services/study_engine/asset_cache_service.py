from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.qdrant_client import COLLECTION_DOCUMENTS, get_qdrant_manager
from app.models.contribution import DocumentVersion
from app.models.study_tools import (
    AcademicAssetCache,
    AcademicAssetType,
    Flashcard,
    FlashcardDeck,
    MindMap,
    Question,
    QuizSession,
    Summary,
)
from app.models.user import User
from app.services.study_engine import flashcard_service, generation_service


SUMMARY_PROFILE_MAP = {
    "EXECUTIVE": "executive",
    "STRUCTURED": "structured",
    "COMPARATIVE": "comparative",
}


def _normalize_profile(value: str | None, default: str = "default") -> str:
    return (value or default).strip().lower()


async def get_cached_asset(
    session: AsyncSession,
    document_version_id: UUID,
    asset_type: AcademicAssetType,
    target_lang: str = "fr",
    profile: str = "default",
) -> AcademicAssetCache | None:
    result = await session.execute(
        select(AcademicAssetCache).where(
            AcademicAssetCache.document_version_id == document_version_id,
            AcademicAssetCache.asset_type == asset_type,
            AcademicAssetCache.target_lang == target_lang,
            AcademicAssetCache.profile == _normalize_profile(profile),
            AcademicAssetCache.is_stale.is_(False),
        )
    )
    return result.scalar_one_or_none()


async def list_cached_assets(
    session: AsyncSession,
    document_version_id: UUID,
) -> list[dict[str, Any]]:
    result = await session.execute(
        select(AcademicAssetCache).where(
            AcademicAssetCache.document_version_id == document_version_id,
            AcademicAssetCache.is_stale.is_(False),
        )
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(row.id),
            "asset_type": row.asset_type,
            "target_lang": row.target_lang,
            "profile": row.profile,
            "chunk_count": row.chunk_count,
            "updated_at": row.updated_at,
        }
        for row in rows
    ]


def _distill_document_context(version: DocumentVersion, max_chars: int = 28000) -> tuple[str, int]:
    """
    Prefer the indexed chunk representation when available, with OCR text as
    a fallback so generation still works before backfill is complete.
    """
    qdrant = get_qdrant_manager()
    try:
        chunks = qdrant.get_document_chunks(COLLECTION_DOCUMENTS, str(version.id), limit=300)
    except Exception:
        chunks = []

    texts = [chunk["chunk_text"].strip() for chunk in chunks if chunk.get("chunk_text")]
    if texts:
        return "\n\n---\n\n".join(texts)[:max_chars], len(texts)

    return (version.ocr_text or "")[:max_chars], 0


async def get_or_generate_asset(
    session: AsyncSession,
    version: DocumentVersion,
    asset_type: AcademicAssetType,
    target_lang: str = "fr",
    profile: str = "default",
    force_regenerate: bool = False,
) -> AcademicAssetCache:
    normalized_profile = _normalize_profile(profile)

    if not force_regenerate:
        cached = await get_cached_asset(
            session,
            version.id,
            asset_type,
            target_lang=target_lang,
            profile=normalized_profile,
        )
        if cached is not None:
            return cached

    context, chunk_count = _distill_document_context(version)

    if asset_type == AcademicAssetType.FLASHCARDS:
        cards = await flashcard_service.generate_flashcards_from_text(context, num_cards=20)
        content = {"flashcards": cards}
    elif asset_type == AcademicAssetType.QUIZ:
        questions = await generation_service.generate_quiz_from_text(context, num_questions=10)
        content = {"questions": questions}
    elif asset_type == AcademicAssetType.SUMMARY:
        content = await generation_service.generate_summary_from_text(
            text=context,
            format_type=normalized_profile.upper(),
            target_lang=target_lang,
        )
    elif asset_type == AcademicAssetType.MINDMAP:
        content = await generation_service.generate_mindmap_from_text(
            text=context,
            target_lang=target_lang,
        )
    else:
        raise ValueError(f"Unsupported asset type: {asset_type}")

    result = await session.execute(
        select(AcademicAssetCache).where(
            AcademicAssetCache.document_version_id == version.id,
            AcademicAssetCache.asset_type == asset_type,
            AcademicAssetCache.target_lang == target_lang,
            AcademicAssetCache.profile == normalized_profile,
        )
    )
    cache_row = result.scalar_one_or_none()
    if cache_row is None:
        cache_row = AcademicAssetCache(
            document_version_id=version.id,
            asset_type=asset_type,
            target_lang=target_lang,
            profile=normalized_profile,
        )

    cache_row.content = content or {}
    cache_row.chunk_count = chunk_count
    cache_row.is_stale = False
    cache_row.updated_at = datetime.utcnow()
    cache_row.source_pipeline_version = "atlas-cache-v1"
    session.add(cache_row)
    await session.flush()
    return cache_row


async def instantiate_flashcard_deck(
    session: AsyncSession,
    version: DocumentVersion,
    current_user: User,
    target_lang: str = "fr",
) -> FlashcardDeck:
    cached = await get_or_generate_asset(
        session,
        version,
        AcademicAssetType.FLASHCARDS,
        target_lang=target_lang,
    )
    cards = cached.content.get("flashcards", [])

    deck = FlashcardDeck(
        student_id=current_user.id,
        document_version_id=version.id,
        title=f"Flashcards for {version.id}",
        card_count=len(cards),
    )
    session.add(deck)
    await session.flush()

    for item in cards:
        session.add(
            Flashcard(
                deck_id=deck.id,
                question=item.get("question") or item.get("front") or "",
                answer=item.get("answer") or item.get("back") or "",
                difficulty=item.get("difficulty") or "MEDIUM",
            )
        )

    return deck


async def instantiate_quiz_session(
    session: AsyncSession,
    version: DocumentVersion,
    current_user: User,
    target_lang: str = "fr",
) -> QuizSession:
    cached = await get_or_generate_asset(
        session,
        version,
        AcademicAssetType.QUIZ,
        target_lang=target_lang,
    )
    questions = cached.content.get("questions", [])

    session_row = QuizSession(
        student_id=current_user.id,
        document_version_id=version.id,
        total_questions=len(questions),
    )
    session.add(session_row)
    await session.flush()

    for item in questions:
        session.add(
            Question(
                quiz_session_id=session_row.id,
                question_text=item.get("content") or item.get("question") or "",
                question_type=item.get("question_type") or "MCQ",
                options=item.get("options") or [],
                correct_answer=item.get("correct_answer") or "",
                explanation=item.get("explanation"),
                source_page=item.get("source_page"),
            )
        )

    return session_row


async def instantiate_summary(
    session: AsyncSession,
    version: DocumentVersion,
    current_user: User,
    format_type: str,
    target_lang: str = "fr",
) -> Summary:
    cached = await get_or_generate_asset(
        session,
        version,
        AcademicAssetType.SUMMARY,
        target_lang=target_lang,
        profile=SUMMARY_PROFILE_MAP.get(format_type.upper(), format_type),
    )

    summary = Summary(
        student_id=current_user.id,
        document_version_id=version.id,
        format=format_type,
        target_lang=target_lang,
        content=cached.content,
    )
    session.add(summary)
    await session.flush()
    return summary


async def instantiate_mindmap(
    session: AsyncSession,
    version: DocumentVersion,
    current_user: User,
    target_lang: str = "fr",
) -> MindMap:
    cached = await get_or_generate_asset(
        session,
        version,
        AcademicAssetType.MINDMAP,
        target_lang=target_lang,
    )

    mindmap = MindMap(
        student_id=current_user.id,
        document_version_id=version.id,
        title=cached.content.get("title") or f"Mind map for {version.id}",
        target_lang=target_lang,
        nodes_json=cached.content.get("nodes") or [],
        edges_json=cached.content.get("edges") or [],
    )
    session.add(mindmap)
    await session.flush()
    return mindmap
