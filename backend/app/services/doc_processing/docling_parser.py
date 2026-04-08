"""
Docling Integration - Phase 1
Parses PDFs to structured Markdown with equation/table preservation.
"""

import logging
from pathlib import Path
from typing import Optional, Dict, Any
import os

logger = logging.getLogger(__name__)

_docling_available = False
_document_converter = None


def _get_converter():
    global _docling_available, _document_converter
    if _document_converter is None:
        try:
            from docling.document_converter import DocumentConverter
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.document import ConversionResult

            _document_converter = DocumentConverter(
                allowed_formats=[InputFormat.PDF, InputFormat.IMAGE]
            )
            _docling_available = True
            logger.info("[DOCLING] Converter initialized successfully")
        except ImportError as e:
            logger.warning(f"[DOCLING] Not available: {e}")
            _docling_available = False
    return _document_converter


def is_docling_available() -> bool:
    return _get_converter() is not None


def parse_with_docling(file_path: str) -> Optional[Dict[str, Any]]:
    """
    Parses PDF using Docling. Returns structured output with Markdown.

    Returns:
        {
            "markdown": str,
            "text": str,
            "has_equations": bool,
            "has_tables": bool,
            "page_count": int,
        }
    """
    converter = _get_converter()
    if not converter:
        return None

    try:
        result = converter.convert(Path(file_path))

        if not result or not result.document:
            return None

        markdown = result.document.export_to_markdown()

        has_equations = "$$" in markdown or "$" in markdown
        has_tables = "|" in markdown and "\n|" in markdown

        return {
            "markdown": markdown,
            "text": result.document.export_to_text(),
            "has_equations": has_equations,
            "has_tables": has_tables,
            "page_count": len(result.pages) if result.pages else 0,
        }

    except Exception as e:
        logger.error(f"[DOCLING] Parse failed: {e}")
        return None


def should_use_docling(file_path: str, extracted_text: str) -> bool:
    """
    Heuristic: Use Docling if:
    - Document has sparse text (scanned)
    - Document likely has tables/equations
    - pdfplumber extraction is poor
    """
    file_ext = Path(file_path).suffix.lower()

    if file_ext in [".png", ".jpg", ".jpeg"]:
        return is_docling_available()

    if len(extracted_text.strip()) < 200:
        return is_docling_available()

    indicators = ["equation", "table", "math", "formula", "exercise", "exam"]
    lower_path = file_path.lower()
    if any(ind in lower_path for ind in indicators):
        return is_docling_available()

    return False
