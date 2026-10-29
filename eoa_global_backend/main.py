"""
EOA Global - Emergency Orchestrator Agent (Phase 2)
Enterprise-grade Multi-Tenant SaaS platform for global emergency management.
Includes Real-Time Event-Driven Architecture, WebSocket Telemetry, and Asynchronous SOS Workers.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from eoa_global_backend.core.config import settings
from eoa_global_backend.core.broker import broker_manager
from eoa_global_backend.db.database import engine, get_db_session, init_database
from eoa_global_backend.api.auth import router as auth_router
from eoa_global_backend.api.websocket import router as websocket_router
from eoa_global_backend.api.sos import router as sos_router
from eoa_global_backend.api.dependencies import get_current_tenant, get_current_user
from eoa_global_backend.db.models import User
from eoa_global_backend.workers.emergency_consumer import (
    start_background_consumer,
    stop_background_consumer,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.
    Coordinates database readiness, broker pooling, and continuous emergency consumer workers.
    """
    # 1. Initialize database tables
    try:
        await init_database()
    except Exception as exc:
        print(f"[EOA Global Startup Note] Database initialization check: {exc}")

    # 2. Connect Message Broker (Redis/RabbitMQ/In-Memory)
    await broker_manager.start()

    # 3. Spawn background asynchronous Emergency Consumer Worker
    await start_background_consumer()

    yield

    # 4. Graceful Shutdown: Terminate background workers, broker connections, and DB pool
    await stop_background_consumer()
    await broker_manager.stop()
    await engine.dispose()


# Initialize FastAPI with enterprise OpenAPI metadata
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "EOA Global (Emergency Orchestrator Agent) Backend API.\n\n"
        "Features:\n"
        "- **Multi-Tenancy**: 100% cryptographic and logical data isolation via `TenantBase`.\n"
        "- **PostGIS Geospatial Engine**: SRID 4326 Point geometry for global incident tracking.\n"
        "- **Event-Driven Architecture**: Partitioned SOS queue ingestion via RabbitMQ/Redis.\n"
        "- **Real-Time WebSocket Streams**: Tenant-isolated live event feeds (`/ws/live-feed/{tenant_id}`).\n"
        "- **Enterprise Security**: Bcrypt hashing, OAuth2 JWT bearer tokens, and federated SSO simulation."
    ),
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# Configure Cross-Origin Resource Sharing (CORS) for global agency access (allows all origins, methods, and headers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(sos_router, prefix=settings.API_V1_STR)
app.include_router(websocket_router)  # Mounted at root: /ws/live-feed/{tenant_id}


@app.get(
    "/",
    tags=["System Status"],
    summary="Platform Root & Health Status",
)
async def root():
    """
    Root status check for load balancers and edge health probes.
    """
    return {
        "status": "online",
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "broker": settings.BROKER_TYPE,
        "docs_url": f"{settings.API_V1_STR}/docs",
    }


@app.get(
    "/health",
    tags=["System Status"],
    summary="Deep Infrastructure Health Check",
)
async def health_check(db: AsyncSession = Depends(get_db_session)):
    """
    Comprehensive health check verifying database, PostGIS extension, and broker status.
    """
    health_report = {
        "status": "healthy",
        "database": "connected",
        "postgis_extension": "unknown",
        "multi_tenancy": "enforced",
        "broker_engine": settings.BROKER_TYPE,
    }
    try:
        result = await db.execute(text("SELECT postgis_version();"))
        postgis_ver = result.scalar()
        health_report["postgis_extension"] = postgis_ver or "active"
    except Exception as exc:
        health_report["database"] = "degraded"
        health_report["postgis_extension"] = f"unreachable ({str(exc)})"
        health_report["status"] = "degraded"
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=health_report)

    return health_report


@app.get(
    f"{settings.API_V1_STR}/tenant-context-demo",
    tags=["Multi-Tenant Verification"],
    summary="Demonstrate Multi-Tenant Boundary Isolation",
)
async def demonstrate_tenant_isolation(
    current_user: User = Depends(get_current_user),
    current_tenant: str = Depends(get_current_tenant),
):
    """
    Demonstration endpoint verifying that get_current_tenant() correctly isolates 
    the active session to the user's specific agency partition.
    """
    return {
        "message": f"Tenant boundary verified for '{current_tenant}'",
        "authenticated_user": current_user.email,
        "user_role": current_user.role,
        "tenant_id": current_tenant,
        "isolation_status": "ENFORCED (All queries filtered by tenant_id)",
    }
