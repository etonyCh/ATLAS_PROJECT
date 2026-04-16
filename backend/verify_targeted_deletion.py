import asyncio
from uuid import UUID
from sqlalchemy import select
from app.db.session import get_session
from app.models.contribution import Contribution, DocumentVersion
from app.models.course import Course
from app.models.user import User
from app.routers.contributions import delete_contribution

# Mock BackgroundTasks since we are calling the function directly
class MockBackgroundTasks:
    def add_task(self, func, *args, **kwargs):
        print(f"Adding background task: {func.__name__}")

async def verify_targeted_deletion():
    async for db in get_session():
        # 1. Find a teacher upload (Contribution)
        res = await db.execute(
            select(Contribution, User, Course)
            .join(User, User.id == Contribution.uploader_id)
            .join(Course, Course.id == Contribution.course_id)
            .where(User.role == "TEACHER")
            .limit(1)
        )
        row = res.first()
        if not row:
            print("No teacher upload found to test with.")
            return

        contribution, teacher, course = row
        contribution_id = contribution.id
        course_id = course.id
        
        print(f"Testing deletion for Contribution: {contribution.title} (ID: {contribution_id})")
        print(f"Associated Course: {course.title} (ID: {course_id})")

        # 2. Perform deletion
        try:
            from fastapi import BackgroundTasks
            bt = MockBackgroundTasks()
            # We need a Redis client too
            from app.core.redis import get_redis_client
            redis_client = await get_redis_client()
            
            result = await delete_contribution(
                contribution_id=contribution_id,
                background_tasks=bt,
                current_user=teacher,
                db=db,
                redis_client=redis_client
            )
            print(f"Deletion result: {result}")

            # 3. Verify PostgreSQL state
            await db.commit() # Flush changes
            
            # Check Contribution is gone
            c_check = await db.get(Contribution, contribution_id)
            if c_check is None:
                print("✅ SUCCESS: Contribution record deleted from DB.")
            else:
                print("❌ FAILED: Contribution record still exists in DB.")

            # Check Course is still there
            course_check = await db.get(Course, course_id)
            if course_check is not None:
                print(f"✅ SUCCESS: Course '{course_check.title}' still exists in catalog.")
            else:
                print("❌ FAILED: Course was deleted! (Integrity Error)")

        except Exception as e:
            print(f"ERROR during test: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_targeted_deletion())
