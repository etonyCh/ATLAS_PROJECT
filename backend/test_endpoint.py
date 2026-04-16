import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func, desc

from app.core.config import settings
from app.models.user import User

async def list_users_sim(_current_user: User, session: AsyncSession):
    filters = []
    
    if _current_user.establishment_id:
        filters.append(User.establishment_id == _current_user.establishment_id)
        
    print(f"Filters applied: {filters}")

    total = await session.execute(select(func.count()).select_from(User).where(*filters))
    result = await session.execute(
        select(User).where(*filters).order_by(desc(User.created_at)).offset(0).limit(20)
    )
    users = result.scalars().all()
    print(f"Total counted: {total.scalar_one()}")
    for user in users:
        print(f"- {user.email} (Est: {user.establishment_id})")

async def main():
    engine = create_async_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == 'etony@biu.bi'))
        admin = result.scalar_one_or_none()
        
        await list_users_sim(admin, session)

if __name__ == "__main__":
    asyncio.run(main())
