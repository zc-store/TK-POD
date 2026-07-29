<#
.SYNOPSIS
启动 TikTok Shop Smart Listing System

.DESCRIPTION
启动前端开发服务器和后端 API 服务
#>

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "    TikTok Shop Smart Listing System" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

$CLIENT_PORT = 5173
$SERVER_PORT = 3001

# 检查 Node.js 是否安装
try {
    $nodeVersion = node --version
    Write-Host "[INFO] Node.js Version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js not found. Please install Node.js 18+ first." -ForegroundColor Red
    Write-Host "        Download: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# 检查并安装依赖
if (-not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "[INFO] First run, installing dependencies..." -ForegroundColor Green
    Write-Host ""
    
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install dependencies. Check your network connection." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host ""
    Write-Host "[SUCCESS] Dependencies installed." -ForegroundColor Green
    Write-Host ""
}

Write-Host "[INFO] Starting services..." -ForegroundColor Green
Write-Host "[INFO] Client Port: $CLIENT_PORT" -ForegroundColor Green
Write-Host "[INFO] Server Port: $SERVER_PORT" -ForegroundColor Green
Write-Host ""
Write-Host "[TIP] Press Ctrl+C to stop services." -ForegroundColor Yellow
Write-Host ""

# 启动开发服务器
npm run dev

Write-Host ""
Write-Host "[INFO] Services stopped." -ForegroundColor Yellow
Read-Host "Press Enter to exit"