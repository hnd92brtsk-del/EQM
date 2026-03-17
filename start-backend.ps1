$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
. (Join-Path $PSScriptRoot "local-runtime-common.ps1")

Ensure-LocalPostgresStarted
Stop-EqmBackendProcesses
Start-Sleep -Milliseconds 400
Assert-PortFree -Port 8000 -ServiceName "EQM backend"

$python = Get-EqmVenvPython
Set-Location ".\backend"
& $python -m uvicorn app.main:app --reload --host localhost --port 8000
