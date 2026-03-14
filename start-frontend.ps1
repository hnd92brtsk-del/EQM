$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Set-Location ".\frontend"

& "npm.cmd" run dev
