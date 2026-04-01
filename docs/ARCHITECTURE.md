# Architecture

## High-Level Architecture

ATLAS uses a split frontend/backend architecture.

### Frontend

- Framework: Next.js App Router
- Language: TypeScript
- UI: React + Tailwind CSS + Radix UI
- Data Fetching: TanStack Query
- HTTP Client: Axios
- State: Zustand for selected app state

### Backend

- Framework: FastAPI
- Language: Python
- ORM/Modeling: SQLModel
- Database: PostgreSQL-oriented stack
- Async runtime: SQLAlchemy async + async drivers
- Background work: Celery + Redis
- File/object storage: MinIO
- AI services: RAG, embeddings, study generation pipeline

## Architectural Layers

## Frontend Layers

- `app/`
  route structure and page composition
- `components/`
  reusable UI and feature components
- `queries/`
  query and mutation hooks
- `lib/api.ts`
  typed client boundary to backend
- `types/api.types.ts`
  frontend-facing API contracts

## Backend Layers

- `routers/`
  public API route handlers
- `services/`
  business logic and subsystem behavior
- `models/`
  persistence models
- `db/`
  active session/engine layer
- `core/`
  configuration, security, permissions, and shared infrastructure
- `schemas/`
  spec-facing request/response models

## Current Active Backend Entry Pattern

- app bootstraps through `app.main`
- router registration is centralized via `routers/registry.py`
- API prefix source is centralized through active settings

## Request Flow

1. Frontend route or component triggers a query or mutation.
2. `frontend/src/lib/api.ts` sends a typed request to `/api/v1/...`
3. FastAPI router receives the request.
4. Auth/role dependencies validate access.
5. Service and model layers execute business logic.
6. Response is returned in a frontend-consumable contract.

## Contract Strategy

The preferred architecture is:

- backend response shape is the source of truth
- frontend types mirror backend contracts
- paginated list endpoints share a common envelope

This approach reduces:

- fragile adapter code
- hidden fallback data
- silent contract drift

## Real-Time Architecture

ATLAS includes websocket support for:

- forum channels
- notification channels

These are used for real-time event delivery where supported by the current UI.

## AI/Study Tool Architecture

Study tool generation and retrieval uses:

- OCR/document version data
- generation services for flashcards, quizzes, summaries, and mind maps
- RAG session/message model for AI chat

## Known Architectural Debt

- legacy `app/api/v1/endpoints` subtree still exists
- compatibility wrappers still exist for old config/database imports
- some product pages expose thinner data than their UI could support

## Target Future Architecture

Recommended future direction:

- one router surface only
- one dependency/auth source only
- one public schema package for all API contracts
- stronger service isolation
- deeper automated contract testing
