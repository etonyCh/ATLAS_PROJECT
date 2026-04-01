from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import case, func, select

from app.db.session import get_session
from app.dependencies import require_role
from app.models.user import Establishment, User

router = APIRouter(tags=["Superadmin"])

@router.get("/superadmin/establishments")
async def list_establishments(
    db: AsyncSession = Depends(get_session),
    _current_user: User = Depends(require_role("SUPERADMIN", "ADMIN")),
) -> list[dict[str, Any]]:
    result = await db.execute(select(Establishment).order_by(Establishment.created_at.desc()))
    establishments = result.scalars().all()

    payload = []
    for est in establishments:
        counts = (
            await db.execute(
                select(
                    func.count(User.id),
                    func.sum(case((User.role == "STUDENT", 1), else_=0)),
                    func.sum(case((User.role == "TEACHER", 1), else_=0)),
                    func.sum(case((User.role == "ADMIN", 1), else_=0)),
                ).where(User.establishment_id == est.id)
            )
        ).one()
        payload.append({
            "id": str(est.id),
            "name": est.name,
            "domain": est.domain,
            "created_at": est.created_at,
            "users": int(counts[0] or 0),
            "students": int(counts[1] or 0),
            "teachers": int(counts[2] or 0),
            "admins": int(counts[3] or 0),
        })
    return payload
