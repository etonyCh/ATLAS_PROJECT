from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy import desc, func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import invalidate_cache_patterns
from app.core.exceptions import atlas_error
from app.core.redis import get_redis_client
from app.db.session import get_session
from app.dependencies import get_current_user, require_role
from app.models.all_models import Notification
from app.models.contribution import (
    Contribution,
    ContributionStatus,
    ContributorRequest,
    ContributorRequestStatus,
    DocumentVersion,
)
from app.models.gamification import XPTransaction, XPTransactionType
from app.models.user import User
from app.schemas.pagination import build_paginated_response
from app.services.study_engine import gamification_service


router = APIRouter(tags=["Contributions"])


class ReviewContributionRequest(BaseModel):
    status: str | None = None
    action: str | None = None
    rejection_reason: str | None = None
    review_note: str | None = None


class ReportCreateRequest(BaseModel):
    type: str
    title: str
    description: str
    severity: str | None = None
    screenshot_url: str | None = None


class ResolveReportRequest(BaseModel):
    action: str = "dismiss"
    note: str | None = None


class ContributorRequestReviewRequest(BaseModel):
    review_note: str | None = None


REPORT_TITLE_PREFIX = "Feedback received: "


def _serialize_contribution(item: Contribution) -> dict[str, Any]:
    data = item.model_dump()
    latest_version: DocumentVersion | None = None
    if item.document_versions:
        latest_version = sorted(
            item.document_versions,
            key=lambda version: version.version_number,
            reverse=True,
        )[0]

    data["review_note"] = item.rejection_reason
    data["updated_at"] = None
    data["is_demo_submission"] = item.is_demo_submission
    data["mime_type"] = latest_version.mime_type if latest_version else None
    data["s3_key"] = latest_version.storage_path if latest_version else None
    data["quality_score"] = latest_version.quality_score if latest_version else None
    data["preview_text"] = (
        (latest_version.ocr_text[:1200] if latest_version and latest_version.ocr_text else None)
    )
    return data


def _serialize_contributor_request(item: ContributorRequest, student: User, contribution: Contribution) -> dict[str, Any]:
    latest_version: DocumentVersion | None = None
    if contribution.document_versions:
        latest_version = sorted(
            contribution.document_versions,
            key=lambda version: version.version_number,
            reverse=True,
        )[0]

    quality_score = latest_version.quality_score if latest_version and latest_version.quality_score is not None else item.ocr_quality_score
    return {
        "id": str(item.id),
        "student_id": str(student.id),
        "email": student.email,
        "full_name": student.full_name,
        "status": item.status,
        "review_note": item.review_note,
        "ocr_quality_score": quality_score,
        "created_at": item.created_at,
        "reviewed_at": item.reviewed_at,
        "demo_contribution": {
            "id": str(contribution.id),
            "title": contribution.title,
            "description": contribution.description,
            "course_id": str(contribution.course_id) if contribution.course_id else None,
            "status": contribution.status,
            "created_at": contribution.created_at,
            "mime_type": latest_version.mime_type if latest_version else None,
            "s3_key": latest_version.storage_path if latest_version else None,
            "preview_text": latest_version.ocr_text[:1200] if latest_version and latest_version.ocr_text else None,
            "quality_score": latest_version.quality_score if latest_version else None,
        },
    }


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

    if not current_user.is_contributor:
        raise atlas_error(
            "CONTRIBUTION_004",
            "Contributor access is required before submitting community uploads.",
            status_code=403,
        )

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

    # Award +10 XP to student on contribution submission (dedup-safe)
    existing_xp = await db.execute(
        select(XPTransaction).where(
            XPTransaction.user_id == current_user.id,
            XPTransaction.transaction_type == XPTransactionType.UPLOAD,
            XPTransaction.reference_id == result.id,
        )
    )
    if not existing_xp.scalars().first():
        xp = XPTransaction(
            user_id=current_user.id,
            amount=10,
            transaction_type=XPTransactionType.UPLOAD,
            reference_id=result.id,
            description=f"Submitted contribution: {title}",
        )
        db.add(xp)
        await db.commit()

    await invalidate_cache_patterns(redis_client, "admin_dashboard:*")
    return result


@router.post("/contributor-requests")
async def create_contributor_request(
    title: str = Form(...),
    description: str | None = Form(default=None),
    course_id: UUID = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("STUDENT")),
    db: AsyncSession = Depends(get_session),
    redis_client: Redis = Depends(get_redis_client),
) -> dict[str, Any]:
    from app.services.doc_processing.upload_service import upload_student_contribution

    if current_user.is_contributor:
        raise atlas_error(
            "CONTRIBUTOR_001",
            "You already have contributor access.",
            status_code=400,
        )

    existing_pending = (
        await db.execute(
            select(ContributorRequest)
            .where(
                ContributorRequest.student_id == current_user.id,
                ContributorRequest.status == ContributorRequestStatus.PENDING,
            )
            .order_by(desc(ContributorRequest.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    if existing_pending is not None:
        raise atlas_error(
            "CONTRIBUTOR_002",
            "A contributor request is already pending review.",
            status_code=400,
        )

    try:
        contribution = await upload_student_contribution(
            session=db,
            current_user=current_user,
            title=title,
            description=description,
            course_id=course_id,
            file=file,
            is_demo_submission=True,
        )
    except ValueError as exc:
        raise atlas_error("CONTRIBUTOR_003", str(exc), status_code=400) from exc

    contributor_request = ContributorRequest(
        student_id=current_user.id,
        demo_contribution_id=contribution.id,
    )
    db.add(contributor_request)
    await db.commit()
    await db.refresh(contributor_request)

    result = await db.execute(
        select(ContributorRequest, User, Contribution)
        .join(User, User.id == ContributorRequest.student_id)
        .join(Contribution, Contribution.id == ContributorRequest.demo_contribution_id)
        .options(selectinload(Contribution.document_versions))
        .where(ContributorRequest.id == contributor_request.id)
    )
    row = result.first()
    await invalidate_cache_patterns(redis_client, "admin_dashboard:*", "leaderboard:*")
    if row is None:
        raise atlas_error("CONTRIBUTOR_004", "Contributor request could not be loaded.", status_code=500)
    req, student, demo_contribution = row
    return {
        "message": "Contributor request submitted successfully.",
        "request": _serialize_contributor_request(req, student, demo_contribution),
    }


@router.get("/contributor-requests/me")
async def get_my_contributor_request(
    current_user: User = Depends(require_role("STUDENT")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    result = await db.execute(
        select(ContributorRequest, Contribution)
        .join(Contribution, Contribution.id == ContributorRequest.demo_contribution_id)
        .options(selectinload(Contribution.document_versions))
        .where(ContributorRequest.student_id == current_user.id)
        .order_by(desc(ContributorRequest.created_at))
        .limit(1)
    )
    row = result.first()
    request_payload = None
    if row is not None:
        contributor_request, contribution = row
        request_payload = _serialize_contributor_request(contributor_request, current_user, contribution)
    return {
        "is_contributor": current_user.is_contributor,
        "contributor_badge_awarded_at": current_user.contributor_badge_awarded_at,
        "request": request_payload,
    }


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
        .options(selectinload(Contribution.document_versions))
        .where(*filters)
        .order_by(desc(Contribution.created_at))
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()
    return build_paginated_response(
        [_serialize_contribution(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/admin/contributions")
async def list_contribution_queue(
    status: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role("ADMIN", "TEACHER")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    filters = [Contribution.is_demo_submission.is_(False)]
    if status:
        filters.append(Contribution.status == status.upper())

    total = (
        await db.execute(select(func.count()).select_from(Contribution).where(*filters))
    ).scalar_one()
    result = await db.execute(
        select(Contribution)
        .options(selectinload(Contribution.document_versions))
        .where(*filters)
        .order_by(desc(Contribution.created_at))
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()
    return build_paginated_response(
        [_serialize_contribution(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/admin/contributor-requests")
async def list_contributor_requests(
    status: str | None = Query(default="PENDING"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    filters = []
    if status:
        normalized = status.upper()
        if normalized in {"PENDING", "APPROVED", "REJECTED"}:
            filters.append(ContributorRequest.status == normalized)

    if current_user.establishment_id:
        filters.append(User.establishment_id == current_user.establishment_id)

    total = (
        await db.execute(
            select(func.count())
            .select_from(ContributorRequest)
            .join(User, User.id == ContributorRequest.student_id)
            .where(*filters)
        )
    ).scalar_one()
    result = await db.execute(
        select(ContributorRequest, User, Contribution)
        .join(User, User.id == ContributorRequest.student_id)
        .join(Contribution, Contribution.id == ContributorRequest.demo_contribution_id)
        .options(selectinload(Contribution.document_versions))
        .where(*filters)
        .order_by(desc(ContributorRequest.created_at))
        .offset(offset)
        .limit(limit)
    )
    items = [
        _serialize_contributor_request(request, student, contribution)
        for request, student, contribution in result.all()
    ]
    return build_paginated_response(items, total=total, limit=limit, offset=offset)


@router.post("/admin/contributor-requests/{request_id}/approve")
async def approve_contributor_request(
    request_id: UUID,
    background_tasks: BackgroundTasks,
    payload: ContributorRequestReviewRequest | None = None,
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
    redis_client: Redis = Depends(get_redis_client),
) -> dict[str, Any]:
    from app.services.doc_processing.moderation_service import execute_contribution_review

    result = await db.execute(
        select(ContributorRequest, User, Contribution)
        .join(User, User.id == ContributorRequest.student_id)
        .join(Contribution, Contribution.id == ContributorRequest.demo_contribution_id)
        .options(selectinload(Contribution.document_versions))
        .where(ContributorRequest.id == request_id)
    )
    row = result.first()
    if row is None:
        raise atlas_error("CONTRIBUTOR_005", "Contributor request not found.", status_code=404)

    request, student, contribution = row
    if current_user.establishment_id and student.establishment_id != current_user.establishment_id:
        raise atlas_error("AUTH_008", "You do not have permission to review this request.", status_code=403)
    if request.status != ContributorRequestStatus.PENDING:
        raise atlas_error("CONTRIBUTOR_006", "Contributor request is not pending.", status_code=400)

    latest_version = None
    if contribution.document_versions:
        latest_version = sorted(contribution.document_versions, key=lambda v: v.version_number, reverse=True)[0]
    request.ocr_quality_score = latest_version.quality_score if latest_version and latest_version.quality_score is not None else request.ocr_quality_score

    await execute_contribution_review(
        contribution_id=str(contribution.id),
        status=ContributionStatus.APPROVED,
        rejection_reason=None,
        admin_user=current_user,
        session=db,
        background_tasks=background_tasks,
    )

    request.status = ContributorRequestStatus.APPROVED
    request.reviewed_by = current_user.id
    request.review_note = payload.review_note if payload else None
    request.reviewed_at = datetime.utcnow()
    student.is_contributor = True
    student.contributor_badge_awarded_at = student.contributor_badge_awarded_at or datetime.utcnow()
    student.trust_score = max(student.trust_score, 25)

    await gamification_service.award_badge(
        db,
        user_id=student.id,
        code="COMMUNITY_CONTRIBUTOR",
        name="Community Contributor",
        description="Earned contributor privileges by submitting a quality demo document.",
        icon="shield-check",
    )

    db.add(request)
    db.add(student)
    await db.commit()
    await invalidate_cache_patterns(redis_client, "admin_dashboard:*", "leaderboard:*")
    return {
        "message": "Contributor request approved successfully.",
        "id": str(request.id),
        "status": request.status,
    }


@router.post("/admin/contributor-requests/{request_id}/reject")
async def reject_contributor_request(
    request_id: UUID,
    background_tasks: BackgroundTasks,
    payload: ContributorRequestReviewRequest,
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
    redis_client: Redis = Depends(get_redis_client),
) -> dict[str, Any]:
    from app.services.doc_processing.moderation_service import execute_contribution_review

    if not payload.review_note or not payload.review_note.strip():
        raise atlas_error("CONTRIBUTOR_007", "A review note is required when rejecting a contributor request.", status_code=400)

    result = await db.execute(
        select(ContributorRequest, User, Contribution)
        .join(User, User.id == ContributorRequest.student_id)
        .join(Contribution, Contribution.id == ContributorRequest.demo_contribution_id)
        .options(selectinload(Contribution.document_versions))
        .where(ContributorRequest.id == request_id)
    )
    row = result.first()
    if row is None:
        raise atlas_error("CONTRIBUTOR_005", "Contributor request not found.", status_code=404)

    request, student, contribution = row
    if current_user.establishment_id and student.establishment_id != current_user.establishment_id:
        raise atlas_error("AUTH_008", "You do not have permission to review this request.", status_code=403)
    if request.status != ContributorRequestStatus.PENDING:
        raise atlas_error("CONTRIBUTOR_006", "Contributor request is not pending.", status_code=400)

    latest_version = None
    if contribution.document_versions:
        latest_version = sorted(contribution.document_versions, key=lambda v: v.version_number, reverse=True)[0]
    request.ocr_quality_score = latest_version.quality_score if latest_version and latest_version.quality_score is not None else request.ocr_quality_score

    await execute_contribution_review(
        contribution_id=str(contribution.id),
        status=ContributionStatus.REJECTED,
        rejection_reason=payload.review_note,
        admin_user=current_user,
        session=db,
        background_tasks=background_tasks,
    )

    request.status = ContributorRequestStatus.REJECTED
    request.reviewed_by = current_user.id
    request.review_note = payload.review_note.strip()
    request.reviewed_at = datetime.utcnow()

    db.add(request)
    await db.commit()
    await invalidate_cache_patterns(redis_client, "admin_dashboard:*")
    return {
        "message": "Contributor request rejected successfully.",
        "id": str(request.id),
        "status": request.status,
    }


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
        raw_status = payload.status or payload.action
        normalized_status = (raw_status or "").upper()
        if normalized_status == "APPROVE":
            normalized_status = "APPROVED"
        elif normalized_status == "REJECT":
            normalized_status = "REJECTED"
        if normalized_status not in {"APPROVED", "REJECTED", "REVISION_REQUESTED"}:
            raise atlas_error("CONTRIBUTION_003", "Invalid review status.", status_code=400)

        result = await execute_contribution_review(
            contribution_id=str(contribution_id),
            status=normalized_status,
            rejection_reason=payload.rejection_reason or payload.review_note,
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
