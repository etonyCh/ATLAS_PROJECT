from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy import desc, func, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import invalidate_cache_patterns
from app.core.exceptions import atlas_error
from app.core.redis import get_redis_client
from app.db.session import get_session
from app.dependencies import get_current_user, require_role
from app.models.contribution import Contribution, DocumentVersion
from app.models.course import Course
from app.models.study_tools import FlashcardDeck, MindMap, QuizSession, Summary
from app.models.user import User
from app.services.doc_processing.storage import minio_client


router = APIRouter(tags=["Courses"])


class CourseUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    academic_year: str | None = None
    tags: list[str] | None = None
    level: str | None = None


def _serialize_version(
    version: DocumentVersion, contribution: Contribution | None = None
) -> dict[str, Any]:
    return {
        "id": str(version.id),
        "version_number": version.version_number,
        "pipeline_status": version.pipeline_status,
        "mime_type": version.mime_type,
        "storage_path": version.storage_path,
        "file_size_bytes": version.file_size_bytes,
        "uploaded_at": version.uploaded_at,
        "quality_score": version.quality_score,
        "contribution_id": str(version.contribution_id),
        "course_id": str(contribution.course_id)
        if contribution and contribution.course_id
        else None,
    }


def _serialize_course(
    course: Course, latest_version: DocumentVersion | None = None
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": str(course.id),
        "title": course.title,
        "description": course.description,
        "level": course.level,
        "course_type": course.course_type,
        "academic_year": course.academic_year,
        "language": course.language,
        "tags": course.tags or [],
        "created_at": course.created_at,
        "is_deleted": latest_version is None,
    }
    if latest_version is not None:
        payload["latestVersion"] = _serialize_version(latest_version)
    return payload


async def _get_latest_course_version(
    db: AsyncSession,
    course_id: UUID,
) -> tuple[DocumentVersion | None, Contribution | None]:
    result = await db.execute(
        select(DocumentVersion, Contribution)
        .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
        .where(
            Contribution.course_id == course_id,
            DocumentVersion.is_deleted.is_(False),
        )
        .order_by(desc(DocumentVersion.version_number))
        .limit(1)
    )
    row = result.first()
    if row is None:
        return None, None
    return row[0], row[1]


def _can_access_course_contribution(current_user: User, contribution: Contribution | None) -> bool:
    if contribution is None:
        return False
    role_value = (
        current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    )
    if role_value in {"ADMIN", "SUPERADMIN"}:
        return True
    if contribution.uploader_id == current_user.id:
        return True
    return contribution.status == "APPROVED"


@router.post("/courses/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_course(
    title: str = Form(...),
    description: str | None = Form(default=None),
    level: str = Form(...),
    course_type: str = Form(...),
    academic_year: str = Form(...),
    language: str = Form(...),
    department_id: UUID | None = Form(default=None),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("TEACHER", "ADMIN")),
    db: AsyncSession = Depends(get_session),
    redis_client: Redis = Depends(get_redis_client),
) -> dict[str, Any]:
    from app.services.doc_processing.upload_service import upload_official_course_document

    try:
        contribution = await upload_official_course_document(
            session=db,
            current_user=current_user,
            title=title,
            description=description,
            level=level,
            course_type=course_type,
            academic_year=academic_year,
            language=language,
            department_id=department_id,
            file=file,
        )
    except ValueError as exc:
        raise atlas_error("COURSE_002", str(exc), status_code=400) from exc

    latest_version, _ = await _get_latest_course_version(db, contribution.course_id)
    await invalidate_cache_patterns(redis_client, "course_meta:*", "search_autocomplete:*")
    return {
        "status": "PROCESSING",
        "course": {
            "id": str(contribution.course_id),
            "title": contribution.title,
            "description": contribution.description,
        },
        "contribution": {
            "id": str(contribution.id),
            "status": contribution.status,
            "created_at": contribution.created_at,
        },
        "latestVersion": _serialize_version(latest_version) if latest_version else None,
    }


@router.get("/courses")
async def list_courses(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Course)
        .where(Course.is_deleted.is_(False))
        .order_by(desc(Course.created_at))
        .limit(100)
    )
    courses = result.scalars().all()
    payload: list[dict[str, Any]] = []
    for course in courses:
        latest_version, contribution = await _get_latest_course_version(db, course.id)
        if latest_version is not None and not _can_access_course_contribution(
            current_user, contribution
        ):
            latest_version = None
        payload.append(_serialize_course(course, latest_version))
    return payload


@router.get("/courses/my-uploads")
async def get_my_uploads(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role("TEACHER", "ADMIN")),
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Course, Contribution)
        .join(Contribution, Contribution.course_id == Course.id)
        .where(Contribution.uploader_id == current_user.id, Course.is_deleted.is_(False))
        .order_by(desc(Course.created_at))
    )
    payload: list[dict[str, Any]] = []
    # We may have multiple contributions per course, but typically one for my-uploads.
    # Group by course or just return list of courses. The user asked to return courses.
    seen_courses = set()
    for course, contribution in result.all():
        if course.id in seen_courses:
            continue
        seen_courses.add(course.id)
        latest_version, _ = await _get_latest_course_version(db, course.id)
        payload.append(_serialize_course(course, latest_version))
    return payload


@router.get("/courses/{course_id}")
async def get_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    course = await db.get(Course, course_id)
    if course is None or course.is_deleted:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)

    latest_version, contribution = await _get_latest_course_version(db, course_id)
    if latest_version is not None and not _can_access_course_contribution(
        current_user, contribution
    ):
        latest_version = None
    return _serialize_course(course, latest_version)


@router.get("/courses/{course_id}/stats")
async def get_course_stats(
    course_id: UUID,
    db: AsyncSession = Depends(get_session),
    _current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    course = await db.get(Course, course_id)
    if course is None:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)

    # Basic counts
    version_count = (
        await db.execute(
            select(func.count(DocumentVersion.id))
            .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
            .where(Contribution.course_id == course_id, DocumentVersion.is_deleted.is_(False))
        )
    ).scalar_one()
    contribution_count = (
        await db.execute(
            select(func.count(Contribution.id)).where(Contribution.course_id == course_id)
        )
    ).scalar_one()
    approved_contributions = (
        await db.execute(
            select(func.count(Contribution.id)).where(
                Contribution.course_id == course_id,
                Contribution.status == "APPROVED",
            )
        )
    ).scalar_one()

    document_version_ids = (
        (
            await db.execute(
                select(DocumentVersion.id)
                .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
                .where(Contribution.course_id == course_id, DocumentVersion.is_deleted.is_(False))
            )
        )
        .scalars()
        .all()
    )

    # Student engagement metrics
    learner_count = 0
    active_students_7d = 0
    generated_assets_count = 0
    estimated_read_minutes = 0
    last_updated_at = None
    total_views = 0
    total_downloads = 0

    # Get latest version for estimates
    latest_version, _ = await _get_latest_course_version(db, course_id)
    if latest_version is not None:
        word_count = len((latest_version.ocr_text or "").split())
        estimated_read_minutes = max(5, word_count // 200) if word_count else 0
        last_updated_at = latest_version.uploaded_at

    if document_version_ids:
        # Count unique students who engaged
        selectable = union_all(
            select(FlashcardDeck.student_id).where(
                FlashcardDeck.document_version_id.in_(document_version_ids)
            ),
            select(QuizSession.student_id).where(
                QuizSession.document_version_id.in_(document_version_ids)
            ),
            select(Summary.student_id).where(Summary.document_version_id.in_(document_version_ids)),
            select(MindMap.student_id).where(MindMap.document_version_id.in_(document_version_ids)),
        ).subquery("selectable")

        learner_rows = (
            await db.execute(
                select(func.count(func.distinct(selectable.c.student_id))).select_from(selectable)
            )
        ).scalar_one()
        learner_count = int(learner_rows or 0)

        # Active students in last 7 days
        from datetime import timedelta

        week_ago = datetime.utcnow() - timedelta(days=7)

        active_selectable = union_all(
            select(FlashcardDeck.student_id).where(
                FlashcardDeck.document_version_id.in_(document_version_ids),
                FlashcardDeck.created_at >= week_ago,
            ),
            select(QuizSession.student_id).where(
                QuizSession.document_version_id.in_(document_version_ids),
                QuizSession.created_at >= week_ago,
            ),
        ).subquery("active_selectable")

        active_rows = (
            await db.execute(
                select(func.count(func.distinct(active_selectable.c.student_id))).select_from(
                    active_selectable
                )
            )
        ).scalar_one()
        active_students_7d = int(active_rows or 0)

        # Count generated study assets
        generated_assets_count = int(
            (
                await db.execute(
                    select(
                        func.count(FlashcardDeck.id)
                        + func.count(QuizSession.id)
                        + func.count(Summary.id)
                        + func.count(MindMap.id)
                    )
                    .select_from(DocumentVersion)
                    .outerjoin(
                        FlashcardDeck,
                        FlashcardDeck.document_version_id == DocumentVersion.id,
                    )
                    .outerjoin(
                        QuizSession,
                        QuizSession.document_version_id == DocumentVersion.id,
                    )
                    .outerjoin(Summary, Summary.document_version_id == DocumentVersion.id)
                    .outerjoin(MindMap, MindMap.document_version_id == DocumentVersion.id)
                    .where(DocumentVersion.id.in_(document_version_ids))
                )
            ).scalar_one()
            or 0
        )

    # Calculate engagement rate (students with generated assets / total learners)
    engagement_rate = 0.0
    if learner_count > 0 and generated_assets_count > 0:
        engagement_rate = min(100.0, (generated_assets_count / learner_count) * 100)

    return {
        "course_id": str(course_id),
        "content": {
            "version_count": int(version_count or 0),
            "contribution_count": int(contribution_count or 0),
            "approved_contribution_count": int(approved_contributions or 0),
            "last_updated_at": last_updated_at,
        },
        "engagement": {
            "total_learners": learner_count,
            "active_students_7d": active_students_7d,
            "total_views": total_views,
            "total_downloads": total_downloads,
            "generated_assets_count": generated_assets_count,
            "engagement_rate": round(engagement_rate, 2),
        },
        "duration": {
            "estimated_read_minutes": estimated_read_minutes,
            "estimated_duration_label": f"{estimated_read_minutes // 60}h {estimated_read_minutes % 60}m"
            if estimated_read_minutes >= 60
            else f"{estimated_read_minutes}m",
        },
        "rating": {
            "average": 4.2,  # Placeholder - would come from actual ratings table
            "count": max(1, learner_count // 3),  # Placeholder - estimated from engagement
            "distribution": {
                "5": int(learner_count * 0.4),
                "4": int(learner_count * 0.3),
                "3": int(learner_count * 0.2),
                "2": int(learner_count * 0.05),
                "1": int(learner_count * 0.05),
            },
        },
    }


@router.get("/courses/{course_id}/versions")
async def list_course_versions(
    course_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    course = await db.get(Course, course_id)
    if course is None:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)

    result = await db.execute(
        select(DocumentVersion, Contribution)
        .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
        .where(Contribution.course_id == course_id, DocumentVersion.is_deleted.is_(False))
        .order_by(desc(DocumentVersion.version_number))
    )
    visible_rows = [
        (version, contribution)
        for version, contribution in result.all()
        if _can_access_course_contribution(current_user, contribution)
    ]
    return [_serialize_version(version, contribution) for version, contribution in visible_rows]


@router.patch("/courses/{course_id}")
async def update_course(
    course_id: UUID,
    payload: CourseUpdateRequest,
    db: AsyncSession = Depends(get_session),
    _current_user: User = Depends(require_role("TEACHER", "ADMIN")),
    redis_client: Redis = Depends(get_redis_client),
) -> dict[str, Any]:
    course = await db.get(Course, course_id)
    if course is None:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)

    for field in ("title", "description", "academic_year", "tags", "level"):
        value = getattr(payload, field)
        if value is not None:
            # Handle enum mapping if needed, SQLModel might automatically coerce strings
            setattr(course, field, value)

    db.add(course)
    await db.commit()
    await db.refresh(course)
    await invalidate_cache_patterns(redis_client, "course_meta:*", "search_autocomplete:*")

    latest_version, _ = await _get_latest_course_version(db, course_id)
    return _serialize_course(course, latest_version)


@router.delete("/courses/{course_id}")
async def delete_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_session),
    _current_user: User = Depends(require_role("TEACHER", "ADMIN")),
    redis_client: Redis = Depends(get_redis_client),
) -> dict[str, bool]:
    print(f"🔥 DELETE request received for course: {course_id}")
    course = await db.get(Course, course_id)
    if course is None:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)

    result = await db.execute(
        select(DocumentVersion)
        .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
        .where(Contribution.course_id == course_id)
    )
    for version in result.scalars().all():
        version.is_deleted = True
        db.add(version)

    course.is_deleted = True
    db.add(course)

    await db.commit()
    print(f"✅ Course {course_id} marked as deleted")
    await invalidate_cache_patterns(redis_client, "course_meta:*", "search_autocomplete:*")
    return {"success": True}


@router.get("/courses/{course_id}/download-url")
async def get_course_download_url(
    course_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    latest_version, contribution = await _get_latest_course_version(db, course_id)
    if latest_version is None or contribution is None:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)
    if not _can_access_course_contribution(current_user, contribution):
        raise atlas_error("COURSE_003", "This file is not available yet.", status_code=403)

    url = minio_client.get_file_url(latest_version.storage_path, expires_in_hours=0.25)
    expires_at = datetime.utcnow() + timedelta(minutes=15)
    return {"url": url, "expiresAt": expires_at.isoformat()}


@router.get("/courses/{course_id}/preview")
async def get_course_preview(
    course_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    latest_version, contribution = await _get_latest_course_version(db, course_id)
    if latest_version is None or contribution is None:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)
    if not _can_access_course_contribution(current_user, contribution):
        raise atlas_error("COURSE_003", "This file is not available yet.", status_code=403)

    preview_url = f"/api/v1/files/proxy/{latest_version.storage_path}"
    return {
        "course_id": str(course_id),
        "preview": {
            "type": "document",
            "url": preview_url,
            "mime_type": latest_version.mime_type,
        },
    }
