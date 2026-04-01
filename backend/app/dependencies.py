from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.exceptions import atlas_error
from app.db.session import get_session
from app.models.user import User


bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_session),
) -> User:
    if credentials is None:
        raise atlas_error("AUTH_007", "Authentication credentials are required.", status_code=401)

    payload = security.decode_token(credentials.credentials)
    subject = payload.get("sub") if payload else None
    if not subject:
        raise atlas_error(
            "AUTH_007",
            "The access token is invalid or has expired.",
            status_code=401,
        )

    result = await db.execute(select(User).where(User.id == UUID(subject)))
    user = result.scalar_one_or_none()
    if user is None:
        raise atlas_error(
            "AUTH_007",
            "The access token is invalid or has expired.",
            status_code=401,
        )
    return user


def require_role(*roles: str) -> Callable[[User], User]:
    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        if user_role not in roles:
            raise atlas_error(
                "AUTH_008",
                "You do not have permission to perform this action.",
                status_code=403,
            )
        return current_user

    return dependency
