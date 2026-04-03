"""
Quick seed script to create default admin and superadmin users directly.
Run this after migrations are applied.
"""

import asyncio
import asyncpg
import sys
import hashlib


async def create_users():
    conn = await asyncpg.connect("postgresql://atlas_user:atlas_password@localhost:5433/atlas_db")

    # Check if users already exist
    existing = await conn.fetch('SELECT email, role FROM "user"')
    existing_emails = {u["email"] for u in existing}

    # Create admin user if not exists
    if "admin@atlas.tn" not in existing_emails:
        admin_id = await conn.fetchval("""
            INSERT INTO "user" (email, hashed_password, full_name, role, is_active, is_verified, onboarding_completed)
            VALUES ('admin@atlas.tn', 'fake_hash_for_dev', 'Atlas Admin', 'ADMIN', true, true, true)
            RETURNING id
        """)
        print(f"Created admin user: admin@atlas.tn (ID: {admin_id})")
    else:
        # Update role to ADMIN if exists
        await conn.execute("UPDATE \"user\" SET role = 'ADMIN' WHERE email = 'admin@atlas.tn'")
        print("Updated admin@atlas.tn to ADMIN role")

    # Create superadmin user if not exists
    if "superadmin@atlas.tn" not in existing_emails:
        superadmin_id = await conn.fetchval("""
            INSERT INTO "user" (email, hashed_password, full_name, role, is_active, is_verified, onboarding_completed)
            VALUES ('superadmin@atlas.tn', 'fake_hash_for_dev', 'Atlas Superadmin', 'SUPERADMIN', true, true, true)
            RETURNING id
        """)
        print(f"Created superadmin user: superadmin@atlas.tn (ID: {superadmin_id})")
    else:
        # Update role to SUPERADMIN if exists
        await conn.execute(
            "UPDATE \"user\" SET role = 'SUPERADMIN' WHERE email = 'superadmin@atlas.tn'"
        )
        print("Updated superadmin@atlas.tn to SUPERADMIN role")

    # Show all users
    print("\nAll users in database:")
    users = await conn.fetch('SELECT email, role FROM "user"')
    for u in users:
        print(f" - {u['email']} [{u['role']}]")

    print("\nIMPORTANT: These are placeholder users!")
    print("To actually log in, use the frontend to register with a real email,")
    print("then use promote_admin.py or promote_superadmin.py to promote that account.")

    await conn.close()


if __name__ == "__main__":
    asyncio.run(create_users())
