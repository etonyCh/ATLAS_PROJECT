from app.services.doc_processing import ocr_strategy


def test_detect_handwriting_risk_uses_low_text_density(monkeypatch) -> None:
    monkeypatch.setattr(ocr_strategy, "extract_quick_pdf_text", lambda _path, max_pages=3: "x" * 30)
    monkeypatch.setattr(ocr_strategy, "get_pdf_page_count", lambda _path: 3)

    assert ocr_strategy.detect_handwriting_risk("scan.pdf") is True


def test_should_force_vlm_ocr_for_large_sparse_pdf() -> None:
    assert ocr_strategy.should_force_vlm_ocr(
        "lecture.pdf",
        quick_text="short text",
        page_count=ocr_strategy.LARGE_PDF_PAGE_THRESHOLD,
        handwriting_risk=False,
    ) is True


def test_should_force_vlm_ocr_for_images() -> None:
    assert ocr_strategy.should_force_vlm_ocr(
        "page.jpeg",
        quick_text="",
        page_count=1,
        handwriting_risk=False,
    ) is True
