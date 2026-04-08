"""
One-time sync script: Push all approved documents from PostgreSQL into MeiliSearch.
Run from the backend directory: python sync_meilisearch.py
"""

import asyncio
import os
import sys

# Ensure the backend app is importable
sys.path.insert(0, os.path.dirname(__file__))

import meilisearch
from sqlalchemy import text
from app.db.session import engine


MEILI_URL = os.getenv("MEILI_URL", "http://localhost:7700")
MEILI_MASTER_KEY = os.getenv("MEILI_MASTER_KEY", "meili_master_key")


async def sync():
    client = meilisearch.Client(MEILI_URL, MEILI_MASTER_KEY)
    index = client.index("documents")

    # Configure index settings
    index.update_settings(
        {
            "filterableAttributes": [
                "level",
                "academic_year",
                "course_type",
                "language",
                "is_official",
                "document_version_id",
                "filiere",
            ],
            "searchableAttributes": ["title", "ocr_text", "tags", "teacher_name", "filiere"],
            "typoTolerance": {
                "enabled": True,
                "minWordSizeForTypos": {"oneTypo": 4, "twoTypos": 8},
            },
        }
    )

    query = text("""
        SELECT
            dv.id AS document_version_id,
            COALESCE(c2.title, con.title, 'Untitled') AS title,
            COALESCE(con.course_id, c2.id) AS course_id,
            COALESCE(u.full_name, u.email, 'Unknown') AS teacher_name,
            CASE WHEN u.role IN ('TEACHER', 'ADMIN') THEN true ELSE false END AS is_official,
            COALESCE(dv.quality_score, 0.0) AS quality_score,
            COALESCE(c2.tags, '{}') AS tags,
            d.name AS filiere,
            c2.level AS level,
            c2.academic_year AS academic_year,
            c2.course_type AS course_type,
            c2.language AS language,
            COALESCE(dv.ocr_text, '') AS ocr_text
        FROM documentversion dv
        JOIN contribution con ON dv.contribution_id = con.id
        JOIN "user" u ON con.uploader_id = u.id
        LEFT JOIN course c2 ON con.course_id = c2.id
        LEFT JOIN department d ON c2.department_id = d.id
        WHERE con.status = 'APPROVED'
          AND dv.is_deleted = false
    """)

    async with engine.connect() as conn:
        result = await conn.execute(query)
        rows = result.mappings().all()

    if not rows:
        print("No approved documents found in the database.")
        return

    documents = []
    for row in rows:
        doc = {
            "id": str(row["document_version_id"]),
            "document_version_id": str(row["document_version_id"]),
            "title": row["title"],
            "course_id": str(row["course_id"]) if row["course_id"] else None,
            "teacher_name": row["teacher_name"],
            "is_official": row["is_official"],
            "quality_score": float(row["quality_score"]) if row["quality_score"] else 0.0,
            "tags": list(row["tags"]) if row["tags"] else [],
            "filiere": row["filiere"] or "",
            "level": row["level"].value if hasattr(row["level"], "value") else row["level"],
            "academic_year": row["academic_year"],
            "course_type": row["course_type"].value
            if hasattr(row["course_type"], "value")
            else row["course_type"],
            "language": row["language"].value
            if hasattr(row["language"], "value")
            else (row["language"] or "FR"),
            "ocr_text": row["ocr_text"] or "",
        }
        documents.append(doc)

    print(f"Found {len(documents)} approved document(s). Indexing into MeiliSearch...")

    task = index.add_documents(documents, primary_key="id")
    print(f"MeiliSearch task queued: UID={task.task_uid}")

    # Wait for task to complete
    client.wait_for_task(task.task_uid, timeout_in_ms=30000)
    task_info = client.get_task(task.task_uid)
    print(f"Task status: {task_info.status}")

    if task_info.status == "succeeded":
        stats = index.get_stats()
        print(f"SUCCESS: MeiliSearch now has {stats.number_of_documents} document(s) indexed.")
    else:
        print(f"FAILED: {task_info.error}")


if __name__ == "__main__":
    asyncio.run(sync())
