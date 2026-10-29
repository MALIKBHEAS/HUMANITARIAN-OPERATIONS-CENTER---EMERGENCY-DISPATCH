@echo off
title Multi-Agent Emergency Orchestrator Launcher
echo ========================================================
echo   Starting Multi-Agent Emergency Orchestrator (EOA)
echo ========================================================
echo.
cd /d "%~dp0"

echo [1/3] Launching FastAPI Backend on http://127.0.0.1:8000 ...
start "EOA Backend (Port 8000)" cmd /k "title EOA Backend (Port 8000) && uvicorn main:app --reload --port 8000"

echo [2/3] Launching React Vite Frontend from frontend\ on http://localhost:5173 ...
start "EOC Dashboard (Port 5173)" cmd /k "title EOC Dashboard (Port 5173) && cd /d "%~dp0frontend" && npm.cmd run dev"

echo.
echo [3/3] Waiting 3 seconds for servers to initialize...
timeout /t 3 /nobreak >nul
start http://localhost:5173/

echo.
echo ========================================================
echo  SYSTEM ONLINE!
echo  - EOC Dashboard:  http://localhost:5173/
echo  - Backend API:    http://127.0.0.1:8000/docs
echo  - WebSocket Feed: ws://127.0.0.1:8000/ws/live-feed
echo ========================================================
echo  Keep the opened command windows active while using.
pause
