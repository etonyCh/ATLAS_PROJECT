import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func

from app.core.config import settings
from app.models.user import User

async def main():
    engine = create_async_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check the admin user
        result = await session.execute(select(User).where(User.email == 'etony@biu.bi'))
        admin = result.scalar_one_or_none()
        
        if admin:
            print(f"Admin Found: {admin.email}")
            print(f"Role: {admin.role}")
            print(f"Establishment ID: {admin.establishment_id}")
            
            if admin.establishment_id:
                # How many users in this establishment?
                count = await session.execute(select(func.count()).select_from(User).where(User.establishment_id == admin.establishment_id))
                print(f"Users in establishment: {count.scalar_one()}")
                
                # How many total users in DB?
                total = await session.execute(select(func.count()).select_from(User))
                print(f"Total Users in DB: {total.scalar_one()}")
        else:
            print("Admin 'etony@biu.bi' not found!")

if __name__ == "__main__":
    asyncio.run(main())
