from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import delete, desc, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import atlas_error
from app.db.session import get_session
from app.dependencies import require_role
from app.models.course import Course, CourseLanguage, CourseLevel, CourseType
from app.models.user import (
    AccountStatus,
    Department,
    Establishment,
    TeacherProfile,
    TeacherRequestStatus,
    TeacherVerificationRequest,
    User,
    UserRole,
)
from app.schemas.pagination import build_paginated_response

# Imports for user deletion cleanup
from app.models.contribution import Contribution
from app.models.collaboration import ForumPost, ForumReply, ForumVote, StudyGroup, StudyGroupMember, LiveSession, LearningPathJob
from app.models.gamification import XPTransaction, UserBadge, UserStreak
from app.models.notification import Notification
from app.models.progress import ReadingProgress
from app.models.annotation import DocumentAnnotation
from app.models.intelligence import UserProfile, TopicKnowledge, UserMemory, LearningInsight

router = APIRouter(tags=["Admin"])


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None


class TeacherRequestReviewRequest(BaseModel):
    review_note: str | None = None


class DepartmentCreateRequest(BaseModel):
    name: str
    allowed_levels: list[str] = []


class DepartmentUpdateRequest(BaseModel):
    name: str | None = None
    allowed_levels: list[str] | None = None


class CatalogCourseCreateRequest(BaseModel):
    title: str
    description: str | None = None
    department_id: UUID
    level: str
    academic_year: str


class CatalogCourseUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    department_id: UUID | None = None
    level: str | None = None
    academic_year: str | None = None
    is_deleted: bool | None = None



class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    filiere: str | None = None
    level: str | None = None
    date_of_birth: str | None = None
    gender: str | None = None
    phone_number: str | None = None
    address: str | None = None
    preferred_language: str | None = None
    is_deleted: bool | None = None


def _serialize_department(department: Department) -> dict[str, Any]:
    return {
        "id": str(department.id),
        "name": department.name,
        "establishment_id": str(department.establishment_id),
        "allowed_levels": list(department.allowed_levels or []),
        "created_at": department.created_at,
    }


def _serialize_catalog_course(
    course: Course, department: Department | None = None
) -> dict[str, Any]:
    return {
        "id": str(course.id),
        "title": course.title,
        "description": course.description,
        "department_id": str(course.department_id) if course.department_id else None,
        "department_name": department.name if department else None,
        "level": course.level.value if hasattr(course.level, "value") else course.level,
        "academic_year": course.academic_year,
        "created_at": course.created_at,
        "is_deleted": course.is_deleted,
    }


@router.post("/admin/teachers/import")
async def import_teachers(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> Any:
    from app.services.iam.teacher_service import process_teacher_batch_import

    return await process_teacher_batch_import(file=file, admin_user=current_user, session=db)


@router.get("/admin/teachers/import-template")
async def download_teacher_import_template(
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> Any:
    from app.services.iam.teacher_service import generate_dynamic_teacher_template

    return await generate_dynamic_teacher_template(admin_user=current_user, session=db)


@router.get("/admin/users")
async def list_users(
    role: str | None = Query(default=None),
    filiere: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    filters = []
    if role:
        filters.append(User.role == role.upper())
    if filiere:
        filters.append(User.filiere == filiere)
    if is_active is not None:
        filters.append(User.is_active.is_(is_active))

    # Strict multi-tenancy: ADMIN must be scoped to an establishment
    filters.append(User.establishment_id == _current_user.establishment_id)

    total = await db.execute(select(func.count()).select_from(User).where(*filters))
    result = await db.execute(
        select(User).where(*filters).order_by(desc(User.created_at)).offset(offset).limit(limit)
    )
    users = result.scalars().all()
    items = [
        {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "filiere": user.filiere,
            "level": user.level,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "status": user.status,
            "created_at": user.created_at,
        }
        for user in users
    ]
    return build_paginated_response(
        items,
        total=total.scalar_one(),
        limit=limit,
        offset=offset,
    )


@router.patch("/admin/users/{user_id}")
async def update_user(
    user_id: UUID,
    payload: UserUpdateRequest,
    _current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if user is None:
        raise atlas_error("USER_001", "User not found.", status_code=404)

    # Strict multi-tenancy: Verify target user belongs to the same establishment
    if user.establishment_id != _current_user.establishment_id:
        raise atlas_error(
            "AUTH_008", "You do not have permission to manage this user.", status_code=403
        )

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.role is not None and payload.role in {"STUDENT", "TEACHER", "ADMIN"}:
        user.role = payload.role

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "status": user.status,
    }


@router.get("/admin/users/pending")
async def list_pending_users(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    filters = [
        User.status == AccountStatus.PENDING_VERIFICATION,
        User.establishment_id == _current_user.establishment_id,
    ]

    total = await db.execute(select(func.count()).select_from(User).where(*filters))
    result = await db.execute(
        select(User).where(*filters).order_by(desc(User.created_at)).offset(offset).limit(limit)
    )
    users = result.scalars().all()
    items = [
        {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "status": user.status,
            "created_at": user.created_at,
        }
        for user in users
    ]
    return build_paginated_response(
        items,
        total=total.scalar_one(),
        limit=limit,
        offset=offset,
    )


@router.get("/admin/teacher-requests")
async def list_teacher_requests(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    filters = [
        TeacherVerificationRequest.status == TeacherRequestStatus.PENDING,
        TeacherVerificationRequest.establishment_id == _current_user.establishment_id,
    ]

    total = await db.execute(
        select(func.count()).select_from(TeacherVerificationRequest).where(*filters)
    )
    result = await db.execute(
        select(TeacherVerificationRequest, User)
        .join(User, User.id == TeacherVerificationRequest.user_id)
        .where(*filters)
        .order_by(desc(TeacherVerificationRequest.created_at))
        .offset(offset)
        .limit(limit)
    )
    items = [
        {
            "id": str(request.id),
            "user_id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "requested_department": request.requested_department,
            "requested_domain": request.requested_domain,
            "status": request.status,
            "created_at": request.created_at,
        }
        for request, user in result.all()
    ]
    return build_paginated_response(items, total=total.scalar_one(), limit=limit, offset=offset)


@router.post("/admin/teacher-requests/{request_id}/approve")
async def approve_teacher_request(
    request_id: UUID,
    payload: TeacherRequestReviewRequest | None = None,
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    result = await db.execute(
        select(TeacherVerificationRequest, User)
        .join(User, User.id == TeacherVerificationRequest.user_id)
        .where(TeacherVerificationRequest.id == request_id)
    )
    row = result.first()
    if row is None:
        raise atlas_error("USER_001", "Teacher request not found.", status_code=404)

    request, user = row
    if current_user.establishment_id and request.establishment_id != current_user.establishment_id:
        raise atlas_error(
            "AUTH_008", "You do not have permission to approve this request.", status_code=403
        )
    if request.status != TeacherRequestStatus.PENDING:
        raise atlas_error("USER_002", "Teacher request is not pending.", status_code=400)

    request.status = TeacherRequestStatus.APPROVED
    request.reviewed_by = current_user.id
    request.review_note = payload.review_note if payload else None
    request.reviewed_at = datetime.utcnow()

    user.status = AccountStatus.ACTIVE
    user.trust_score = max(user.trust_score, 50)
    user.is_verified = True
    if user.verified_at is None:
        user.verified_at = datetime.utcnow()

    dept_result = await db.execute(
        select(Department).where(
            Department.establishment_id == request.establishment_id,
            Department.name == request.requested_department,
        )
    )
    department = dept_result.scalar_one_or_none()

    profile_result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == user.id)
    )
    teacher_profile = profile_result.scalar_one_or_none()
    if teacher_profile is None:
        teacher_profile = TeacherProfile(
            user_id=user.id,
            department_id=department.id if department else None,
            specialization=request.requested_department,
        )
    else:
        teacher_profile.department_id = (
            department.id if department else teacher_profile.department_id
        )
        teacher_profile.specialization = (
            teacher_profile.specialization or request.requested_department
        )

    db.add(request)
    db.add(user)
    db.add(teacher_profile)
    await db.commit()
    await db.refresh(user)

    return {
        "message": "Teacher request approved successfully.",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "status": user.status,
            "trust_score": user.trust_score,
        },
        "request": {
            "id": str(request.id),
            "status": request.status,
            "reviewed_at": request.reviewed_at,
        },
    }


@router.post("/admin/users/{user_id}/approve")
async def approve_pending_user(
    user_id: UUID,
    _current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if user is None:
        raise atlas_error("USER_001", "User not found.", status_code=404)

    if _current_user.establishment_id and user.establishment_id != _current_user.establishment_id:
        raise atlas_error(
            "AUTH_008", "You do not have permission to approve this user.", status_code=403
        )

    if user.status != AccountStatus.PENDING_VERIFICATION:
        raise atlas_error("USER_002", "User is not in pending status.", status_code=400)

    user.status = AccountStatus.ACTIVE
    user.trust_score = 50  # Initial trust score for verified educators
    user.is_verified = True

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {
        "message": "User approved successfully.",
        "id": str(user.id),
        "status": user.status,
        "trust_score": user.trust_score,
    }


@router.get("/admin/departments")
async def list_departments(
    _current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    # Strict multi-tenancy filter
    filters = [Department.establishment_id == _current_user.establishment_id]
    result = await db.execute(select(Department).where(*filters).order_by(Department.name.asc()))
    return [_serialize_department(item) for item in result.scalars().all()]


@router.post("/admin/departments")
async def create_department(
    payload: DepartmentCreateRequest,
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    if not current_user.establishment_id:
        raise atlas_error("ADMIN_001", "Admin must belong to an establishment.", status_code=400)

    department = Department(
        name=payload.name.strip(),
        establishment_id=current_user.establishment_id,
        allowed_levels=payload.allowed_levels,
    )
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return _serialize_department(department)


@router.patch("/admin/departments/{department_id}")
async def update_department(
    department_id: UUID,
    payload: DepartmentUpdateRequest,
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    department = await db.get(Department, department_id)
    if department is None:
        raise atlas_error("DEPT_001", "Department not found.", status_code=404)
    if (
        current_user.establishment_id
        and department.establishment_id != current_user.establishment_id
    ):
        raise atlas_error("AUTH_008", "You do not have access to this department.", status_code=403)

    if payload.name is not None:
        department.name = payload.name.strip()
    if payload.allowed_levels is not None:
        department.allowed_levels = payload.allowed_levels

    db.add(department)
    await db.commit()
    await db.refresh(department)
    return _serialize_department(department)


@router.get("/admin/catalog/courses")
async def list_catalog_courses(
    _current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    query = (
        select(Course, Department)
        .outerjoin(Department, Department.id == Course.department_id)
        .where(Department.establishment_id == _current_user.establishment_id)
    )
    result = await db.execute(query.order_by(desc(Course.created_at)))
    rows = result.all()
    return [_serialize_catalog_course(course, department) for course, department in rows]


@router.post("/admin/catalog/courses")
async def create_catalog_course(
    payload: CatalogCourseCreateRequest,
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    department = await db.get(Department, payload.department_id)
    if department is None:
        raise atlas_error("DEPT_001", "Department not found.", status_code=404)
    if (
        current_user.establishment_id
        and department.establishment_id != current_user.establishment_id
    ):
        raise atlas_error("AUTH_008", "You do not have access to this department.", status_code=403)
    if payload.level not in (department.allowed_levels or []):
        raise atlas_error(
            "COURSE_003", "Selected level is not enabled for this department.", status_code=400
        )

    course = Course(
        title=payload.title.strip(),
        description=payload.description,
        department_id=payload.department_id,
        level=CourseLevel(payload.level),
        academic_year=payload.academic_year,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return _serialize_catalog_course(course, department)


@router.patch("/admin/catalog/courses/{course_id}")
async def update_catalog_course(
    course_id: UUID,
    payload: CatalogCourseUpdateRequest,
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    # 1. Fetch the course
    course = await db.get(Course, course_id)
    if course is None:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)

    # 2. Fetch current department for ownership check
    current_dept = await db.get(Department, course.department_id)
    if (
        current_dept is None 
        or (current_user.establishment_id and current_dept.establishment_id != current_user.establishment_id)
    ):
        raise atlas_error("AUTH_008", "You do not have access to this course.", status_code=403)

    # 3. If department_id is being changed, validate the new one
    target_dept = current_dept
    if payload.department_id and payload.department_id != course.department_id:
        target_dept = await db.get(Department, payload.department_id)
        if target_dept is None:
            raise atlas_error("DEPT_001", "New department not found.", status_code=404)
        if (
            current_user.establishment_id 
            and target_dept.establishment_id != current_user.establishment_id
        ):
            raise atlas_error("AUTH_008", "You cannot move courses to another establishment.", status_code=403)
        course.department_id = payload.department_id

    # 4. If level is changed, validate against department allowed levels
    new_level = payload.level or course.level
    if hasattr(new_level, "value"):
        new_level = new_level.value
        
    if payload.level:
         if new_level not in (target_dept.allowed_levels or []):
            raise atlas_error("COURSE_003", f"Level {new_level} is not enabled for department {target_dept.name}.", status_code=400)
         course.level = CourseLevel(new_level)

    # 5. Update other fields
    if payload.title is not None:
        course.title = payload.title.strip()
    if payload.description is not None:
        course.description = payload.description.strip() or None
    if payload.academic_year is not None:
        course.academic_year = payload.academic_year
    if payload.is_deleted is not None:
        course.is_deleted = payload.is_deleted

    db.add(course)
    await db.commit()
    await db.refresh(course)
    return _serialize_catalog_course(course, target_dept)


@router.delete("/admin/catalog/courses/{course_id}")
async def delete_catalog_course(
    course_id: UUID,
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    course = await db.get(Course, course_id)
    if course is None:
        raise atlas_error("COURSE_001", "Course not found.", status_code=404)

    # Ownership Check
    dept = await db.get(Department, course.department_id)
    if (
        dept is None 
        or (current_user.establishment_id and dept.establishment_id != current_user.establishment_id)
    ):
        raise atlas_error("AUTH_008", "You do not have access to this course.", status_code=403)

    await db.delete(course)
    await db.commit()
    return {"message": "Catalog course deleted successfully."}


@router.delete("/admin/departments/{department_id}")
async def delete_department(
    department_id: UUID,
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    department = await db.get(Department, department_id)
    if department is None:
        raise atlas_error("DEPT_001", "Department not found.", status_code=404)
    if (
        current_user.establishment_id
        and department.establishment_id != current_user.establishment_id
    ):
        raise atlas_error("AUTH_008", "You do not have access to this department.", status_code=403)

    await db.delete(department)
    await db.commit()
    return {"message": "Department and all associated courses deleted successfully."}


@router.get("/admin/establishments")
async def list_establishments(
    _current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    # Multi-tenant: ADMIN remains strictly scoped to their assigned establishment
    query = select(Establishment).where(Establishment.id == _current_user.establishment_id)

    result = await db.execute(query.order_by(Establishment.name.asc()))
    establishments = result.scalars().all()
    return [
        {"id": str(e.id), "name": e.name, "domain": e.domain, "is_authorized": e.is_authorized}
        for e in establishments
    ]


@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """
    Delete a user and clean up associated records.
    
    User-generated content (contributions, forum posts, annotations) is preserved
    but orphaned (uploader_id/author_id set to NULL). User-specific data
    (XP, badges, streaks, notifications, etc.) is deleted.
    """
    # Fetch the user to delete
    user = await db.get(User, user_id)
    if user is None:
        raise atlas_error("USER_001", "User not found.", status_code=404)
    
    # Multi-tenant check: admin can only delete users in their establishment
    if (
        current_user.establishment_id
        and user.establishment_id != current_user.establishment_id
    ):
        raise atlas_error("AUTH_008", "You do not have access to this user.", status_code=403)
    
    # Prevent self-deletion
    if user.id == current_user.id:
        raise atlas_error("USER_003", "You cannot delete your own account.", status_code=400)
    
    # 1. Orphan contributions (keep documents, remove uploader link)
    await db.execute(
        update(Contribution)
        .where(Contribution.uploader_id == user_id)
        .values(uploader_id=None)
    )
    
    # 2. Orphan forum content (keep posts/replies, remove author link)
    await db.execute(
        update(ForumPost)
        .where(ForumPost.author_id == user_id)
        .values(author_id=None)
    )
    await db.execute(
        update(ForumReply)
        .where(ForumReply.author_id == user_id)
        .values(author_id=None)
    )
    
    # 3. Orphan document annotations (keep annotations, remove user link)
    await db.execute(
        update(DocumentAnnotation)
        .where(DocumentAnnotation.user_id == user_id)
        .values(user_id=None)
    )
    
    # 4. Delete user-specific records that don't make sense without the user
    await db.execute(delete(ForumVote).where(ForumVote.user_id == user_id))
    await db.execute(delete(StudyGroupMember).where(StudyGroupMember.user_id == user_id))
    await db.execute(delete(XPTransaction).where(XPTransaction.user_id == user_id))
    await db.execute(delete(UserBadge).where(UserBadge.user_id == user_id))
    await db.execute(delete(UserStreak).where(UserStreak.user_id == user_id))
    await db.execute(delete(Notification).where(Notification.user_id == user_id))
    await db.execute(delete(ReadingProgress).where(ReadingProgress.user_id == user_id))
    await db.execute(delete(LiveSession).where(LiveSession.teacher_id == user_id))
    await db.execute(delete(LearningPathJob).where(LearningPathJob.user_id == user_id))
    await db.execute(delete(UserProfile).where(UserProfile.user_id == user_id))
    await db.execute(delete(TopicKnowledge).where(TopicKnowledge.user_id == user_id))
    await db.execute(delete(UserMemory).where(UserMemory.user_id == user_id))
    await db.execute(delete(LearningInsight).where(LearningInsight.user_id == user_id))
    
    # 5. Delete study groups owned by this user (cascade deletes members)
    await db.execute(delete(StudyGroup).where(StudyGroup.owner_id == user_id))
    
    # 6. Delete the user (cascade deletes: OTP tokens, teacher profile,
    #    teacher request, contributor requests, flashcard decks, quiz sessions,
    #    summaries, mind maps, RAG sessions due to cascade_delete=True or ondelete="CASCADE")
    await db.delete(user)
    await db.commit()
    
    return {"message": f"User {user_id} deleted successfully. Their contributions and documents remain but are now orphaned."}


@router.get("/admin/analytics/export")
async def export_analytics_pdf(
    period: str = Query(default="monthly", description="Report period (monthly, weekly)"),
    lang: str = Query(default="en", description="Language for report"),
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
):
    from app.services.doc_processing.analytics_export_service import generate_analytics_pdf
    from app.models.contribution import Contribution
    from app.models.course import Course

    today = datetime.utcnow()
    if period == "monthly":
        start_date = today.replace(day=1)
        period_label = today.strftime("%B %Y")
    else:
        start_date = today - timedelta(days=7)
        period_label = f"{start_date.strftime('%Y-%m-%d')} to {today.strftime('%Y-%m-%d')}"

    total_users = await db.execute(select(func.count(User.id)))
    total_courses = await db.execute(select(func.count(Course.id)).where(Course.is_deleted == False))
    total_uploads = await db.execute(
        select(func.count(Contribution.id))
        .where(Contribution.created_at >= start_date)
    )
    approved_uploads = await db.execute(
        select(func.count(Contribution.id))
        .where(Contribution.created_at >= start_date, Contribution.status == "APPROVED")
    )

    report_data = {
        "summary": {
            "total_users": total_users.scalar() or 0,
            "total_courses": total_courses.scalar() or 0,
            "total_uploads": total_uploads.scalar() or 0,
            "approved_uploads": approved_uploads.scalar() or 0,
        },
        "top_courses": [],
        "period": period_label,
    }

    pdf_bytes = generate_analytics_pdf("admin", period_label, report_data, lang)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="atlas-admin-report-{today.strftime("%Y-%m-%d")}.pdf"'
        }
    )
