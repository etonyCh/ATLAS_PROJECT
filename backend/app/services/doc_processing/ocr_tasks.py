import os
import io
import base64
import cv2
import numpy as np
import pdfplumber
import tempfile
import socket
import struct
import structlog
from celery import shared_task
from sqlmodel import Session, select, create_engine
from minio.commonconfig import CopySource
from PIL import Image

from app.core.config import settings
from app.models.all_models import DocumentVersion, DocumentPipelineStatus, Contribution
from app.services.doc_processing.storage import minio_client
from app.services.ai_core.embedding_tasks_qdrant import embed_document
from app.services.ai_core.ollama_client import ollama  # NEW: SOTA Lego Client

# US-07 Dependencies
from langdetect import detect, LangDetectException
from simhash import Simhash

# Use a synchronous engine for Celery tasks
sync_engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI.replace("postgresql+asyncpg", "postgresql")
)

# =============================================================================
# DEFENSIVE HELPER METHODS
# =============================================================================


def _pil_to_base64(pil_img: Image.Image) -> str:
    """Converts a PIL Image to a Base64 string for Multimodal LLM ingestion."""
    buffered = io.BytesIO()
    pil_img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


def _perform_llm_ocr(base64_img: str) -> str:
    """
    Executes vision OCR via Ollama and sanitizes formatting artifacts so
    downstream indexing stays deterministic and frontend preview remains coherent.
    """
    log = structlog.get_logger().bind(action="llm_vision_ocr")
    prompt = (
        "You are an elite, highly accurate Optical Character Recognition (OCR) engine. "
        "Extract all text from this image exactly as it appears. "
        "Preserve the original languages (including Arabic, French, and English). "
        "Preserve formatting, line breaks, and structural layout. "
        "Do NOT include any conversational filler, markdown formatting blocks, or explanations. "
        "Output strictly the extracted text."
    )

    try:
        extracted_text = ollama.generate_vision(prompt=prompt, base64_images=[base64_img])

        if not extracted_text:
            return ""

        # Defensive cleanup for occasional fenced-output artifacts from VLMs
        cleaned = extracted_text.strip()
        if cleaned.startswith("```") and cleaned.endswith("```"):
            lines = cleaned.splitlines()
            if len(lines) >= 3:
                cleaned = "\n".join(lines[1:-1]).strip()

        # Normalize BOM and null chars that can pollute embedding stage
        cleaned = cleaned.replace("\ufeff", "").replace("\x00", "")
        return cleaned.strip()
    except Exception as e:
        log.error("llm_vision_ocr_failed", error=str(e))
        return ""


def _scan_file_with_clamav(
    file_path: str,
    host: str = os.getenv("CLAMAV_HOST", "localhost"),
    port: int = 3310,
) -> bool:
    """
    DEFENSIVE ARCHITECTURE: US-24 Antivirus Scanner.

    Communicates with the ClamAV daemon natively over TCP using the
    zINSTREAM protocol. Operates in a "Fail-Closed" state: returns False
    if infected OR if the scanner is unreachable.
    """
    log = structlog.get_logger().bind(scanner="clamav", host=host)
    try:
        with socket.create_connection((host, port), timeout=15) as sock:
            sock.sendall(b"zINSTREAM\0")

            with open(file_path, "rb") as f:
                while chunk := f.read(4096):
                    sock.sendall(struct.pack("!I", len(chunk)) + chunk)

            # Zero-length chunk signals end-of-stream to daemon
            sock.sendall(struct.pack("!I", 0))

            response = sock.recv(1024).decode("utf-8").strip()

            if "OK" in response:
                return True
            elif "FOUND" in response:
                log.warning(
                    "SECURITY ALERT: Malware detected during ClamAV scan.",
                    response=response,
                )
                return False
            else:
                log.error("ClamAV returned unexpected response.", response=response)
                return False

    except socket.timeout:
        log.error("CRITICAL: ClamAV daemon connection timed out. Failing closed.")
        return False
    except Exception as e:
        log.error("CRITICAL: ClamAV connection failed. Failing closed.", error=str(e))
        return False


# =============================================================================
# SIDE EFFECTS & ROUTING
# =============================================================================


@shared_task(name="notify_admin_degraded_scan")
def notify_admin_degraded_scan(contribution_id: str, quality_score: float, document_id: str):
    """
    Side-effect isolation for notifying administrators of degraded uploads.
    Prevents SMTP blockages from halting the OCR pipeline.
    """
    log = structlog.get_logger().bind(task="notify_admin_degraded_scan")
    if not settings.ADMIN_ALERT_EMAIL:
        log.warning("admin_alert_email_not_configured_skipping_notification")
        return

    log.info(
        "dispatching_admin_alert",
        to=settings.ADMIN_ALERT_EMAIL,
        subject=f"ATLAS Alert: Degraded Scan Detected (Score: {quality_score:.2f})",
        contribution_id=contribution_id,
        document_id=document_id,
    )
    # Architecture Node: Bind to app.services.email_service.send_email() here
    # once SMTP templates for admins are finalized.


# =============================================================================
# CORE PIPELINE
# =============================================================================


@shared_task(name="process_document_ocr")
def process_document_ocr(document_version_id: str):
    """
    US-06, US-07, & US-24 Hybrid OCR Pipeline via Multimodal LLM (Ollama).
    """
    log = structlog.get_logger().bind(
        task="process_document_ocr",
        document_version_id=document_version_id,
    )
    log.info("start_ocr_pipeline")

    final_language = "unknown"
    is_scan = False

    with Session(sync_engine) as session:
        doc = session.get(DocumentVersion, document_version_id)
        if not doc:
            log.error("document_not_found")
            return

        doc.pipeline_status = DocumentPipelineStatus.OCR_PROCESSING
        session.add(doc)
        session.commit()

        extracted_text = ""
        total_quality_score = 0.0
        scanned_pages_count = 0
        temp_path = None

        _, file_extension = os.path.splitext(doc.storage_path)
        file_extension = file_extension.lower()

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp:
                temp_path = tmp.name

            # ----------------------------------------------------------------
            # Stage 1 — Download from MinIO quarantine
            # ----------------------------------------------------------------
            log.info("downloading_from_quarantine_storage", path=doc.storage_path)
            minio_client.ensure_bucket_exists()
            minio_client.client.fget_object(
                minio_client.bucket_name,
                doc.storage_path,
                temp_path,
            )

            # ----------------------------------------------------------------
            # Stage 2 — ClamAV antivirus (US-24)
            # ----------------------------------------------------------------
            log.info("initiating_clamav_scan")
            is_clean = _scan_file_with_clamav(temp_path)

            if not is_clean:
                log.critical(
                    "SECURITY ALERT: File failed ClamAV scan. "
                    "Destroying object and aborting pipeline."
                )
                minio_client.client.remove_object(minio_client.bucket_name, doc.storage_path)
                doc.pipeline_status = DocumentPipelineStatus.FAILED
                doc.storage_path = "DELETED_SECURITY_VIOLATION"
                doc.is_deleted = True
                session.add(doc)
                session.commit()
                return

            log.info("clamav_scan_passed_clean")

            # ----------------------------------------------------------------
            # Stage 3 — Promote quarantine → permanent storage
            # ----------------------------------------------------------------
            if doc.storage_path.startswith("quarantine/"):
                contribution = session.get(Contribution, doc.contribution_id)
                if contribution:
                    permanent_path = (
                        f"courses/{contribution.course_id}/"
                        f"v{doc.version_number}_{doc.id}{file_extension}"
                    )
                    log.info("promoting_file_to_permanent_storage", path=permanent_path)

                    minio_client.client.copy_object(
                        minio_client.bucket_name,
                        permanent_path,
                        CopySource(minio_client.bucket_name, doc.storage_path),
                    )
                    minio_client.client.remove_object(minio_client.bucket_name, doc.storage_path)
                    doc.storage_path = permanent_path
                    session.add(doc)
                    session.commit()

            # ----------------------------------------------------------------
            # Stage 4 — Intelligent Parser Selection (Phase 1 Addition)
            # ----------------------------------------------------------------
            log.info("selecting_optimal_parser", file_type=file_extension)

            extracted_text = ""
            parser_used = "unknown"
            docling_result = None

            if file_extension == ".pdf":
                from app.services.doc_processing.docling_parser import (
                    parse_with_docling,
                    should_use_docling,
                    is_docling_available,
                )

                quick_text = ""
                try:
                    with pdfplumber.open(temp_path) as pdf:
                        for page in pdf.pages[:3]:
                            page_text = page.extract_text() or ""
                            quick_text += page_text + "\n"
                except Exception:
                    quick_text = ""

                use_docling = is_docling_available() and should_use_docling(temp_path, quick_text)

                if use_docling:
                    log.info("routing_to_docling_parser", reason="complex_document_detected")
                    docling_result = parse_with_docling(temp_path)

                    if docling_result:
                        extracted_text = docling_result["markdown"]
                        parser_used = "docling"
                        log.info(
                            "docling_extraction_complete",
                            has_equations=docling_result.get("has_equations", False),
                            has_tables=docling_result.get("has_tables", False),
                            pages=docling_result.get("page_count", 0),
                        )

                if not extracted_text:
                    log.info("routing_to_pdfplumber_pipeline")
                    parser_used = "pdfplumber_hybrid"

                    with pdfplumber.open(temp_path) as pdf:
                        for page in pdf.pages:
                            page_text = page.extract_text()

                            if not page_text or len(page_text.strip()) < 50:
                                log.info(
                                    "scanned_page_detected_routing_to_vision_llm",
                                    page_number=page.page_number,
                                )
                                scanned_pages_count += 1

                                pil_img = page.to_image(resolution=300).original
                                img_cv = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

                                gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
                                variance = cv2.Laplacian(gray, cv2.CV_64F).var()
                                total_quality_score += variance

                                if variance < 100.0:
                                    log.warning(
                                        "low_scan_quality",
                                        variance=variance,
                                        page_number=page.page_number,
                                    )

                                base64_img = _pil_to_base64(pil_img)
                                page_text = _perform_llm_ocr(base64_img)

                                if not page_text:
                                    log.warning(
                                        "vision_ocr_empty_result",
                                        page_number=page.page_number,
                                    )

                            if page_text:
                                extracted_text += page_text + "\n\n"

            elif file_extension in [".png", ".jpg", ".jpeg"]:
                from app.services.doc_processing.docling_parser import (
                    parse_with_docling,
                    is_docling_available,
                )

                if is_docling_available():
                    docling_result = parse_with_docling(temp_path)
                    if docling_result:
                        extracted_text = docling_result["text"]
                        parser_used = "docling_vision"
                    else:
                        log.info("routing_to_vision_llm")
                        parser_used = "ollama_vision"
                        scanned_pages_count = 1

                        try:
                            pil_img = Image.open(temp_path).convert("RGB")
                            img_cv = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

                            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
                            variance = cv2.Laplacian(gray, cv2.CV_64F).var()
                            total_quality_score += variance

                            base64_img = _pil_to_base64(pil_img)
                            extracted_text = _perform_llm_ocr(base64_img)
                        except Exception as img_err:
                            log.error("failed_to_process_direct_image", error=str(img_err))
                else:
                    log.info("routing_to_vision_llm")
                    parser_used = "ollama_vision"
                    scanned_pages_count = 1

                    try:
                        pil_img = Image.open(temp_path).convert("RGB")
                        img_cv = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

                        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
                        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
                        total_quality_score += variance

                        base64_img = _pil_to_base64(pil_img)
                        extracted_text = _perform_llm_ocr(base64_img)
                    except Exception as img_err:
                        log.error("failed_to_process_direct_image", error=str(img_err))

            else:
                log.warning("unsupported_file_format_for_text_extraction", extension=file_extension)
                extracted_text = f"[Text extraction not supported natively for {file_extension} files in this version. File stored safely.]"

            extracted_text = extracted_text.strip()
            if not extracted_text:
                log.warning("ocr_extracted_text_empty")

            # ----------------------------------------------------------------
            # Stage 6 — Language detection & SimHash deduplication (US-07)
            # ----------------------------------------------------------------
            detected_lang = "unknown"
            simhash_str = None

            if extracted_text and not extracted_text.startswith("[Text extraction not supported"):
                try:
                    detected_lang = detect(extracted_text)
                except LangDetectException:
                    log.warning("langdetect_failed")

                simhash_str = str(Simhash(extracted_text).value)

                existing_dup = session.exec(
                    select(DocumentVersion).where(
                        DocumentVersion.simhash == simhash_str,
                        DocumentVersion.id != doc.id,
                    )
                ).first()

                if existing_dup:
                    log.warning(
                        "semantic_duplicate_detected",
                        original_id=str(existing_dup.id),
                    )

            # ----------------------------------------------------------------
            # Stage 7 — Side-Effects, Persistence & Pipeline Advance
            # ----------------------------------------------------------------
            doc.ocr_text = extracted_text
            doc.language = detected_lang
            doc.simhash = simhash_str
            doc.parser_used = parser_used
            doc.has_structured_content = (
                docling_result.get("has_equations", False)
                or docling_result.get("has_tables", False)
                if docling_result
                else False
            )

            if scanned_pages_count > 0:
                doc.quality_score = total_quality_score / scanned_pages_count

                # US-07: The Total Coverage Side-Effect Execution
                if doc.quality_score < settings.OCR_QUALITY_ALERT_THRESHOLD:
                    log.warning(
                        "document_quality_below_alert_threshold",
                        avg_score=doc.quality_score,
                        threshold=settings.OCR_QUALITY_ALERT_THRESHOLD,
                        contribution_id=str(doc.contribution_id),
                    )

                    # 1. State Persistence (Schema Mutator)
                    contribution = session.get(Contribution, doc.contribution_id)
                    if contribution:
                        contribution.quality_flag = True
                        session.add(contribution)

                    # 2. Asynchronous Notification Dispatch
                    notify_admin_degraded_scan.delay(
                        contribution_id=str(doc.contribution_id),
                        quality_score=doc.quality_score,
                        document_id=str(doc.id),
                    )

            doc.pipeline_status = DocumentPipelineStatus.EMBEDDING
            session.add(doc)
            session.commit()

            log.info(
                "ocr_success",
                chars_extracted=len(extracted_text),
                language=detected_lang,
            )

            final_language = doc.language
            is_scan = scanned_pages_count > 0

            embed_document.delay(str(document_version_id))

        except Exception as e:
            log.error("ocr_pipeline_failed", error=str(e), exc_info=True)
            doc.pipeline_status = DocumentPipelineStatus.FAILED
            session.add(doc)
            session.commit()

        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError as cleanup_error:
                    log.warning("temp_file_cleanup_failed", error=str(cleanup_error))

    return {
        "status": "completed",
        "document_id": document_version_id,
        "language": final_language,
        "is_scan": is_scan,
    }
