import asyncio
import asyncpg
import sys

async def run(email):
    conn = await asyncpg.connect("postgresql://atlas_user:atlas_password@localhost:5433/atlas_db")
    
    # Check if user exists
    user = await conn.fetchrow("SELECT id, email, role FROM \"user\" WHERE email = $1", email)
    if user:
        # Promote
        await conn.execute("UPDATE \"user\" SET role = 'ADMIN' WHERE email = $1", email)
        print(f"Successfully promoted {email} to ADMIN.")
    else:
        # Create a basic admin user? It's better to tell the user to sign up and then promote them.
        print(f"User {email} not found. Please sign up on the frontend first!")
        
    all_users = await conn.fetch("SELECT email, role FROM \"user\"")
    print("All current users:")
    for u in all_users:
        print(f" - {u['email']} [{u['role']}]")

    await conn.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        asyncio.run(run(sys.argv[1]))
    else:
        asyncio.run(run("admin@atlas.com"))
