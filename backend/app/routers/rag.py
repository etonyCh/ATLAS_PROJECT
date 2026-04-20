from __future__ import annotations

import json
from datetime import datetime
from typing import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import atlas_error
from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.contribution import Contribution, DocumentVersion
from app.models.rag import Message, RAGSession
from app.models.user import User
from app.schemas.pagination import PageMeta
from app.services.ai_core import rag_inference, rag_storage
from app.services.ai_core.guardrails import sanitize_rag_query


router = APIRouter(tags=["RAG"])


class CreateSessionRequest(BaseModel):
    course_id: str


class CreateMessageRequest(BaseModel):
    content: str


class SessionResponse(BaseModel):
    id: str
    course_id: str
    message_count: int
    created_at: datetime


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    sources: list[dict[str, object]] = []


class MessageListResponse(BaseModel):
    items: list[MessageResponse]
    meta: PageMeta


async def _latest_document_version_for_course(db: AsyncSession, course_id: UUID) -> DocumentVersion:
    """Pick the newest non-deleted document version linked to the course (same rule as study tools)."""
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
        raise atlas_error(
            "RAG_002",
            "No documents are available for this course yet. Add or approve course materials first.",
            status_code=404,
        )
    return version


async def _course_id_for_document_version(db: AsyncSession, document_version_id: UUID) -> UUID:
    result = await db.execute(
        select(Contribution.course_id)
        .join(DocumentVersion, DocumentVersion.contribution_id == Contribution.id)
        .where(DocumentVersion.id == document_version_id)
    )
    cid = result.scalar_one_or_none()
    if cid is None:
        raise atlas_error(
            "RAG_003",
            "RAG session is linked to a document that no longer exists.",
            status_code=500,
        )
    return cid


async def _event_stream(
    db: AsyncSession,
    session_row: RAGSession,
    payload: CreateMessageRequest,
) -> AsyncGenerator[str, None]:
    user_message = Message(
        session_id=session_row.id,
        role="user",
        content=payload.content,
        timestamp=datetime.utcnow(),
    )
    db.add(user_message)
    await db.flush()

    context, similarity, source_page, source_chunk = await rag_storage.retrieve_rag_context(
        session=db,
        query=payload.content,
        document_version_id=str(session_row.document_version_id),
    )

    if context is None:
        off_topic = "Cette question semble hors du sujet du cours. Je suis limite au contenu du document."
        for token in off_topic.split(" "):
            yield f'data: {json.dumps({"type": "token", "content": token + " "})}\n\n'
        yield f'data: {json.dumps({"type": "sources", "sources": []})}\n\n'
        yield f'data: {json.dumps({"type": "done"})}\n\n'

        assistant_message = Message(
            session_id=session_row.id,
            role="assistant",
            content=off_topic,
            source_page=None,
            cosine_similarity=similarity,
            chunk_text=None,
            timestamp=datetime.utcnow(),
        )
        db.add(assistant_message)
        session_row.message_count += 2
        db.add(session_row)
        await db.commit()
        return

    full_content = ""
    async for raw in rag_inference.stream_llm_response("fr", context, payload.content):
        try:
            decoded = json.loads(raw.strip())
        except json.JSONDecodeError:
            continue

        error = decoded.get("error")
        if error:
            yield f'data: {json.dumps({"type": "error", "error": error})}\n\n'
            return

        token = decoded.get("delta")
        if token:
            full_content += token
            yield f'data: {json.dumps({"type": "token", "content": token})}\n\n'

    sources = []
    if source_page is not None:
        course_id = await _course_id_for_document_version(db, session_row.document_version_id)
        sources.append(
            {
                "course_id": str(course_id),
                "title": f"Course {course_id}",
                "page": int(source_page),
            }
        )
    yield f'data: {json.dumps({"type": "sources", "sources": sources})}\n\n'
    yield f'data: {json.dumps({"type": "done"})}\n\n'

    assistant_message = Message(
        session_id=session_row.id,
        role="assistant",
        content=full_content.strip(),
        source_page=source_page,
        cosine_similarity=similarity,
        chunk_text=source_chunk,
        timestamp=datetime.utcnow(),
    )
    db.add(assistant_message)
    session_row.message_count += 2
    db.add(session_row)
    await db.commit()


@router.post("/rag/sessions", status_code=status.HTTP_201_CREATED, response_model=SessionResponse)
async def create_session(
    payload: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> SessionResponse:
    try:
        course_uuid = UUID(payload.course_id.strip())
    except ValueError as exc:
        raise atlas_error("RAG_004", "Invalid course_id.", status_code=422) from exc

    version = await _latest_document_version_for_course(db, course_uuid)
    session_row = RAGSession(
        student_id=current_user.id,
        document_version_id=version.id,
        message_count=0,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(session_row)
    await db.commit()
    await db.refresh(session_row)
    return SessionResponse(
        id=str(session_row.id),
        course_id=str(course_uuid),
        message_count=session_row.message_count,
        created_at=session_row.created_at,
    )


@router.get("/rag/sessions/{session_id}", response_model=SessionResponse)
async def get_rag_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> SessionResponse:
    result = await db.execute(
        select(RAGSession).where(
            RAGSession.id == session_id,
            RAGSession.student_id == current_user.id,
        )
    )
    session_row = result.scalar_one_or_none()
    if session_row is None:
        raise atlas_error("RAG_001", "RAG session not found.", status_code=404)
    course_id = await _course_id_for_document_version(db, session_row.document_version_id)
    return SessionResponse(
        id=str(session_row.id),
        course_id=str(course_id),
        message_count=session_row.message_count,
        created_at=session_row.created_at,
    )


@router.get("/rag/sessions/{session_id}/messages", response_model=MessageListResponse)
async def list_messages(
    session_id: UUID,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> MessageListResponse:
    session_result = await db.execute(
        select(RAGSession).where(
            RAGSession.id == session_id,
            RAGSession.student_id == current_user.id,
        )
    )
    session_row = session_result.scalar_one_or_none()
    if session_row is None:
        raise atlas_error("RAG_001", "RAG session not found.", status_code=404)

    course_id = await _course_id_for_document_version(db, session_row.document_version_id)

    result = await db.execute(
        select(Message).where(Message.session_id == session_id).order_by(Message.timestamp.asc())
    )
    rows = result.scalars().all()
    total = len(rows)
    page_rows = rows[offset : offset + limit]
    items = [
        MessageResponse(
            id=str(row.id),
            role=row.role,
            content=row.content,
            created_at=row.timestamp,
            sources=(
                [{"course_id": str(course_id), "title": f"Course {course_id}", "page": row.source_page}]
                if row.source_page is not None
                else []
            ),
        )
        for row in page_rows
    ]
    return MessageListResponse(
        items=items,
        meta=PageMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=offset + len(items) < total,
        ),
    )


@router.post("/rag/sessions/{session_id}/messages")
async def create_message(
    session_id: UUID,
    payload: CreateMessageRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    payload = CreateMessageRequest(content=sanitize_rag_query(payload.content))

    result = await db.execute(
        select(RAGSession).where(
            RAGSession.id == session_id,
            RAGSession.student_id == current_user.id,
        )
    )
    session_row = result.scalar_one_or_none()
    if session_row is None:
        raise atlas_error("RAG_001", "RAG session not found.", status_code=404)

    response.headers["Cache-Control"] = "no-cache"
    return StreamingResponse(
        _event_stream(db, session_row, payload),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


@router.delete("/rag/sessions/{session_id}")
async def delete_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    result = await db.execute(
        select(RAGSession).where(
            RAGSession.id == session_id,
            RAGSession.student_id == current_user.id,
        )
    )
    session_row = result.scalar_one_or_none()
    if session_row is None:
        raise atlas_error("RAG_001", "RAG session not found.", status_code=404)

    await db.execute(delete(Message).where(Message.session_id == session_id))
    await db.delete(session_row)
    await db.commit()
    return {"success": True}
