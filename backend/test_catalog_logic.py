import asyncio
from sqlalchemy import select
from app.db.session import get_session
from app.models.all_models import User, Course, Department, TeacherProfile
from app.routers.courses import list_course_catalog

async def test_logic():
    async for db in get_session():
        # Get one of the teachers
        res = await db.execute(select(User).where(User.email == "mouhamedgharsala@gmail.com"))
        teacher = res.scalar_one()
        
        print(f"Testing for teacher: {teacher.email} (Est: {teacher.establishment_id})")
        
        try:
            # Manually call the endpoint logic
            catalog = await list_course_catalog(db, teacher)
            print("Catalog fetch successful!")
            print(f"Items found: {len(catalog)}")
            for item in catalog:
                print(f" - {item['title']} ({item['id']})")
        except Exception as e:
            print(f"CATALOG FETCH FAILED: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_logic())
