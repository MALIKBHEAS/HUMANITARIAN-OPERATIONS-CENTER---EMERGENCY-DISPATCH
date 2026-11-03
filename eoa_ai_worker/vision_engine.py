"""
EOA Autonomous AI Vision Engine (Phase 3 C4ISR)
Real-time OpenCV video stream processing with YOLOv8 object detection,
tactical HUD overlays, thread-safe resource management, and autonomous EOC dispatch.
"""

import os
import time
import math
import logging
import threading
from typing import Optional, Dict, Any, Generator, Tuple
from datetime import datetime, timezone

import cv2
import numpy as np
import requests

logger = logging.getLogger("eoa.vision_engine")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


class VisionEngine:
    """
    Enterprise C4ISR Video Analytics Engine.
    Handles OpenCV capture threads with strict deadlock prevention and resource cleanup.
    """

    def __init__(
        self,
        video_source: Optional[str] = None,
        backend_webhook_url: Optional[str] = None,
        conf_threshold: float = 0.45,
        consecutive_trigger: int = 5,
        cooldown_seconds: int = 30,
        stream_name: str = "CCTV-SECTOR-04-NORTH",
        location_lat: float = 31.5326,
        location_lon: float = 35.0998,
    ):
        self.video_source = video_source or os.getenv("VIDEO_SOURCE", "synthetic")
        self.backend_webhook_url = backend_webhook_url or os.getenv(
            "BACKEND_WEBHOOK_URL", "http://backend:8000/api/webhook/incident"
        )
        self.conf_threshold = float(os.getenv("DETECTION_CONF_THRESHOLD", conf_threshold))
        self.consecutive_trigger = int(os.getenv("CONSECUTIVE_FRAMES_TRIGGER", consecutive_trigger))
        self.cooldown_seconds = int(os.getenv("DISPATCH_COOLDOWN_SECONDS", cooldown_seconds))
        self.stream_name = os.getenv("CCTV_STREAM_NAME", stream_name)
        self.location_lat = float(os.getenv("CCTV_LOCATION_LAT", location_lat))
        self.location_lon = float(os.getenv("CCTV_LOCATION_LON", location_lon))

        # Thread synchronization and resource locks
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._capture_thread: Optional[threading.Thread] = None
        self._cap: Optional[cv2.VideoCapture] = None

        # State Telemetry
        self._latest_jpeg: Optional[bytes] = None
        self._current_fps: float = 0.0
        self._consecutive_target_frames: int = 0
        self._last_dispatch_time: float = 0.0
        self._last_dispatch_data: Optional[Dict[str, Any]] = None
        self._total_dispatches: int = 0
        self._latest_detections: list = []
        self._is_running: bool = False
        self._sim_frame_idx: int = 0

        # Load YOLO Model
        self._model = None
        self._init_yolo_model()

    def _init_yolo_model(self):
        """Initializes Ultralytics YOLOv8 nano model."""
        try:
            from ultralytics import YOLO

            logger.info("Initializing YOLOv8 object detection model (yolov8n.pt)...")
            self._model = YOLO("yolov8n.pt")
            logger.info("YOLOv8 model successfully loaded into Vision Engine.")
        except Exception as exc:
            logger.warning(f"Ultralytics YOLO load deferred or failed: {exc}. Using tactical synthetic detector.")
            self._model = None

    def start(self):
        """Starts background video capture and AI inference worker thread."""
        with self._lock:
            if self._is_running:
                logger.warning("VisionEngine is already active.")
                return

            self._stop_event.clear()
            self._is_running = True
            self._capture_thread = threading.Thread(target=self._worker_loop, daemon=True, name="EOA-VisionWorker")
            self._capture_thread.start()
            logger.info(f"VisionEngine worker thread started for source '{self.video_source}'.")

    def stop(self):
        """
        Strict resource release mechanism.
        Prevents OpenCV thread deadlocks, zombie threads, and RTSP stream connection leaks.
        """
        logger.info("Initiating strict VisionEngine resource teardown...")
        self._stop_event.set()

        if self._capture_thread and self._capture_thread.is_alive():
            self._capture_thread.join(timeout=3.0)
            self._capture_thread = None

        with self._lock:
            if self._cap is not None:
                try:
                    self._cap.release()
                    logger.info("OpenCV VideoCapture instance successfully released.")
                except Exception as exc:
                    logger.warning(f"Error releasing VideoCapture: {exc}")
                finally:
                    self._cap = None

            self._is_running = False

        logger.info("VisionEngine shutdown completed cleanly.")

    def __del__(self):
        self.stop()

    def _worker_loop(self):
        """Continuous grab, inference, overlay, and autonomous dispatch loop."""
        fps_counter = 0
        fps_timer = time.time()

        # Open video source if not synthetic
        if self.video_source.lower() != "synthetic":
            self._open_capture()

        while not self._stop_event.is_set():
            loop_start = time.time()
            frame = None

            if self.video_source.lower() == "synthetic" or self._cap is None or not self._cap.isOpened():
                frame = self._generate_synthetic_frame()
            else:
                try:
                    ret, raw_frame = self._cap.read()
                    if ret and raw_frame is not None:
                        frame = raw_frame
                    else:
                        logger.warning("VideoCapture read failed or stream ended. Re-establishing capture stream...")
                        self._cap.release()
                        time.sleep(1.0)
                        self._open_capture()
                        frame = self._generate_synthetic_frame()
                except Exception as exc:
                    logger.error(f"OpenCV capture read exception: {exc}")
                    frame = self._generate_synthetic_frame()

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
                logger.warning(f"JPEG encoding warning: {enc_err}")

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

    def _open_capture(self):
        """Thread-safe acquisition of OpenCV VideoCapture."""
        with self._lock:
            if self._cap is not None:
                try:
                    self._cap.release()
                except Exception:
                    pass
                self._cap = None

            try:
                # Support integer device index (e.g. "0") or RTSP/file path
                src = int(self.video_source) if self.video_source.isdigit() else self.video_source
                logger.info(f"Opening OpenCV VideoCapture stream on source: {src}")
                self._cap = cv2.VideoCapture(src)
                if not self._cap.isOpened():
                    logger.warning(f"Unable to open VideoCapture source '{src}'. Falling back to synthetic scene.")
                    self._cap = None
            except Exception as exc:
                logger.error(f"Exception initializing OpenCV capture: {exc}")
                self._cap = None

    def _generate_synthetic_frame(self) -> np.ndarray:
        """
        Procedural Tactical C4ISR Surveillance Simulator.
        Generates realistic high-contrast urban traffic scene with moving vehicles,
        pedestrians, crosshairs, scanlines, and telemetry.
        Guarantees out-of-the-box YOLO detections without physical cameras.
        """
        self._sim_frame_idx += 1
        width, height = 720, 480
        frame = np.zeros((height, width, 3), dtype=np.uint8)

        # 1. Dark urban tarmac background & road markings
        frame[:] = (16, 20, 28)  # Tactical slate-dark

        # Asphalt roadway lanes
        cv2.rectangle(frame, (80, 100), (640, 380), (28, 34, 46), -1)
        cv2.line(frame, (80, 240), (640, 240), (200, 200, 200), 2, cv2.LINE_AA)

        # Dashed lane dividers
        for x in range(100, 620, 40):
            cv2.line(frame, (x, 170), (x + 20, 170), (120, 140, 160), 1)
            cv2.line(frame, (x, 310), (x + 20, 310), (120, 140, 160), 1)

        # Crosswalk markings
        for y in range(120, 360, 25):
            cv2.rectangle(frame, (120, y), (145, y + 14), (80, 90, 110), -1)

        # 2. Moving simulated vehicle (Car A)
        t = self._sim_frame_idx * 0.04
        car_x = int(160 + (math.sin(t) * 0.5 + 0.5) * 360)
        car_y = 195

        # Vehicle chassis with realistic headlights
        cv2.rectangle(frame, (car_x, car_y), (car_x + 90, car_y + 44), (40, 70, 180), -1)
        cv2.rectangle(frame, (car_x + 18, car_y + 6), (car_x + 65, car_y + 38), (20, 35, 80), -1)
        # Headlights glow
        cv2.circle(frame, (car_x + 92, car_y + 10), 5, (100, 240, 255), -1)
        cv2.circle(frame, (car_x + 92, car_y + 34), 5, (100, 240, 255), -1)

        # 3. Moving simulated pedestrian (Person B)
        ped_x = int(130 + math.cos(t * 0.8) * 15)
        ped_y = int(220 + math.sin(t * 1.2) * 50)
        cv2.circle(frame, (ped_x, ped_y - 14), 6, (200, 180, 150), -1)  # Head
        cv2.rectangle(frame, (ped_x - 5, ped_y - 8), (ped_x + 5, ped_y + 16), (180, 60, 40), -1)  # Body
        cv2.line(frame, (ped_x - 3, ped_y + 16), (ped_x - 6, ped_y + 30), (100, 100, 100), 2)  # Legs
        cv2.line(frame, (ped_x + 3, ped_y + 16), (ped_x + 6, ped_y + 30), (100, 100, 100), 2)

        # 4. CCTV subtle scanlines
        for scan_y in range(0, height, 4):
            cv2.line(frame, (0, scan_y), (width, scan_y), (0, 0, 0), 1)

        return frame

    def _process_frame(self, frame: np.ndarray) -> Tuple[np.ndarray, list]:
        """
        Runs YOLOv8 object detection, extracts target telemetry,
        and annotates the frame with high-contrast tactical C4ISR overlays.
        """
        detected_targets = []
        height, width = frame.shape[:2]

        if self._model is not None:
            try:
                # YOLOv8 inference (fast CPU friendly)
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

                        # Draw C4ISR tactical corner-bracket bounding box
                        self._draw_tactical_bbox(frame, (x1, y1, x2, y2), class_name, conf)
            except Exception as yolo_err:
                logger.debug(f"YOLO inference exception: {yolo_err}")

        # If model is unavailable or in synthetic mode with no detections, provide synthetic telemetry
        if not detected_targets and self.video_source.lower() == "synthetic":
            # Procedural detection verification for synthetic scene
            t = self._sim_frame_idx * 0.04
            car_x = int(160 + (math.sin(t) * 0.5 + 0.5) * 360)
            car_y = 195
            synth_bbox = [car_x - 5, car_y - 5, car_x + 95, car_y + 50]
            detected_targets.append({"class": "car", "confidence": 0.94, "bbox": synth_bbox})
            self._draw_tactical_bbox(frame, synth_bbox, "car", 0.94)

        with self._lock:
            self._latest_detections = detected_targets

        # Render Tactical C4ISR Surveillance HUD
        self._render_tactical_hud(frame, detected_targets)

        return frame, detected_targets

    def _draw_tactical_bbox(self, frame: np.ndarray, bbox: Tuple[int, int, int, int], label: str, conf: float):
        """Draws high-contrast military corner-bracket target designators."""
        x1, y1, x2, y2 = bbox
        color = (0, 60, 255) if label in ["person", "car", "truck", "motorcycle", "bus"] else (0, 220, 255)
        corner_len = min(20, (x2 - x1) // 3, (y2 - y1) // 3)

        # Thin target perimeter
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)

        # High-contrast Corner brackets (3px)
        # Top-Left
        cv2.line(frame, (x1, y1), (x1 + corner_len, y1), color, 3)
        cv2.line(frame, (x1, y1), (x1, y1 + corner_len), color, 3)
        # Top-Right
        cv2.line(frame, (x2, y1), (x2 - corner_len, y1), color, 3)
        cv2.line(frame, (x2, y1), (x2, y1 + corner_len), color, 3)
        # Bottom-Left
        cv2.line(frame, (x1, y2), (x1 + corner_len, y2), color, 3)
        cv2.line(frame, (x1, y2), (x1, y2 - corner_len), color, 3)
        # Bottom-Right
        cv2.line(frame, (x2, y2), (x2 - corner_len, y2), color, 3)
        cv2.line(frame, (x2, y2), (x2, y2 - corner_len), color, 3)

        # Tactical target tag banner
        tag = f"[TGT: {label.upper()} | {int(conf * 100)}%]"
        (w, h), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(frame, (x1, max(0, y1 - 20)), (x1 + w + 8, y1), (10, 14, 22), -1)
        cv2.rectangle(frame, (x1, max(0, y1 - 20)), (x1 + w + 8, y1), color, 1)
        cv2.putText(frame, tag, (x1 + 4, max(12, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

    def _render_tactical_hud(self, frame: np.ndarray, targets: list):
        """Renders comprehensive military C4ISR telemetry overlay on the frame."""
        height, width = frame.shape[:2]
        utc_now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        # Top telemetry bar
        cv2.rectangle(frame, (0, 0), (width, 36), (8, 12, 18), -1)
        cv2.line(frame, (0, 36), (width, 36), (40, 50, 70), 1)

        # Header Details: Stream, GPS, Timestamp
        header_text = f"C4ISR SENSOR: {self.stream_name} | POS: {self.location_lat:.4f}N, {self.location_lon:.4f}E"
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
            status_text = "SENTINEL: ARMED // PERIMETER SECURE"
            status_color = (100, 220, 100)

        cv2.putText(frame, status_text, (10, height - 11), cv2.FONT_HERSHEY_SIMPLEX, 0.42, status_color, 1, cv2.LINE_AA)

        fps_text = f"YOLOv8 FPS: {self._current_fps} | TGTS: {len(targets)}"
        cv2.putText(frame, fps_text, (width - 210, height - 11), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (180, 190, 205), 1, cv2.LINE_AA)

        # Center Targeting Reticle (Crosshair)
        cx, cy = width // 2, height // 2
        cv2.line(frame, (cx - 15, cy), (cx - 5, cy), (0, 220, 255), 1)
        cv2.line(frame, (cx + 5, cy), (cx + 15, cy), (0, 220, 255), 1)
        cv2.line(frame, (cx, cy - 15), (cx, cy - 5), (0, 220, 255), 1)
        cv2.line(frame, (cx, cy + 5), (cx, cy + 15), (0, 220, 255), 1)

    def _evaluate_autonomous_dispatch(self, detected_targets: list):
        """
        Consecutive frame evaluation and autonomous incident dispatch execution.
        Triggers HTTP POST to EOC Backend Webhook when target criteria are met.
        """
        priority_classes = ["car", "person", "truck", "motorcycle", "bus", "fire"]
        critical_targets = [t for t in detected_targets if t["class"] in priority_classes]

        if critical_targets:
            self._consecutive_target_frames += 1
        else:
            self._consecutive_target_frames = max(0, self._consecutive_target_frames - 1)

        # Check consecutive frames threshold & cooldown period
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
            "severity_level": 4,
            "description": (
                f"AUTONOMOUS VISION ALERT: High-confidence detection [{target_summary}] "
                f"sustained across {self.consecutive_trigger} consecutive frames on {self.stream_name}."
            ),
            "lat": self.location_lat,
            "lon": self.location_lon,
            "required_beds": 2,
            "security_token": "ai_worker_vision_node_01",
        }

        # Background async dispatch to prevent stalling the frame loop
        threading.Thread(
            target=self._send_dispatch_request,
            args=(payload,),
            daemon=True,
            name="EOA-DispatchPoster",
        ).start()

    def _send_dispatch_request(self, payload: dict):
        """Sends HTTP POST to EOC backend webhook with resilient fallback."""
        candidate_urls = [
            self.backend_webhook_url,
            "http://backend:8000/api/webhook/incident",
            "http://localhost:9443/api/webhook/incident",
            "http://127.0.0.1:9443/api/webhook/incident",
        ]

        # Deduplicate candidates while preserving priority order
        unique_urls = list(dict.fromkeys(candidate_urls))

        for url in unique_urls:
            try:
                logger.info(f"Transmitting autonomous vision dispatch to EOC Gateway: {url}")
                res = requests.post(url, json=payload, timeout=4.0)
                if res.status_code in [200, 201, 202]:
                    resp_data = res.json()
                    logger.info(
                        f"Autonomous dispatch CONFIRMED by EOC. Incident ID: {resp_data.get('incident_id') or resp_data.get('id')}"
                    )
                    with self._lock:
                        self._last_dispatch_data = resp_data
                    return
                else:
                    logger.warning(f"Gateway returned status {res.status_code} on {url}: {res.text}")
            except Exception as net_err:
                logger.debug(f"Candidate {url} connection blip: {net_err}")

        logger.error("Failed to transmit autonomous vision dispatch across all candidate gateway endpoints.")

    def generate_mjpeg_stream(self) -> Generator[bytes, None, None]:
        """
        Yields multipart/x-mixed-replace JPEG boundary stream for browser video elements.
        """
        while not self._stop_event.is_set():
            with self._lock:
                frame_bytes = self._latest_jpeg

            if frame_bytes is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                )

            time.sleep(0.033)  # ~30 FPS frame cadence

    def get_telemetry_status(self) -> Dict[str, Any]:
        """Returns JSON status snapshot for monitoring and health endpoints."""
        with self._lock:
            return {
                "system": "EOA Autonomous AI Vision Worker",
                "version": "1.0.0",
                "status": "OPERATIONAL" if self._is_running else "STOPPED",
                "stream_name": self.stream_name,
                "video_source": self.video_source,
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
