import asyncio
from sqlalchemy import select, update
from app.db.session import get_session
from app.models.user import User, TeacherProfile, Department
from app.models.course import Course

async def fix_data():
    print("--- Catalog Data Cleanup ---")
    async for session in get_session():
        # 1. Find a default department (e.g. Computer Science in establishment 71d9...)
        # We'll pick the first department found in the DB as a safe default for orphans if they match the establishment
        res_dept = await session.execute(select(Department))
        depts = res_dept.scalars().all()
        
        if not depts:
            print("❌ No departments found! Cannot fix data.")
            return
            
        default_dept = depts[0]
        print(f"Using Default Dept: {default_dept.name} ({default_dept.id})")

        # 2. Fix Orphan Courses (Dept ID is None)
        res_orphan = await session.execute(select(Course).where(Course.department_id.is_(None)))
        orphans = res_orphan.scalars().all()
        print(f"Found {len(orphans)} orphan courses.")
        
        for c in orphans:
            c.department_id = default_dept.id
            session.add(c)
        
        # 3. Fix Unassigned Teachers (linking them to their establishment's first department)
        res_teachers = await session.execute(select(User).where(User.role == "TEACHER"))
        teachers = res_teachers.scalars().all()
        
        for t in teachers:
            res_p = await session.execute(select(TeacherProfile).where(TeacherProfile.user_id == t.id))
            p = res_p.scalar_one_or_none()
            
            if not p:
                print(f"Creating profile for teacher: {t.full_name}")
                p = TeacherProfile(user_id=t.id)
                session.add(p)
            
            if not p.department_id:
                # Find the first department in the teacher's establishment
                res_est_dept = await session.execute(
                    select(Department).where(Department.establishment_id == t.establishment_id).limit(1)
                )
                est_dept = res_est_dept.scalar_one_or_none()
                if est_dept:
                    print(f"Assigning teacher {t.full_name} ({t.email}) to {est_dept.name}")
                    p.department_id = est_dept.id
                    session.add(p)
                else:
                    print(f"⚠️ No department found for teacher establishment {t.establishment_id}")

        await session.commit()
        print("✅ Data synchronization complete.")

if __name__ == "__main__":
    asyncio.run(fix_data())
