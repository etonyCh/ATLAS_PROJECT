from __future__ import annotations

import io
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from minio.error import S3Error
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.contribution import Contribution, DocumentVersion
from app.models.user import User, UserRole
from app.services.doc_processing.storage import minio_client


router = APIRouter(tags=["Files"])


def _can_access_document(current_user: User, contribution: Contribution) -> bool:
    role_value = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_value in (UserRole.ADMIN.value, UserRole.SUPERADMIN.value):
        return True
    if contribution.uploader_id == current_user.id:
        return True
    return contribution.status == "APPROVED"


@router.get("/files/proxy/{path:path}")
async def proxy_file(
    path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Proxies files from MinIO storage with contribution-aware access control.
    """
    try:
        result = await db.execute(
            select(DocumentVersion, Contribution)
            .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
            .where(DocumentVersion.storage_path == path)
        )
        row = result.first()
        if row is None:
            raise HTTPException(status_code=404, detail="File not found")

        document_version, contribution = row
        if document_version.is_deleted:
            raise HTTPException(status_code=404, detail="File not found")

        if not _can_access_document(current_user, contribution):
            raise HTTPException(status_code=403, detail="You do not have permission to access this file")

        response = minio_client.client.get_object(minio_client.bucket_name, path)
        data = response.read()
        response.close()
        response.release_conn()

        content_type = document_version.mime_type or _get_content_type(path)
        
        # Validate that we have actual file data
        if not data or len(data) == 0:
            raise HTTPException(status_code=500, detail="File is empty or corrupted")

        return StreamingResponse(
            io.BytesIO(data),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename={path.split('/')[-1]}",
                "Content-Length": str(len(data)),
                "Accept-Ranges": "bytes",
            },
        )
    except S3Error as e:
        if e.code == "NoSuchKey":
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load file: {str(e)}")


# ---------------------------------------------------------------------------
# SOTA PDF Previewer — Presigned URL Endpoint
# ---------------------------------------------------------------------------

@router.get("/files/pdf-view-url/{contribution_id}")
async def get_pdf_view_url(
    contribution_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Generates a time-limited presigned URL for secure, direct-from-storage
    PDF viewing.  The frontend PDF previewer calls this instead of proxying
    the entire file through the backend.

    Security guarantees:
      • JWT validated via ``get_current_user`` dependency.
      • Contribution-level access control (owner / admin / approved).
      • Presigned URL expires after 15 minutes.
      • URL is single-use-intent (MinIO enforces expiry, not reuse).

    Returns:
        {
            "url":        "<presigned MinIO/S3 URL>",
            "expires_at": "<ISO-8601 timestamp>",
            "filename":   "<original filename>",
            "mime_type":  "<detected MIME type>",
            "file_size":  <bytes>
        }
    """
    # 1. Look up the latest non-deleted DocumentVersion for this contribution
    result = await db.execute(
        select(DocumentVersion, Contribution)
        .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
        .where(
            DocumentVersion.contribution_id == contribution_id,
            DocumentVersion.is_deleted.is_(False),
        )
        .order_by(desc(DocumentVersion.version_number))
        .limit(1)
    )
    row = result.first()

    if row is None:
        raise HTTPException(status_code=404, detail="Document not found for this contribution.")

    document_version, contribution = row

    # 2. Enforce access control
    if not _can_access_document(current_user, contribution):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view this document.",
        )

    # 3. Validate the file is a viewable type (PDF primarily)
    viewable_types = {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
    }
    mime = document_version.mime_type or ""
    if mime not in viewable_types:
        raise HTTPException(
            status_code=400,
            detail=f"This file type ({mime}) is not supported for in-browser preview. Use the download endpoint instead.",
        )

    # 4. Generate presigned URL — strictly 15 minutes
    try:
        presigned_url = minio_client.get_file_url(
            document_version.storage_path,
            expires_in_hours=0.25,  # 15 minutes
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate secure viewing URL: {str(exc)}",
        )

    expires_at = datetime.utcnow() + timedelta(minutes=15)
    filename = document_version.storage_path.split("/")[-1] if document_version.storage_path else "document"

    return {
        "url": presigned_url,
        "expires_at": expires_at.isoformat(),
        "filename": filename,
        "mime_type": document_version.mime_type,
        "file_size": document_version.file_size_bytes,
    }


@router.get("/files/pdf-view-url-by-path")
async def get_pdf_view_url_by_path(
    path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Generates a presigned URL for PDF viewing using the storage_path directly.
    This is used by the FilePreview component which already has the storage path.

    Security: Same JWT + access control as the contribution-based endpoint.
    """
    # 1. Look up the DocumentVersion by storage path
    result = await db.execute(
        select(DocumentVersion, Contribution)
        .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
        .where(DocumentVersion.storage_path == path)
    )
    row = result.first()

    if row is None:
        raise HTTPException(status_code=404, detail="File not found")

    document_version, contribution = row

    if document_version.is_deleted:
        raise HTTPException(status_code=404, detail="File not found")

    # 2. Enforce access control
    if not _can_access_document(current_user, contribution):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view this document.",
        )

    # 3. Generate presigned URL — strictly 15 minutes
    try:
        presigned_url = minio_client.get_file_url(
            document_version.storage_path,
            expires_in_hours=0.25,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate secure viewing URL: {str(exc)}",
        )

    expires_at = datetime.utcnow() + timedelta(minutes=15)
    filename = document_version.storage_path.split("/")[-1] if document_version.storage_path else "document"

    return {
        "url": presigned_url,
        "expires_at": expires_at.isoformat(),
        "filename": filename,
        "mime_type": document_version.mime_type,
        "file_size": document_version.file_size_bytes,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_content_type(path: str) -> str:
    """Determine content type based on file extension."""
    path_lower = path.lower()
    if path_lower.endswith(".pdf"):
        return "application/pdf"
    elif path_lower.endswith(".doc"):
        return "application/msword"
    elif path_lower.endswith(".docx"):
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif path_lower.endswith(".txt"):
        return "text/plain"
    elif path_lower.endswith(".png"):
        return "image/png"
    elif path_lower.endswith(".jpg") or path_lower.endswith(".jpeg"):
        return "image/jpeg"
    else:
        return "application/octet-stream"
