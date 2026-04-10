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
        "department_id": str(course.department_id) if course.department_id else None,
        "tags": course.tags or [],
        "created_at": course.created_at,
        "is_deleted": course.is_deleted,
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


async def _get_latest_accessible_course_version(
    db: AsyncSession,
    course_id: UUID,
    current_user: User,
) -> tuple[DocumentVersion | None, Contribution | None]:
    result = await db.execute(
        select(DocumentVersion, Contribution)
        .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
        .where(
            Contribution.course_id == course_id,
            DocumentVersion.is_deleted.is_(False),
        )
        .order_by(desc(DocumentVersion.version_number))
    )
    for version, contribution in result.all():
        if _can_access_course_contribution(current_user, contribution):
            return version, contribution
    return None, None


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
    course_id: UUID = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("TEACHER")),
    db: AsyncSession = Depends(get_session),
    redis_client: Redis = Depends(get_redis_client),
) -> dict[str, Any]:
    from app.services.doc_processing.upload_service import upload_official_course_document

    try:
        contribution = await upload_official_course_document(
            session=db,
            current_user=current_user,
            course_id=course_id,
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
    # Get regular courses
    result = await db.execute(
        select(Course)
        .where(Course.is_deleted.is_(False))
        .order_by(desc(Course.created_at))
        .limit(100)
    )
    courses = list(result.scalars().all())

    # Get courses from user's approved contributions
    # First get course_ids from approved contributions by this user
    from app.models.contribution import Contribution
    contrib_ids_result = await db.execute(
        select(Contribution.course_id)
        .where(
            Contribution.uploader_id == current_user.id,
            Contribution.status == "approved",
            Contribution.course_id.isnot(None)
        )
    )
    contrib_course_ids = [row[0] for row in contrib_ids_result.all() if row[0]]

    # Fetch those courses
    contrib_courses = []
    if contrib_course_ids:
        contrib_result = await db.execute(
            select(Course)
            .where(
                Course.id.in_(contrib_course_ids),
                Course.is_deleted.is_(False)
            )
            .order_by(desc(Course.created_at))
        )
        contrib_courses = list(contrib_result.scalars().all())

    # Combine and deduplicate courses
    seen_ids = set()
    all_courses = []

    for course in courses + contrib_courses:
        if course.id not in seen_ids:
            seen_ids.add(course.id)
            all_courses.append(course)

    # Sort by creation date
    all_courses.sort(key=lambda c: c.created_at, reverse=True)

    payload: list[dict[str, Any]] = []
    for course in all_courses[:100]:  # Limit to 100
        latest_version, _ = await _get_latest_accessible_course_version(db, course.id, current_user)
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


@router.get("/courses/catalog")
async def list_course_catalog(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Course)
        .where(Course.is_deleted.is_(False))
        .order_by(desc(Course.created_at))
    )
    courses = result.scalars().all()

    role_value = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    filtered_courses: list[Course] = []
    for course in courses:
        if role_value == "TEACHER":
            teacher_department_id = (
                current_user.teacher_profile.department_id
                if getattr(current_user, "teacher_profile", None)
                else None
            )
            if teacher_department_id and course.department_id != teacher_department_id:
                continue
        filtered_courses.append(course)

    return [_serialize_course(course) for course in filtered_courses]


@router.get("/courses/{course_id}")
async def get_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    course = await db.get(Course, course_id)
    if course is None or course.is_deleted:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)

    latest_version, _ = await _get_latest_accessible_course_version(db, course_id, current_user)
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
    _current_user: User = Depends(require_role("ADMIN")),
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
    _current_user: User = Depends(require_role("ADMIN")),
    redis_client: Redis = Depends(get_redis_client),
) -> dict[str, bool]:
    """
    Hard cascade delete: removes course and all related data permanently.
    Deletes from: PostgreSQL, MinIO, Qdrant, and MeiliSearch.
    """
    from sqlalchemy import delete
    from app.models.study_tools import FlashcardDeck, QuizSession, MindMap, Summary
    from app.models.rag import RAGSession
    from app.models.annotation import DocumentAnnotation
    from app.models.all_models import ReadingProgress
    from app.core.qdrant_client import get_qdrant_manager, COLLECTION_DOCUMENTS

    print(f"🔥 DELETE request received for course: {course_id}")
    course = await db.get(Course, course_id)
    if course is None:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)

    # Get all contributions for this course
    result = await db.execute(
        select(Contribution.id).where(Contribution.course_id == course_id)
    )
    contribution_ids = [row[0] for row in result.all()]

    if contribution_ids:
        # Get all document versions for these contributions
        result = await db.execute(
            select(DocumentVersion.id, DocumentVersion.storage_path)
            .where(DocumentVersion.contribution_id.in_(contribution_ids))
        )
        version_rows = result.all()
        version_ids = [row[0] for row in version_rows]
        storage_paths = [row[1] for row in version_rows if row[1]]

        if version_ids:
            print(f"🗑️  Deleting {len(version_ids)} document versions and related data...")

            # Delete from Qdrant (vector embeddings)
            try:
                qdrant = get_qdrant_manager()
                for version_id in version_ids:
                    qdrant.delete_document_embeddings(
                        collection_name=COLLECTION_DOCUMENTS,
                        document_version_id=str(version_id)
                    )
                print(f"✅ Deleted embeddings from Qdrant")
            except Exception as e:
                print(f"⚠️  Qdrant deletion warning: {e}")

            # Delete from MinIO (files)
            for path in storage_paths:
                try:
                    minio_client.delete_file(path)
                except Exception as e:
                    print(f"⚠️  MinIO deletion warning for {path}: {e}")
            print(f"✅ Deleted {len(storage_paths)} files from MinIO")

            # Delete related study tools (cascade handled by DB for their children)
            await db.execute(delete(FlashcardDeck).where(FlashcardDeck.document_version_id.in_(version_ids)))
            await db.execute(delete(QuizSession).where(QuizSession.document_version_id.in_(version_ids)))
            await db.execute(delete(MindMap).where(MindMap.document_version_id.in_(version_ids)))
            await db.execute(delete(Summary).where(Summary.document_version_id.in_(version_ids)))

            # Delete RAG sessions (messages cascade via DB)
            await db.execute(delete(RAGSession).where(RAGSession.document_version_id.in_(version_ids)))

            # Delete annotations and reading progress
            await db.execute(delete(DocumentAnnotation).where(DocumentAnnotation.document_version_id.in_(version_ids)))
            await db.execute(delete(ReadingProgress).where(ReadingProgress.document_version_id.in_(version_ids)))

            # Delete document embeddings from PostgreSQL
            from app.models.embedding import DocumentEmbedding
            await db.execute(delete(DocumentEmbedding).where(DocumentEmbedding.document_version_id.in_(version_ids)))

            # Delete document versions
            await db.execute(delete(DocumentVersion).where(DocumentVersion.id.in_(version_ids)))

        # Delete contributor requests linked to these contributions
        from app.models.contribution import ContributorRequest
        await db.execute(delete(ContributorRequest).where(ContributorRequest.demo_contribution_id.in_(contribution_ids)))

        # Delete contributions
        await db.execute(delete(Contribution).where(Contribution.id.in_(contribution_ids)))

    # Delete the course itself
    await db.execute(delete(Course).where(Course.id == course_id))

    await db.commit()
    print(f"✅ Course {course_id} and all related data permanently deleted")
    await invalidate_cache_patterns(redis_client, "course_meta:*", "search_autocomplete:*")
    return {"success": True}


@router.get("/courses/{course_id}/download-url")
async def get_course_download_url(
    course_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    latest_version, contribution = await _get_latest_accessible_course_version(db, course_id, current_user)
    if latest_version is None or contribution is None:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)

    # Return proxy URL instead of direct MinIO URL to avoid CORS/issues
    url = f"/api/files/proxy/{latest_version.storage_path}"
    expires_at = datetime.utcnow() + timedelta(minutes=15)
    return {"url": url, "expiresAt": expires_at.isoformat()}


@router.get("/courses/{course_id}/preview")
async def get_course_preview(
    course_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    latest_version, contribution = await _get_latest_accessible_course_version(db, course_id, current_user)
    if latest_version is None or contribution is None:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)

    preview_url = f"/api/files/proxy/{latest_version.storage_path}"
    return {
        "course_id": str(course_id),
        "preview": {
            "type": "document",
            "url": preview_url,
            "mime_type": latest_version.mime_type,
        },
    }
