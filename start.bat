@echo off
title Windows 93 Offline Server
echo ====================================================
echo Starting Offline Windows 93 Server...
echo Make sure Python is installed and added to your PATH.
echo ====================================================
echo.
python server.py
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Python failed to start the server.
    echo Please make sure Python is installed and accessible.
    pause
)
