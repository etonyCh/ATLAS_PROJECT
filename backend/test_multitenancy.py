import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func, desc
import uuid

from app.core.config import settings
from app.models.user import User, UserRole, Establishment

async def main():
    engine = create_async_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # 1. Create two establishments
        e1 = Establishment(id=uuid.uuid4(), name="Est 1", domain="e1.com", is_authorized=True)
        e2 = Establishment(id=uuid.uuid4(), name="Est 2", domain="e2.com", is_authorized=True)
        
        session.add(e1)
        session.add(e2)
        await session.flush() # Get them in the session
        
        # 2. Create an admin for E1
        admin = User(
            id=uuid.uuid4(),
            email=f"admin_e1_{uuid.uuid4().hex[:4]}@test.com",
            role=UserRole.ADMIN,
            establishment_id=e1.id,
            is_active=True,
            hashed_password="dummy_password"
        )
        
        # 3. Create a user in E1
        user_e1 = User(
            id=uuid.uuid4(),
            email=f"user_e1_{uuid.uuid4().hex[:4]}@test.com",
            establishment_id=e1.id,
            is_active=True,
            hashed_password="dummy_password"
        )
        
        # 4. Create a user in E2
        user_e2 = User(
            id=uuid.uuid4(),
            email=f"user_e2_{uuid.uuid4().hex[:4]}@test.com",
            establishment_id=e2.id,
            is_active=True,
            hashed_password="dummy_password"
        )
        
        session.add(admin)
        session.add(user_e1)
        session.add(user_e2)
        await session.commit()
        
        # 5. Simulate list_users for admin of E1 with NEW STRICT LOGIC
        # filters = [User.establishment_id == admin.establishment_id]
        filters = [User.establishment_id == admin.establishment_id]
            
        result = await session.execute(select(User).where(*filters))
        visible_users = result.scalars().all()
        
        print(f"Admin {admin.email} (Est: {admin.establishment_id})")
        print(f"Visible users: {[u.email for u in visible_users]}")
        
        # Verify if user_e2 is visible
        e2_visible = any(u.id == user_e2.id for u in visible_users)
        print(f"User from E2 visible? {e2_visible}")
        
        if e2_visible:
            print("FAILURE: Multi-tenancy broken!")
        else:
            print("SUCCESS: Multi-tenancy preserved in query.")
            
        # 6. Cleanup (optional but good for testing)
        await session.delete(admin)
        await session.delete(user_e1)
        await session.delete(user_e2)
        await session.delete(e1)
        await session.delete(e2)
        await session.commit()

if __name__ == "__main__":
    asyncio.run(main())
