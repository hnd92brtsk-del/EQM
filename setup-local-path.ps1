$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$venvScripts = (Resolve-Path ".\.venv\Scripts").Path
$currentUserPath = [Environment]::GetEnvironmentVariable("Path", "User")

if (-not $currentUserPath) {
    $currentUserPath = ""
}

$parts = $currentUserPath -split ";" | Where-Object { $_ -and $_.Trim() }
if ($parts -contains $venvScripts) {
    Write-Host ".venv\\Scripts is already present in the user PATH." -ForegroundColor Yellow
    Write-Host "Open a new PowerShell window to use the existing PATH entry."
    exit 0
}

$newPath = if ($currentUserPath.Trim()) {
    "$currentUserPath;$venvScripts"
} else {
    $venvScripts
}

[Environment]::SetEnvironmentVariable("Path", $newPath, "User")

Write-Host "Added $venvScripts to the user PATH." -ForegroundColor Green
Write-Host "Open a new PowerShell window for the change to take effect."
