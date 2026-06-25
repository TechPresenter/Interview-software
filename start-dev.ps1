# HireSense — local dev launcher
# Usage:  right-click → Run with PowerShell,  or:  ./start-dev.ps1
$root = $PSScriptRoot

# 1) Redis (portable build at C:\Users\prash\redis)
$redisUp = (Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue).TcpTestSucceeded
if (-not $redisUp) {
  Start-Process -FilePath "C:\Users\prash\redis\redis-server.exe" -WindowStyle Hidden
  Start-Sleep -Seconds 2
  Write-Host "Started Redis on :6379"
} else {
  Write-Host "Redis already running on :6379"
}

# 2) Backend API (new window)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\server'; npm run dev"

# 3) Frontend web (new window)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\client'; npm run dev"

Write-Host ""
Write-Host "HireSense starting..."
Write-Host "  API : http://localhost:5000"
Write-Host "  Web : http://localhost:3000"
Write-Host "Login: admin@hiresense.ai / ChangeMe123!"
