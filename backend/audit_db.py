import asyncio
from sqlalchemy import select, func
from app.db.session import get_session
from app.models.course import Course
from app.models.user import User, TeacherProfile, Establishment, Department

async def check():
    async for session in get_session():
        # Counts
        c = (await session.execute(select(func.count(Course.id)))).scalar_one()
        u = (await session.execute(select(func.count(User.id)))).scalar_one()
        tp = (await session.execute(select(func.count(TeacherProfile.id)))).scalar_one()
        e = (await session.execute(select(func.count(Establishment.id)))).scalar_one()
        d = (await session.execute(select(func.count(Department.id)))).scalar_one()
        
        print(f"--- DATABASE AUDIT ---")
        print(f"Establishments: {e}")
        print(f"Departments: {d}")
        print(f"Courses: {c}")
        print(f"Users: {u}")
        print(f"Teacher Profiles: {tp}")
        
        # Details of first few courses if any
        if c > 0:
            res = await session.execute(select(Course).limit(5))
            for row in res.scalars():
                print(f"Course: {row.title} (Dept: {row.department_id})")
        
        # Current users
        res = await session.execute(select(User).limit(10))
        for row in res.scalars():
            print(f"User: {row.email} (Role: {row.role}, Est: {row.establishment_id})")

if __name__ == "__main__":
    asyncio.run(check())
