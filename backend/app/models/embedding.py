from typing import Optional, List
from datetime import datetime
import uuid
from sqlmodel import SQLModel, Field, Relationship
import sqlalchemy as sa

class DocumentEmbedding(SQLModel, table=True):
    """
    Legacy compatibility model.

    The platform now stores embeddings in Qdrant, but some existing code paths
    still reference this SQLModel relationship/table during startup and cleanup.
    Keep the model importable without requiring the PostgreSQL pgvector extension.
    """

    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    document_version_id: uuid.UUID = Field(foreign_key="documentversion.id", index=True)

    # Legacy storage fallback only. Primary vector storage now lives in Qdrant.
    vector: Optional[List[float]] = Field(default=None, sa_column=sa.Column(sa.JSON()))

    chunk_index: int = 0
    chunk_text: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Use quotes to avoid circular imports if DocumentVersion is defined elsewhere
    document_version: Optional["DocumentVersion"] = Relationship(back_populates="embeddings")
