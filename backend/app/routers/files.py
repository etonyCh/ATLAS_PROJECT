from __future__ import annotations

import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from minio.error import S3Error
from sqlalchemy import select
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

        return StreamingResponse(
            io.BytesIO(data),
            media_type=content_type,
            headers={"Content-Disposition": f"inline; filename={path.split('/')[-1]}"},
        )
    except S3Error as e:
        if e.code == "NoSuchKey":
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load file: {str(e)}")


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
