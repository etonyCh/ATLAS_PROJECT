from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import invalidate_cache_patterns
from app.core.exceptions import atlas_error
from app.core.redis import get_redis_client
from app.db.session import get_session
from app.dependencies import get_current_user, require_role
from app.models.all_models import Notification
from app.models.contribution import Contribution
from app.models.user import User
from app.schemas.pagination import build_paginated_response


router = APIRouter(tags=["Contributions"])


class ReviewContributionRequest(BaseModel):
    status: str
    rejection_reason: str | None = None


class ReportCreateRequest(BaseModel):
    type: str
    title: str
    description: str
    severity: str | None = None
    screenshot_url: str | None = None


class ResolveReportRequest(BaseModel):
    action: str = "dismiss"
    note: str | None = None


REPORT_TITLE_PREFIX = "Feedback received: "


def _serialize_report(notification: Notification) -> dict[str, Any]:
    report_type = "other"
    severity: str | None = None
    screenshot_url: str | None = None
    description_lines: list[str] = []

    for raw_line in notification.message.splitlines():
        line = raw_line.strip()
        if line.startswith("Type: "):
            report_type = line.removeprefix("Type: ").strip().lower() or "other"
        elif line.startswith("Severity: "):
            severity = line.removeprefix("Severity: ").strip().lower() or None
        elif line.startswith("Screenshot: "):
            screenshot_url = line.removeprefix("Screenshot: ").strip() or None
        elif line:
            description_lines.append(line)

    description = "\n".join(description_lines).strip() or notification.message

    return {
        "id": str(notification.id),
        "title": notification.title.removeprefix(REPORT_TITLE_PREFIX).strip() or notification.title,
        "description": description,
        "type": report_type,
        "severity": severity,
        "screenshot_url": screenshot_url,
        "status": "RESOLVED" if notification.is_read else "PENDING",
        "is_resolved": notification.is_read,
        "created_at": notification.created_at,
    }


@router.post("/contributions")
async def create_contribution(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    description: str | None = Form(default=None),
    course_id: UUID = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("STUDENT")),
    db: AsyncSession = Depends(get_session),
    redis_client: Redis = Depends(get_redis_client),
) -> Any:
    from app.services.doc_processing.upload_service import upload_student_contribution

    try:
        result = await upload_student_contribution(
            session=db,
            current_user=current_user,
            title=title,
            description=description,
            course_id=course_id,
            file=file,
        )
    except ValueError as exc:
        raise atlas_error("CONTRIBUTION_001", str(exc), status_code=400) from exc
    await invalidate_cache_patterns(redis_client, "admin_dashboard:*")
    return result


@router.get("/contributions/me")
async def list_my_contributions(
    status: str | None = Query(default=None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role("STUDENT")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    filters = [Contribution.uploader_id == current_user.id]
    if status:
        filters.append(Contribution.status == status.upper())

    total = (
        await db.execute(select(func.count()).select_from(Contribution).where(*filters))
    ).scalar_one()
    result = await db.execute(
        select(Contribution)
        .where(*filters)
        .order_by(desc(Contribution.created_at))
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()
    return build_paginated_response(items, total=total, limit=limit, offset=offset)


@router.get("/admin/contributions")
async def list_contribution_queue(
    status: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role("ADMIN", "TEACHER")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    filters = []
    if status:
        filters.append(Contribution.status == status.upper())

    total = (
        await db.execute(select(func.count()).select_from(Contribution).where(*filters))
    ).scalar_one()
    result = await db.execute(
        select(Contribution)
        .where(*filters)
        .order_by(desc(Contribution.created_at))
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()
    return build_paginated_response(items, total=total, limit=limit, offset=offset)


@router.patch("/admin/contributions/{contribution_id}")
async def review_contribution(
    contribution_id: UUID,
    payload: ReviewContributionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role("ADMIN", "TEACHER")),
    db: AsyncSession = Depends(get_session),
    redis_client: Redis = Depends(get_redis_client),
) -> Any:
    from app.services.doc_processing.moderation_service import execute_contribution_review

    try:
        result = await execute_contribution_review(
            contribution_id=str(contribution_id),
            status=payload.status,
            rejection_reason=payload.rejection_reason,
            admin_user=current_user,
            session=db,
            background_tasks=background_tasks,
        )
        await invalidate_cache_patterns(redis_client, "admin_dashboard:*", "leaderboard:*")
        return result
    except ValueError as exc:
        raise atlas_error("CONTRIBUTION_002", str(exc), status_code=400) from exc


@router.post("/reports")
async def create_report(
    payload: ReportCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    lines = [f"Type: {payload.type.upper()}"]
    if payload.severity:
        lines.append(f"Severity: {payload.severity.upper()}")
    if payload.screenshot_url:
        lines.append(f"Screenshot: {payload.screenshot_url}")
    lines.extend(["", payload.description.strip()])

    notification = Notification(
        user_id=current_user.id,
        title=f"{REPORT_TITLE_PREFIX}{payload.title.strip()}",
        message="\n".join(lines),
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return {
        "message": "Feedback submitted successfully.",
        "id": str(notification.id),
    }


@router.get("/admin/reports")
async def list_reports(
    status: str | None = Query(default=None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    filters = [Notification.title.like(f"{REPORT_TITLE_PREFIX}%")]
    if status:
        normalized_status = status.upper()
        if normalized_status == "RESOLVED":
            filters.append(Notification.is_read.is_(True))
        elif normalized_status == "PENDING":
            filters.append(Notification.is_read.is_(False))

    total = (
        await db.execute(select(func.count()).select_from(Notification).where(*filters))
    ).scalar_one()
    result = await db.execute(
        select(Notification)
        .where(*filters)
        .order_by(desc(Notification.created_at))
        .offset(offset)
        .limit(limit)
    )
    notifications = result.scalars().all()
    items = [_serialize_report(item) for item in notifications]
    return build_paginated_response(items, total=total, limit=limit, offset=offset)


@router.patch("/admin/reports/{report_id}")
async def resolve_report(
    report_id: UUID,
    payload: ResolveReportRequest,
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    report = await db.get(Notification, report_id)
    if report is None or not report.title.startswith(REPORT_TITLE_PREFIX):
        raise atlas_error("REPORT_001", "Report not found.", status_code=404)
    report.is_read = True
    db.add(report)
    await db.commit()
    return {
        "message": f"Report marked as resolved with action '{payload.action}'.",
        "id": str(report.id),
        "resolved": True,
    }
