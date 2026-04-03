# Backend Run Guide

This guide reflects the current backend flow after the auth, moderation, and
preview-system updates.

## Start Infrastructure

From the project root:

```powershell
docker compose up -d db redis minio meilisearch
```

## Create And Activate The Backend Environment

```powershell
cd backend
py -3.12 -m venv env
env\Scripts\activate
pip install -r requirements.txt
```

## Run Migrations

```powershell
alembic upgrade head
```

## Start The API

```powershell
uvicorn app.main:app --reload --port 8000
```

## Start Celery

In another terminal:

```powershell
cd backend
env\Scripts\activate
python run_celery.py -A app.core.celery_app worker --loglevel=info -P solo
```

## Fresh Reset For End-To-End Testing

If you want a clean database with working demo accounts:

```powershell
cd backend
python seed_fresh_test_state.py
```

Seeded accounts:

- `admin@atlas.tn` / `Admin123!`
- `superadmin@atlas.tn` / `SuperAdmin123!`
- `student@atlas.tn` / `Student123!`
- `teacher@atlas.tn` / `Teacher123!`

## Promote Existing Users

If you create a user manually and want to elevate it:

### Promote To Admin

```powershell
python promote_admin.py your-email@example.com
```

### Promote To Superadmin

```powershell
python promote_superadmin.py your-email@example.com
```

### List Existing Admins

```powershell
python get_admins.py
```

## Current Auth And Moderation Notes

- public registration is student-only
- teachers enter through the teacher request verification flow
- teacher requests are reviewed by admins
- pending contributions can be previewed by moderators before approval
- learners cannot access unapproved files

## Preview And File Handling Notes

Backend accepts:

- `PDF`
- `DOC`
- `DOCX`
- `PPT`
- `PPTX`
- `PNG`
- `JPG`
- `JPEG`

Inline preview is enforced through the secured backend file proxy:

- `GET /api/v1/files/proxy/{path:path}`

The frontend calls that route through its same-origin proxy layer for safer
browser behavior.
