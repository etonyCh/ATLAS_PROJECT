from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import atlas_error
from app.db.session import get_session
from app.dependencies import require_role
from app.models.user import AccountStatus, Department, TeacherProfile, TeacherRequestStatus, TeacherVerificationRequest, User
from app.schemas.pagination import build_paginated_response


router = APIRouter(tags=["Admin"])


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None


class TeacherRequestReviewRequest(BaseModel):
    review_note: str | None = None


@router.post("/admin/teachers/import")
async def import_teachers(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_session),
) -> Any:
    from app.services.iam.teacher_service import process_teacher_batch_import

    return await process_teacher_batch_import(file=file, admin_user=current_user, session=db)


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
        
    if _current_user.establishment_id:
        filters.append(User.establishment_id == _current_user.establishment_id)

    total = await db.execute(select(func.count()).select_from(User).where(*filters))
    result = await db.execute(
        select(User)
        .where(*filters)
        .order_by(desc(User.created_at))
        .offset(offset)
        .limit(limit)
    )
    users = result.scalars().all()
    items = [
        {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
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
    filters = [User.status == AccountStatus.PENDING_VERIFICATION]
    if _current_user.establishment_id:
        filters.append(User.establishment_id == _current_user.establishment_id)

    total = await db.execute(select(func.count()).select_from(User).where(*filters))
    result = await db.execute(
        select(User)
        .where(*filters)
        .order_by(desc(User.created_at))
        .offset(offset)
        .limit(limit)
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
    filters = [TeacherVerificationRequest.status == TeacherRequestStatus.PENDING]
    if _current_user.establishment_id:
        filters.append(TeacherVerificationRequest.establishment_id == _current_user.establishment_id)

    total = await db.execute(select(func.count()).select_from(TeacherVerificationRequest).where(*filters))
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
        raise atlas_error("AUTH_008", "You do not have permission to approve this request.", status_code=403)
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

    profile_result = await db.execute(select(TeacherProfile).where(TeacherProfile.user_id == user.id))
    teacher_profile = profile_result.scalar_one_or_none()
    if teacher_profile is None:
        teacher_profile = TeacherProfile(
            user_id=user.id,
            department_id=department.id if department else None,
            specialization=request.requested_department,
        )
    else:
        teacher_profile.department_id = department.id if department else teacher_profile.department_id
        teacher_profile.specialization = teacher_profile.specialization or request.requested_department

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
        raise atlas_error("AUTH_008", "You do not have permission to approve this user.", status_code=403)
        
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
        "trust_score": user.trust_score
    }
