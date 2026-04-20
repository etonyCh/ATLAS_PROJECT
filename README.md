

```markdown
# ATLAS

Trust-aware ed-tech platform combining course delivery, AI study tools, and multi-role governance for higher education.

**Repository:** https://github.com/etonyCh/ATLAS_PROJECT

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.12
- Node.js 18+

### 1. Infrastructure
```bash
# Linux/macOS
docker compose up -d db redis minio meilisearch

# Windows (PowerShell)
docker compose up -d db redis minio meilisearch
```

### 2. Backend
```bash
# Linux/macOS
cd backend
python3.12 -m venv env
source env/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Windows (PowerShell)
cd backend
py -3.12 -m venv env
env\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 3. Celery Worker
```bash
# Linux/macOS
source env/bin/activate
python run_celery.py -A app.core.celery_app worker --loglevel=info

# Windows (PowerShell)
env\Scripts\activate
python run_celery.py -A app.core.celery_app worker --loglevel=info -P solo
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Architecture

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js (role-based surfaces) |
| Backend | FastAPI (auth, moderation, AI services) |
| Database | PostgreSQL |
| Cache | Redis |
| Storage | MinIO |
| Search | MeiliSearch |
| Tasks | Celery |

**File Support:** PDF, PNG, JPG, JPEG, DOCX, PPTX (legacy DOC/PPT: download only)

---

## Test Accounts

Reset and seed fresh state:
```bash
cd backend
python seed_fresh_test_state.py
```

| Role | Email | Password |
|------|-------|----------|
| Superadmin | superadmin@atlas.tn | SuperAdmin123! |
| Admin | admin@atlas.tn | Admin123! |
| Teacher | teacher@atlas.tn | Teacher123! |
| Student | student@atlas.tn | Student123! |

---

## Documentation

- [Product Overview](docs/PRODUCT_OVERVIEW.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API_REFERENCE.md)
- [User Guide](docs/USER_GUIDE.md)

---

## Key Features

- Single login entry for all roles (student registration with OTP, teacher verification workflow)
- Moderated content pipeline (contributions reviewed before student visibility)
- Secure file preview system (students, teachers, admins)
- AI study tools: chat, flashcards, quizzes, summaries, mind maps
```

This version keeps the essential architecture, setup steps for both platforms, test credentials, and feature highlights while removing redundancy. The `-P solo` flag for Windows Celery is included (required on Windows due to lack of fork support).