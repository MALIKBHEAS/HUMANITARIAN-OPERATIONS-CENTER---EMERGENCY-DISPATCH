"""
EOA Autonomous AI Vision Engine (Phase 4 C4ISR: Hybrid Central CCTV + Edge UAV)
Real-time OpenCV video stream processing with YOLOv8 object detection,
dynamic multi-stream RTSP ingestion, thread-safe resource management,
tactical HUD overlays, and autonomous EOC incident dispatch.
"""

import os
import time
import math
import logging
import threading
import uuid
from typing import Optional, Dict, Any, Generator, Tuple, List
from datetime import datetime, timezone

import cv2
import numpy as np
import requests

logger = logging.getLogger("eoa.vision_engine")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


class VisionStreamWorker:
    """
    Dedicated worker thread for an individual video stream (RTSP, webcam, or synthetic).
    Implements strict deadlock prevention, watchdog reconnection, and autonomous dispatch.
    """

    def __init__(
        self,
        stream_id: str,
        stream_name: str,
        video_source: str,
        location_lat: float = 31.5326,
        location_lon: float = 35.0998,
        conf_threshold: float = 0.45,
        consecutive_trigger: int = 5,
        cooldown_seconds: int = 30,
        backend_webhook_url: Optional[str] = None,
        shared_model: Any = None,
        inference_lock: Optional[threading.Lock] = None,
    ):
        self.stream_id = stream_id
        self.stream_name = stream_name
        self.video_source = video_source
        self.location_lat = location_lat
        self.location_lon = location_lon
        self.conf_threshold = conf_threshold
        self.consecutive_trigger = consecutive_trigger
        self.cooldown_seconds = cooldown_seconds
        self.backend_webhook_url = backend_webhook_url or os.getenv(
            "BACKEND_WEBHOOK_URL", "http://backend:8000/api/webhook/incident"
        )
        self._model = shared_model
        self._inference_lock = inference_lock or threading.Lock()

        # Thread synchronization and resource locks
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._cap: Optional[cv2.VideoCapture] = None
        self._is_running: bool = False

        # State Telemetry
        self._latest_jpeg: Optional[bytes] = None
        self._current_fps: float = 0.0
        self._consecutive_target_frames: int = 0
        self._last_dispatch_time: float = 0.0
        self._last_dispatch_data: Optional[Dict[str, Any]] = None
        self._total_dispatches: int = 0
        self._latest_detections: list = []
        self._sim_frame_idx: int = 0
        self._connection_state: str = "INITIALIZING"
        self._last_frame_timestamp: float = time.time()

    def start(self):
        """Starts the capture and inference loop thread."""
        with self._lock:
            if self._is_running:
                logger.warning(f"Stream [{self.stream_id}] is already running.")
                return

            self._stop_event.clear()
            self._is_running = True
            self._thread = threading.Thread(
                target=self._worker_loop,
                daemon=True,
                name=f"EOA-Worker-{self.stream_id}",
            )
            self._thread.start()
            logger.info(f"StreamWorker [{self.stream_id}] started for source '{self.video_source}'.")

    def stop(self):
        """
        Strict resource release mechanism.
        Prevents thread deadlocks, zombie threads, and RTSP socket leaks.
        """
        logger.info(f"Stopping StreamWorker [{self.stream_id}]...")
        self._stop_event.set()

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.5)
            self._thread = None

        with self._lock:
            if self._cap is not None:
                try:
                    self._cap.release()
                    logger.info(f"OpenCV VideoCapture released for [{self.stream_id}].")
                except Exception as exc:
                    logger.warning(f"Error releasing VideoCapture [{self.stream_id}]: {exc}")
                finally:
                    self._cap = None

            self._is_running = False
            self._connection_state = "TERMINATED"

        logger.info(f"StreamWorker [{self.stream_id}] shutdown complete.")

    def _open_capture(self) -> bool:
        """Thread-safe acquisition of OpenCV VideoCapture with RTSP timeout safeguards."""
        with self._lock:
            if self._cap is not None:
                try:
                    self._cap.release()
                except Exception:
                    pass
                self._cap = None

            src = self.video_source.strip()
            # If numeric, convert to int index (e.g. "0")
            target_source: Any = int(src) if src.isdigit() else src

            try:
                # Set FFMPEG timeout env var for RTSP TCP sockets
                os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "timeout;4000000|rtsp_transport;tcp"
                logger.info(f"Connecting VideoCapture for [{self.stream_id}] -> {target_source}")
                self._cap = cv2.VideoCapture(target_source, cv2.CAP_FFMPEG)

                # Set timeout properties if supported
                try:
                    self._cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 4000)
                    self._cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 4000)
                except Exception:
                    pass

                if self._cap.isOpened():
                    self._connection_state = "CONNECTED"
                    logger.info(f"Stream [{self.stream_id}] successfully opened.")
                    return True
                else:
                    self._connection_state = "RECONNECTING"
                    logger.warning(f"Stream [{self.stream_id}] failed to open. Reconnecting...")
                    self._cap = None
                    return False
            except Exception as exc:
                self._connection_state = "ERROR"
                logger.error(f"Stream [{self.stream_id}] connection exception: {exc}")
                self._cap = None
                return False

    def _worker_loop(self):
        """Continuous grab, inference, overlay, and autonomous dispatch loop."""
        fps_counter = 0
        fps_timer = time.time()
        is_synthetic = self.video_source.lower() == "synthetic"

        if not is_synthetic:
            self._open_capture()

        while not self._stop_event.is_set():
            loop_start = time.time()
            frame = None

            if is_synthetic:
                frame = self._generate_synthetic_frame()
                self._connection_state = "SYNTHETIC_ACTIVE"
            else:
                if self._cap is None or not self._cap.isOpened():
                    self._connection_state = "RECONNECTING"
                    time.sleep(1.0)
                    if not self._open_capture():
                        # Yield a tactical reconnection splash frame
                        frame = self._generate_reconnecting_frame()
                else:
                    try:
                        ret, raw_frame = self._cap.read()
                        if ret and raw_frame is not None:
                            frame = raw_frame
                            self._connection_state = "CONNECTED"
                            self._last_frame_timestamp = time.time()
                        else:
                            logger.warning(f"Stream [{self.stream_id}] read failure. Re-establishing...")
                            self._connection_state = "SIGNAL_LOST"
                            self._cap.release()
                            self._cap = None
                            frame = self._generate_reconnecting_frame()
                            time.sleep(1.0)
                    except Exception as exc:
                        logger.error(f"Exception reading stream [{self.stream_id}]: {exc}")
                        frame = self._generate_reconnecting_frame()
                        time.sleep(1.0)

            if frame is None:
                time.sleep(0.03)
                continue

            # Run YOLOv8 Object Detection and draw bounding boxes
            processed_frame, detected_targets = self._process_frame(frame)

            # Check and trigger autonomous incident dispatch
            self._evaluate_autonomous_dispatch(detected_targets)

            # Encode frame to JPEG for MJPEG streaming
            try:
                ret, jpeg_buf = cv2.imencode(".jpg", processed_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
                if ret:
                    with self._lock:
                        self._latest_jpeg = jpeg_buf.tobytes()
            except Exception as enc_err:
                logger.warning(f"JPEG encoding warning on [{self.stream_id}]: {enc_err}")

            # Calculate FPS
            fps_counter += 1
            if time.time() - fps_timer >= 1.0:
                self._current_fps = round(fps_counter / (time.time() - fps_timer), 1)
                fps_counter = 0
                fps_timer = time.time()

            # Target ~25-30 FPS to avoid saturating CPU
            elapsed = time.time() - loop_start
            sleep_time = max(0.005, 0.033 - elapsed)
            time.sleep(sleep_time)

    def _generate_synthetic_frame(self) -> np.ndarray:
        """Procedural Tactical C4ISR Surveillance Simulator."""
        self._sim_frame_idx += 1
        width, height = 720, 480
        frame = np.zeros((height, width, 3), dtype=np.uint8)

        # Dark urban tarmac background & road markings
        frame[:] = (16, 20, 28)
        cv2.rectangle(frame, (80, 100), (640, 380), (28, 34, 46), -1)
        cv2.line(frame, (80, 240), (640, 240), (200, 200, 200), 2, cv2.LINE_AA)

        for x in range(100, 620, 40):
            cv2.line(frame, (x, 170), (x + 20, 170), (120, 140, 160), 1)
            cv2.line(frame, (x, 310), (x + 20, 310), (120, 140, 160), 1)

        for y in range(120, 360, 25):
            cv2.rectangle(frame, (120, y), (145, y + 14), (80, 90, 110), -1)

        t = self._sim_frame_idx * 0.04
        car_x = int(160 + (math.sin(t) * 0.5 + 0.5) * 360)
        car_y = 195

        cv2.rectangle(frame, (car_x, car_y), (car_x + 90, car_y + 44), (40, 70, 180), -1)
        cv2.rectangle(frame, (car_x + 18, car_y + 6), (car_x + 65, car_y + 38), (20, 35, 80), -1)
        cv2.circle(frame, (car_x + 92, car_y + 10), 5, (100, 240, 255), -1)
        cv2.circle(frame, (car_x + 92, car_y + 34), 5, (100, 240, 255), -1)

        ped_x = int(130 + math.cos(t * 0.8) * 15)
        ped_y = int(220 + math.sin(t * 1.2) * 50)
        cv2.circle(frame, (ped_x, ped_y - 14), 6, (200, 180, 150), -1)
        cv2.rectangle(frame, (ped_x - 5, ped_y - 8), (ped_x + 5, ped_y + 16), (180, 60, 40), -1)
        cv2.line(frame, (ped_x - 3, ped_y + 16), (ped_x - 6, ped_y + 30), (100, 100, 100), 2)
        cv2.line(frame, (ped_x + 3, ped_y + 16), (ped_x + 6, ped_y + 30), (100, 100, 100), 2)

        for scan_y in range(0, height, 4):
            cv2.line(frame, (0, scan_y), (width, scan_y), (0, 0, 0), 1)

        return frame

    def _generate_reconnecting_frame(self) -> np.ndarray:
        """Generates tactical splash frame when an RTSP stream is connecting/reconnecting."""
        width, height = 720, 480
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:] = (12, 16, 24)

        # Tactical Grid
        for x in range(0, width, 40):
            cv2.line(frame, (x, 0), (x, height), (22, 28, 38), 1)
        for y in range(0, height, 40):
            cv2.line(frame, (0, y), (width, y), (22, 28, 38), 1)

        # Warning Banner
        cx, cy = width // 2, height // 2
        title = f"[ RTSP SENSOR LINK ACQUIRING: {self.stream_id} ]"
        sub = f"TARGET GATEWAY: {self.video_source[:45]}"
        stat = f"STATUS: {self._connection_state} // WATCHDOG RETRYING..."

        cv2.rectangle(frame, (cx - 240, cy - 50), (cx + 240, cy + 50), (18, 24, 34), -1)
        cv2.rectangle(frame, (cx - 240, cy - 50), (cx + 240, cy + 50), (0, 165, 255), 1)

        cv2.putText(frame, title, (cx - 210, cy - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (0, 220, 255), 1, cv2.LINE_AA)
        cv2.putText(frame, sub, (cx - 210, cy + 8), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (160, 175, 195), 1, cv2.LINE_AA)
        cv2.putText(frame, stat, (cx - 210, cy + 32), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 200, 255), 1, cv2.LINE_AA)

        return frame

    def _process_frame(self, frame: np.ndarray) -> Tuple[np.ndarray, list]:
        """Runs YOLOv8 object detection with shared inference lock and tactical C4ISR overlays."""
        detected_targets = []
        height, width = frame.shape[:2]

        if self._model is not None:
            try:
                with self._inference_lock:
                    results = self._model.predict(
                        source=frame,
                        verbose=False,
                        conf=self.conf_threshold,
                        device="cpu",
                        imgsz=480,
                    )

                if results and len(results) > 0:
                    boxes = results[0].boxes
                    for box in boxes:
                        cls_id = int(box.cls[0].item())
                        class_name = self._model.names.get(cls_id, str(cls_id))
                        conf = float(box.conf[0].item())
                        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

                        detected_targets.append(
                            {
                                "class": class_name,
                                "confidence": round(conf, 3),
                                "bbox": [x1, y1, x2, y2],
                            }
                        )
                        self._draw_tactical_bbox(frame, (x1, y1, x2, y2), class_name, conf)
            except Exception as yolo_err:
                logger.debug(f"YOLO inference exception [{self.stream_id}]: {yolo_err}")

        # Procedural fallback for synthetic scenes if no targets returned
        if not detected_targets and self.video_source.lower() == "synthetic":
            t = self._sim_frame_idx * 0.04
            car_x = int(160 + (math.sin(t) * 0.5 + 0.5) * 360)
            car_y = 195
            synth_bbox = [car_x - 5, car_y - 5, car_x + 95, car_y + 50]
            detected_targets.append({"class": "car", "confidence": 0.94, "bbox": synth_bbox})
            self._draw_tactical_bbox(frame, synth_bbox, "car", 0.94)

        with self._lock:
            self._latest_detections = detected_targets

        self._render_tactical_hud(frame, detected_targets)
        return frame, detected_targets

    def _draw_tactical_bbox(self, frame: np.ndarray, bbox: Tuple[int, int, int, int], label: str, conf: float):
        """Draws high-contrast military corner-bracket target designators."""
        x1, y1, x2, y2 = bbox
        color = (0, 60, 255) if label in ["person", "car", "truck", "motorcycle", "bus"] else (0, 220, 255)
        corner_len = min(20, (x2 - x1) // 3, (y2 - y1) // 3)

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)
        cv2.line(frame, (x1, y1), (x1 + corner_len, y1), color, 3)
        cv2.line(frame, (x1, y1), (x1, y1 + corner_len), color, 3)
        cv2.line(frame, (x2, y1), (x2 - corner_len, y1), color, 3)
        cv2.line(frame, (x2, y1), (x2, y1 + corner_len), color, 3)
        cv2.line(frame, (x1, y2), (x1 + corner_len, y2), color, 3)
        cv2.line(frame, (x1, y2), (x1, y2 - corner_len), color, 3)
        cv2.line(frame, (x2, y2), (x2 - corner_len, y2), color, 3)
        cv2.line(frame, (x2, y2), (x2, y2 - corner_len), color, 3)

        tag = f"[TGT: {label.upper()} | {int(conf * 100)}%]"
        (w, h), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(frame, (x1, max(0, y1 - 20)), (x1 + w + 8, y1), (10, 14, 22), -1)
        cv2.rectangle(frame, (x1, max(0, y1 - 20)), (x1 + w + 8, y1), color, 1)
        cv2.putText(frame, tag, (x1 + 4, max(12, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

    def _render_tactical_hud(self, frame: np.ndarray, targets: list):
        """Renders military C4ISR telemetry overlay on the frame."""
        height, width = frame.shape[:2]
        utc_now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        # Top telemetry bar
        cv2.rectangle(frame, (0, 0), (width, 36), (8, 12, 18), -1)
        cv2.line(frame, (0, 36), (width, 36), (40, 50, 70), 1)

        header_text = (
            f"SENSOR: {self.stream_name} [{self.stream_id}] | "
            f"POS: {self.location_lat:.4f}N, {self.location_lon:.4f}E"
        )
        cv2.putText(frame, header_text, (10, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 220, 255), 1, cv2.LINE_AA)
        cv2.putText(frame, utc_now, (width - 210, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (180, 190, 205), 1, cv2.LINE_AA)

        # Bottom Sentinel Status Bar
        cv2.rectangle(frame, (0, height - 32), (width, height), (8, 12, 18), -1)
        cv2.line(frame, (0, height - 32), (width, height - 32), (40, 50, 70), 1)

        is_cooling_down = (time.time() - self._last_dispatch_time) < self.cooldown_seconds
        if is_cooling_down:
            cooldown_left = int(self.cooldown_seconds - (time.time() - self._last_dispatch_time))
            status_text = f"SENTINEL: DISPATCH TRANSMITTED // COOLDOWN ACTIVE ({cooldown_left}s)"
            status_color = (0, 200, 255)
        elif self._consecutive_target_frames > 0:
            status_text = (
                f"SENTINEL: TRACKING ANOMALY [{self._consecutive_target_frames}/{self.consecutive_trigger} FRAMES]"
            )
            status_color = (0, 160, 255)
        else:
            status_text = f"SENTINEL: ARMED // STATE: {self._connection_state}"
            status_color = (100, 220, 100)

        cv2.putText(frame, status_text, (10, height - 11), cv2.FONT_HERSHEY_SIMPLEX, 0.42, status_color, 1, cv2.LINE_AA)

        fps_text = f"YOLOv8 FPS: {self._current_fps} | TGTS: {len(targets)}"
        cv2.putText(frame, fps_text, (width - 210, height - 11), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (180, 190, 205), 1, cv2.LINE_AA)

        # Center Targeting Reticle
        cx, cy = width // 2, height // 2
        cv2.line(frame, (cx - 15, cy), (cx - 5, cy), (0, 220, 255), 1)
        cv2.line(frame, (cx + 5, cy), (cx + 15, cy), (0, 220, 255), 1)
        cv2.line(frame, (cx, cy - 15), (cx, cy - 5), (0, 220, 255), 1)
        cv2.line(frame, (cx, cy + 5), (cx, cy + 15), (0, 220, 255), 1)

    def _evaluate_autonomous_dispatch(self, detected_targets: list):
        """Evaluates consecutive frames and triggers automated dispatch."""
        priority_classes = ["car", "person", "truck", "motorcycle", "bus", "fire"]
        critical_targets = [t for t in detected_targets if t["class"] in priority_classes]

        if critical_targets:
            self._consecutive_target_frames += 1
        else:
            self._consecutive_target_frames = max(0, self._consecutive_target_frames - 1)

        now = time.time()
        time_since_last_dispatch = now - self._last_dispatch_time

        if (
            self._consecutive_target_frames >= self.consecutive_trigger
            and time_since_last_dispatch >= self.cooldown_seconds
        ):
            self._trigger_automated_dispatch(critical_targets)

    def _trigger_automated_dispatch(self, targets: list):
        """Executes autonomous HTTP POST incident payload to EOC Backend."""
        self._last_dispatch_time = time.time()
        self._consecutive_target_frames = 0
        self._total_dispatches += 1

        target_names = list(set([t["class"] for t in targets])) if targets else ["ANOMALY"]
        target_summary = ", ".join(target_names).upper()

        payload = {
            "type": "AI_VISION_ANOMALY",
            "incident_type": "AI_VISION_ANOMALY",
            "severity_level": 4,
            "severity": 4,
            "description": (
                f"AUTONOMOUS VISION ALERT: High-confidence detection [{target_summary}] "
                f"sustained across {self.consecutive_trigger} consecutive frames on {self.stream_name}."
            ),
            "lat": self.location_lat,
            "lon": self.location_lon,
            "latitude": self.location_lat,
            "longitude": self.location_lon,
            "stream_id": self.stream_id,
            "stream_name": self.stream_name,
            "required_beds": 2,
            "security_token": "ai_worker_vision_node_01",
        }

        threading.Thread(
            target=self._send_dispatch_request,
            args=(payload,),
            daemon=True,
            name=f"EOA-Dispatch-{self.stream_id}",
        ).start()

    def _send_dispatch_request(self, payload: dict):
        """Sends HTTP POST to EOC backend webhook with resilient fallback."""
        candidate_urls = [
            self.backend_webhook_url,
            "http://backend:8000/api/webhook/incident",
            "http://localhost:9443/api/webhook/incident",
            "http://127.0.0.1:9443/api/webhook/incident",
        ]
        unique_urls = list(dict.fromkeys(candidate_urls))

        for url in unique_urls:
            try:
                logger.info(f"Transmitting vision dispatch from [{self.stream_id}] to Gateway: {url}")
                res = requests.post(url, json=payload, timeout=4.0)
                if res.status_code in [200, 201, 202]:
                    resp_data = res.json()
                    logger.info(f"Dispatch CONFIRMED for [{self.stream_id}]: {resp_data.get('incident_id') or resp_data.get('id')}")
                    with self._lock:
                        self._last_dispatch_data = resp_data
                    return
                else:
                    logger.warning(f"Gateway status {res.status_code} for [{self.stream_id}] on {url}: {res.text}")
            except Exception as net_err:
                logger.debug(f"Candidate {url} blip: {net_err}")

        logger.error(f"Failed to transmit vision dispatch for [{self.stream_id}] across candidate gateways.")

    def generate_mjpeg_stream(self) -> Generator[bytes, None, None]:
        """Yields multipart/x-mixed-replace JPEG boundary stream."""
        while not self._stop_event.is_set():
            with self._lock:
                frame_bytes = self._latest_jpeg

            if frame_bytes is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                )

            time.sleep(0.033)

    def get_telemetry_status(self) -> Dict[str, Any]:
        """Returns JSON status snapshot."""
        with self._lock:
            return {
                "stream_id": self.stream_id,
                "stream_name": self.stream_name,
                "video_source": self.video_source,
                "status": "OPERATIONAL" if self._is_running else "STOPPED",
                "connection_state": self._connection_state,
                "fps": self._current_fps,
                "consecutive_target_frames": self._consecutive_target_frames,
                "consecutive_trigger_threshold": self.consecutive_trigger,
                "cooldown_seconds": self.cooldown_seconds,
                "is_cooling_down": (time.time() - self._last_dispatch_time) < self.cooldown_seconds,
                "total_dispatches": self._total_dispatches,
                "last_dispatch": self._last_dispatch_data,
                "active_detections": self._latest_detections,
                "coordinates": {
                    "lat": self.location_lat,
                    "lon": self.location_lon,
                },
            }


class VisionEngine:
    """
    Central Hybrid C4ISR Vision Analytics Engine.
    Coordinates the shared YOLOv8 model and manages dynamic multi-stream RTSP/camera threads.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._inference_lock = threading.Lock()
        self._streams: Dict[str, VisionStreamWorker] = {}
        self._model = None
        self._init_yolo_model()

        # Seed primary default surveillance stream (cctv-1)
        default_source = os.getenv("VIDEO_SOURCE", "synthetic")
        default_sector = os.getenv("CCTV_STREAM_NAME", "CCTV-SECTOR-04-NORTH")
        default_lat = float(os.getenv("CCTV_LOCATION_LAT", "31.5326"))
        default_lon = float(os.getenv("CCTV_LOCATION_LON", "35.0998"))

        self.add_stream(
            rtsp_url=default_source,
            sector=default_sector,
            lat=default_lat,
            lon=default_lon,
            stream_id="cctv-1",
        )

    def _init_yolo_model(self):
        """Initializes Ultralytics YOLOv8 nano model."""
        try:
            from ultralytics import YOLO

            logger.info("Initializing YOLOv8 object detection model (yolov8n.pt)...")
            self._model = YOLO("yolov8n.pt")
            logger.info("YOLOv8 model successfully loaded into Central Vision Engine.")
        except Exception as exc:
            logger.warning(f"Ultralytics YOLO load deferred or failed: {exc}. Using tactical synthetic detector.")
            self._model = None

    def add_stream(
        self,
        rtsp_url: str,
        sector: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        stream_id: Optional[str] = None,
    ) -> VisionStreamWorker:
        """
        Dynamically registers and spawns a new tracking thread for an RTSP/camera stream.
        """
        clean_url = rtsp_url.strip()
        clean_sector = sector.strip() or "Dynamic Tactical Sector"
        target_lat = float(lat) if lat is not None else 31.5326
        target_lon = float(lon) if lon is not None else 35.0998

        if not stream_id:
            # Generate deterministic short ID
            stream_id = f"cctv-rtsp-{uuid.uuid4().hex[:6]}"

        with self._lock:
            # If stream already exists, tear it down cleanly first
            if stream_id in self._streams:
                logger.info(f"Stream [{stream_id}] already active. Re-initializing...")
                self._streams[stream_id].stop()

            worker = VisionStreamWorker(
                stream_id=stream_id,
                stream_name=clean_sector,
                video_source=clean_url,
                location_lat=target_lat,
                location_lon=target_lon,
                shared_model=self._model,
                inference_lock=self._inference_lock,
            )
            self._streams[stream_id] = worker
            worker.start()
            logger.info(f"Dynamic RTSP stream [{stream_id}] online on sector '{clean_sector}'.")
            return worker

    def remove_stream(self, stream_id: str) -> bool:
        """Stops and unregisters a dynamic stream."""
        with self._lock:
            if stream_id not in self._streams:
                return False
            worker = self._streams.pop(stream_id)
            worker.stop()
            logger.info(f"Stream [{stream_id}] removed from active tracking pool.")
            return True

    def get_stream(self, stream_id: str) -> Optional[VisionStreamWorker]:
        """Retrieves active stream worker by ID with cctv-1 fallback."""
        with self._lock:
            return self._streams.get(stream_id) or self._streams.get("cctv-1")

    def list_streams(self) -> List[Dict[str, Any]]:
        """Returns telemetry summaries for all active dynamic streams."""
        with self._lock:
            return [worker.get_telemetry_status() for worker in self._streams.values()]

    def generate_mjpeg_stream(self, stream_id: str = "cctv-1") -> Generator[bytes, None, None]:
        """Routes MJPEG generator to the requested stream worker."""
        worker = self.get_stream(stream_id)
        if worker is not None:
            yield from worker.generate_mjpeg_stream()
        else:
            logger.warning(f"Requested stream [{stream_id}] not found.")

    def get_telemetry_status(self) -> Dict[str, Any]:
        """Returns central engine status plus primary stream metrics."""
        primary = self.get_stream("cctv-1")
        primary_status = primary.get_telemetry_status() if primary else {}

        with self._lock:
            active_count = len(self._streams)
            stream_keys = list(self._streams.keys())

        return {
            "system": "EOA Autonomous AI Vision Worker (Central Hybrid)",
            "version": "1.1.0",
            "status": "OPERATIONAL",
            "active_streams_count": active_count,
            "active_stream_ids": stream_keys,
            "primary_stream": primary_status,
            "fps": primary_status.get("fps", 0),
            "total_dispatches": sum(s.get("total_dispatches", 0) for s in self.list_streams()),
        }

    def _trigger_automated_dispatch(self, targets: list):
        """Triggers dispatch on primary stream (drill support)."""
        primary = self.get_stream("cctv-1")
        if primary:
            primary._trigger_automated_dispatch(targets)

    def start(self):
        """Starts all registered stream threads."""
        with self._lock:
            for worker in self._streams.values():
                worker.start()

    def stop(self):
        """Stops all registered stream threads."""
        with self._lock:
            for worker in self._streams.values():
                worker.stop()
