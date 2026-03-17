$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
. (Join-Path $PSScriptRoot "local-runtime-common.ps1")

Stop-EqmFrontendProcesses
Start-Sleep -Milliseconds 400
Assert-PortFree -Port 5173 -ServiceName "EQM frontend"

Set-Location ".\frontend"
& "npm.cmd" run dev -- --host localhost --port 5173
