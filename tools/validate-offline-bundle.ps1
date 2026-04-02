param(
    [string]$BundleRoot = "deploy/dist/eqm-offline-bundle",
    [string]$ValidationRoot = "runtime-logs/offline-validate",
    [string]$AdminPassword = "EqmAdmin2026!",
    [int]$PostgresPort = 25432,
    [int]$BackendPort = 28000,
    [int]$FrontendPort = 28080
)

$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSNativeCommandUseErrorActionPreference = $true
}

$repoRoot = (Get-Location).Path
$resolvedBundleRoot = (Resolve-Path $BundleRoot).Path
$resolvedValidationRoot = Join-Path $repoRoot $ValidationRoot
$composeFile = Join-Path $resolvedBundleRoot "deploy/app/docker-compose.yml"
$dumpPath = Join-Path $resolvedBundleRoot "backup/equipment_crm_deploy.sql"
$envFile = Join-Path $resolvedValidationRoot ".env"
$version = (Get-Content (Join-Path $resolvedBundleRoot "VERSION") -TotalCount 1).Trim()

function Write-Utf8LfFile {
    param(
        [string]$Path,
        [string]$Content
    )

    $directory = Split-Path -Parent $Path
    if ($directory) {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, ($Content -replace "`r`n", "`n"), $utf8NoBom)
}

function Convert-ToDockerPath {
    param([string]$Path)

    return ((Resolve-Path $Path).Path -replace "\\", "/")
}

function Copy-DirContents {
    param(
        [string]$SourceDir,
        [string]$TargetDir
    )

    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
    if (Test-Path $SourceDir) {
        Get-ChildItem -LiteralPath $SourceDir -Force | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination $TargetDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Wait-ForHttpOk {
    param(
        [string]$Url,
        [int]$Attempts = 30
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                return
            }
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }

    throw "Endpoint did not become ready: $Url"
}

function Wait-ForContainerHealth {
    param(
        [string]$ContainerName,
        [int]$Attempts = 60
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $status = (docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" $ContainerName).Trim()
            if ($status -eq "healthy") {
                return
            }
        }
        catch {
            Start-Sleep -Seconds 2
        }

        Start-Sleep -Seconds 2
    }

    throw "Container did not become healthy: $ContainerName"
}

if (Test-Path $resolvedValidationRoot) {
    Remove-Item -LiteralPath $resolvedValidationRoot -Recurse -Force
}

$dirs = @{
    Photo = Join-Path $resolvedValidationRoot "photo"
    Datasheets = Join-Path $resolvedValidationRoot "datasheets"
    Uploads = Join-Path $resolvedValidationRoot "uploads"
    CabinetFiles = Join-Path $resolvedValidationRoot "cabinet-files"
    PidStorage = Join-Path $resolvedValidationRoot "pid-storage"
    Postgres = Join-Path $resolvedValidationRoot "postgres"
}

foreach ($dir in $dirs.Values) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

Copy-DirContents -SourceDir (Join-Path $resolvedBundleRoot "Photo") -TargetDir $dirs.Photo
Copy-DirContents -SourceDir (Join-Path $resolvedBundleRoot "Datasheets") -TargetDir $dirs.Datasheets
Copy-DirContents -SourceDir (Join-Path $resolvedBundleRoot "backend/uploads") -TargetDir $dirs.Uploads
Copy-DirContents -SourceDir (Join-Path $resolvedBundleRoot "backend/storage/cabinet_files") -TargetDir $dirs.CabinetFiles
Copy-DirContents -SourceDir (Join-Path $resolvedBundleRoot "backend/app/pid_storage") -TargetDir $dirs.PidStorage

$envText = @"
DB_HOST=postgres
DB_PORT=5432
DB_NAME=equipment_crm
DB_USER=equipment_user
DB_PASSWORD=EqmDeployDb2026!
POSTGRES_SUPERUSER_PASSWORD=EqmDeployPg2026!

JWT_SECRET=eqm-offline-jwt-$version
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
ENV=production
CORS_ORIGINS=http://127.0.0.1:$FrontendPort,http://localhost:$FrontendPort

PUBLIC_BASE_URL=http://127.0.0.1:$FrontendPort
FRONTEND_PUBLIC_URL=http://127.0.0.1:$FrontendPort
BACKEND_PUBLIC_URL=http://127.0.0.1:$BackendPort
VITE_API_URL=/api/v1

FRONTEND_RUNTIME_HOST=frontend
FRONTEND_RUNTIME_PORT=80
FRONTEND_RUNTIME_URL=http://frontend
BACKEND_RUNTIME_HOST=0.0.0.0
BACKEND_RUNTIME_PORT=8000
BACKEND_RUNTIME_URL=http://127.0.0.1:8000

PHOTO_DIR=/srv/eqm/photo
HOST_PHOTO_DIR=$(Convert-ToDockerPath $dirs.Photo)
DATASHEET_DIR=/srv/eqm/datasheets
HOST_DATASHEET_DIR=$(Convert-ToDockerPath $dirs.Datasheets)
UPLOAD_DIR=/srv/eqm/uploads
HOST_UPLOAD_DIR=$(Convert-ToDockerPath $dirs.Uploads)
CABINET_FILES_DIR=/srv/eqm/cabinet-files
HOST_CABINET_FILES_DIR=$(Convert-ToDockerPath $dirs.CabinetFiles)
CABINET_FILES_MAX_SIZE=10737418240
PID_STORAGE_ROOT=/srv/eqm/pid-storage
HOST_PID_STORAGE_ROOT=$(Convert-ToDockerPath $dirs.PidStorage)
POSTGRES_DATA_DIR=/var/lib/postgresql/data
HOST_POSTGRES_DATA_DIR=/tmp/eqm-postgres-validation

POSTGRES_BIND_PORT=$PostgresPort
BACKEND_BIND_PORT=$BackendPort
FRONTEND_BIND_PORT=$FrontendPort

EQM_POSTGRES_IMAGE=postgres:16
EQM_BACKEND_IMAGE=eqm/backend:$version
EQM_FRONTEND_IMAGE=eqm/frontend:$version

LM_STUDIO_BASE_URL=http://localhost:1234
LM_STUDIO_API_KEY=
LM_MODEL=phi-3-mini-4k-instruct

SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=$AdminPassword
"@

Write-Utf8LfFile -Path $envFile -Content $envText

$imageDir = Join-Path $resolvedBundleRoot "deploy/runtime-images"
docker load -i (Join-Path $imageDir "postgres-16.tar")
docker load -i (Join-Path $imageDir "eqm-backend-$($version.TrimStart('v')).tar")
docker load -i (Join-Path $imageDir "eqm-frontend-$($version.TrimStart('v')).tar")

docker compose --env-file $envFile -f $composeFile down -v --remove-orphans
docker compose --env-file $envFile -f $composeFile up -d postgres
Wait-ForContainerHealth -ContainerName "eqm-postgres"

docker compose --env-file $envFile -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U equipment_user -d equipment_crm -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION CURRENT_USER; GRANT ALL ON SCHEMA public TO CURRENT_USER; GRANT ALL ON SCHEMA public TO PUBLIC;'
docker cp $dumpPath eqm-postgres:/tmp/equipment_crm_deploy.sql
docker compose --env-file $envFile -f $composeFile exec -T postgres psql -v ON_ERROR_STOP=1 -U equipment_user -d equipment_crm -f /tmp/equipment_crm_deploy.sql

Wait-ForContainerHealth -ContainerName "eqm-postgres"
docker compose --env-file $envFile -f $composeFile up -d backend frontend

Wait-ForHttpOk -Url "http://127.0.0.1:$BackendPort/health"
Wait-ForHttpOk -Url "http://127.0.0.1:$BackendPort/docs"
Wait-ForHttpOk -Url "http://127.0.0.1:$FrontendPort/"

$health = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/health" -TimeoutSec 10
$docsStatus = (Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/docs" -UseBasicParsing -TimeoutSec 10).StatusCode
$frontendStatus = (Invoke-WebRequest -Uri "http://127.0.0.1:$FrontendPort/" -UseBasicParsing -TimeoutSec 10).StatusCode
$loginPayload = @{
    username = "admin"
    password = $AdminPassword
} | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$BackendPort/api/v1/auth/login" -ContentType "application/json" -Body $loginPayload -TimeoutSec 15

$fileIdOutput = docker compose --env-file $envFile -f $composeFile exec -T postgres psql -U equipment_user -d equipment_crm -t -A -c "select id from cabinet_files where is_deleted = false order by id limit 1"
$fileId = ($fileIdOutput | Out-String).Trim()
if (-not $fileId) {
    $sampleCabinetFile = Get-ChildItem -LiteralPath $dirs.CabinetFiles -File | Select-Object -First 1
    if ($sampleCabinetFile) {
        $cabinetId = ((docker compose --env-file $envFile -f $composeFile exec -T postgres psql -U equipment_user -d equipment_crm -t -A -c "select id from cabinets where is_deleted = false order by id limit 1") | Out-String).Trim()
        $adminUserId = ((docker compose --env-file $envFile -f $composeFile exec -T postgres psql -U equipment_user -d equipment_crm -t -A -c "select id from users where username = 'admin' limit 1") | Out-String).Trim()
        if ($cabinetId -and $adminUserId) {
            $escapedOriginalName = $sampleCabinetFile.Name.Replace("'", "''")
            $escapedStoredName = $sampleCabinetFile.Name.Replace("'", "''")
            $insertSql = @"
insert into cabinet_files (cabinet_id, original_name, stored_name, ext, size_bytes, mime, created_by_id)
values ($cabinetId, '$escapedOriginalName', '$escapedStoredName', 'pdf', $($sampleCabinetFile.Length), 'application/pdf', $adminUserId)
returning id;
"@
            $insertOutput = (docker compose --env-file $envFile -f $composeFile exec -T postgres psql -U equipment_user -d equipment_crm -q -t -A -c $insertSql) | Out-String
            $insertedIdMatch = [regex]::Match($insertOutput, "\d+")
            if ($insertedIdMatch.Success) {
                $fileId = $insertedIdMatch.Value
            }
        }
    }
}

$fileStatus = $null
if ($fileId) {
    $fileHeaders = @{ Authorization = "Bearer $($login.access_token)" }
    $fileStatus = (Invoke-WebRequest -Headers $fileHeaders -Uri "http://127.0.0.1:$BackendPort/api/v1/cabinet-files/$fileId/download" -UseBasicParsing -TimeoutSec 20).StatusCode
}

$equipmentTypesCount = (docker compose --env-file $envFile -f $composeFile exec -T postgres psql -U equipment_user -d equipment_crm -t -A -c "select count(*) from equipment_types").Trim()
$auditLogsCount = (docker compose --env-file $envFile -f $composeFile exec -T postgres psql -U equipment_user -d equipment_crm -t -A -c "select count(*) from audit_logs").Trim()
$composePs = docker compose --env-file $envFile -f $composeFile ps

Write-Host "Validation succeeded."
Write-Host "Compose file: $composeFile"
Write-Host "Validation env: $envFile"
Write-Host "Health version: $($health.version)"
Write-Host "Docs status: $docsStatus"
Write-Host "Frontend status: $frontendStatus"
Write-Host "Admin login user: $($login.user.username)"
Write-Host "Cabinet file download status: $fileStatus"
Write-Host "equipment_types rows: $equipmentTypesCount"
Write-Host "audit_logs rows: $auditLogsCount"
Write-Host ""
Write-Host $composePs
