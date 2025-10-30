Write-Host "Starting Safe Egypt Development Environment..." -ForegroundColor Green
Write-Host ""

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start backend in a new PowerShell window
Write-Host "Starting Backend Server..." -ForegroundColor Yellow
$backendPath = Join-Path $scriptDir "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Installing Python requirements...' -ForegroundColor Cyan; python -m pip install -r requirements.txt; Write-Host 'Starting uvicorn server...' -ForegroundColor Cyan; uvicorn app:app --host 127.0.0.1 --port 8000"

# Wait a moment before starting the frontend
Start-Sleep -Seconds 2

# Start frontend in a new PowerShell window
Write-Host "Starting Dashboard..." -ForegroundColor Yellow
$dashboardPath = Join-Path $scriptDir "dashboard"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$dashboardPath'; Write-Host 'Installing npm packages...' -ForegroundColor Cyan; npm install; Write-Host 'Starting development server...' -ForegroundColor Cyan; npm run dev"

Write-Host ""
Write-Host "Both servers are starting in separate windows!" -ForegroundColor Green
Write-Host "Backend: http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "Dashboard: Check the dashboard terminal for the URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to close this window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

