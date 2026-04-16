import asyncio
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_session
from app.models.all_models import User, Contribution, TeacherProfile
from app.routers.contributions import list_contribution_queue

async def verify_filtering():
    async for db in get_session():
        # Get a teacher
        res = await db.execute(
            select(User)
            .where(User.email == "mouhamedgharsala@gmail.com")
            .options(selectinload(User.teacher_profile))
        )
        teacher = res.scalar_one()
        
        print(f"Testing filter for Teacher: {teacher.email}")
        
        try:
            # Call the queue listing function
            response = await list_contribution_queue(db=db, current_user=teacher)
            items = response.get("items", [])
            print(f"Total items in queue: {len(items)}")
            
            non_student_found = False
            for item in items:
                # We need to check the uploader of this item
                contrib_res = await db.execute(select(Contribution, User).join(User, User.id == Contribution.uploader_id).where(Contribution.id == item["id"]))
                contrib, uploader = contrib_res.first()
                print(f" - Contribution '{item['title']}' by {uploader.email} (Role: {uploader.role})")
                if uploader.role != "STUDENT":
                    non_student_found = True
            
            if non_student_found:
                print("❌ FAILED: Found non-student contributions in the teacher's queue.")
            else:
                print("✅ SUCCESS: Only student contributions are visible to the teacher.")
                
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_filtering())
