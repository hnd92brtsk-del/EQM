$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
. (Join-Path $PSScriptRoot "local-runtime-common.ps1")

Write-Host "Stopping EQM local runtime..." -ForegroundColor Cyan

Stop-EqmFrontendProcesses
Stop-EqmBackendProcesses
Start-Sleep -Seconds 1
Stop-LocalPostgres

Write-Host "EQM local runtime stopped." -ForegroundColor Green
