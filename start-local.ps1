$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
. (Join-Path $PSScriptRoot "local-runtime-common.ps1")

Write-Host "Starting EQM local runtime on localhost..." -ForegroundColor Cyan
Ensure-LocalPostgresStarted
$backend = Start-EqmBackendProcess
$frontend = Start-EqmFrontendProcess

Wait-HttpOk -Url "http://127.0.0.1:8000/docs"
Wait-PortOpen -TargetHost "127.0.0.1" -Port 5173

Write-Host ""
Write-Host "EQM local runtime is ready." -ForegroundColor Green
Write-Host "Backend : http://127.0.0.1:8000/docs"
Write-Host "Frontend: http://127.0.0.1:5173"
Write-Host "Backend PID : $($backend.Id)"
Write-Host "Frontend PID: $($frontend.Id)"
Write-Host "Logs:"
Write-Host "  backend : $((Join-Path $PSScriptRoot 'backend.log'))"
Write-Host "  frontend: $((Join-Path $PSScriptRoot 'frontend.log'))"
