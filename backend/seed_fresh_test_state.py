import asyncio
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
    if existing:
        return str(existing["id"])

    department_id = str(uuid.uuid4())
    await conn.execute(
        """
        INSERT INTO department (id, name, establishment_id, created_at)
        VALUES ($1, $2, $3, $4)
        """,
        department_id,
        name,
        establishment_id,
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


async def ensure_teacher_profile(conn: asyncpg.Connection, user_id: str, department_id: str, specialization: str) -> None:
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
        fss_id = await ensure_establishment(conn, "Faculty of Sciences", "fss.tn")
        enit_id = await ensure_establishment(conn, "ENIT", "enit.tn")

        atlas_cs_id = await ensure_department(conn, atlas_id, "Computer Science")
        await ensure_department(conn, atlas_id, "Mathematics")
        await ensure_department(conn, atlas_id, "Physics")
        await ensure_department(conn, fss_id, "Computer Science")
        await ensure_department(conn, fss_id, "Biology")
        await ensure_department(conn, enit_id, "Engineering")

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
        await ensure_user(
            conn,
            email="student@atlas.tn",
            password="Student123!",
            full_name="Atlas Student",
            role="STUDENT",
            establishment_id=atlas_id,
            filiere="Informatique",
            level="L3",
            onboarding_completed=False,
            trust_score=10,
            profile_completeness=65,
        )
        teacher_id = await ensure_user(
            conn,
            email="teacher@atlas.tn",
            password="Teacher123!",
            full_name="Atlas Teacher",
            role="TEACHER",
            establishment_id=atlas_id,
            trust_score=75,
        )
        await ensure_teacher_profile(conn, teacher_id, atlas_cs_id, "Computer Science")

    print("Fresh test state created.")
    print("")
    print("Login-ready accounts:")
    print("  admin@atlas.tn / Admin123!")
    print("  superadmin@atlas.tn / SuperAdmin123!")
    print("  student@atlas.tn / Student123!")
    print("  teacher@atlas.tn / Teacher123!")
    print("")
    print("Teacher request testing:")
    print("  Use any unused @atlas.tn email on /auth/teacher-request")
    print("  Example: newteacher@atlas.tn")
    print("")
    print("Admin organization domain:")
    print("  atlas.tn")

    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
