from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import atlas_error
from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.contribution import Contribution, DocumentVersion
from app.models.course import Course
from app.models.study_tools import (
    AcademicAssetType,
    Flashcard,
    FlashcardDeck,
    MindMap,
    Question,
    QuizSession,
    Summary,
)
from app.models.user import User
from app.services.study_engine import asset_cache_service, flashcard_service
from app.services.study_engine.flashcard_service import ReviewButton


router = APIRouter(tags=["Study"])


class FlashcardGenerateRequest(BaseModel):
    course_id: UUID
    num_cards: int = Field(default=10, ge=1, le=20)


class FlashcardReviewRequest(BaseModel):
    rating: ReviewButton


class QuizGenerateRequest(BaseModel):
    course_id: UUID
    num_questions: int = Field(default=10, ge=1, le=15)


class QuizSubmitRequest(BaseModel):
    answers: dict[str, str]


class SummaryGenerateRequest(BaseModel):
    course_id: UUID
    format_type: str = "EXECUTIVE"
    target_lang: str = "fr"


class MindMapGenerateRequest(BaseModel):
    course_id: UUID
    target_lang: str = "fr"


class DocumentAssetGenerateRequest(BaseModel):
    asset_type: str
    target_lang: str = "fr"
    profile: str = "default"
    force_regenerate: bool = False


async def _latest_document_version(db: AsyncSession, course_id: UUID) -> DocumentVersion:
    result = await db.execute(
        select(DocumentVersion)
        .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
        .where(
            Contribution.course_id == course_id,
            DocumentVersion.is_deleted.is_(False),
        )
        .order_by(desc(DocumentVersion.version_number))
        .limit(1)
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)
    return version


def _serialize_flashcard(card: Flashcard) -> dict[str, Any]:
    return {
        "id": str(card.id),
        "question": card.question,
        "answer": card.answer,
        "difficulty": card.difficulty,
        "next_review_at": card.next_review_at,
        "interval": card.interval,
        "ease_factor": card.ease_factor,
        "repetitions": card.repetitions,
    }


@router.post("/flashcards/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_flashcards(
    payload: FlashcardGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    version = await _latest_document_version(db, payload.course_id)
    deck = await asset_cache_service.instantiate_flashcard_deck(db, version, current_user)
    await db.commit()
    return {"job_id": str(deck.id), "status": "READY"}


@router.get("/flashcards/decks")
async def list_flashcard_decks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(FlashcardDeck).where(FlashcardDeck.student_id == current_user.id).order_by(desc(FlashcardDeck.created_at))
    )
    decks = result.scalars().all()
    return [
        {
            "id": str(deck.id),
            "title": deck.title,
            "card_count": deck.card_count,
            "document_version_id": str(deck.document_version_id),
            "share_token": deck.share_token,
            "created_at": deck.created_at,
        }
        for deck in decks
    ]


@router.get("/flashcards/decks/{deck_id}")
async def get_flashcard_deck(
    deck_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    deck = await db.get(FlashcardDeck, deck_id)
    if deck is None or deck.student_id != current_user.id:
        raise atlas_error("FLASHCARD_002", "Deck not found.", status_code=404)

    cards_result = await db.execute(select(Flashcard).where(Flashcard.deck_id == deck_id))
    cards = cards_result.scalars().all()

    # Calculate study progress
    total_cards = len(cards)
    due_cards = sum(1 for c in cards if c.next_review_at and c.next_review_at <= datetime.utcnow())
    studied_cards = sum(1 for c in cards if c.repetitions and c.repetitions > 0)

    # Get course info if available
    course_info = None
    if deck.document_version_id:
        from sqlalchemy import select as sa_select
        version_result = await db.execute(
            sa_select(DocumentVersion, Contribution, Course)
            .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
            .join(Course, Course.id == Contribution.course_id)
            .where(DocumentVersion.id == deck.document_version_id)
        )
        row = version_result.first()
        if row:
            _, _, course = row
            course_info = {
                "id": str(course.id),
                "title": course.title,
                "academic_year": course.academic_year,
                "language": course.language,
            }

    return {
        "id": str(deck.id),
        "title": deck.title,
        "card_count": deck.card_count,
        "share_token": deck.share_token,
        "course": course_info,
        "progress": {
            "total_cards": total_cards,
            "studied_cards": studied_cards,
            "due_cards": due_cards,
            "mastery_percentage": round((studied_cards / total_cards * 100), 1) if total_cards > 0 else 0,
        },
        "cards": [_serialize_flashcard(card) for card in cards],
    }


@router.get("/flashcards/due")
async def get_due_flashcards(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    result = await db.execute(
        select(Flashcard)
        .join(FlashcardDeck, FlashcardDeck.id == Flashcard.deck_id)
        .where(
            FlashcardDeck.student_id == current_user.id,
            Flashcard.next_review_at <= datetime.utcnow(),
        )
        .order_by(Flashcard.next_review_at.asc())
    )
    cards = result.scalars().all()
    return {"items": [_serialize_flashcard(card) for card in cards], "total": len(cards)}


@router.patch("/flashcards/{card_id}/review")
async def review_flashcard(
    card_id: UUID,
    payload: FlashcardReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    result = await db.execute(
        select(Flashcard)
        .join(FlashcardDeck, FlashcardDeck.id == Flashcard.deck_id)
        .where(Flashcard.id == card_id, FlashcardDeck.student_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if card is None:
        raise atlas_error("FLASHCARD_003", "Card not found.", status_code=404)

    quality = flashcard_service.map_button_to_quality(payload.rating)
    repetitions, ease_factor, interval = flashcard_service.calculate_sm2(
        quality,
        card.repetitions,
        card.ease_factor,
        card.interval,
    )
    card.repetitions = repetitions
    card.ease_factor = ease_factor
    card.interval = interval
    card.last_reviewed_at = datetime.utcnow()
    card.next_review_at = datetime.utcnow() + timedelta(days=interval)
    db.add(card)
    await db.commit()

    return {
        "id": str(card.id),
        "next_review_at": card.next_review_at,
        "interval_days": card.interval,
        "ease_factor": card.ease_factor,
        "repetitions": card.repetitions,
    }


@router.get("/flashcards/decks/{deck_id}/share")
async def get_flashcard_share_link(
    deck_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    deck = await db.get(FlashcardDeck, deck_id)
    if deck is None or deck.student_id != current_user.id:
        raise atlas_error("FLASHCARD_002", "Deck not found.", status_code=404)

    return {
        "token": deck.share_token or "",
        "url": f"/flashcards/shared/{deck.share_token}",
    }


@router.post("/quiz/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_quiz(
    payload: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    version = await _latest_document_version(db, payload.course_id)
    session_row = await asset_cache_service.instantiate_quiz_session(db, version, current_user)
    await db.commit()
    return {"job_id": str(session_row.id), "status": "READY"}


@router.get("/quiz/sessions")
async def list_quiz_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(QuizSession)
        .where(QuizSession.student_id == current_user.id)
        .order_by(desc(QuizSession.created_at))
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(row.id),
            "score": row.score,
            "total_questions": row.total_questions,
            "is_completed": row.is_completed,
            "created_at": row.created_at,
            "submitted_at": row.submitted_at,
        }
        for row in rows
    ]


@router.get("/quiz/{quiz_id}")
async def get_quiz(
    quiz_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    session_row = await db.get(QuizSession, quiz_id)
    if session_row is None or session_row.student_id != current_user.id:
        raise atlas_error("QUIZ_002", "Quiz session not found.", status_code=404)

    result = await db.execute(select(Question).where(Question.quiz_session_id == quiz_id))
    questions = result.scalars().all()
    return {
        "id": str(session_row.id),
        "total_questions": session_row.total_questions,
        "time_limit_minutes": session_row.time_limit_minutes,
        "questions": [
            {
                "id": str(question.id),
                "question": question.question_text,
                "question_type": question.question_type,
                "options": question.options,
                "source_page": question.source_page,
            }
            for question in questions
        ],
    }


@router.post("/quiz/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: UUID,
    payload: QuizSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    session_row = await db.get(QuizSession, quiz_id)
    if session_row is None or session_row.student_id != current_user.id:
        raise atlas_error("QUIZ_002", "Quiz session not found.", status_code=404)
    if session_row.is_completed:
        raise atlas_error("QUIZ_003", "Quiz has already been submitted.", status_code=400)

    result = await db.execute(select(Question).where(Question.quiz_session_id == quiz_id))
    questions = result.scalars().all()

    correct_count = 0
    explanations = []
    for question in questions:
        submitted = payload.answers.get(str(question.id))
        question.student_answer = submitted
        question.is_correct = submitted == question.correct_answer
        if question.is_correct:
            correct_count += 1
        explanations.append(
            {
                "question_id": str(question.id),
                "correct_answer": question.correct_answer,
                "explanation": question.explanation,
                "is_correct": question.is_correct,
                "source_page": question.source_page,
            }
        )
        db.add(question)

    score = (correct_count / len(questions) * 100) if questions else 0.0
    session_row.score = score
    session_row.is_completed = True
    session_row.submitted_at = datetime.utcnow()
    db.add(session_row)
    await db.commit()

    return {"score": score, "results": explanations}


@router.get("/quiz/history")
async def get_quiz_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(QuizSession)
        .where(QuizSession.student_id == current_user.id, QuizSession.submitted_at.is_not(None))
        .order_by(desc(QuizSession.submitted_at))
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(row.id),
            "score": row.score,
            "submitted_at": row.submitted_at,
            "total_questions": row.total_questions,
        }
        for row in rows
    ]


@router.post("/summaries/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_summary(
    payload: SummaryGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    version = await _latest_document_version(db, payload.course_id)
    summary = await asset_cache_service.instantiate_summary(
        db,
        version,
        current_user,
        format_type=payload.format_type,
        target_lang=payload.target_lang,
    )
    await db.commit()
    await db.refresh(summary)
    return {"job_id": str(summary.id), "status": "READY"}


@router.get("/summaries/{summary_id}")
async def get_summary(
    summary_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    summary = await db.get(Summary, summary_id)
    if summary is None or summary.student_id != current_user.id:
        raise atlas_error("SUMMARY_002", "Summary not found.", status_code=404)
    return {
        "id": str(summary.id),
        "format": summary.format,
        "target_lang": summary.target_lang,
        "content": summary.content,
        "created_at": summary.created_at,
    }


@router.post("/mindmaps/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_mindmap(
    payload: MindMapGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    version = await _latest_document_version(db, payload.course_id)
    mindmap = await asset_cache_service.instantiate_mindmap(
        db,
        version,
        current_user,
        target_lang=payload.target_lang,
    )
    await db.commit()
    await db.refresh(mindmap)
    return {"job_id": str(mindmap.id), "status": "READY"}


@router.get("/mindmaps/{mindmap_id}")
async def get_mindmap(
    mindmap_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    mindmap = await db.get(MindMap, mindmap_id)
    if mindmap is None or mindmap.student_id != current_user.id:
        raise atlas_error("MINDMAP_002", "Mind map not found.", status_code=404)
    return {
        "id": str(mindmap.id),
        "title": mindmap.title,
        "target_lang": mindmap.target_lang,
        "nodes": mindmap.nodes_json,
        "edges": mindmap.edges_json,
        "created_at": mindmap.created_at,
    }


@router.get("/documents/{document_version_id}/assets/manifest")
async def get_document_asset_manifest(
    document_version_id: UUID,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    items = await asset_cache_service.list_cached_assets(db, document_version_id)
    return {"items": items, "total": len(items)}


@router.get("/documents/{document_version_id}/assets/{asset_type}")
async def get_document_asset(
    document_version_id: UUID,
    asset_type: str,
    target_lang: str = "fr",
    profile: str = "default",
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    normalized_type = asset_type.strip().upper()
    if normalized_type not in {"FLASHCARDS", "QUIZ", "SUMMARY", "MINDMAP"}:
        raise atlas_error("ASSET_001", "Unsupported asset type.", status_code=400)
    asset_enum = AcademicAssetType(normalized_type)

    cached = await asset_cache_service.get_cached_asset(
        db,
        document_version_id,
        asset_enum,
        target_lang=target_lang,
        profile=profile,
    )
    if cached is None:
        raise atlas_error("ASSET_002", "Cached asset not found.", status_code=404)

    return {
        "id": str(cached.id),
        "document_version_id": str(cached.document_version_id),
        "asset_type": cached.asset_type,
        "target_lang": cached.target_lang,
        "profile": cached.profile,
        "content": cached.content,
        "chunk_count": cached.chunk_count,
        "updated_at": cached.updated_at,
    }


@router.post("/documents/{document_version_id}/assets/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_document_asset(
    document_version_id: UUID,
    payload: DocumentAssetGenerateRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    version = await db.get(DocumentVersion, document_version_id)
    if version is None or version.is_deleted:
        raise atlas_error("ASSET_003", "Document version not found.", status_code=404)

    normalized_type = payload.asset_type.strip().upper()
    if normalized_type not in {"FLASHCARDS", "QUIZ", "SUMMARY", "MINDMAP"}:
        raise atlas_error("ASSET_001", "Unsupported asset type.", status_code=400)
    asset_enum = AcademicAssetType(normalized_type)

    cached = await asset_cache_service.get_or_generate_asset(
        db,
        version,
        asset_enum,
        target_lang=payload.target_lang,
        profile=payload.profile,
        force_regenerate=payload.force_regenerate,
    )
    await db.commit()
    await db.refresh(cached)

    return {
        "id": str(cached.id),
        "document_version_id": str(cached.document_version_id),
        "asset_type": cached.asset_type,
        "target_lang": cached.target_lang,
        "profile": cached.profile,
        "content": cached.content,
        "chunk_count": cached.chunk_count,
        "updated_at": cached.updated_at,
    }
