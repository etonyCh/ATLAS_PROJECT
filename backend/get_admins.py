import asyncio
import asyncpg

async def run():
    conn = await asyncpg.connect("postgresql://atlas_user:atlas_password@localhost:5433/atlas_db")
    users = await conn.fetch("SELECT email, role FROM \"user\" WHERE role IN ('SUPERADMIN', 'ADMIN')")
    if not users:
        print("No admin users found in the database. Creating one...")
        import uuid
        from datetime import datetime
        # Since I don't know the exact hashing method on the spot without checking models, I'll print the regular users to see if we can promote one
        all_users = await conn.fetch("SELECT email, role FROM \"user\"")
        print("All users:", [dict(u) for u in all_users])
    else:
        print("Admins:", [dict(u) for u in users])
    await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
