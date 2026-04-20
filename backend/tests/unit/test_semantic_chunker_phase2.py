from app.services.ai_core import semantic_chunker


def test_chunk_for_embedding_preserves_atomic_blocks() -> None:
    text = (
        "Introduction to the lesson.\n\n"
        "```python\nprint('atlas')\n```\n\n"
        "Closing remarks."
    )

    chunks = semantic_chunker.chunk_for_embedding(text, chunk_size=20)

    assert chunks
    assert any(chunk["chunk_type"] == "CODE" for chunk in chunks)
    assert any(chunk["chunk_type"] == "TEXT" for chunk in chunks)
    code_chunk = next(chunk for chunk in chunks if chunk["chunk_type"] == "CODE")
    assert code_chunk["is_atomic"] is True
    assert "print('atlas')" in code_chunk["content"]


def test_chunk_for_embedding_truncates_oversized_atomic_blocks(monkeypatch) -> None:
    monkeypatch.setattr(semantic_chunker, "_ENCODER", None)
    monkeypatch.setattr(semantic_chunker, "_EMBED_MAX_TOKENS", 10)
    text = "```text\n" + " ".join(f"word{i}" for i in range(30)) + "\n```"

    chunks = semantic_chunker.chunk_for_embedding(text, chunk_size=20)

    assert len(chunks) == 1
    assert chunks[0]["chunk_type"] == "CODE"
    assert chunks[0]["token_count"] <= 10
    assert len(chunks[0]["content"].split()) < 30
