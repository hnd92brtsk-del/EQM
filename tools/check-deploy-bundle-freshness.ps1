param(
    [string]$BundleRoot = "deploy/dist/eqm-offline-bundle"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$resolvedBundleRoot = (Resolve-Path $BundleRoot -ErrorAction SilentlyContinue)
if (-not $resolvedBundleRoot) {
    Write-Error "Bundle root not found: $BundleRoot"
    exit 1
}

$resolvedBundleRoot = $resolvedBundleRoot.Path
$stampPath = Join-Path $resolvedBundleRoot "deploy/metadata/bundle-build-stamp.json"
$repoVersionPath = Join-Path $repoRoot "VERSION"
$bundleVersionPath = Join-Path $resolvedBundleRoot "VERSION"

if (-not (Test-Path $stampPath)) {
    Write-Host "BUNDLE STALE: bundle build stamp is missing." -ForegroundColor Red
    Write-Host "Rebuild bundle with: powershell -ExecutionPolicy Bypass -File .\deploy\build-offline-bundle.ps1"
    exit 1
}

$stamp = Get-Content $stampPath -Raw | ConvertFrom-Json
$bundleBuiltAtUtc = [DateTime]::Parse($stamp.build_completed_utc).ToUniversalTime()
$repoVersion = (Get-Content $repoVersionPath -TotalCount 1).Trim()
$bundleVersion = (Get-Content $bundleVersionPath -TotalCount 1).Trim()

$trackedRoots = @(
    "backend",
    "frontend",
    "deploy",
    "docs/deploy",
    "backup",
    "Photo",
    "Datasheets",
    "README.md",
    "VERSION",
    ".dockerignore"
)

$excludedDirNames = @(
    ".git",
    ".venv",
    ".idea",
    ".vscode",
    "__pycache__",
    "node_modules",
    ".pytest_cache",
    "runtime-logs",
    "dist"
)

$candidateFiles = New-Object System.Collections.Generic.List[System.IO.FileInfo]
foreach ($relativePath in $trackedRoots) {
    $fullPath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path $fullPath)) {
        continue
    }

    $item = Get-Item $fullPath -Force
    if ($item.PSIsContainer) {
        Get-ChildItem -LiteralPath $fullPath -Recurse -File -Force | Where-Object {
            $segments = $_.FullName.Substring($repoRoot.Length).TrimStart('\').Split('\')
            -not ($segments | Where-Object { $_ -in $excludedDirNames })
        } | ForEach-Object {
            $candidateFiles.Add($_)
        }
    }
    else {
        $candidateFiles.Add($item)
    }
}

$staleFiles = $candidateFiles | Where-Object {
    $_.LastWriteTimeUtc -gt $bundleBuiltAtUtc
} | Sort-Object LastWriteTimeUtc -Descending

Write-Host "Bundle root: $resolvedBundleRoot"
Write-Host "Bundle built at (UTC): $($bundleBuiltAtUtc.ToString('u'))"
Write-Host "Repo version: $repoVersion"
Write-Host "Bundle version: $bundleVersion"

if ($repoVersion -ne $bundleVersion) {
    Write-Host "BUNDLE STALE: VERSION differs between repo and bundle." -ForegroundColor Red
    Write-Host "Rebuild bundle with: powershell -ExecutionPolicy Bypass -File .\deploy\build-offline-bundle.ps1"
    exit 1
}

if ($staleFiles.Count -gt 0) {
    Write-Host "BUNDLE STALE: source files are newer than the current bundle." -ForegroundColor Red
    $staleFiles | Select-Object -First 15 | ForEach-Object {
        $relative = $_.FullName.Substring($repoRoot.Length).TrimStart('\')
        Write-Host (" - {0} ({1:u})" -f $relative, $_.LastWriteTimeUtc)
    }
    if ($staleFiles.Count -gt 15) {
        Write-Host (" - ... and {0} more files" -f ($staleFiles.Count - 15))
    }
    Write-Host "Rebuild bundle with: powershell -ExecutionPolicy Bypass -File .\deploy\build-offline-bundle.ps1"
    exit 1
}

Write-Host "BUNDLE FRESH: bundle build stamp is newer than tracked project inputs." -ForegroundColor Green
Write-Host "Optional validation: powershell -ExecutionPolicy Bypass -File .\tools\validate-offline-bundle.ps1 -BundleRoot $BundleRoot"
