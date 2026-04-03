# ATLAS

ATLAS is a trust-aware ed-tech platform for higher education. It combines
course delivery, AI study tools, moderated contributions, and multi-role
governance in one shared workspace for students, teachers, admins, and
superadmins.

Repository:

- https://github.com/etonyCh/ATLAS_PROJECT

## Current Platform Highlights

- one shared login entry for every role
- student-only public registration with OTP verification
- teacher verification request plus admin approval workflow
- moderated contribution pipeline before learner visibility
- secure preview system shared by student, teacher, and admin surfaces
- AI study tools including chat, flashcards, quizzes, summaries, and mind maps

## File Preview Support

Inline preview currently works for:

- `PDF`
- `PNG`
- `JPG`
- `JPEG`
- `DOCX`
- `PPTX`

Legacy `DOC` and `PPT` files currently use open/download fallback with
extracted text preview when available.

## Architecture At A Glance

- `frontend/`
  Next.js application with role-based surfaces and same-origin preview proxy
- `backend/`
  FastAPI API with auth, moderation, file access control, and study services
- `docs/`
  product, architecture, API, and operations documentation
- infrastructure
  PostgreSQL, Redis, MinIO, Celery, and MeiliSearch

## Quick Start

### 1. Start Infrastructure

```powershell
docker compose up -d db redis minio meilisearch
```

### 2. Start The Backend

```powershell
cd backend
py -3.12 -m venv env
env\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 3. Start Celery

```powershell
cd backend
env\Scripts\activate
python run_celery.py -A app.core.celery_app worker --loglevel=info -P solo
```

### 4. Start The Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Fresh Test Seed

To reset and seed a clean testing state:

```powershell
cd backend
python seed_fresh_test_state.py
```

Common seeded accounts:

- `admin@atlas.tn` / `Admin123!`
- `superadmin@atlas.tn` / `SuperAdmin123!`
- `student@atlas.tn` / `Student123!`
- `teacher@atlas.tn` / `Teacher123!`

## Documentation Map

- [docs/README.md](docs/README.md)
- [docs/PRODUCT_OVERVIEW.md](docs/PRODUCT_OVERVIEW.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- [backend/README_RUN_BACKEND.md](backend/README_RUN_BACKEND.md)
