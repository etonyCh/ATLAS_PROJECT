from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Iterator

import numpy as np
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image

logger = logging.getLogger(__name__)

DEFAULT_VLM_BATCH_SIZE = int(os.getenv("OCR_VLM_BATCH_SIZE", "6"))
DEFAULT_VLM_DPI = int(os.getenv("OCR_VLM_DPI", "220"))
HANDWRITING_TEXT_THRESHOLD = int(os.getenv("OCR_HANDWRITING_TEXT_THRESHOLD", "120"))
LARGE_PDF_PAGE_THRESHOLD = int(os.getenv("OCR_LARGE_PDF_PAGE_THRESHOLD", "24"))


def get_pdf_page_count(file_path: str) -> int:
    try:
        with pdfplumber.open(file_path) as pdf:
            return len(pdf.pages)
    except Exception:
        return 0


def extract_quick_pdf_text(file_path: str, max_pages: int = 3) -> str:
    snippets: list[str] = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages[:max_pages]:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    snippets.append(page_text.strip())
    except Exception as exc:
        logger.debug("quick_pdf_text_failed", extra={"error": str(exc)})
    return "\n".join(snippets)


def detect_handwriting_risk(file_path: str, max_pages: int = 3) -> bool:
    """
    Heuristic detector for PDFs that behave like scanned or handwritten material.

    We treat very low extractable text density in the first pages as a strong
    signal that OCR should prefer a vision-first path.
    """
    sample_text = extract_quick_pdf_text(file_path, max_pages=max_pages)
    page_count = max(1, min(get_pdf_page_count(file_path), max_pages))
    avg_chars_per_page = len(sample_text.strip()) / page_count if page_count else 0
    return avg_chars_per_page < HANDWRITING_TEXT_THRESHOLD


def should_force_vlm_ocr(
    file_path: str,
    quick_text: str,
    page_count: int,
    handwriting_risk: bool,
) -> bool:
    if Path(file_path).suffix.lower() in {".png", ".jpg", ".jpeg"}:
        return True
    if handwriting_risk:
        return True
    if page_count >= LARGE_PDF_PAGE_THRESHOLD and len(quick_text.strip()) < HANDWRITING_TEXT_THRESHOLD * 2:
        return True
    return False


def iter_pdf_page_images(
    file_path: str,
    dpi: int = DEFAULT_VLM_DPI,
    batch_size: int = DEFAULT_VLM_BATCH_SIZE,
) -> Iterator[list[tuple[int, Image.Image]]]:
    """
    Yields rendered page images in batches so large scanned PDFs do not force
    a single in-memory OCR run.
    """
    pdf = pdfium.PdfDocument(file_path)
    total_pages = len(pdf)
    try:
        batch: list[tuple[int, Image.Image]] = []
        scale = dpi / 72.0
        for page_index in range(total_pages):
            page = pdf[page_index]
            bitmap = page.render(scale=scale)
            pil_image = bitmap.to_pil().convert("RGB")
            batch.append((page_index + 1, pil_image))
            if len(batch) >= batch_size:
                yield batch
                batch = []
        if batch:
            yield batch
    finally:
        pdf.close()


def laplacian_variance(pil_img: Image.Image) -> float:
    import cv2

    img_cv = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())
