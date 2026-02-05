@echo off
REM V64 G-One System Startup (Windows)
REM ===================================

echo.
echo ========================================
echo   V64 G-One Unified System
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found!
    echo Please install Python 3.11 or higher
    pause
    exit /b 1
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found!
    echo Please install Node.js
    pause
    exit /b 1
)

echo Starting V64 G-One System...
echo.

REM Run the Python startup script
python start_system.py

pause
