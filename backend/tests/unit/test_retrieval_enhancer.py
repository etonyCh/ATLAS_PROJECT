from app.services.ai_core import retrieval_enhancer


def test_expand_query_variants_normalizes_and_reduces_prompt_words() -> None:
    variants = retrieval_enhancer.expand_query_variants("Explain binary-tree insertion?!")

    assert variants[0] == "Explain binary-tree insertion?!"
    assert "binary-tree insertion" in [variant.lower() for variant in variants]
    assert any("binary-tree insertion" in variant.lower() for variant in variants[1:])


def test_rerank_chunks_uses_heuristic_fallback(monkeypatch) -> None:
    monkeypatch.setattr(retrieval_enhancer, "_get_reranker", lambda: None)
    chunks = [
        {"chunk_text": "Tree traversal and insertion in a binary search tree", "score": 0.10},
        {"chunk_text": "Sorting basics only", "score": 0.20},
    ]

    ranked = retrieval_enhancer.rerank_chunks("binary search tree insertion", chunks, top_k=2)

    assert ranked[0]["chunk_text"].startswith("Tree traversal")
    assert ranked[0]["rerank_score"] > ranked[1]["rerank_score"]
