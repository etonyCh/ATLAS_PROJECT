import asyncio
from sqlalchemy import select
from app.db.session import get_session
from app.models.user import User, TeacherProfile, Department, Establishment
from app.models.course import Course

async def check():
    async for session in get_session():
        print("--- RELATIONAL AUDIT ---")
        
        # 1. Check Establishments and their Departments
        est_res = await session.execute(select(Establishment))
        for est in est_res.scalars():
            print(f"Est: {est.name} ({est.id})")
            dept_res = await session.execute(select(Department).where(Department.establishment_id == est.id))
            for dept in dept_res.scalars():
                print(f"  - Dept: {dept.name} ({dept.id})")
                course_res = await session.execute(select(Course).where(Course.department_id == dept.id))
                for course in course_res.scalars():
                    print(f"    - Course: {course.title} ({course.id})")
        
        # 2. Check Teachers and their affiliation
        teacher_res = await session.execute(select(User).where(User.role == "TEACHER"))
        for t in teacher_res.scalars():
            profile_res = await session.execute(select(TeacherProfile).where(TeacherProfile.user_id == t.id))
            profile = profile_res.scalar_one_or_none()
            print(f"Teacher: {t.full_name} ({t.email})")
            print(f"  - Est ID on User: {t.establishment_id}")
            print(f"  - Dept ID on Profile: {profile.department_id if profile else 'NO PROFILE'}")
            
            # Check if this teacher CAN see any courses according to the logic
            # Current logic: Department.establishment_id == user.establishment_id 
            # AND (if profile.dept exist) course.dept_id == profile.dept_id
            
if __name__ == "__main__":
    asyncio.run(check())
