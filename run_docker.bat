@echo off
echo =====================================================================
echo  EOA Global (Emergency Orchestrator Agent) - Docker Launch System
echo =====================================================================
echo.
echo [1/3] Checking Docker daemon status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Desktop is not running! Please start Docker Desktop and retry.
    pause
    exit /b 1
)

echo [2/3] Building and starting all EOA Global containers in background...
echo        - PostGIS 16-3.4 (Geospatial Database)
echo        - Redis 7 Alpine (Event Broker & Message Stream)
echo        - FastAPI Backend (Multi-Tenancy, PostGIS, JWT, LangChain AI)
echo        - React 18 + Vite Frontend (Nginx Production Reverse Proxy)
echo.

docker compose up --build -d

echo.
echo [3/3] Deployment Successful!
echo =====================================================================
echo  * EOA Global Frontend Dashboard: http://localhost:3000
echo  * EOA Global Backend Swagger UI: http://localhost:8000/api/v1/docs
echo  * EOA Health Status Endpoint:    http://localhost:8000/health
echo =====================================================================
echo.
echo To view live logs:    docker compose logs -f
echo To stop containers:   docker compose down
echo.
pause
