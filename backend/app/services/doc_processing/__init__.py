"""
Document Processing Domain Public API.

This module exposes the strict public interface for the document lifecycle,
spanning storage, OCR/ML extraction, moderation state machines, user annotations,
and PDF export generation.
"""
from .storage import minio_client, calculate_sha256
from .ocr_tasks import process_document_ocr

__all__ = [
    "minio_client",
    "calculate_sha256",
    "process_document_ocr"
]
