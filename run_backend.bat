@echo off
title EOA FastAPI Backend (Port 8000)
echo ====================================================
echo  Starting Emergency Orchestrator Agent (EOA) Backend
echo  Port: 8000
echo  Swagger Docs: http://127.0.0.1:8000/docs
echo  WebSocket: ws://127.0.0.1:8000/ws/live-feed
echo ====================================================
uvicorn main:app --reload --port 8000
pause
