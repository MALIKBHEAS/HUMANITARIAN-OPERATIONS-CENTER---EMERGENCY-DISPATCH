"""
EOA Autonomous AI Vision Worker Service (Phase 3 C4ISR)
FastAPI application serving real-time tactical MJPEG video streams and AI telemetry.
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Response, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from vision_engine import VisionEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("eoa.ai_worker.api")

# Initialize global Vision Engine singleton
engine = VisionEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager guaranteeing engine start and clean resource teardown."""
    logger.info("Initializing C4ISR Autonomous AI Vision Worker service...")
    engine.start()
    yield
    logger.info("Shutting down AI Vision Worker service and releasing video capture devices...")
    engine.stop()


app = FastAPI(
    title="EOA Autonomous AI Vision Worker",
    version="1.0.0",
    description="C4ISR Autonomous YOLOv8 Vision Analytics, Tactical HUD, and Automated Incident Dispatch",
    lifespan=lifespan,
)

# Whitelist CORS for Dashboard, Edge App, and API Gateway
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:49152",
        "http://127.0.0.1:49152",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:9443",
        "http://127.0.0.1:9443",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Health status endpoint."""
    telemetry = engine.get_telemetry_status()
    return {
        "status": telemetry.get("status", "UNKNOWN"),
        "service": "EOA Autonomous AI Vision Worker",
        "fps": telemetry.get("fps", 0),
        "total_dispatches": telemetry.get("total_dispatches", 0),
    }


@app.get("/stream/cctv-1")
def stream_cctv_1():
    """
    Tactical MJPEG stream for Sector 4 CCTV surveillance camera.
    Returns multipart/x-mixed-replace JPEG boundary stream.
    """
    return StreamingResponse(
        engine.generate_mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "close",
        },
    )


@app.get("/api/vision/status")
def get_vision_status():
    """Returns real-time AI telemetry, YOLO detections, and dispatch metrics."""
    return engine.get_telemetry_status()


class ManualTriggerRequest(BaseModel):
    target_class: Optional[str] = "car"
    confidence: Optional[float] = 0.95
    reason: Optional[str] = "Manual operator drill or test verification"


@app.post("/api/vision/trigger")
def trigger_manual_dispatch(req: ManualTriggerRequest):
    """
    Manually triggers an automated dispatch sequence for testing and calibration.
    """
    mock_target = [{"class": req.target_class, "confidence": req.confidence}]
    engine._trigger_automated_dispatch(mock_target)
    return {
        "status": "DISPATCH_INITIATED",
        "target": req.target_class,
        "telemetry": engine.get_telemetry_status(),
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")
