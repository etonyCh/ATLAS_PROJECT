import torch
from celery import shared_task
from sqlmodel import Session, create_engine, select
from sqlalchemy import delete
import structlog

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except Exception:
    from langchain.text_splitters import RecursiveCharacterTextSplitter

import os
import meilisearch

from app.core.config import settings
from app.models.all_models import (
    DocumentVersion, 
    DocumentPipelineStatus, 
    DocumentEmbedding,
    Contribution,
    ContributionStatus,
    Course,
    User,
    UserRole,
    Department,
)

# ML Dependencies (US-08)
from sentence_transformers import SentenceTransformer
from keybert import KeyBERT

sync_engine = create_engine(settings.SQLALCHEMY_DATABASE_URI.replace("postgresql+asyncpg", "postgresql"))

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"

# Defensive Architecture: Lazy initialization to prevent memory leaks in Celery forks
_device = None
_embedding_model = None
_kw_model = None

def get_models():
    """
    Initializes ML models once per worker process.
    Implements a zero-cost optimization by sharing the MPNet model weights 
    between SentenceTransformer and KeyBERT.
    """
    global _device, _embedding_model, _kw_model
    if _embedding_model is None:
        # DEFENSIVE ARCHITECTURE: Strictly isolate to CPU.
        # This prevents Celery from consuming VRAM, leaving the GPU entirely 
        # dedicated to Ollama (MiniCPM Vision & Qwen RAG).
        _device = "cpu"
        structlog.get_logger().info("loading_ml_models", device=_device, model=MODEL_NAME)
        
        _embedding_model = SentenceTransformer(MODEL_NAME, device=_device)
        # Re-use the embedding model for KeyBERT to save RAM
        _kw_model = KeyBERT(model=_embedding_model)
        
    return _embedding_model, _kw_model, _device

def _embed_chunks(text: str, model: SentenceTransformer, device: str):
    """
    Splits text into 512-token chunks with 50-token overlap, 
    then embeds using hardware-aware batching.
    """
    try:
        text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            encoding_name="cl100k_base",
            chunk_size=512,
            chunk_overlap=50,
        )
        chunks = text_splitter.split_text(text)
    except Exception:
        # Fallback to character length if tiktoken fails
        chunks = RecursiveCharacterTextSplitter(
            chunk_size=2000,
            chunk_overlap=300,
            length_function=len,
        ).split_text(text)

    if not chunks:
        return []

    # Batch process for performance benchmark (<90s for 100 pages)
    vectors = model.encode(
        chunks, 
        batch_size=32, 
        device=device, 
        normalize_embeddings=True,
        show_progress_bar=False
    )
    
    return list(zip(chunks, vectors.tolist()))

def _auto_index_to_meilisearch(session: Session, dv: DocumentVersion, contribution: Contribution) -> None:
    """
    Auto-index teacher/admin documents to MeiliSearch after the Celery pipeline
    reaches READY. Student documents are NOT indexed here — they wait for admin
    approval via moderation_service.execute_contribution_review().
    """
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
        course_level = getattr(course.level, "value", course.level) if course and hasattr(course, "level") else None
        course_type = getattr(course.course_type, "value", course.course_type) if course and hasattr(course, "course_type") else None
        course_lang = getattr(course.language, "value", course.language) if course and hasattr(course, "language") else "FR"
        course_year = getattr(course, "academic_year", None) if course else None
        course_tags = getattr(course, "tags", []) if course else []
        filiere = department_name or (uploader.filiere if uploader and hasattr(uploader, "filiere") else None)

        doc_payload = {
            "id": str(dv.id),
            "document_version_id": str(dv.id),
            "course_id": str(course.id) if course else None,
            "title": getattr(contribution, "title", None) or (course.title if course else "Untitled Document"),
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
        index.update_settings({
            "typoTolerance": {
                "enabled": True,
                "minWordSizeForTypos": {"oneTypo": 4, "twoTypos": 8},
            }
        })
        index.add_documents([doc_payload], primary_key="id")
        log.info("auto_indexed_teacher_document", doc_id=str(dv.id))
    except Exception as e:
        log.error("auto_index_failed", error=str(e))


@shared_task(name="embed_document", bind=True)
def embed_document(self, document_version_id: str):
    log = structlog.get_logger().bind(task="embed_document", document_version_id=document_version_id)
    
    with Session(sync_engine) as session:
        dv = session.get(DocumentVersion, document_version_id)
        if not dv:
            log.warning("missing_document_version")
            return
        
        if not dv.ocr_text:
            log.warning("missing_ocr_text")
            dv.pipeline_status = DocumentPipelineStatus.READY
            session.add(dv)
            session.commit()
            return

        try:
            # 1. Load optimized ML models (CPU Isolated)
            embedding_model, kw_model, device = get_models()
            
            # 2. Extract Keywords (Auto-tagging US-08)
            # Truncate text to first 15,000 chars to avoid memory explosion on large books
            text_for_keywords = dv.ocr_text[:15000]
            keywords_scored = kw_model.extract_keywords(
                text_for_keywords, 
                keyphrase_ngram_range=(1, 2), 
                top_n=5
            )
            extracted_tags = [kw[0] for kw in keywords_scored] if keywords_scored else []
            
            # 3. Update Course Tags
            if dv.contribution_id:
                contribution = session.get(Contribution, dv.contribution_id)
                if contribution and contribution.course_id:
                    course = session.get(Course, contribution.course_id)
                    if course:
                        # Append new tags while keeping existing ones, ensuring uniqueness
                        existing_tags = set(course.tags or [])
                        existing_tags.update(extracted_tags)
                        course.tags = list(existing_tags)
                        session.add(course)

            # 4. Clear old embeddings and generate new ones
            session.exec(delete(DocumentEmbedding).where(DocumentEmbedding.document_version_id == dv.id))
            chunked_embeddings = _embed_chunks(dv.ocr_text, embedding_model, device)
            
            # 5. Insert pgvector records
            for idx, (chunk_text, vector) in enumerate(chunked_embeddings):
                emb = DocumentEmbedding(
                    document_version_id=dv.id,
                    vector=vector,
                    chunk_index=idx,
                    chunk_text=chunk_text
                )
                session.add(emb)

            # 6. Finalize Pipeline
            dv.pipeline_status = DocumentPipelineStatus.READY
            session.add(dv)
            session.commit()
            
            log.info(
                "embedded_and_tagged_stored", 
                chunks_count=len(chunked_embeddings),
                tags=extracted_tags,
                hardware=device
            )

            # 7. Auto-index to MeiliSearch for APPROVED teacher uploads
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