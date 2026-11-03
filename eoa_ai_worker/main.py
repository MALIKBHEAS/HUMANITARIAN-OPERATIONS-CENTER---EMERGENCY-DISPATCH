"""
EOA Autonomous AI Vision Worker Service (Phase 4 C4ISR: Hybrid Central CCTV + Edge UAV)
FastAPI application serving real-time tactical MJPEG video streams,
dynamic RTSP ingestion, and multi-stream AI telemetry.
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Response, HTTPException, Path
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from vision_engine import VisionEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("eoa.ai_worker.api")

# Initialize global Vision Engine singleton
engine = VisionEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager guaranteeing engine start and clean resource teardown."""
    logger.info("Initializing C4ISR Hybrid Vision Worker service...")
    engine.start()
    yield
    logger.info("Shutting down AI Vision Worker service and releasing all video capture streams...")
    engine.stop()


app = FastAPI(
    title="EOA Autonomous AI Vision Worker",
    version="1.1.0",
    description="C4ISR Autonomous YOLOv8 Vision Analytics, Multi-Stream RTSP Ingestion, and Automated Incident Dispatch",
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
        "service": "EOA Autonomous AI Vision Worker (Hybrid Central + Edge)",
        "active_streams_count": telemetry.get("active_streams_count", 0),
        "fps": telemetry.get("fps", 0),
        "total_dispatches": telemetry.get("total_dispatches", 0),
    }


@app.get("/stream/cctv-1")
def stream_cctv_1():
    """
    Primary Tactical MJPEG stream (Sector 4 CCTV / Default Camera).
    Returns multipart/x-mixed-replace JPEG boundary stream.
    """
    return StreamingResponse(
        engine.generate_mjpeg_stream("cctv-1"),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "close",
        },
    )


@app.get("/stream/{stream_id}")
def stream_by_id(stream_id: str = Path(..., description="Target camera or RTSP stream identifier")):
    """
    Dynamic Tactical MJPEG stream by stream ID.
    Returns multipart/x-mixed-replace JPEG boundary stream for any dynamic RTSP stream.
    """
    worker = engine.get_stream(stream_id)
    if not worker:
        raise HTTPException(status_code=404, detail=f"Stream '{stream_id}' not found.")

    return StreamingResponse(
        engine.generate_mjpeg_stream(stream_id),
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
    """Returns real-time AI telemetry, YOLO detections, and central stream status."""
    return engine.get_telemetry_status()


@app.get("/api/vision/streams")
def list_active_streams():
    """Returns telemetry and health status for all active CCTV & RTSP streams."""
    return {
        "count": len(engine._streams),
        "streams": engine.list_streams(),
    }


class AddStreamRequest(BaseModel):
    rtsp_url: str = Field(..., description="RTSP URL, HTTP stream URL, webcam index, or 'synthetic'")
    sector: str = Field(..., description="Tactical sector or street camera name")
    lat: Optional[float] = Field(31.5326, description="Sensor latitude")
    lon: Optional[float] = Field(35.0998, description="Sensor longitude")
    stream_id: Optional[str] = Field(None, description="Optional custom stream ID")


@app.post("/api/vision/add-stream")
def add_tactical_rtsp_stream(req: AddStreamRequest):
    """
    Dynamically ingests a live RTSP street camera into the AI tracking engine.
    Spawns an isolated background thread for capture and YOLO object detection.
    """
    try:
        worker = engine.add_stream(
            rtsp_url=req.rtsp_url,
            sector=req.sector,
            lat=req.lat,
            lon=req.lon,
            stream_id=req.stream_id,
        )

        stream_url = f"/stream/{worker.stream_id}"
        full_stream_url = f"http://localhost:8080{stream_url}"

        logger.info(f"Operator initialized tactical stream [{worker.stream_id}] for sector '{req.sector}'.")

        return {
            "status": "STREAM_INITIALIZED",
            "message": f"Tactical RTSP sensor initialized on sector '{req.sector}'.",
            "stream_id": worker.stream_id,
            "stream_name": worker.stream_name,
            "video_source": worker.video_source,
            "stream_url": stream_url,
            "full_stream_url": full_stream_url,
            "telemetry": worker.get_telemetry_status(),
        }
    except Exception as exc:
        logger.error(f"Failed to initialize RTSP stream: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize stream: {str(exc)}")


@app.delete("/api/vision/stream/{stream_id}")
def remove_stream(stream_id: str):
    """Gracefully terminates and releases resources for a dynamic stream."""
    if stream_id == "cctv-1":
        raise HTTPException(status_code=400, detail="Cannot terminate primary system stream 'cctv-1'.")

    removed = engine.remove_stream(stream_id)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Stream '{stream_id}' not found.")

    return {"status": "STREAM_TERMINATED", "stream_id": stream_id}


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
