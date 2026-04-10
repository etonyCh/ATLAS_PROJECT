import asyncio
import logging
import uuid
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
from sqlmodel import SQLModel

from app.core.config import settings
from app.core.security import get_password_hash

# Initialize basic logging for the database session module
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Core asynchronous engine instance
engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=True, future=True)


DEFAULT_ADMIN_EMAIL = "admin@atlas.tn"
DEFAULT_ADMIN_PASSWORD = "Admin123!"
DEFAULT_ADMIN_FULL_NAME = "Atlas Admin"
DEFAULT_ESTABLISHMENT_NAME = "ATLAS University"
DEFAULT_ESTABLISHMENT_DOMAIN = "atlas.tn"


async def _ensure_default_admin(conn) -> None:
    """
    Guarantee that the bootstrap admin always exists with the default
    credentials required by the platform owner.

    This is intentionally self-healing:
    - creates the atlas.tn establishment if missing
    - creates the admin if missing
    - resets the admin password/flags/role on every startup
    """
    now = datetime.utcnow()

    establishment_result = await conn.execute(
        text("SELECT id FROM establishment WHERE domain = :domain"),
        {"domain": DEFAULT_ESTABLISHMENT_DOMAIN},
    )
    establishment_id = establishment_result.scalar_one_or_none()

    if establishment_id is None:
        establishment_id = str(uuid.uuid4())
        await conn.execute(
            text(
                """
                INSERT INTO establishment (id, name, domain, created_at)
                VALUES (:id, :name, :domain, :created_at)
                """
            ),
            {
                "id": establishment_id,
                "name": DEFAULT_ESTABLISHMENT_NAME,
                "domain": DEFAULT_ESTABLISHMENT_DOMAIN,
                "created_at": now,
            },
        )
        logger.info("Created bootstrap establishment for %s.", DEFAULT_ESTABLISHMENT_DOMAIN)

    hashed_password = get_password_hash(DEFAULT_ADMIN_PASSWORD)

    existing_user = await conn.execute(
        text('SELECT id FROM "user" WHERE email = :email'),
        {"email": DEFAULT_ADMIN_EMAIL},
    )
    user_id = existing_user.scalar_one_or_none()

    if user_id is None:
        await conn.execute(
            text(
                """
                INSERT INTO "user" (
                    id, email, hashed_password, full_name, role, status,
                    establishment_id, trust_score, profile_completeness,
                    is_active, is_verified, verified_at, onboarding_completed,
                    is_contributor, created_at
                )
                VALUES (
                    :id, :email, :hashed_password, :full_name, 'ADMIN', 'ACTIVE',
                    :establishment_id, 100, 100,
                    true, true, :verified_at, true,
                    true, :created_at
                )
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "email": DEFAULT_ADMIN_EMAIL,
                "hashed_password": hashed_password,
                "full_name": DEFAULT_ADMIN_FULL_NAME,
                "establishment_id": establishment_id,
                "verified_at": now,
                "created_at": now,
            },
        )
        logger.warning(
            "Bootstrap admin created: %s / %s",
            DEFAULT_ADMIN_EMAIL,
            DEFAULT_ADMIN_PASSWORD,
        )
        return

    await conn.execute(
        text(
            """
            UPDATE "user"
            SET hashed_password = :hashed_password,
                full_name = :full_name,
                role = 'ADMIN',
                status = 'ACTIVE',
                establishment_id = :establishment_id,
                trust_score = 100,
                profile_completeness = 100,
                is_active = true,
                is_verified = true,
                verified_at = :verified_at,
                onboarding_completed = true,
                is_contributor = true
            WHERE email = :email
            """
        ),
        {
            "email": DEFAULT_ADMIN_EMAIL,
            "hashed_password": hashed_password,
            "full_name": DEFAULT_ADMIN_FULL_NAME,
            "establishment_id": establishment_id,
            "verified_at": now,
        },
    )
    logger.warning(
        "Bootstrap admin synchronized to default credentials: %s / %s",
        DEFAULT_ADMIN_EMAIL,
        DEFAULT_ADMIN_PASSWORD,
    )

async def init_db(max_retries: int = 5, delay_seconds: int = 5):
    """
    Initialize the database connection and schema with resilient retry logic.
    This prevents the application from crashing if the database container is still booting.
    """
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Attempting database connection ({attempt}/{max_retries})...")
            
            async with engine.begin() as conn:
                # Auto-generate schema (Note: Alembic is typically preferred for migrations in production, 
                # but this ensures the baseline exists for local development/testing).
                # Vector storage now lives in Qdrant, so no pgvector extension is required.
                await conn.run_sync(SQLModel.metadata.create_all)
                await _ensure_default_admin(conn)
                
            logger.info("Database connection established and initialized successfully.")
            return  # Exit the retry loop upon success
            
        except (OperationalError, OSError) as e:
            logger.warning(f"Database connection failed on attempt {attempt}: {e}")
            if attempt == max_retries:
                logger.error("CRITICAL: Maximum database connection retries reached. Backend startup failed.")
                raise e
            
            logger.info(f"Retrying in {delay_seconds} seconds...")
            await asyncio.sleep(delay_seconds)

async def get_session() -> AsyncSession:
    """
    Dependency injection function for FastAPI endpoints.
    Yields an active database session for the request lifecycle.
    """
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session
