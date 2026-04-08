"""
RAG Storage Service - Qdrant Implementation
Replaces pgvector with Qdrant for all vector operations.

Architecture: Hybrid Dense + Sparse Vector Retrieval
- Dense vectors: SentenceTransformer embeddings for semantic similarity
- Sparse vectors: BM25-style TF vectors for exact lexical matching
- Fusion: Reciprocal Rank Fusion (RRF) for combined results
"""

import os
import logging
import asyncio
from typing import Optional, Tuple

os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_HUB_OFFLINE", "1")

from sqlalchemy.ext.asyncio import AsyncSession
from sentence_transformers import SentenceTransformer

from app.models.all_models import DocumentVersion
from app.core.config import settings
from app.core.qdrant_client import get_qdrant_manager, COLLECTION_DOCUMENTS

logger = logging.getLogger(__name__)

# Configuration
EMBEDDER_MODEL = getattr(settings, "EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-mpnet-base-v2")
SIMILARITY_THRESHOLD = 0.15
RELEVANT_CONTEXT_FLOOR = 0.22
RELEVANT_CONTEXT_MARGIN = 0.08

# Lazy embedder singleton
_embedder: Optional[SentenceTransformer] = None


def _initialize_embedder() -> Optional[SentenceTransformer]:
    """Initializes the local SentenceTransformer on CPU."""
    global _embedder
    if _embedder is None:
        try:
            logger.info(f"[RAG] Loading SentenceTransformer: {EMBEDDER_MODEL}")
            _embedder = SentenceTransformer(EMBEDDER_MODEL, device="cpu")
        except Exception as e:
            logger.error(f"[RAG] Failed to load embedder: {e}")
    return _embedder


def get_embedder() -> Optional[SentenceTransformer]:
    """Returns initialized embedder."""
    return _initialize_embedder()


async def ensure_document_indexed(session: AsyncSession, document_version_id: str) -> bool:
    """
    Verifies document embeddings exist in Qdrant.
    Returns True if indexed, False otherwise.
    """
    try:
        # Check if document exists in Qdrant by attempting a search
        qdrant = get_qdrant_manager()
        
        # Try to search with a dummy vector - if collection doesn't exist, this will fail
        # A simpler check would be to query by document_version_id filter
        # But for now, we'll check the document status in PG
        
        result = await session.execute(
            select(DocumentVersion).where(DocumentVersion.id == document_version_id)
        )
        doc = result.scalars().first()
        
        if not doc:
            logger.warning(f"[RAG] Document {document_version_id} not found in database")
            return False
            
        # Check if document has OCR text but embeddings may be missing
        if doc and doc.ocr_text:
            # Trigger embedding generation if needed (via Celery task)
            # For now, assume embeddings exist if pipeline status is READY
            return doc.pipeline_status == "READY"
            
        return False
        
    except Exception as e:
        logger.error(f"[RAG] Error checking document index: {e}")
        return False


# Need to import select
from sqlalchemy import select


async def retrieve_rag_context(
    session: AsyncSession,
    query: str,
    document_version_id: str,
) -> Tuple[Optional[str], float, Optional[int], Optional[str]]:
    """
    Executes RAG retrieval using Qdrant hybrid search.
    
    Returns:
        Tuple of (context_text, max_similarity_score, source_chunk_index, top_chunk_text)
    """
    embedder = get_embedder()
    if not embedder:
        logger.error("[RAG] Embedder not available")
        return None, 0.0, None, None

    try:
        # Use Qdrant for hybrid search
        qdrant = get_qdrant_manager()
        
        context, max_score, chunk_idx, chunk_text = await asyncio.to_thread(
            qdrant.search_by_text,
            COLLECTION_DOCUMENTS,
            query,
            embedder,
            document_version_id,
            top_k=5,
            score_threshold=SIMILARITY_THRESHOLD,
        )
        
        return context, max_score, chunk_idx, chunk_text
        
    except Exception as e:
        logger.error(f"[RAG] Qdrant retrieval failed: {e}")
        return None, 0.0, None, None


async def index_document_chunks(
    document_version_id: str,
    chunks: list,
    chunk_embeddings: list,
) -> bool:
    """
    Stores document chunks in Qdrant for RAG retrieval.
    
    Args:
        document_version_id: UUID of the document
        chunks: List of chunk texts
        chunk_embeddings: List of embedding vectors (dense only, sparse computed internally)
    """
    try:
        if not chunks or not chunk_embeddings:
            logger.warning(f"[RAG] No chunks to index for {document_version_id}")
            return False

        qdrant = get_qdrant_manager()
        
        # Prepare chunks with their embeddings
        chunk_data = list(zip(chunks, chunk_embeddings))
        
        await asyncio.to_thread(
            qdrant.upsert_embeddings,
            COLLECTION_DOCUMENTS,
            document_version_id,
            chunk_data,
            content_type="document",
        )
        
        logger.info(f"[RAG] Indexed {len(chunks)} chunks for document {document_version_id}")
        return True
        
    except Exception as e:
        logger.error(f"[RAG] Failed to index document chunks: {e}")
        return False


async def delete_document_index(document_version_id: str) -> bool:
    """Deletes all Qdrant embeddings for a document."""
    try:
        qdrant = get_qdrant_manager()
        await asyncio.to_thread(
            qdrant.delete_document_embeddings,
            COLLECTION_DOCUMENTS,
            document_version_id,
        )
        return True
    except Exception as e:
        logger.error(f"[RAG] Failed to delete document index: {e}")
        return False
