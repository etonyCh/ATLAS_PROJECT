"""
Document Embedding Tasks - Qdrant Implementation
Replaces pgvector storage with Qdrant for all AI embeddings.

This module handles:
- Document chunking (Phase 2: Semantic chunking)
- Embedding generation with SentenceTransformer
- Hybrid dense+sparse vector storage in Qdrant
- Meilisearch indexing for keyword search
"""

import torch
from celery import shared_task
from sqlmodel import Session, create_engine, select
from sqlalchemy import delete as sa_delete, update as sa_update
import structlog
import os
import meilisearch
import asyncio
from typing import List, Tuple, Dict, Any

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except Exception:
    from langchain.text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings
from app.core.qdrant_client import get_qdrant_manager, COLLECTION_DOCUMENTS
from app.models.all_models import (
    AcademicAssetCache,
    DocumentVersion,
    DocumentPipelineStatus,
    Contribution,
    ContributionStatus,
    Course,
    User,
    UserRole,
    Department,
)

# ML Dependencies
from sentence_transformers import SentenceTransformer
from keybert import KeyBERT

sync_engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI.replace("postgresql+asyncpg", "postgresql")
)

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"

# Lazy initialization globals
_device = None
_embedding_model = None
_kw_model = None


def _mark_document_asset_cache_stale(session: Session, document_version_id: str) -> None:
    session.execute(
        sa_update(AcademicAssetCache)
        .where(AcademicAssetCache.document_version_id == document_version_id)
        .values(is_stale=True)
    )


def _get_models():
    """Initializes ML models once per worker process."""
    global _device, _embedding_model, _kw_model
    if _embedding_model is None:
        _device = "cuda" if torch.cuda.is_available() else "cpu"
        structlog.get_logger().info("loading_ml_models", device=_device, model=MODEL_NAME)
        _embedding_model = SentenceTransformer(MODEL_NAME, device=_device)
        _kw_model = KeyBERT(model=_embedding_model)
    return _embedding_model, _kw_model, _device


def _embed_chunks(
    text: str, model: SentenceTransformer, device: str
) -> List[Tuple[str, List[float]]]:
    """
    Splits text into chunks and generates embeddings.
    Returns list of (chunk_text, embedding_vector) tuples.
    """
    try:
        text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            encoding_name="cl100k_base",
            chunk_size=512,
            chunk_overlap=50,
        )
        chunks = text_splitter.split_text(text)
    except Exception:
        chunks = RecursiveCharacterTextSplitter(
            chunk_size=2000,
            chunk_overlap=300,
            length_function=len,
        ).split_text(text)

    if not chunks:
        return []

    vectors = model.encode(
        chunks, batch_size=32, device=device, normalize_embeddings=True, show_progress_bar=False
    )

    return list(zip(chunks, vectors.tolist()))


def _embed_chunks_semantic(
    text: str, model: SentenceTransformer, device: str
) -> List[Tuple[str, List[float], Dict[str, Any]]]:
    """
    Phase 2: Semantic chunking with structure preservation.
    Returns list of (chunk_text, embedding_vector, metadata) tuples.
    """
    from app.services.ai_core.semantic_chunker import chunk_for_embedding

    semantic_chunks = chunk_for_embedding(text, chunk_size=512)

    if not semantic_chunks:
        return []

    chunk_texts = [chunk["content"] for chunk in semantic_chunks]

    vectors = model.encode(
        chunk_texts,
        batch_size=32,
        device=device,
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    results = []
    for chunk, vector in zip(semantic_chunks, vectors):
        results.append(
            (
                chunk["content"],
                vector.tolist(),
                {
                    "chunk_type": chunk["chunk_type"],
                    "is_atomic": chunk["is_atomic"],
                    "token_count": chunk["token_count"],
                },
            )
        )

    return results


def _embed_chunks_colbert(text: str) -> List[Tuple[str, Any, Dict[str, Any]]]:
    """
    Phase 3: Hybrid embedding with ColBERT for technical content.
    """
    from app.services.ai_core.semantic_chunker import chunk_for_embedding
    from app.services.ai_core.colbert_embedder import get_hybrid_embedder

    semantic_chunks = chunk_for_embedding(text, chunk_size=512)

    if not semantic_chunks:
        return []

    embedder = get_hybrid_embedder()
    embedded_chunks = embedder.embed_chunks(semantic_chunks)

    results = []
    for (content, embedding, method), chunk in zip(embedded_chunks, semantic_chunks):
        results.append(
            (
                content,
                embedding,
                {
                    "chunk_type": chunk["chunk_type"],
                    "is_atomic": chunk["is_atomic"],
                    "token_count": chunk["token_count"],
                    "embedding_method": method,
                },
            )
        )

    return results


def _auto_index_to_meilisearch(
    session: Session, dv: DocumentVersion, contribution: Contribution
) -> None:
    """Auto-index approved documents to MeiliSearch."""
    log = structlog.get_logger().bind(action="auto_index_meilisearch", doc_id=str(dv.id))
    try:
        course = session.get(Course, contribution.course_id) if contribution.course_id else None
        uploader = session.get(User, contribution.uploader_id)

        department_name = None
        if course and course.department_id:
            dept = session.get(Department, course.department_id)
            if dept:
                department_name = dept.name

        teacher_name = (uploader.full_name or uploader.email) if uploader else "Unknown"
        course_level = (
            getattr(course.level, "value", course.level)
            if course and hasattr(course, "level")
            else None
        )
        course_type = (
            getattr(course.course_type, "value", course.course_type)
            if course and hasattr(course, "course_type")
            else None
        )
        course_lang = (
            getattr(course.language, "value", course.language)
            if course and hasattr(course, "language")
            else "FR"
        )
        course_year = getattr(course, "academic_year", None) if course else None
        course_tags = getattr(course, "tags", []) if course else []
        filiere = department_name or (
            uploader.filiere if uploader and hasattr(uploader, "filiere") else None
        )

        doc_payload = {
            "id": str(dv.id),
            "document_version_id": str(dv.id),
            "course_id": str(course.id) if course else None,
            "title": getattr(contribution, "title", None)
            or (course.title if course else "Untitled Document"),
            "teacher_name": teacher_name,
            "is_official": True,
            "quality_score": dv.quality_score,
            "tags": course_tags,
            "filiere": filiere,
            "level": course_level,
            "academic_year": course_year,
            "course_type": course_type,
            "language": course_lang,
            "ocr_text": getattr(dv, "ocr_text", ""),
        }

        client = meilisearch.Client(
            os.getenv("MEILI_URL", "http://localhost:7700"),
            os.getenv("MEILI_MASTER_KEY", "meili_master_key"),
        )
        index = client.index("documents")
        index.update_settings(
            {
                "typoTolerance": {
                    "enabled": True,
                    "minWordSizeForTypos": {"oneTypo": 4, "twoTypos": 8},
                }
            }
        )
        index.add_documents([doc_payload], primary_key="id")
        log.info("auto_indexed_teacher_document", doc_id=str(dv.id))
    except Exception as e:
        log.error("auto_index_failed", error=str(e))


@shared_task(name="embed_document", bind=True)
def embed_document(self, document_version_id: str):
    """
    Celery task: Generates embeddings and stores in Qdrant.
    Replaces pgvector storage with Qdrant hybrid vectors.
    """
    log = structlog.get_logger().bind(
        task="embed_document", document_version_id=document_version_id
    )

    with Session(sync_engine) as session:
        dv = session.get(DocumentVersion, document_version_id)
        if not dv:
            log.warning("missing_document_version")
            return

        if not dv.ocr_text:
            log.warning("missing_ocr_text")
            _mark_document_asset_cache_stale(session, document_version_id)
            dv.pipeline_status = DocumentPipelineStatus.READY
            session.add(dv)
            session.commit()
            return

        try:
            # Load models
            embedding_model, kw_model, device = _get_models()

            # Extract keywords
            text_for_keywords = dv.ocr_text[:15000]
            keywords_scored = kw_model.extract_keywords(
                text_for_keywords, keyphrase_ngram_range=(1, 2), top_n=5
            )
            extracted_tags = [kw[0] for kw in keywords_scored] if keywords_scored else []

            # Update course tags
            if dv.contribution_id:
                contribution = session.get(Contribution, dv.contribution_id)
                if contribution and contribution.course_id:
                    course = session.get(Course, contribution.course_id)
                    if course:
                        existing_tags = set(course.tags or [])
                        existing_tags.update(extracted_tags)
                        course.tags = list(existing_tags)
                        session.add(course)

            # Generate embeddings with semantic chunking (Phase 2)
            chunked_embeddings = _embed_chunks_semantic(dv.ocr_text, embedding_model, device)

            # Store in Qdrant with chunk metadata (Phase 2)
            if chunked_embeddings:
                qdrant = get_qdrant_manager()
                chunk_data = [(content, vector) for content, vector, _ in chunked_embeddings]
                chunk_metadata = [meta for _, _, meta in chunked_embeddings]

                qdrant.upsert_embeddings(
                    collection_name=COLLECTION_DOCUMENTS,
                    document_version_id=str(dv.id),
                    chunks=chunk_data,
                    content_type="document",
                    metadata=chunk_metadata,
                )
                log.info("qdrant_embeddings_stored", chunks_count=len(chunked_embeddings))

            _mark_document_asset_cache_stale(session, document_version_id)

            # Finalize pipeline
            dv.pipeline_status = DocumentPipelineStatus.READY
            session.add(dv)
            session.commit()

            log.info(
                "embedded_and_tagged",
                chunks_count=len(chunked_embeddings),
                tags=extracted_tags,
                hardware=device,
            )

            # Auto-index to MeiliSearch for approved teacher uploads
            contribution = session.get(Contribution, dv.contribution_id)
            if contribution and contribution.status == ContributionStatus.APPROVED:
                uploader = session.get(User, contribution.uploader_id)
                if uploader and uploader.role in (UserRole.TEACHER, UserRole.ADMIN):
                    _auto_index_to_meilisearch(session, dv, contribution)
                    log.info("teacher_doc_auto_indexed", contribution_id=str(contribution.id))

        except Exception as e:
            log.error("embedding_pipeline_failed", error=str(e), exc_info=True)
            dv.pipeline_status = DocumentPipelineStatus.FAILED
            session.add(dv)
            session.commit()
            raise self.retry(exc=e, countdown=60, max_retries=3)


@shared_task(name="reindex_document")
def reindex_document(document_version_id: str) -> bool:
    """
    Reindexes a document in Qdrant (useful for recovery or updates).
    """
    log = structlog.get_logger().bind(
        task="reindex_document", document_version_id=document_version_id
    )

    with Session(sync_engine) as session:
        dv = session.get(DocumentVersion, document_version_id)
        if not dv or not dv.ocr_text:
            log.error("document_not_found_or_no_text")
            return False

        try:
            # Delete existing embeddings
            qdrant = get_qdrant_manager()
            qdrant.delete_document_embeddings(COLLECTION_DOCUMENTS, str(dv.id))

            # Regenerate and store with semantic chunking
            embedding_model, _, device = _get_models()
            chunked_embeddings = _embed_chunks_semantic(dv.ocr_text, embedding_model, device)

            if chunked_embeddings:
                chunk_data = [(content, vector) for content, vector, _ in chunked_embeddings]
                chunk_metadata = [meta for _, _, meta in chunked_embeddings]

                qdrant.upsert_embeddings(
                    collection_name=COLLECTION_DOCUMENTS,
                    document_version_id=str(dv.id),
                    chunks=chunk_data,
                    content_type="document",
                    metadata=chunk_metadata,
                )

            _mark_document_asset_cache_stale(session, document_version_id)
            session.commit()

            log.info("document_reindexed", chunks_count=len(chunked_embeddings))
            return True

        except Exception as e:
            log.error("reindex_failed", error=str(e))
            return False
