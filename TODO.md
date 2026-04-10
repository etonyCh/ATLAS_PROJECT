# TODO - Search + RAG CORS Fix

- [x] Diagnose config mismatch between Meilisearch clients
  - [x] Review `backend/app/core/config.py` settings for `MEILI_URL` and `MEILI_MASTER_KEY`
  - [x] Review compose/env wiring for Meilisearch variables
  - [x] Confirm which client is used by `/search` and `/search/autocomplete`

- [x] Align Meilisearch client initialization
  - [x] Update `backend/app/services/ai_core/rag_inference.py` to use `settings` (not raw `os.getenv`)
  - [x] Add startup log context for selected Meili host/key presence (masked)

- [x] Fix RAG CORS path
  - [x] Update `backend/app/main.py` to use `settings.BACKEND_CORS_ORIGINS` consistently
  - [x] Ensure localhost frontend origins remain allowed in local/dev

- [ ] Verify critical path
  - [ ] Preflight OPTIONS for `/api/v1/rag/sessions`
  - [ ] POST `/api/v1/rag/sessions` from localhost frontend origin
  - [ ] Validate semantic flow after CORS unblocks
