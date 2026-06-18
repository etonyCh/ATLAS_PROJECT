import asyncio
import sys
import sqlalchemy as sa
from sqlmodel import select

sys.path.insert(0, "/app")

from app.db.session import get_session
from app.models.contribution import DocumentVersion

async def main():
    async for db in get_session():
        # Query documentversion
        try:
            statement = select(DocumentVersion)
            result = await db.execute(statement)
            doc_versions = result.scalars().all()
            print("--- documentversion ---")
            for dv in doc_versions:
                ocr_len = len(dv.ocr_text) if dv.ocr_text else 0
                print(f"ID: {dv.id} | Path: {dv.storage_path} | Status: {dv.pipeline_status} | OCR Len: {ocr_len} | Parser: {dv.parser_used}")
        except Exception as e:
            print(f"Failed to query documentversion: {e}")
            await db.rollback()

        # Query documents (ATLAS-OCR internal)
        try:
            res = await db.execute(sa.text("SELECT uuid, original_filename, status, ocr_mode, error_message FROM documents"))
            docs = res.fetchall()
            print("\n--- documents (ATLAS-OCR internal) ---")
            for doc in docs:
                print(f"UUID: {doc[0]} | Name: {doc[1]} | Status: {doc[2]} | Mode: {doc[3]} | Error: {doc[4]}")
        except Exception as e:
            print(f"\nFailed to query documents table: {e}")
            await db.rollback()

        # Count parent chunks for this specific document UUID
        doc_uuid = "a9c9d61e-b84f-4e0c-8681-6731107604b4"
        try:
            res = await db.execute(sa.text("SELECT COUNT(*) FROM parent_chunks WHERE document_uuid = :uuid"), {"uuid": doc_uuid})
            count = res.scalar()
            print(f"\nParent chunks for {doc_uuid}: {count}")
        except Exception as e:
            print(f"Failed to count parent chunks: {e}")
            await db.rollback()

        # Count child chunks for this specific document UUID
        try:
            res = await db.execute(sa.text("""
                SELECT COUNT(*) FROM child_chunks 
                WHERE parent_id IN (SELECT id FROM parent_chunks WHERE document_uuid = :uuid)
            """), {"uuid": doc_uuid})
            count = res.scalar()
            print(f"Child chunks for {doc_uuid}: {count}")
        except Exception as e:
            # Let's see what the child chunks table is called
            try:
                # Let's search tables
                res = await db.execute(sa.text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
                tables = [r[0] for r in res.fetchall()]
                print(f"All Tables: {tables}")
            except Exception as e2:
                print(f"Failed to list tables: {e2}")
            await db.rollback()
            
        break

if __name__ == "__main__":
    asyncio.run(main())
