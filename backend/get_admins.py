import asyncio
import asyncpg

async def run():
    conn = await asyncpg.connect("postgresql://atlas_user:atlas_password@localhost:5433/atlas_db")
    users = await conn.fetch("SELECT email, role, full_name FROM \"user\"")
    print("All Users:", [dict(u) for u in users])
    await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
