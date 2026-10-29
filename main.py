import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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

# 2. Configure CORS Middleware (Permissive for Vite / React Development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Include Routers
app.include_router(incidents_router, prefix="/api", tags=["Incidents & Webhooks"])
app.include_router(resources_router, prefix="/api/resources", tags=["Emergency Resources"])

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

# 5. WebSocket Endpoint for Real-Time Dispatch Broadcasting
@app.websocket("/ws/live-feed")
async def websocket_live_feed(websocket: WebSocket):
    """
    WebSocket endpoint connecting React / Vite dashboards to receive
    live autonomous dispatch updates as incidents are processed.
    """
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep socket alive and handle client-side ping/messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.warning(f"WebSocket client error: {exc}")
        ws_manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
