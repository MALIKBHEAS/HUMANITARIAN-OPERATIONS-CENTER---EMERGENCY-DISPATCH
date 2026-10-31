@echo off
title Multi-Agent Emergency Orchestrator Launcher
echo ========================================================
echo   Starting Multi-Agent Emergency Orchestrator (EOA)
echo ========================================================
echo.
cd /d "%~dp0"

echo [1/3] Launching FastAPI Backend on http://127.0.0.1:8000 ...
start "EOA Backend (Port 8000)" cmd /k "title EOA Backend (Port 8000) && uvicorn main:app --reload --port 8000"

echo [2/3] Launching React Vite Frontend from eoa_global_frontend\ on http://localhost:49152 ...
start "C4ISR Terminal (Port 49152)" cmd /k "title C4ISR Terminal (Port 49152) && cd /d "%~dp0eoa_global_frontend" && npm.cmd run dev"

echo.
echo [3/3] Waiting 3 seconds for servers to initialize...
timeout /t 3 /nobreak >nul
start http://localhost:49152/

echo.
echo ========================================================
echo  SYSTEM ONLINE!
echo  - C4ISR Dashboard: http://localhost:49152/
echo  - Backend API:     http://127.0.0.1:8000/docs
echo  - WebSocket Feed:  ws://127.0.0.1:8000/ws/live-feed
echo ========================================================
echo  Keep the opened command windows active while using.
pause
