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

# 2. CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Include Routers
app.include_router(webhook_router)

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
@app.websocket("/ws/live-feed")
async def websocket_live_feed(websocket: WebSocket):
    """
    WebSocket endpoint connecting global frontend control centers
    for live real-time push of AI dispatch events.
    """
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.warning(f"WebSocket client terminated: {exc}")
        ws_manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
