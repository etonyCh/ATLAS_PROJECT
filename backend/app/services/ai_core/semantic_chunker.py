"""
Semantic Chunking - Phase 2
Preserves atomic blocks (equations, tables, code) while chunking prose.
"""

import re
import os
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class SemanticChunk:
    content: str
    chunk_type: str
    token_count: int
    metadata: Dict[str, Any]


class SemanticChunker:
    """
    ATLAS-OCR-new style semantic chunking.
    Treats structural elements as atomic - never splits mid-equation.
    """

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

        self.patterns = {
            "CODE": re.compile(r"(```[\s\S]*?```)"),
            "MATH": re.compile(r"(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])"),
            "INLINE_MATH": re.compile(r"(?<!\$)\$([^\$]+)\$(?!\$)"),
            "TABLE": re.compile(r"(^\|.+?\|$\n(?:\|[-\s:]+\|$\n)?(?:\|.+?\|$\n)*)", re.MULTILINE),
            "IMAGE": re.compile(r"(!\[.*?\]\(.*?\))"),
        }

        try:
            import tiktoken

            self.encoder = tiktoken.get_encoding("cl100k_base")
            self._use_tiktoken = True
        except ImportError:
            self.encoder = None
            self._use_tiktoken = False

    def count_tokens(self, text: str) -> int:
        if self._use_tiktoken and self.encoder:
            return len(self.encoder.encode(text))
        return int(len(text.split()) * 1.3)

    def chunk(self, text: str) -> List[SemanticChunk]:
        """
        Main entry point. Splits text into semantic chunks.
        """
        if not text or not text.strip():
            return []

        chunks = []

        combined_pattern = re.compile("|".join(f"({p.pattern})" for p in self.patterns.values()))

        segments = combined_pattern.split(text)
        current_buffer = ""

        for segment in segments:
            if not segment or not segment.strip():
                continue

            block_type = self._classify_block(segment)

            if block_type != "TEXT":
                if current_buffer.strip():
                    chunks.extend(self._chunk_prose(current_buffer))
                    current_buffer = ""

                token_count = self.count_tokens(segment)
                chunks.append(
                    SemanticChunk(
                        content=segment.strip(),
                        chunk_type=block_type,
                        token_count=token_count,
                        metadata={"atomic": True},
                    )
                )
            else:
                current_buffer += segment + "\n"
                if self.count_tokens(current_buffer) >= self.chunk_size:
                    chunks.extend(self._chunk_prose(current_buffer))
                    current_buffer = ""

        if current_buffer.strip():
            chunks.extend(self._chunk_prose(current_buffer))

        return chunks

    def _classify_block(self, text: str) -> str:
        """Classifies text segment by type."""
        text = text.strip()

        for block_type, pattern in self.patterns.items():
            if pattern.fullmatch(text):
                return block_type

        return "TEXT"

    def _chunk_prose(self, text: str) -> List[SemanticChunk]:
        """Chunks standard text with overlap."""
        chunks = []
        words = text.split()

        words_per_chunk = int(self.chunk_size / 1.3)
        step = max(1, words_per_chunk - int(self.chunk_overlap / 1.3))

        for i in range(0, len(words), step):
            chunk_words = words[i : i + words_per_chunk]
            chunk_text = " ".join(chunk_words)

            if chunk_text.strip():
                chunks.append(
                    SemanticChunk(
                        content=chunk_text.strip(),
                        chunk_type="TEXT",
                        token_count=self.count_tokens(chunk_text),
                        metadata={"atomic": False},
                    )
                )

        return chunks


def chunk_for_embedding(text: str, chunk_size: int = 512) -> List[Dict[str, Any]]:
    """
    Convenience function for embedding_tasks_qdrant.py integration.
    Returns list of dicts with content and metadata.
    """
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
