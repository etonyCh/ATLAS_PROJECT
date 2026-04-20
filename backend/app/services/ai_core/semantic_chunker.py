"""
Semantic chunking for indexed academic documents.

This parser preserves structural blocks such as code, math, tables, and image
references as atomic units while prose is chunked with token-aware overlap.
Large atomic blocks are hard-truncated to the embedding model limit so the
vectorization pipeline survives malformed or oversized content.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

try:
    import tiktoken

    _ENCODER = tiktoken.get_encoding("cl100k_base")
except ImportError:
    _ENCODER = None


_ATOMIC_BLOCK_PATTERN = re.compile(
    r"("
    r"```[\s\S]*?```"
    r"|\$\$[\s\S]*?\$\$"
    r"|\\\[[\s\S]*?\\\]"
    r"|!\[.*?\]\(.*?\)"
    r"|(?:^\|.+\|\s*\n)+(?:^\|[-:\s|]+\|\s*\n)?(?:^\|.+\|\s*\n)*"
    r")",
    re.MULTILINE,
)

_EMBED_MAX_TOKENS = int(os.getenv("EMBEDDING_MAX_TOKENS", "8192"))


@dataclass
class SemanticChunk:
    content: str
    chunk_type: str
    token_count: int
    metadata: Dict[str, Any]


def _count_tokens(text: str) -> int:
    if _ENCODER is not None:
        return len(_ENCODER.encode(text))
    return max(1, int(len(text.split()) * 1.3))


def _hard_truncate(text: str, limit: int) -> str:
    if _ENCODER is not None:
        return _ENCODER.decode(_ENCODER.encode(text)[:limit]).strip()
    words = text.split()
    approx = max(1, int(limit / 1.3))
    return " ".join(words[:approx]).strip()


def _detect_atomic_type(block: str) -> str:
    stripped = block.strip()
    if stripped.startswith("```"):
        return "CODE"
    if stripped.startswith("$$") or stripped.startswith(r"\[") or stripped.startswith(r"\("):
        return "MATH"
    if stripped.startswith("!["):
        return "IMAGE"
    if stripped.startswith("|"):
        return "TABLE"
    return "TEXT"


class SemanticChunker:
    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50):
        self.chunk_size = max(64, chunk_size)
        self.chunk_overlap = max(0, min(chunk_overlap, self.chunk_size // 2))

    def chunk(self, text: str) -> List[SemanticChunk]:
        if not text or not text.strip():
            return []

        chunks: List[SemanticChunk] = []
        segments = _ATOMIC_BLOCK_PATTERN.split(text)
        prose_buffer = ""

        for idx, segment in enumerate(segments):
            if not segment or not segment.strip():
                continue

            if idx % 2 == 1:
                if prose_buffer.strip():
                    chunks.extend(self._chunk_prose(prose_buffer))
                    prose_buffer = ""

                block_type = _detect_atomic_type(segment)
                content = segment.strip()
                token_count = _count_tokens(content)
                if token_count > _EMBED_MAX_TOKENS:
                    logger.warning(
                        "Semantic chunker truncating oversized atomic block type=%s tokens=%d limit=%d",
                        block_type,
                        token_count,
                        _EMBED_MAX_TOKENS,
                    )
                    content = _hard_truncate(content, _EMBED_MAX_TOKENS)
                    token_count = _count_tokens(content)

                chunks.append(
                    SemanticChunk(
                        content=content,
                        chunk_type=block_type,
                        token_count=token_count,
                        metadata={"atomic": True},
                    )
                )
                continue

            prose_buffer += segment
            if _count_tokens(prose_buffer) >= self.chunk_size * 3:
                chunks.extend(self._chunk_prose(prose_buffer))
                prose_buffer = ""

        if prose_buffer.strip():
            chunks.extend(self._chunk_prose(prose_buffer))

        return chunks

    def _chunk_prose(self, text: str) -> List[SemanticChunk]:
        if _ENCODER is not None:
            token_ids = _ENCODER.encode(text)
            if not token_ids:
                return []

            step = max(1, self.chunk_size - self.chunk_overlap)
            rows: List[SemanticChunk] = []
            for start in range(0, len(token_ids), step):
                token_window = token_ids[start : start + self.chunk_size]
                chunk_text = _ENCODER.decode(token_window).strip()
                if not chunk_text:
                    continue
                rows.append(
                    SemanticChunk(
                        content=chunk_text,
                        chunk_type="TEXT",
                        token_count=len(token_window),
                        metadata={"atomic": False},
                    )
                )
                if start + self.chunk_size >= len(token_ids):
                    break
            return rows

        words = text.split()
        if not words:
            return []

        words_per_chunk = max(1, int(self.chunk_size / 1.3))
        overlap_words = max(0, int(self.chunk_overlap / 1.3))
        step = max(1, words_per_chunk - overlap_words)

        rows: List[SemanticChunk] = []
        for start in range(0, len(words), step):
            chunk_text = " ".join(words[start : start + words_per_chunk]).strip()
            if not chunk_text:
                continue
            rows.append(
                SemanticChunk(
                    content=chunk_text,
                    chunk_type="TEXT",
                    token_count=_count_tokens(chunk_text),
                    metadata={"atomic": False},
                )
            )
            if start + words_per_chunk >= len(words):
                break
        return rows


def chunk_for_embedding(text: str, chunk_size: int = 512) -> List[Dict[str, Any]]:
    chunker = SemanticChunker(chunk_size=chunk_size)
    chunks = chunker.chunk(text)
    return [
        {
            "content": chunk.content,
            "chunk_type": chunk.chunk_type,
            "token_count": chunk.token_count,
            "is_atomic": chunk.metadata.get("atomic", False),
        }
        for chunk in chunks
    ]
