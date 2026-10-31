import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from ws_manager import ws_manager
from routers.webhook import router as webhook_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("eoa_backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle context manager: initializes database and PostGIS extensions."""
    logger.info("Initializing PostGIS extensions and database schemas...")
    init_db()
    logger.info("PostGIS spatial database initialized.")
    yield
    logger.info("Shutting down EOA backend...")

# 1. Initialize FastAPI Application
app = FastAPI(
    title="Global Emergency Orchestrator Agent (EOA) - PostGIS Edition",
    description="Autonomous GIS Emergency Orchestration Backend powered by PostGIS ST_DWithin and ReAct Agent workflows.",
    version="3.0.0",
    lifespan=lifespan
)

# 2. CORS Middleware (Allows all origins for MVP / whitelists 49152 & 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:49152",
        "http://127.0.0.1:49152",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:80",
        "http://127.0.0.1:80",
        "*",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Include Routers strictly with prefix="/api"
app.include_router(webhook_router, prefix="/api", tags=["Incidents & Webhook"])
app.include_router(webhook_router, tags=["Incidents & Webhook Direct Fallback"])

# 4. Root Health Check
@app.get("/", tags=["Health"])
def health_check():
    return {
        "system": "Global Emergency Orchestrator Agent (EOA)",
        "spatial_engine": "PostGIS (WGS 84 SRID=4326)",
        "status": "OPERATIONAL",
        "docs_url": "/docs",
        "websocket_url": "/ws/live-feed"
    }

# 5. Live WebSocket Feed for Operations Dashboard
async def _handle_backend_ws(websocket: WebSocket, tenant_id: str = "default"):
    # Always accept immediately to prevent 403 Forbidden rejection
    await websocket.accept()
    await ws_manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "EOA_SOCKET_INITIALIZED",
            "tenant_id": tenant_id,
            "status": "ONLINE",
            "message": "Connected to EOA Dispatch Feed"
        })
    except Exception:
        pass

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            elif '"type":"PING"' in data or '"type": "PING"' in data:
                await websocket.send_json({"type": "HEARTBEAT_ACK", "status": "ALIVE"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.warning(f"WebSocket client terminated: {exc}")
        ws_manager.disconnect(websocket)

@app.websocket("/ws/live-feed")
async def websocket_live_feed(websocket: WebSocket):
    await _handle_backend_ws(websocket, tenant_id="default")

@app.websocket("/ws/live-feed/{tenant_id}")
async def websocket_live_feed_tenant(websocket: WebSocket, tenant_id: str):
    await _handle_backend_ws(websocket, tenant_id=tenant_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
