param(
    [string]$OutputDir = "",
    [string]$DeployAdminPassword = "EqmAdmin2026!",
    [string]$DeployDbPassword = "EqmDeployDb2026!",
    [string]$DeployPostgresPassword = "EqmDeployPg2026!",
    [string]$ServerIp = "192.168.110.18"
)

$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSNativeCommandUseErrorActionPreference = $true
}

$deployRoot = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path -Parent $deployRoot
$version = (Get-Content (Join-Path $repoRoot "VERSION") -TotalCount 1).Trim()
$expectedRevision = "0043_add_io_signal_plc_range_fields"
$deployJwtSecret = "eqm-offline-jwt-$($version.Trim())-server-2026-secure-key"

if (-not $OutputDir) {
    $OutputDir = Join-Path $deployRoot "dist\\eqm-offline-bundle"
}

$runtimeImagesDir = Join-Path $OutputDir "deploy\\runtime-images"
$backupDir = Join-Path $repoRoot "backup"
$dumpPath = Join-Path $backupDir "equipment_crm_deploy.sql"
$countsPath = Join-Path $backupDir "equipment_crm_deploy_table_counts.tsv"
$enumsPath = Join-Path $backupDir "equipment_crm_deploy_enums.txt"
$validationReportPath = Join-Path $repoRoot "docs\\deploy\\04_validation_report_ru.md"
$bundleEnvPath = Join-Path $OutputDir "deploy\\app\\.env"

function Write-Utf8LfFile {
    param(
        [string]$Path,
        [string]$Content
    )

    $directory = Split-Path -Parent $Path
    if ($directory) {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
    }

    $normalizedContent = $Content -replace "`r`n", "`n"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $normalizedContent, $utf8NoBom)
}

function Resolve-PgToolPath {
    param([string]$ToolName)

    $command = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $postmasterOpts = Join-Path $repoRoot ".postgres\\data\\postmaster.opts"
    if (Test-Path $postmasterOpts) {
        $line = Get-Content $postmasterOpts -TotalCount 1
        if ($line -match '^"([^"]+postgres(?:\\.exe)?)"') {
            $binDir = Split-Path -Parent $Matches[1]
            $candidate = Join-Path $binDir "$ToolName.exe"
            if (Test-Path $candidate) {
                return $candidate
            }
        }
    }

    throw "Unable to locate PostgreSQL tool: $ToolName"
}

function Measure-DirectoryBytes {
    param(
        [string]$Path,
        [string[]]$ExcludePrefixes = @()
    )

    $resolvedRoot = (Resolve-Path $Path).Path
    $sum = 0L
    Get-ChildItem -LiteralPath $resolvedRoot -Recurse -File -Force | ForEach-Object {
        $fullName = $_.FullName
        foreach ($prefix in $ExcludePrefixes) {
            if ($fullName.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                return
            }
        }
        $sum += $_.Length
    }
    return $sum
}

function Format-Bytes {
    param([Int64]$Bytes)

    if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }
    return "$Bytes B"
}

function Ensure-LocalDatabase {
    $pgCtl = Resolve-PgToolPath "pg_ctl"
    $pgIsReady = Resolve-PgToolPath "pg_isready"
    $dataDir = Join-Path $repoRoot ".postgres\\data"

    & $pgIsReady -h localhost -p 5432 -d equipment_crm -U equipment_user *> $null
    if ($LASTEXITCODE -eq 0) {
        return
    }

    & $pgCtl -D $dataDir -l (Join-Path $repoRoot ".postgres\\postgres.log") start
    Start-Sleep -Seconds 3
    & $pgIsReady -h localhost -p 5432 -d equipment_crm -U equipment_user
    if ($LASTEXITCODE -ne 0) {
        throw "Local PostgreSQL cluster did not become ready."
    }
}

Write-Host "Preparing EQM offline deploy bundle for version $version"

Ensure-LocalDatabase

& ".\\.venv\\Scripts\\python.exe" "backend\\scripts\\export_deploy_snapshot_metadata.py" `
    --env-file "backend/.env" `
    --counts-output $countsPath `
    --enums-output $enumsPath `
    --expected-revision $expectedRevision `
    --min-rows 1300

$dbPassword = (Select-String -Path (Join-Path $repoRoot "backend\\.env") -Pattern "^DB_PASSWORD=(.*)$").Matches.Groups[1].Value
$pgDump = Resolve-PgToolPath "pg_dump"
$env:PGPASSWORD = $dbPassword
try {
    & $pgDump -h localhost -p 5432 -U equipment_user -d equipment_crm -f $dumpPath
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

$frontendDir = Join-Path $repoRoot "frontend"
Push-Location $frontendDir
try {
    & npm.cmd run build
}
finally {
    Pop-Location
}

if (-not (Test-Path (Join-Path $frontendDir "dist"))) {
    throw "Frontend dist directory was not created."
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
} else {
    Remove-Item -LiteralPath $OutputDir -Recurse -Force
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$copyTargets = @(
    ".dockerignore",
    "README.md",
    "VERSION",
    "backend",
    "frontend",
    "deploy\\README_ru.md",
    "deploy\\app",
    "docs\\deploy",
    "backup",
    "Photo",
    "Datasheets"
)

foreach ($relativePath in $copyTargets) {
    $sourcePath = Join-Path $repoRoot $relativePath
    $destinationPath = Join-Path $OutputDir $relativePath
    $destinationParent = Split-Path -Parent $destinationPath

    if (-not (Test-Path $sourcePath)) {
        throw "Required path not found: $sourcePath"
    }

    if ($destinationParent) {
        New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
    }

    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Recurse -Force
}

$pathsToRemove = @(
    "backend\\.env",
    "backend\\__pycache__",
    "backend\\.pytest_cache",
    "backend\\runtime-logs",
    "frontend\\node_modules",
    "frontend\\dist",
    "frontend\\.vite",
    "frontend\\.vite-temp"
)

foreach ($relativePath in $pathsToRemove) {
    $targetPath = Join-Path $OutputDir $relativePath
    if (Test-Path $targetPath) {
        Remove-Item -LiteralPath $targetPath -Recurse -Force
    }
}

Get-ChildItem -LiteralPath $OutputDir -Recurse -Directory -Force |
    Where-Object { $_.Name -in @("__pycache__", ".pytest_cache", "node_modules", "dist") } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }

New-Item -ItemType Directory -Force -Path $runtimeImagesDir | Out-Null

$backendImage = "eqm/backend:$version"
$frontendImage = "eqm/frontend:$version"
$postgresImage = "postgres:16"

docker build -f (Join-Path $repoRoot "deploy\\app\\Dockerfile.backend") -t $backendImage $repoRoot
docker build -f (Join-Path $repoRoot "deploy\\app\\Dockerfile.frontend") -t $frontendImage $repoRoot

try {
    docker image inspect $postgresImage *> $null
}
catch {
    throw "Base runtime image $postgresImage is not available locally. Pull it before building the offline bundle."
}

docker save -o (Join-Path $runtimeImagesDir "eqm-backend-$($version.TrimStart('v')).tar") $backendImage
docker save -o (Join-Path $runtimeImagesDir "eqm-frontend-$($version.TrimStart('v')).tar") $frontendImage
docker save -o (Join-Path $runtimeImagesDir "postgres-16.tar") $postgresImage

$envText = @"
DB_HOST=postgres
DB_PORT=5432
DB_NAME=equipment_crm
DB_USER=equipment_user
DB_PASSWORD=$DeployDbPassword
POSTGRES_SUPERUSER_PASSWORD=$DeployPostgresPassword

JWT_SECRET=$deployJwtSecret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
ENV=production
CORS_ORIGINS=http://$ServerIp

PUBLIC_BASE_URL=http://$ServerIp
FRONTEND_PUBLIC_URL=http://$ServerIp
BACKEND_PUBLIC_URL=http://$ServerIp
VITE_API_URL=/api/v1

FRONTEND_RUNTIME_HOST=frontend
FRONTEND_RUNTIME_PORT=80
FRONTEND_RUNTIME_URL=http://frontend
BACKEND_RUNTIME_HOST=0.0.0.0
BACKEND_RUNTIME_PORT=8000
BACKEND_RUNTIME_URL=http://127.0.0.1:8000

PHOTO_DIR=/srv/eqm/photo
HOST_PHOTO_DIR=/srv/eqm/photo
DATASHEET_DIR=/srv/eqm/datasheets
HOST_DATASHEET_DIR=/srv/eqm/datasheets
UPLOAD_DIR=/srv/eqm/uploads
HOST_UPLOAD_DIR=/srv/eqm/uploads
CABINET_FILES_DIR=/srv/eqm/cabinet-files
HOST_CABINET_FILES_DIR=/srv/eqm/cabinet-files
CABINET_FILES_MAX_SIZE=10737418240
PID_STORAGE_ROOT=/srv/eqm/pid-storage
HOST_PID_STORAGE_ROOT=/srv/eqm/pid-storage
POSTGRES_DATA_DIR=/srv/eqm/postgres
HOST_POSTGRES_DATA_DIR=/srv/eqm/postgres

POSTGRES_BIND_PORT=15432
BACKEND_BIND_PORT=18000
FRONTEND_BIND_PORT=18080

EQM_POSTGRES_IMAGE=postgres:16
EQM_BACKEND_IMAGE=$backendImage
EQM_FRONTEND_IMAGE=$frontendImage

LM_STUDIO_BASE_URL=http://localhost:1234
LM_STUDIO_API_KEY=
LM_MODEL=phi-3-mini-4k-instruct

SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=$DeployAdminPassword
"@

Write-Utf8LfFile -Path $bundleEnvPath -Content $envText

$sourceSizeBytes = Measure-DirectoryBytes -Path $repoRoot -ExcludePrefixes @(
    (Join-Path $repoRoot ".git"),
    (Join-Path $repoRoot ".venv"),
    (Join-Path $repoRoot "deploy\\dist")
)
$bundleSizeBytes = Measure-DirectoryBytes -Path $OutputDir

$report = @"
# EQM Offline Deploy Validation Report

- Version: `$version`
- Expected alembic revision: `$expectedRevision`
- Fresh dump: `backup/equipment_crm_deploy.sql`
- Table counts: `backup/equipment_crm_deploy_table_counts.tsv`
- Enum and dictionary report: `backup/equipment_crm_deploy_enums.txt`
- Source size excluding `.git`, `.venv`, existing `deploy/dist`: $(Format-Bytes $sourceSizeBytes)
- Offline bundle size: $(Format-Bytes $bundleSizeBytes)

Build bundle script completed successfully.
Local Docker validation results are appended after runtime smoke checks.
"@

Write-Utf8LfFile -Path $validationReportPath -Content $report

Write-Host "Offline bundle created at: $OutputDir"
Write-Host "Backend image: $backendImage"
Write-Host "Frontend image: $frontendImage"
Write-Host "Default deploy admin password: $DeployAdminPassword"
