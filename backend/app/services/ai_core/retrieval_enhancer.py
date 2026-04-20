from __future__ import annotations

import logging
import re
from typing import Any, Iterable

logger = logging.getLogger(__name__)

_reranker = None
_reranker_failed = False

_LEADING_PATTERNS = [
    r"^\s*(what is|what are|define|explain|summarize)\s+",
    r"^\s*(quelle est|qu'est-ce que|quels sont|définis|définir|explique|résume)\s+",
]


def normalize_query_text(query: str) -> str:
    text = re.sub(r"\s+", " ", query).strip()
    text = text.replace("’", "'")
    return text


def expand_query_variants(query: str) -> list[str]:
    """
    Lightweight deterministic query expansion.

    Keeps the current API contract stable while broadening recall a bit for
    semantic retrieval and exact-text lookup.
    """
    base = normalize_query_text(query)
    variants = [base]

    lowered = base.lower()
    reduced = base
    for pattern in _LEADING_PATTERNS:
        reduced = re.sub(pattern, "", reduced, flags=re.IGNORECASE)
    reduced = normalize_query_text(reduced)
    if reduced and reduced.lower() != lowered and len(reduced) >= 4:
        variants.append(reduced)

    new_variants = []
    for v in variants:
        without_punct = normalize_query_text(re.sub(r"[^\w\s\-\+\./]", " ", v))
        if without_punct and without_punct.lower() not in {x.lower() for x in variants + new_variants}:
            new_variants.append(without_punct)
    variants.extend(new_variants)

    compact_math = normalize_query_text(
        base.replace(" ≥ ", " >= ")
        .replace(" ≤ ", " <= ")
        .replace(" ≠ ", " != ")
        .replace(" → ", " -> ")
    )
    if compact_math and compact_math.lower() not in {v.lower() for v in variants}:
        variants.append(compact_math)

    return variants[:5]


def _get_reranker():
    global _reranker, _reranker_failed
    if _reranker is not None or _reranker_failed:
        return _reranker
    try:
        from sentence_transformers import CrossEncoder

        _reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    except Exception as exc:
        _reranker_failed = True
        logger.warning("[RERANK] CrossEncoder unavailable, falling back to heuristic reranking: %s", exc)
    return _reranker


def rerank_chunks(query: str, chunks: Iterable[dict[str, Any]], top_k: int = 5) -> list[dict[str, Any]]:
    rows = list(chunks)
    if not rows:
        return []

    reranker = _get_reranker()
    if reranker is not None:
        try:
            pairs = [(query, row.get("chunk_text") or "") for row in rows]
            scores = reranker.predict(pairs)
            for row, score in zip(rows, scores):
                row["rerank_score"] = float(score)
            rows.sort(key=lambda item: item.get("rerank_score", 0.0), reverse=True)
            return rows[:top_k]
        except Exception as exc:
            logger.warning("[RERANK] CrossEncoder scoring failed, using heuristic fallback: %s", exc)

    query_terms = set(re.findall(r"\w+", query.lower()))
    for row in rows:
        text = (row.get("chunk_text") or "").lower()
        overlap = len(query_terms.intersection(re.findall(r"\w+", text)))
        row["rerank_score"] = (row.get("score") or 0.0) + overlap * 0.05
    rows.sort(key=lambda item: item.get("rerank_score", 0.0), reverse=True)
    return rows[:top_k]
