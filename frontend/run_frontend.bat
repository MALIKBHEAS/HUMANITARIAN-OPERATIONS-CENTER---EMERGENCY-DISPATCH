@echo off
title EOC React Vite Frontend (Port 5173)
cd /d "%~dp0"
echo ====================================================
echo  Starting Emergency Operations Center (EOC) Frontend
echo  Directory: frontend\
echo  Port: 5173
echo  Dashboard: http://localhost:5173
echo ====================================================
npm.cmd run dev
pause
