import logging
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import init_db
from ws_manager import ws_manager
from routers.incidents import router as incidents_router
from routers.resources import router as resources_router

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes tables on startup and handles clean shutdown."""
    logger.info("Initializing database schemas...")
    init_db()
    logger.info("Database initialized successfully.")
    yield
    logger.info("Application shutting down...")

# 1. Initialize FastAPI Application
app = FastAPI(
    title="EOA Backend",
    description="Emergency Orchestrator Agent (EOA) Autonomous Backend & Real-Time Dispatch System",
    version="2.0.0",
    lifespan=lifespan
)

# 2. Configure CORS Middleware (Explicitly whitelists 49152, 9443, 8000, 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:49152",
        "http://127.0.0.1:49152",
        "http://localhost:9443",
        "http://127.0.0.1:9443",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:80",
        "http://127.0.0.1:80",
        "http://localhost",
        "http://127.0.0.1",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# 3. Include Routers strictly with prefix="/api"
# Matches both /api/webhook/incident and /api/resources/all seamlessly
app.include_router(incidents_router, prefix="/api", tags=["Incidents & Webhooks"])
app.include_router(incidents_router, tags=["Incidents Webhooks Fallback"])
app.include_router(resources_router, prefix="/api", tags=["Emergency Resources"])
app.include_router(resources_router, prefix="/api/resources", tags=["Emergency Resources Fallback"])
app.include_router(resources_router, tags=["Emergency Resources Root Fallback"])

# 4. Root Health Check Endpoint
@app.get("/", tags=["Health"])
def health_check():
    return {
        "system": "Emergency Orchestrator Agent (EOA)",
        "status": "OPERATIONAL",
        "version": "2.0.0",
        "docs": "/docs",
        "ws_feed": "/ws/live-feed"
    }

# 5. Core WebSocket Stream Handler
async def _handle_websocket_stream(
    websocket: WebSocket,
    tenant_id: str = "default",
    token: Optional[str] = None
):
    """
    Core WebSocket handler ensuring handshake acceptance and live telemetry streaming.
    Guarantees 'await websocket.accept()' is executed first to prevent 403 Forbidden.
    """
    # 1. Guarantee WebSocket Handshake Acceptance
    await websocket.accept()
    await ws_manager.connect(websocket)
    logger.info(f"[WebSocket] Tunnel established for tenant '{tenant_id}'. Token provided: {bool(token)}")

    # 2. Send initial connection telemetry packet
    try:
        await websocket.send_json({
            "type": "EOA_SOCKET_INITIALIZED",
            "tenant_id": tenant_id or "default",
            "status": "ONLINE",
            "authenticated": bool(token),
            "message": "Connected to EOA C4ISR Live Telemetry Stream",
        })
    except Exception as exc:
        logger.warning(f"[WebSocket] Initial handshake packet warning: {exc}")

    # 3. Interactive heartbeat & event streaming loop
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            elif '"type":"PING"' in data or '"type": "PING"' in data:
                await websocket.send_json({"type": "HEARTBEAT_ACK", "status": "ALIVE"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
        logger.info(f"[WebSocket] Client safely disconnected from tenant '{tenant_id}'.")
    except Exception as exc:
        logger.warning(f"[WebSocket] Client connection error: {exc}")
        ws_manager.disconnect(websocket)

# Standard root WebSocket endpoint (/ws/live-feed)
@app.websocket("/ws/live-feed")
async def websocket_live_feed(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    await _handle_websocket_stream(websocket, tenant_id="default", token=token)

# Multi-tenant WebSocket endpoint (/ws/live-feed/{tenant_id})
@app.websocket("/ws/live-feed/{tenant_id}")
async def websocket_live_feed_tenant(
    websocket: WebSocket,
    tenant_id: str,
    token: Optional[str] = Query(None),
):
    await _handle_websocket_stream(websocket, tenant_id=tenant_id, token=token)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
