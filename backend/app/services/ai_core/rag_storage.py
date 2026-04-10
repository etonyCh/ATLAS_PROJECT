"""
Compatibility wrapper for RAG storage.

Historically this module used PostgreSQL + pgvector. The platform now uses
Qdrant for vector storage, but several routers still import this module name.
Keep that import stable while delegating all work to the Qdrant implementation.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from .rag_storage_qdrant import ensure_document_indexed, retrieve_rag_context


async def get_or_create_rag_collection(
    session: AsyncSession, document_version_id: str
) -> str:
    """
    Legacy compatibility helper.

    Older call sites expect this function to return the document_version_id
    after ensuring embeddings exist. In the Qdrant world, indexing is handled
    asynchronously, so we simply check/index state and return the id unchanged.
    """
    await ensure_document_indexed(session, document_version_id)
    return document_version_id


__all__ = ["get_or_create_rag_collection", "retrieve_rag_context"]
