# Complete Data Reset Script for ATLAS Project
# This will delete ALL data and start fresh

Write-Host "=== ATLAS Complete Data Reset ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop all running containers
Write-Host "Step 1: Stopping all containers..." -ForegroundColor Yellow
docker compose down
Write-Host "Containers stopped." -ForegroundColor Green
Write-Host ""

# Step 2: Delete all Docker volumes (this removes all data)
Write-Host "Step 2: Deleting all data volumes..." -ForegroundColor Yellow
Write-Host "This will delete:" -ForegroundColor Red
Write-Host "  - PostgreSQL database (all tables, users, courses)" -ForegroundColor Red
Write-Host "  - MinIO storage (all uploaded files)" -ForegroundColor Red
Write-Host "  - Redis cache" -ForegroundColor Red
Write-Host "  - Meilisearch index" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Are you sure? Type 'yes' to continue"
if ($confirm -ne "yes") {
    Write-Host "Aborted." -ForegroundColor Red
    exit 1
}

# Remove volumes
$volumes = docker volume ls --format "{{.Name}}" | Select-String "atlas"
foreach ($vol in $volumes) {
    docker volume rm $vol
}
Write-Host "Volumes deleted." -ForegroundColor Green
Write-Host ""

# Step 3: Start fresh infrastructure
Write-Host "Step 3: Starting fresh infrastructure..." -ForegroundColor Yellow
docker compose up -d db redis minio meilisearch
Write-Host "Infrastructure starting..." -ForegroundColor Green
Write-Host ""

# Step 4: Wait for services to be healthy
Write-Host "Step 4: Waiting for services to be ready..." -ForegroundColor Yellow
Write-Host "This may take 30-60 seconds..." -ForegroundColor Gray

# Wait for PostgreSQL
$pgReady = $false
$attempts = 0
while (-not $pgReady -and $attempts -lt 30) {
    Start-Sleep -Seconds 2
    $attempts++
    try {
        $result = docker exec atlas-project-db-1 pg_isready -U atlas_user -d atlas_db 2>&1
        if ($result -match "accepting connections") {
            $pgReady = $true
            Write-Host "PostgreSQL is ready!" -ForegroundColor Green
        }
    } catch {
        Write-Host "Waiting for PostgreSQL... ($attempts/30)" -ForegroundColor Gray
    }
}

if (-not $pgReady) {
    Write-Host "PostgreSQL failed to start. Check docker logs." -ForegroundColor Red
    exit 1
}

# Wait a bit more for other services
Start-Sleep -Seconds 5
Write-Host "Services are ready!" -ForegroundColor Green
Write-Host ""

# Step 5: Run database migrations
Write-Host "Step 5: Running database migrations..." -ForegroundColor Yellow
cd backend

# Check if virtual environment exists, create if not
if (-not (Test-Path "env\Scripts\activate")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Gray
    py -3.12 -m venv env
}

# Activate and install dependencies
& env\Scripts\activate
pip install -r requirements.txt -q

# Run migrations
alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migrations failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Migrations complete!" -ForegroundColor Green
Write-Host ""

# Step 6: Seed fresh test data
Write-Host "Step 6: Seeding fresh test data..." -ForegroundColor Yellow

# Check if running in Docker mode or local mode
$dockerApiRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
        $dockerApiRunning = $true
    }
} catch {
    $dockerApiRunning = $false
}

if ($dockerApiRunning) {
    Write-Host "Docker API detected. Seeding via Docker..." -ForegroundColor Gray
    docker compose exec -T api python seed_fresh_test_state.py
} else {
    python seed_fresh_test_state.py
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Seeding failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Fresh data seeded!" -ForegroundColor Green
Write-Host ""

# Step 7: Clear MinIO and recreate bucket
Write-Host "Step 7: Setting up MinIO storage..." -ForegroundColor Yellow

# Wait for MinIO to be ready
$minioReady = $false
$attempts = 0
while (-not $minioReady -and $attempts -lt 20) {
    Start-Sleep -Seconds 2
    $attempts++
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:9000/minio/health/live" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $minioReady = $true
            Write-Host "MinIO is ready!" -ForegroundColor Green
        }
    } catch {
        Write-Host "Waiting for MinIO... ($attempts/20)" -ForegroundColor Gray
    }
}

# Create bucket using MinIO Client (mc) if available, or AWS CLI
$bucketName = "atlas-documents"
Write-Host "Creating MinIO bucket '$bucketName'..." -ForegroundColor Gray

try {
    # Try using AWS CLI with MinIO endpoint
    $env:AWS_ACCESS_KEY_ID = "minio_admin"
    $env:AWS_SECRET_ACCESS_KEY = "minio_password"
    
    aws --endpoint-url http://localhost:9000 s3 mb s3://$bucketName 2>$null
    aws --endpoint-url http://localhost:9000 s3api put-bucket-policy --bucket $bucketName --policy "{`"Version`":`"2012-10-17`",`"Statement`":[{`"Effect`":`"Allow`",`"Principal`":`"*`",`"Action`":`"s3:GetObject`",`"Resource`":`"arn:aws:s3:::$bucketName/*`"}]}" 2>$null
    
    Write-Host "MinIO bucket '$bucketName' created!" -ForegroundColor Green
} catch {
    Write-Host "Could not auto-create MinIO bucket. You may need to:" -ForegroundColor Yellow
    Write-Host "  1. Open http://localhost:9001 (minioadmin/minio_password)" -ForegroundColor Yellow
    Write-Host "  2. Create a bucket named '$bucketName'" -ForegroundColor Yellow
}

Write-Host ""

# Step 8: Summary
Write-Host "=== RESET COMPLETE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your system is now clean with fresh test data:" -ForegroundColor Green
    Write-Host "  - admin@atlas.tn / Admin123!" -ForegroundColor White
    Write-Host "  - superadmin@atlas.tn / SuperAdmin123!" -ForegroundColor White
    Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  Docker mode (recommended):" -ForegroundColor Cyan
Write-Host "    1. Start all services: docker compose up -d" -ForegroundColor White
Write-Host "    2. Verify deployment: .\verify_deployment.ps1" -ForegroundColor White
Write-Host "    3. Start the frontend: cd ../frontend && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  Local development mode:" -ForegroundColor Cyan
Write-Host "    1. Start the backend API: uvicorn app.main:app --reload --port 8000" -ForegroundColor White
Write-Host "    2. Start Celery: python run_celery.py -A app.core.celery_app worker --loglevel=info -P solo" -ForegroundColor White
Write-Host "    3. Start the frontend: cd ../frontend && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "MinIO Console: http://localhost:9001 (minioadmin/minio_password)" -ForegroundColor Cyan
