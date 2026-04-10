"""
Quick seed script to create login-ready default admin and superadmin users.
Run this after migrations are applied.
"""

import asyncio
import uuid
from datetime import datetime

import asyncpg

from app.core.security import get_password_hash


DB_URL = "postgresql://atlas_user:atlas_password@localhost:5433/atlas_db"
ADMIN_EMAIL = "admin@atlas.tn"
ADMIN_PASSWORD = "Admin123!"
SUPERADMIN_EMAIL = "superadmin@atlas.tn"
SUPERADMIN_PASSWORD = "SuperAdmin123!"
ESTABLISHMENT_DOMAIN = "atlas.tn"
ESTABLISHMENT_NAME = "ATLAS University"


async def _ensure_establishment(conn: asyncpg.Connection) -> str:
    existing = await conn.fetchrow(
        "SELECT id FROM establishment WHERE domain = $1",
        ESTABLISHMENT_DOMAIN,
    )
    if existing:
        return str(existing["id"])

    establishment_id = str(uuid.uuid4())
    await conn.execute(
        """
        INSERT INTO establishment (id, name, domain, created_at)
        VALUES ($1, $2, $3, $4)
        """,
        establishment_id,
        ESTABLISHMENT_NAME,
        ESTABLISHMENT_DOMAIN,
        datetime.utcnow(),
    )
    return establishment_id


async def _upsert_user(
    conn: asyncpg.Connection,
    *,
    email: str,
    password: str,
    full_name: str,
    role: str,
    establishment_id: str | None = None,
) -> None:
    existing = await conn.fetchrow('SELECT id FROM "user" WHERE email = $1', email)
    hashed_password = get_password_hash(password)
    now = datetime.utcnow()

    if existing:
        await conn.execute(
            """
            UPDATE "user"
            SET hashed_password = $2,
                full_name = $3,
                role = $4,
                status = 'ACTIVE',
                establishment_id = $5,
                trust_score = 100,
                profile_completeness = 100,
                is_active = true,
                is_verified = true,
                verified_at = $6,
                onboarding_completed = true,
                is_contributor = true
            WHERE email = $1
            """,
            email,
            hashed_password,
            full_name,
            role,
            establishment_id,
            now,
        )
        print(f"Synchronized {email} with default credentials.")
        return

    await conn.execute(
        """
        INSERT INTO "user" (
            id, email, hashed_password, full_name, role, status,
            establishment_id, trust_score, profile_completeness,
            is_active, is_verified, verified_at, onboarding_completed,
            is_contributor, created_at
        )
        VALUES (
            $1, $2, $3, $4, $5, 'ACTIVE',
            $6, 100, 100,
            true, true, $7, true,
            true, $8
        )
        """,
        str(uuid.uuid4()),
        email,
        hashed_password,
        full_name,
        role,
        establishment_id,
        now,
        now,
    )
    print(f"Created {role} user: {email}")


async def create_users():
    conn = await asyncpg.connect(DB_URL)
    try:
        establishment_id = await _ensure_establishment(conn)

        await _upsert_user(
            conn,
            email=ADMIN_EMAIL,
            password=ADMIN_PASSWORD,
            full_name="Atlas Admin",
            role="ADMIN",
            establishment_id=establishment_id,
        )
        await _upsert_user(
            conn,
            email=SUPERADMIN_EMAIL,
            password=SUPERADMIN_PASSWORD,
            full_name="Atlas Superadmin",
            role="SUPERADMIN",
            establishment_id=establishment_id,
        )

        print("\nLogin-ready default accounts:")
        print(f" - {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        print(f" - {SUPERADMIN_EMAIL} / {SUPERADMIN_PASSWORD}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(create_users())
