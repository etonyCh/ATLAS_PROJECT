import asyncio
import sys

sys.path.insert(0, "/app")

from app.services.doc_processing.upload_service import _async_ingestion_worker

async def main():
    file_path = "/omni/workspace/a9c9d61e-b84f-4e0c-8681-6731107604b4.pdf"
    doc_uuid = "a9c9d61e-b84f-4e0c-8681-6731107604b4"
    print(f"Retriggering ingestion for {doc_uuid} at {file_path}...")
    await _async_ingestion_worker(file_path, doc_uuid)
    print("Ingestion worker finished.")

if __name__ == "__main__":
    asyncio.run(main())
