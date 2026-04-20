#!/bin/bash
# Complete Data Reset Script for ATLAS Project (Linux)
# This will delete ALL data and start fresh

set -e

echo -e "\033[36m=== ATLAS Complete Data Reset ===\033[0m"
echo ""

# Step 1: Stop all running containers
echo -e "\033[33mStep 1: Stopping all containers...\033[0m"
docker compose down
echo -e "\033[32mContainers stopped.\033[0m"
echo ""

# Step 2: Delete all Docker volumes (this removes all data)
echo -e "\033[33mStep 2: Deleting all data volumes...\033[0m"
echo -e "\033[31mThis will delete:\033[0m"
echo -e "\033[31m  - PostgreSQL database (all tables, users, courses)\033[0m"
echo -e "\033[31m  - MinIO storage (all uploaded files)\033[0m"
echo -e "\033[31m  - Redis cache\033[0m"
echo -e "\033[31m  - Meilisearch index\033[0m"
echo -e "\033[31m  - Qdrant vector data\033[0m"
echo ""

read -p "Are you sure? Type 'yes' to continue: " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "\033[31mAborted.\033[0m"
    exit 1
fi

# Remove volumes
echo "Removing Docker volumes..."
docker volume ls --format "{{.Name}}" | grep "atlas" | xargs -r docker volume rm 2>/dev/null || true
echo -e "\033[32mVolumes deleted.\033[0m"
echo ""

# Step 3: Start fresh infrastructure
echo -e "\033[33mStep 3: Starting fresh infrastructure...\033[0m"
docker compose up -d db redis minio meilisearch qdrant
echo -e "\033[32mInfrastructure starting...\033[0m"
echo ""

# Step 4: Wait for services to be healthy
echo -e "\033[33mStep 4: Waiting for services to be ready...\033[0m"
echo -e "\033[90mThis may take 30-60 seconds...\033[0m"

# Wait for PostgreSQL
pg_ready=false
attempts=0
while [ "$pg_ready" = false ] && [ $attempts -lt 30 ]; do
    sleep 2
    attempts=$((attempts + 1))
    if docker exec atlas_project-db-1 pg_isready -U atlas_user -d atlas_db 2>/dev/null | grep -q "accepting connections"; then
        pg_ready=true
        echo -e "\033[32mPostgreSQL is ready!\033[0m"
    else
        echo -e "\033[90mWaiting for PostgreSQL... ($attempts/30)\033[0m"
    fi
done

if [ "$pg_ready" = false ]; then
    echo -e "\033[31mPostgreSQL failed to start. Check docker logs.\033[0m"
    exit 1
fi

# Wait for other services
sleep 5
echo -e "\033[32mServices are ready!\033[0m"
echo ""

# Step 5: Run database migrations
echo -e "\033[33mStep 5: Running database migrations...\033[0m"
cd backend

# Check if virtual environment exists, create if not
if [ ! -d "env/bin" ]; then
    echo -e "\033[90mCreating virtual environment...\033[0m"
    python3.12 -m venv env
fi

# Activate and install dependencies
source env/bin/activate
pip install -r requirements.txt -q

# Run migrations
alembic upgrade head
if [ $? -ne 0 ]; then
    echo -e "\033[31mMigrations failed!\033[0m"
    exit 1
fi
echo -e "\033[32mMigrations complete!\033[0m"
echo ""

# Step 6: Seed fresh test data
echo -e "\033[33mStep 6: Seeding fresh test data...\033[0m"
python seed_fresh_test_state.py
if [ $? -ne 0 ]; then
    echo -e "\033[31mSeeding failed!\033[0m"
    exit 1
fi
echo -e "\033[32mFresh data seeded!\033[0m"
echo ""

# Step 7: Clear Qdrant collections
echo -e "\033[33mStep 7: Resetting Qdrant collections...\033[0m"
curl -X DELETE http://localhost:6333/collections/documents 2>/dev/null || true
curl -X DELETE http://localhost:6333/collections/rag_documents 2>/dev/null || true
echo -e "\033[32mQdrant collections reset.\033[0m"
echo ""

# Step 8: Clear Meilisearch index
echo -e "\033[33mStep 8: Resetting Meilisearch index...\033[0m"
curl -X DELETE http://localhost:7700/indexes/documents 2>/dev/null || true
echo -e "\033[32mMeilisearch index reset.\033[0m"
echo ""

# Step 9: Summary
echo -e "\033[36m=== RESET COMPLETE ===\033[0m"
echo ""
echo -e "\033[32mYour system is now clean with fresh test data:\033[0m"
echo -e "\033[37m  - admin@atlas.tn / Admin123!\033[0m"
echo -e "\033[37m  - superadmin@atlas.tn / SuperAdmin123!\033[0m"
echo -e "\033[37m  - teacher@atlas.tn / Teacher123!\033[0m"
echo -e "\033[37m  - student@atlas.tn / Student123!\033[0m"
echo ""

echo -e "\033[33mNext steps:\033[0m"
echo -e "\033[36m  Local development mode:\033[0m"
echo -e "\033[37m    1. Start the backend API: uvicorn app.main:app --reload --port 8000\033[0m"
echo -e "\033[37m    2. Start Celery: python run_celery.py -A app.core.celery_app worker --loglevel=info\033[0m"
echo -e "\033[37m    3. Start the frontend: cd ../frontend && npm run dev\033[0m"
echo ""
echo -e "\033[36mMinIO Console: http://localhost:9001 (minioadmin/minio_password)\033[0m"
echo -e "\033[36mMeilisearch: http://localhost:7700\033[0m"
echo -e "\033[36mQdrant: http://localhost:6333/dashboard\033[0m"
