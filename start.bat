@echo off
title TikTok Shop Smart Listing System

echo.
echo ==============================================
echo     TikTok Shop Smart Listing System
echo ==============================================
echo.

:: 检测当前运行环境
:: 如果是 PowerShell，调用 PowerShell 脚本
if defined PSModulePath (
    echo [INFO] Running in PowerShell environment
    echo [INFO] Launching PowerShell script...
    powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"
    exit /b 0
)

:: 如果是 Command Prompt，继续执行
set "CLIENT_PORT=5173"
set "SERVER_PORT=3001"

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+ first.
    echo         Download: https://nodejs.org/
    pause
    exit /b 1
)

:: Check Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [INFO] Node.js Version: %NODE_VERSION%

:: Install dependencies if not exists
if not exist "node_modules" (
    echo.
    echo [INFO] First run, installing dependencies...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies. Check your network connection.
        pause
        exit /b 1
    )
    echo.
    echo [SUCCESS] Dependencies installed.
    echo.
)

echo [INFO] Starting services...
echo [INFO] Client Port: %CLIENT_PORT%
echo [INFO] Server Port: %SERVER_PORT%
echo.
echo [TIP] Press Ctrl+C to stop services.
echo.

:: Start development servers
npm run dev

pause