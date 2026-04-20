"""
Qdrant Vector Database Client for ATLAS AI Services
Architecture: Hybrid Dense + Sparse Vector Storage

Replaces pgvector for all AI-related embeddings:
- RAG document retrieval
- Flashcard context
- Summarization vectors
- Semantic search
"""

import os
import re
import math
import logging
import asyncio
import uuid
from typing import List, Dict, Optional, Any, Tuple
from functools import lru_cache

import numpy as np
from qdrant_client import QdrantClient, models
from qdrant_client.http.models import Distance, VectorParams, SparseVectorParams

from app.core.config import settings

logger = logging.getLogger(__name__)

# Collection names for different AI services
COLLECTION_DOCUMENTS = "atlas_documents"
COLLECTION_FLASHCARDS = "atlas_flashcards"
COLLECTION_SUMMARIES = "atlas_summaries"

# Named vector configurations
DENSE_VECTOR_NAME = "dense"
SPARSE_VECTOR_NAME = "sparse"

# Embedding dimension from config or default
EMBEDDING_DIM = getattr(settings, "EMBEDDING_DIMENSION", 768)


class QdrantManager:
    """
    Manages Qdrant collections for ATLAS AI services.
    Provides hybrid dense (semantic) + sparse (lexical) vector storage.
    """

    def __init__(self):
        self._client: Optional[QdrantClient] = None
        self._initialized_collections: set = set()

    def get_client(self) -> QdrantClient:
        """Lazy initialization of Qdrant client."""
        if self._client is None:
            qdrant_url = getattr(
                settings, "QDRANT_URL", os.getenv("QDRANT_URL", "http://localhost:6333")
            )

            logger.info(f"[QDRANT] Connecting to {qdrant_url}")
            self._client = QdrantClient(url=qdrant_url, timeout=30)

            # Health check
            try:
                self._client.get_collections()
                logger.info("[QDRANT] Connection established successfully")
            except Exception as e:
                logger.error(f"[QDRANT] Connection failed: {e}")
                raise

        return self._client

    def ensure_collection(self, collection_name: str, use_multivector: bool = False) -> None:
        """
        Ensures collection exists. If use_multivector=True, configures for ColBERT.
        """
        if collection_name in self._initialized_collections:
            return

        client = self.get_client()

        if client.collection_exists(collection_name):
            logger.debug(f"[QDRANT] Collection '{collection_name}' already exists")
            self._initialized_collections.add(collection_name)
            return

        logger.info(
            f"[QDRANT] Creating collection: {collection_name} (multivector={use_multivector})"
        )

        if use_multivector:
            vectors_config = {
                DENSE_VECTOR_NAME: VectorParams(
                    size=EMBEDDING_DIM,
                    distance=Distance.DOT,
                    multivector_config=models.MultiVectorConfig(
                        comparator=models.MultiVectorComparator.MAX_SIM
                    ),
                    hnsw_config=models.HnswConfigDiff(m=16, ef_construct=200),
                ),
            }
        else:
            vectors_config = {
                DENSE_VECTOR_NAME: VectorParams(
                    size=EMBEDDING_DIM,
                    distance=Distance.COSINE,
                    hnsw_config=models.HnswConfigDiff(
                        m=16,
                        ef_construct=200,
                    ),
                ),
            }

        client.create_collection(
            collection_name=collection_name,
            vectors_config=vectors_config,
            sparse_vectors_config={
                SPARSE_VECTOR_NAME: SparseVectorParams(
                    index=models.SparseIndexParams(on_disk=False)
                ),
            },
            quantization_config=models.ScalarQuantization(
                scalar=models.ScalarQuantizationConfig(
                    type=models.ScalarType.INT8,
                    always_ram=True,
                )
            ),
        )

        # Create payload indexes for filtering
        client.create_payload_index(
            collection_name=collection_name,
            field_name="document_version_id",
            field_schema=models.KeywordIndexParams(type=models.KeywordIndexType.KEYWORD),
        )
        client.create_payload_index(
            collection_name=collection_name,
            field_name="chunk_index",
            field_schema=models.IntegerIndexParams(type=models.IntegerIndexType.INTEGER),
        )
        client.create_payload_index(
            collection_name=collection_name,
            field_name="content_type",
            field_schema=models.KeywordIndexParams(type=models.KeywordIndexType.KEYWORD),
        )

        self._initialized_collections.add(collection_name)
        logger.info(f"[QDRANT] Collection '{collection_name}' created successfully")

    def upsert_embeddings(
        self,
        collection_name: str,
        document_version_id: str,
        chunks: List[Tuple[str, List[float]]],  # (text, dense_vector)
        content_type: str = "document",
        metadata: Optional[List[Dict]] = None,
    ) -> None:
        """
        Stores document chunks with both dense and sparse vectors.

        Args:
            collection_name: Target Qdrant collection
            document_version_id: UUID of the document version
            chunks: List of (chunk_text, dense_embedding_vector) tuples
            content_type: Type of content for filtering
            metadata: Optional list of metadata dicts (Phase 2: chunk_type, is_atomic, token_count)
        """
        self.ensure_collection(collection_name)

        if not chunks:
            logger.warning(f"[QDRANT] No chunks to upsert for {document_version_id}")
            return

        client = self.get_client()
        points = []

        # Generate sparse vectors for lexical matching
        sparse_vectors = _compute_bm25_sparse_vectors([chunk[0] for chunk in chunks])

        for idx, ((chunk_text, dense_vector), sparse_vec) in enumerate(zip(chunks, sparse_vectors)):
            # Generate valid UUID5 from document_version_id + chunk index
            point_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"{document_version_id}_{idx}")

            payload = {
                "document_version_id": document_version_id,
                "chunk_index": idx,
                "chunk_text": chunk_text,
                "content_type": content_type,
            }

            if metadata and idx < len(metadata):
                payload["chunk_type"] = metadata[idx].get("chunk_type", "TEXT")
                payload["is_atomic"] = metadata[idx].get("is_atomic", False)
                payload["token_count"] = metadata[idx].get("token_count", 0)

            points.append(
                models.PointStruct(
                    id=str(point_id),  # Convert UUID to string for Pydantic validation
                    vector={
                        DENSE_VECTOR_NAME: dense_vector,
                        SPARSE_VECTOR_NAME: sparse_vec,
                    },
                    payload=payload,
                )
            )

        # Batch upsert
        client.upsert(
            collection_name=collection_name,
            points=points,
            wait=True,
        )

        logger.info(
            f"[QDRANT] Upserted {len(points)} points to '{collection_name}' "
            f"for document {document_version_id}"
        )

    def search_similar(
        self,
        collection_name: str,
        query_vector: List[float],
        query_text: Optional[str] = None,
        document_version_id: Optional[str] = None,
        top_k: int = 5,
        score_threshold: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Hybrid search using both dense (semantic) and sparse (lexical) vectors.
        Uses Reciprocal Rank Fusion (RRF) to combine results.
        """
        self.ensure_collection(collection_name)

        client = self.get_client()

        # Build filter if document_version_id specified
        query_filter = None
        if document_version_id:
            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_version_id",
                        match=models.MatchValue(value=document_version_id),
                    )
                ]
            )

        # Generate sparse query vector
        sparse_query = _compute_bm25_sparse_vectors([query_text or ""])[0]

        # Hybrid search with prefetch + RRF fusion
        results = client.query_points(
            collection_name=collection_name,
            prefetch=[
                # Dense semantic search
                models.Prefetch(
                    query=query_vector,
                    using=DENSE_VECTOR_NAME,
                    limit=top_k * 3,
                    filter=query_filter,
                ),
                # Sparse lexical search
                models.Prefetch(
                    query=models.SparseVector(
                        indices=sparse_query["indices"],
                        values=sparse_query["values"],
                    ),
                    using=SPARSE_VECTOR_NAME,
                    limit=top_k * 3,
                    filter=query_filter,
                ),
            ],
            query=models.FusionQuery(fusion=models.Fusion.RRF),
            limit=top_k,
            with_payload=True,
        )

        return [
            {
                "id": point.id,
                "score": point.score,
                "chunk_text": point.payload.get("chunk_text"),
                "chunk_index": point.payload.get("chunk_index"),
                "document_version_id": point.payload.get("document_version_id"),
            }
            for point in results.points
        ]

    def search_by_text(
        self,
        collection_name: str,
        query_text: str,
        embedder,  # Embedding model/function
        document_version_id: Optional[str] = None,
        top_k: int = 5,
        score_threshold: float = 0.15,
    ) -> Tuple[Optional[str], float, Optional[int], Optional[str]]:
        """
        Full RAG search: embed query text, search, return top context.
        Returns: (context_text, max_score, source_chunk_index, matched_chunk_text)
        """
        # Generate dense embedding
        query_vector = embedder.encode([query_text], normalize_embeddings=True)[0].tolist()

        # Search
        results = self.search_similar(
            collection_name=collection_name,
            query_vector=query_vector,
            query_text=query_text,
            document_version_id=document_version_id,
            top_k=top_k,
        )

        if not results:
            return None, 0.0, None, None

        top_result = results[0]
        max_score = top_result["score"]

        if max_score < score_threshold:
            logger.info(f"[QDRANT] Score {max_score:.3f} below threshold {score_threshold}")
            return None, max_score, None, None

        # Build context from relevant results
        relevant = [r for r in results if r["score"] >= score_threshold]
        context_parts = [f"[Snippet {r['chunk_index']}] {r['chunk_text']}" for r in relevant]
        context = "\n\n".join(context_parts)

        return context, max_score, top_result["chunk_index"], top_result["chunk_text"]

    def get_document_chunks(
        self,
        collection_name: str,
        document_version_id: str,
        limit: int = 256,
    ) -> List[Dict[str, Any]]:
        """
        Returns ordered chunk payloads for a single document version.
        """
        self.ensure_collection(collection_name)
        client = self.get_client()

        points, _ = client.scroll(
            collection_name=collection_name,
            scroll_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_version_id",
                        match=models.MatchValue(value=document_version_id),
                    )
                ]
            ),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )

        rows: List[Dict[str, Any]] = []
        for point in points:
            payload = point.payload or {}
            rows.append(
                {
                    "chunk_index": int(payload.get("chunk_index") or 0),
                    "chunk_text": payload.get("chunk_text") or "",
                    "document_version_id": payload.get("document_version_id"),
                    "content_type": payload.get("content_type") or "document",
                    "chunk_type": payload.get("chunk_type") or "TEXT",
                    "is_atomic": bool(payload.get("is_atomic") or False),
                    "token_count": int(payload.get("token_count") or 0),
                }
            )

        rows.sort(key=lambda item: item["chunk_index"])
        return rows

    def delete_document_embeddings(
        self,
        collection_name: str,
        document_version_id: str,
    ) -> None:
        """Deletes all embeddings for a specific document version."""
        self.ensure_collection(collection_name)

        client = self.get_client()

        client.delete(
            collection_name=collection_name,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_version_id",
                            match=models.MatchValue(value=document_version_id),
                        )
                    ]
                )
            ),
            wait=True,
        )

        logger.info(f"[QDRANT] Deleted embeddings for document {document_version_id}")


# Module-level singleton
_qdrant_manager: Optional[QdrantManager] = None


def get_qdrant_manager() -> QdrantManager:
    """Returns singleton QdrantManager instance."""
    global _qdrant_manager
    if _qdrant_manager is None:
        _qdrant_manager = QdrantManager()
    return _qdrant_manager


def _compute_bm25_sparse_vectors(texts: List[str]) -> List[Dict[str, Any]]:
    """
    Generates TF-normalized sparse vectors for BM25-style lexical retrieval.

    Args:
        texts: List of text strings to vectorize

    Returns:
        List of sparse vector dicts with "indices" and "values" keys
    """
    sparse_vectors = []

    for text in texts:
        # Tokenize: lowercase, extract alphanumeric tokens
        tokens = re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)*", text.lower())

        term_freq: Dict[str, int] = {}
        for token in tokens:
            term_freq[token] = term_freq.get(token, 0) + 1

        if not term_freq:
            # Empty text - return dummy zero vector
            sparse_vectors.append({"indices": [0], "values": [0.0]})
            continue

        # Stable integer indices via hash
        indices = [abs(hash(term)) % (2**31) for term in term_freq.keys()]
        # Sublinear TF scaling: log(1 + tf)
        values = [math.log1p(tf) for tf in term_freq.values()]

        sparse_vectors.append({"indices": indices, "values": values})

    return sparse_vectors
