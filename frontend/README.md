# 🖥️ Emergency Operations Center (EOC) Frontend

Real-time, dark-mode tactical Emergency Operations Center (EOC) dashboard built with React, Vite, Leaflet, and Tailwind CSS. Connects to the FastAPI backend via WebSockets (`ws://127.0.0.1:8000/ws/live-feed`) to stream live emergency incidents and autonomous AI ReAct dispatch decisions.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server (Port 5173)
```bash
npm run dev
```
Or double-click `run_frontend.bat`.

### 3. Build Production Bundle
```bash
npm run build
```
Generates production-optimized static files in the `frontend/dist/` directory.

---

## 🗺️ Key Features
- **Global Sector Switcher**: Seamlessly switch between Hebron, Tokyo, Madrid, New York, and Riyadh.
- **Real-Time Polylines**: Visual dispatch routing connecting incidents to nearest hospitals and police stations.
- **AI ReAct Trace Inspector**: Click to inspect the full AI reasoning cycle (`OBSERVATION` ➔ `THOUGHT` ➔ `ACTION` ➔ `FINAL ANSWER`).
- **One-Click Incident Injector**: Preset emergency scenarios for live demonstration.
- **Frictionless Authentication**: Tactical SSO / Device token login barrier.
