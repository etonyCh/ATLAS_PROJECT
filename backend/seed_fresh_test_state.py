import asyncio
import json
import uuid
from datetime import UTC, datetime

import asyncpg

from app.core.security import get_password_hash


DB_URL = "postgresql://atlas_user:atlas_password@localhost:5433/atlas_db"


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


async def ensure_establishment(conn: asyncpg.Connection, name: str, domain: str) -> str:
    existing = await conn.fetchrow(
        "SELECT id FROM establishment WHERE domain = $1",
        domain,
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
        name,
        domain,
        utc_now(),
    )
    return establishment_id


async def ensure_department(conn: asyncpg.Connection, establishment_id: str, name: str) -> str:
    existing = await conn.fetchrow(
        "SELECT id FROM department WHERE establishment_id = $1 AND name = $2",
        establishment_id,
        name,
    )
    default_levels = ["L1", "L2", "L3", "M1", "M2", "Doctorat"]
    default_levels_json = json.dumps(default_levels)
    if existing:
        await conn.execute(
            """
            UPDATE department
            SET allowed_levels = $3
            WHERE establishment_id = $1 AND name = $2
            """,
            establishment_id,
            name,
            default_levels_json,
        )
        return str(existing["id"])

    department_id = str(uuid.uuid4())
    await conn.execute(
        """
        INSERT INTO department (id, name, establishment_id, allowed_levels, created_at)
        VALUES ($1, $2, $3, $4, $5)
        """,
        department_id,
        name,
        establishment_id,
        default_levels_json,
        utc_now(),
    )
    return department_id


async def ensure_user(
    conn: asyncpg.Connection,
    *,
    email: str,
    password: str,
    full_name: str,
    role: str,
    establishment_id: str | None = None,
    filiere: str | None = None,
    level: str | None = None,
    onboarding_completed: bool = True,
    trust_score: int = 0,
    profile_completeness: int = 100,
) -> str:
    existing = await conn.fetchrow('SELECT id FROM "user" WHERE email = $1', email)
    hashed_password = get_password_hash(password)
    now = utc_now()

    if existing:
        user_id = str(existing["id"])
        is_contributor = role in ("TEACHER", "ADMIN", "SUPER_ADMIN")
        await conn.execute(
            """
            UPDATE "user"
            SET full_name = $2,
                role = $3,
                establishment_id = $4,
                status = 'ACTIVE',
                trust_score = $5,
                profile_completeness = $6,
                is_active = true,
                is_verified = true,
                verified_at = $7,
                filiere = $8,
                level = $9,
                onboarding_completed = $10,
                is_contributor = $11,
                hashed_password = $12
            WHERE email = $1
            """,
            email,
            full_name,
            role,
            establishment_id,
            trust_score,
            profile_completeness,
            now,
            filiere,
            level,
            onboarding_completed,
            is_contributor,
            hashed_password,
        )
        return user_id

    user_id = str(uuid.uuid4())
    is_contributor = role in ("TEACHER", "ADMIN", "SUPER_ADMIN")
    await conn.execute(
        """
        INSERT INTO "user" (
            email, full_name, role, status, establishment_id, trust_score, profile_completeness,
            is_active, is_verified, verified_at, filiere, level, onboarding_completed,
            is_contributor, id, hashed_password, created_at
        )
        VALUES (
            $1, $2, $3, 'ACTIVE', $4, $5, $6,
            true, true, $7, $8, $9, $10,
            $11, $12, $13, $14
        )
        """,
        email,
        full_name,
        role,
        establishment_id,
        trust_score,
        profile_completeness,
        now,
        filiere,
        level,
        onboarding_completed,
        is_contributor,
        user_id,
        hashed_password,
        now,
    )
    return user_id


async def ensure_teacher_profile(
    conn: asyncpg.Connection, user_id: str, department_id: str, specialization: str
) -> None:
    existing = await conn.fetchrow(
        "SELECT id FROM teacherprofile WHERE user_id = $1",
        user_id,
    )
    if existing:
        await conn.execute(
            """
            UPDATE teacherprofile
            SET department_id = $2, specialization = $3
            WHERE user_id = $1
            """,
            user_id,
            department_id,
            specialization,
        )
        return

    await conn.execute(
        """
        INSERT INTO teacherprofile (id, user_id, department_id, specialization, modules)
        VALUES ($1, $2, $3, $4, $5)
        """,
        str(uuid.uuid4()),
        user_id,
        department_id,
        specialization,
        "Algorithms, Data Structures",
    )


async def main() -> None:
    conn = await asyncpg.connect(DB_URL)
    async with conn.transaction():
        atlas_id = await ensure_establishment(conn, "ATLAS University", "atlas.tn")

        await ensure_user(
            conn,
            email="admin@atlas.tn",
            password="Admin123!",
            full_name="Atlas Admin",
            role="ADMIN",
            establishment_id=atlas_id,
            trust_score=90,
        )
        await ensure_user(
            conn,
            email="superadmin@atlas.tn",
            password="SuperAdmin123!",
            full_name="Atlas Superadmin",
            role="SUPERADMIN",
            trust_score=100,
        )

    print("Fresh test state created (Only Admins).")
    print("")
    print("Login-ready accounts:")
    print("  admin@atlas.tn / Admin123!")
    print("  superadmin@atlas.tn / SuperAdmin123!")
    print("")

    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
