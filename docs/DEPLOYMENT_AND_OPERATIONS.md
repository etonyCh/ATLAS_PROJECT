# Deployment and Operations

## Frontend

### Technology

- Next.js
- Node.js runtime

### Typical Commands

```bash
npm install
npm run dev
npm run build
npm run start
```

## Backend

### Technology

- FastAPI
- Python 3.11+
- Celery
- Redis

### Typical Local Startup

```bash
docker-compose up -d
cd backend
py -3.12 -m venv env
call env\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Celery Worker

```bash
call env\Scripts\activate
python run_celery.py -A app.core.celery_app worker --loglevel=info
```

## Expected Supporting Services

- database
- redis
- object storage
- email provider
- AI service dependencies

## Recommended Environment Categories

- local
- development
- staging
- production

## Operational Recommendations

- monitor backend response times
- monitor Celery task failures
- monitor websocket connection stability
- monitor object storage availability
- monitor auth failure and refresh failure rates

## Deployment Risks

- AI dependencies can be heavy and operationally sensitive
- background job failure handling should be monitored carefully
- contract drift between frontend and backend should be guarded with tests
