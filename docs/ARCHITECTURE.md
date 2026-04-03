# Architecture

## System Shape

ATLAS uses a split web architecture:

- `frontend/`
  Next.js App Router application for public auth, student, teacher, admin, and
  superadmin experiences
- `backend/`
  FastAPI service exposing `/api/v1/...` routes for identity, courses,
  moderation, study tools, and governance
- infrastructure
  PostgreSQL, Redis, MinIO, Celery workers, and MeiliSearch

## Frontend Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS + Radix UI
- TanStack Query for data fetching
- Zustand for selected client state
- `react-pdf`, `docx-preview`, and `@jvmr/pptx-to-html` for in-app preview

## Backend Stack

- FastAPI
- SQLModel / SQLAlchemy async
- PostgreSQL
- Redis
- Celery
- MinIO object storage
- MeiliSearch

## Identity And Trust Architecture

### Public Entry

- one shared login page for all users
- one public self-registration flow for students
- one teacher verification request flow for educators

### Role Model

- `STUDENT`
  self-registers, verifies OTP, can contribute and study
- `TEACHER`
  enters through admin invite or verification request
- `ADMIN`
  manages operational and moderation actions in platform surfaces
- `SUPERADMIN`
  platform-level governance role

### Account Status Model

- `ACTIVE`
- `PENDING_VERIFICATION`
- `SUSPENDED`

### Trust Rules

- public registration accepts student creation only
- teacher access is created through `POST /api/v1/auth/teacher-request`
- admin approval activates teacher accounts
- role checks use RBAC
- file/course visibility adds ABAC-style constraints based on owner and review
  state

## Content Lifecycle

### Course Uploads

1. Teacher or admin uploads a course file.
2. File is validated, hashed, and stored in MinIO.
3. A `Contribution` and `DocumentVersion` are recorded.
4. OCR / downstream processing is queued.
5. Approved content becomes visible to learners and indexing systems.

### Student Contributions

1. Student submits a contribution against a course.
2. File enters moderation as `PENDING`.
3. Admin or teacher reviews the file.
4. Approval restores visibility and indexes the content.
5. Rejection soft-deletes document versions from public discovery paths.

## File Visibility Model

The backend file proxy is the enforcement layer:

- admins and superadmins can preview moderated and pending files
- uploaders can preview their own files, including pending items
- regular learners can only access approved course/contribution files

This rule is enforced in:

- `backend/app/routers/files.py`
- `backend/app/routers/courses.py`
- `backend/app/routers/contributions.py`

## Preview Architecture

### Why A Same-Origin Proxy Exists

The browser should not fetch file previews directly from the backend origin in
development. To avoid CORS issues and browser extension interference, the
frontend proxies preview traffic through:

- `frontend/src/app/api/files/proxy/[...path]/route.ts`

That route forwards authenticated preview requests to:

- `GET /api/v1/files/proxy/{path:path}`

### Preview Rendering Path

1. UI opens a preview modal.
2. `FilePreview` requests the file through the frontend proxy.
3. The proxy forwards auth to the backend file endpoint.
4. Backend validates access against role and contribution visibility.
5. Frontend renders the file based on MIME type.

### Current Inline Preview Matrix

- `PDF`
  inline via `react-pdf` using in-memory bytes
- `PNG`, `JPG`, `JPEG`
  inline image preview
- `DOCX`
  inline HTML rendering via `docx-preview`
- `PPTX`
  inline slide rendering via `@jvmr/pptx-to-html`
- `DOC`, `PPT`
  open/download fallback plus extracted text preview when available

## Frontend Layers

- `src/app/`
  route composition and page shells
- `src/components/`
  shared UI and feature components
- `src/components/ui/file-preview.tsx`
  shared preview system used by student, teacher, and admin surfaces
- `src/lib/api.ts`
  typed client boundary
- `src/types/api.types.ts`
  frontend-facing contracts
- `src/queries/`
  query and mutation wrappers

## Backend Layers

- `app/routers/`
  API entry points
- `app/services/`
  business logic and document-processing orchestration
- `app/models/`
  persistence models
- `app/core/`
  config, auth, and shared infrastructure
- `app/db/`
  session and engine setup

## Real-Time Surfaces

ATLAS currently includes websocket support for:

- notifications
- forums
- collaboration/live session flows

## Known Constraints

- legacy `.doc` and `.ppt` files are not visually rendered inline yet
- some deleted frontend route files still leave stale `.next` validator noise in
  local TypeScript checks
- admin scoping is improved but not yet a fully isolated tenant control plane

## Recommended Next Evolution

- add server-side conversion for legacy Office files
- expand admin tenancy boundaries from coarse RBAC to stronger org-level ABAC
- add automated end-to-end tests for preview and moderation workflows
