#!/bin/bash
# =====================================================================
# EOA Global (Emergency Orchestrator Agent) - Docker Launch System (Linux/macOS)
# =====================================================================

set -e

echo "====================================================================="
echo " EOA Global - Docker Orchestration Deployment"
echo "====================================================================="

if ! docker info > /dev/null 2>&1; then
    echo "[ERROR] Docker is not running! Please start the Docker daemon."
    exit 1
fi

echo "[1/2] Building and launching all services..."
echo "      - PostGIS 16-3.4 (Geospatial Database)"
echo "      - Redis 7 Alpine (Event Broker & Message Stream)"
echo "      - FastAPI Backend (Multi-Tenancy, PostGIS, JWT, LangChain AI)"
echo "      - React 18 + Vite Frontend (Nginx Production Reverse Proxy)"

docker compose up --build -d

echo ""
echo "[2/2] Deployment Complete!"
echo "====================================================================="
echo " * Frontend Operations Dashboard: http://localhost:3000"
echo " * Backend OpenAPI / Swagger UI:  http://localhost:8000/api/v1/docs"
echo " * System Health Status:          http://localhost:8000/health"
echo "====================================================================="
echo ""
echo "Live logs:  docker compose logs -f"
echo "Shutdown:   docker compose down"
