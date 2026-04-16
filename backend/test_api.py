import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.services.iam import auth_service
from app.core.redis import get_redis_client
from httpx import AsyncClient

async def main():
    redis_client = await get_redis_client()
    engine = create_async_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        user = await auth_service.authenticate_user(session, 'etony@biu.bi', 'Etony123!', redis_client)
        if not user:
            print("Login failed")
            return
            
        access_token, _ = auth_service.create_user_tokens(user.id, user.role.value if hasattr(user.role, 'value') else user.role)
        print(f"Token: {access_token[:20]}...")
        
        async with AsyncClient(base_url="http://localhost:8000") as client:
            response = await client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {access_token}"})
            print(f"Status: {response.status_code}")
            print(response.json())

if __name__ == "__main__":
    asyncio.run(main())
