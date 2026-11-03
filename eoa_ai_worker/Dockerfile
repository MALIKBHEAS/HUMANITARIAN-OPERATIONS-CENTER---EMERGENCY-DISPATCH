# =============================================================================
# EOA Autonomous AI Vision Worker - Production Dockerfile (Phase 3 C4ISR)
# Python 3.10 Slim with OpenCV & YOLOv8 Real-Time Video Analytics
# =============================================================================

FROM python:3.10-slim

WORKDIR /app

# Install minimal OS dependencies required for OpenCV and PyTorch/YOLO
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libglib2.0-0 \
    libgomp1 \
    libgl1 \
    libxcb1 \
    libx11-xcb1 \
    libsm6 \
    libxext6 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Optimize pip and install lightweight CPU-optimized PyTorch first
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y opencv-python && \
    pip install --no-cache-dir --force-reinstall --no-deps opencv-python-headless && \
    python -c "import cv2; import ultralytics; print('AI Worker OpenCV and YOLO dependencies verified OK')"

# Copy application code
COPY . .

# Expose sovereign vision server port
EXPOSE 8080

# Run FastAPI MJPEG Streaming Server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
