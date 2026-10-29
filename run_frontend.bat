@echo off
title EOC React Vite Frontend (Port 5173)
cd /d "%~dp0frontend"
echo ====================================================
echo  Starting Emergency Operations Center (EOC) Frontend
echo  Working Directory: frontend\
echo  Port: 5173
echo  Dashboard: http://localhost:5173
echo ====================================================
npm.cmd run dev
pause
