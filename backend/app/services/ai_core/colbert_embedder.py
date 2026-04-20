"""
ColBERT Multi-Vector Embeddings - Phase 3
Token-level embeddings for precise retrieval (equations, code, specific terms).
"""

import os
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import torch

logger = logging.getLogger(__name__)

COLBERT_MODEL = os.getenv("COLBERT_MODEL", "jinaai/jina-colbert-v2")
MAX_TOKENS_PER_CHUNK = 512


class ColbertEmbedder:
    """
    ATLAS-OCR-new style ColBERT embeddings.
    Returns 2D token matrices instead of single vectors.
    """

    def __init__(self):
        self._model = None
        self._tokenizer = None
        self._device = "cuda" if torch.cuda.is_available() else "cpu"

    def _load_model(self):
        """Lazy loading of ColBERT model."""
        if self._model is not None:
            return

        try:
            from transformers import AutoModel, AutoTokenizer

            logger.info(f"[COLBERT] Loading model: {COLBERT_MODEL}")

            self._tokenizer = AutoTokenizer.from_pretrained(COLBERT_MODEL, trust_remote_code=True)
            self._model = AutoModel.from_pretrained(COLBERT_MODEL, trust_remote_code=True)
            self._model.eval()
            self._model.to(self._device)

            logger.info("[COLBERT] Model loaded successfully")

        except Exception as e:
            logger.error(f"[COLBERT] Failed to load model: {e}")
            raise

    def encode(self, texts: List[str]) -> List[np.ndarray]:
        """
        Encodes texts to ColBERT token matrices.

        Returns:
            List of 2D arrays: (num_tokens, embedding_dim) per text
        """
        self._load_model()

        results = []

        with torch.no_grad():
            for text in texts:
                inputs = self._tokenizer(
                    text,
                    return_tensors="pt",
                    max_length=MAX_TOKENS_PER_CHUNK,
                    truncation=True,
                    padding=True,
                )
                inputs = {k: v.to(self._device) for k, v in inputs.items()}

                outputs = self._model(**inputs)

                token_embeddings = outputs.last_hidden_state

                attention_mask = inputs["attention_mask"]
                mask_2d = attention_mask.unsqueeze(-1).float()

                masked_embeddings = token_embeddings * mask_2d
                valid_tokens = attention_mask.sum(dim=1)

                num_valid = valid_tokens[0].item()
                embedding_matrix = masked_embeddings[0, :num_valid, :].cpu().numpy()

                results.append(embedding_matrix)

        return results

    def encode_single(self, text: str) -> np.ndarray:
        """Convenience method for single text."""
        return self.encode([text])[0]


class HybridEmbedder:
    """
    Combines SentenceTransformer (fast) + ColBERT (accurate).
    Uses ColBERT for technical content, SentenceTransformer for prose.
    """

    def __init__(self):
        self.colbert = ColbertEmbedder()
        self._st_model = None
        self._kw_model = None

    def _get_st_model(self):
        """Lazy load SentenceTransformer."""
        if self._st_model is None:
            from sentence_transformers import SentenceTransformer

            device = "cuda" if torch.cuda.is_available() else "cpu"
            self._st_model = SentenceTransformer(
                "sentence-transformers/paraphrase-multilingual-mpnet-base-v2", device=device
            )
        return self._st_model

    def embed_chunks(self, chunks: List[Dict[str, Any]]) -> List[Tuple[str, Any, str]]:
        """
        Embeds chunks with appropriate method.

        Returns:
            List of (text, embedding, method) where method is "colbert" or "st"
        """
        results = []

        for chunk in chunks:
            content = chunk["content"]
            chunk_type = chunk.get("chunk_type", "TEXT")
            is_atomic = chunk.get("is_atomic", False)

            if is_atomic or chunk_type in ["CODE", "MATH", "TABLE"]:
                try:
                    embedding = self.colbert.encode_single(content)
                    method = "colbert"
                except Exception as e:
                    logger.warning(f"[COLBERT] Failed, falling back to ST: {e}")
                    embedding = self._get_st_model().encode(content, normalize_embeddings=True)
                    method = "st"
            else:
                embedding = self._get_st_model().encode(content, normalize_embeddings=True)
                method = "st"

            results.append((content, embedding, method))

        return results


_hybrid_embedder: Optional[HybridEmbedder] = None


def get_hybrid_embedder() -> HybridEmbedder:
    """Returns singleton HybridEmbedder."""
    global _hybrid_embedder
    if _hybrid_embedder is None:
        _hybrid_embedder = HybridEmbedder()
    return _hybrid_embedder
