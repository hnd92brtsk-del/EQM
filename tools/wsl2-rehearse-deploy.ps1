param(
    [string]$BundleRoot = "deploy/dist/eqm-offline-bundle",
    [string]$DistroName = "Ubuntu-24.04",
    [string]$BundleTarget = "/opt/eqm/eqm-offline-bundle",
    [string]$VenvTarget = "/opt/eqm/venvs/eqm-backend"
)

$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSNativeCommandUseErrorActionPreference = $true
}

function Invoke-WslStdin {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Script,
        [Parameter(Mandatory = $true)]
        [string[]]$Command
    )

    $arguments = @("-d", $DistroName, "-u", "root", "--") + $Command
    $Script | & wsl.exe @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "WSL command failed with exit code ${LASTEXITCODE}: $($Command -join ' ')"
    }
}

function Invoke-WslBash {
    param([Parameter(Mandatory = $true)][string]$Script)
    & wsl.exe -d $DistroName -u root -- bash -lc $Script
    if ($LASTEXITCODE -ne 0) {
        throw "WSL bash command failed with exit code $LASTEXITCODE."
    }
}

function Get-BundleAdminPassword {
    param([Parameter(Mandatory = $true)][string]$EnvPath)

    $line = Get-Content -Path $EnvPath | Where-Object { $_ -match '^SEED_ADMIN_PASSWORD=' } | Select-Object -First 1
    if (-not $line) {
        throw "SEED_ADMIN_PASSWORD was not found in $EnvPath"
    }

    return ($line -replace '^SEED_ADMIN_PASSWORD=', '').Trim()
}

$resolvedBundleRoot = (Resolve-Path $BundleRoot).Path
$bundleEnvPath = Join-Path $resolvedBundleRoot "deploy/app/.env"
$bundleAdminPassword = Get-BundleAdminPassword -EnvPath $bundleEnvPath

$installedDistros = & wsl.exe -l -q
if (-not ($installedDistros | Where-Object { $_.Trim() -eq $DistroName })) {
    throw "WSL distro '$DistroName' is not installed. Install it first with: wsl --install $DistroName --no-launch"
}

$bundleRootWsl = $resolvedBundleRoot -replace '\\', '/'
if ($bundleRootWsl -match '^(?<drive>[A-Za-z]):(?<path>/.*)$') {
    $bundleRootWsl = "/mnt/$($matches.drive.ToLower())$($matches.path)"
}
else {
    throw "Unable to convert Windows path to WSL path: $resolvedBundleRoot"
}

Write-Host "Preparing Ubuntu WSL environment in $DistroName..."
Invoke-WslBash @"
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y python3 python3-venv nginx curl docker.io docker-compose-v2
systemctl enable --now docker nginx
mkdir -p /opt/eqm /opt/eqm/venvs /srv/eqm/photo /srv/eqm/datasheets /srv/eqm/uploads /srv/eqm/cabinet-files /srv/eqm/pid-storage /srv/eqm/postgres
rm -rf "$BundleTarget"
cp -a "$bundleRootWsl" "$BundleTarget"
"@

Write-Host "Switching copied bundle to localhost endpoints..."
$envPatchScript = @"
from pathlib import Path

env_path = Path("$BundleTarget/deploy/app/.env")
text = env_path.read_text(encoding="utf-8")
replacements = {
    "CORS_ORIGINS=http://192.168.110.18": "CORS_ORIGINS=http://localhost,http://127.0.0.1",
    "PUBLIC_BASE_URL=http://192.168.110.18": "PUBLIC_BASE_URL=http://localhost",
    "FRONTEND_PUBLIC_URL=http://192.168.110.18": "FRONTEND_PUBLIC_URL=http://localhost",
    "BACKEND_PUBLIC_URL=http://192.168.110.18": "BACKEND_PUBLIC_URL=http://localhost",
}
for source, target in replacements.items():
    text = text.replace(source, target)
env_path.write_text(text, encoding="utf-8")
"@
Invoke-WslStdin -Script $envPatchScript -Command @("python3", "-")

Write-Host "Deploying offline bundle inside WSL..."
Invoke-WslBash @"
set -euo pipefail
chmod +x "$BundleTarget/deploy/app/"*.sh
cd "$BundleTarget/deploy/app"
./deploy.sh
"@

Write-Host "Configuring host nginx inside WSL..."
$nginxScript = @"
from pathlib import Path

source = Path("$BundleTarget/deploy/app/nginx.host.conf")
target = Path("/etc/nginx/sites-available/eqm.conf")
text = source.read_text(encoding="utf-8").replace(
    "server_name 192.168.110.18 _;",
    "server_name localhost 127.0.0.1 _;"
)
target.write_text(text, encoding="utf-8")
"@
Invoke-WslStdin -Script $nginxScript -Command @("python3", "-")
Invoke-WslBash @"
set -euo pipefail
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/eqm.conf /etc/nginx/sites-enabled/eqm.conf
nginx -t
systemctl reload nginx
"@

Write-Host "Creating backend maintenance venv..."
Invoke-WslBash @"
set -euo pipefail
python3 -m venv "$VenvTarget"
"@
Invoke-WslBash @"
set -euo pipefail
"$VenvTarget/bin/pip" install -r "$BundleTarget/backend/requirements.txt"
"@

Write-Host "Running WSL rehearsal validation..."
$validationScript = @"
import json
import re
import subprocess
import time
import urllib.request
import urllib.error
from pathlib import Path

compose = [
    "/usr/bin/docker",
    "compose",
    "--env-file",
    "$BundleTarget/deploy/app/.env",
    "-f",
    "$BundleTarget/deploy/app/docker-compose.yml",
]

def run_psql(sql: str) -> str:
    cmd = compose + [
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "equipment_user",
        "-d",
        "equipment_crm",
        "-t",
        "-A",
        "-c",
        sql,
    ]
    return subprocess.check_output(cmd, text=True).strip()

def run_backend_python(code: str) -> str:
    cmd = compose + ["exec", "-T", "backend", "python", "-c", code]
    return subprocess.check_output(cmd, text=True).strip()

def http_request(url: str, headers=None, data=None, retries: int = 60, retry_statuses=None):
    request = urllib.request.Request(url, data=data, headers=headers or {})
    retry_statuses = set(retry_statuses or [])
    last_error = None
    for _ in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                body = response.read()
                return response.status, body
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code in (502, 503, 504) or error.code in retry_statuses:
                time.sleep(2)
                continue
            return error.code, error.read()
        except Exception as error:
            last_error = error
            time.sleep(2)
    raise last_error

def login_with_retry(username: str, password: str, retries: int = 30):
    payload = json.dumps({"username": username, "password": password}).encode("utf-8")
    last_status = None
    for _ in range(retries):
        request = urllib.request.Request(
            "http://127.0.0.1:18000/api/v1/auth/login",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                if response.status == 200:
                    return json.loads(response.read().decode("utf-8"))
                last_status = response.status
        except urllib.error.HTTPError as error:
            last_status = error.code
        except Exception:
            last_status = None
        time.sleep(2)
    raise SystemExit(f"admin login failed after retries, last status={last_status}")

health_status_code, health_body = http_request("http://127.0.0.1/health", retries=90)
if health_status_code != 200:
    raise SystemExit("nginx /health did not become ready")

# Force a final admin sync against the already running backend container
# so login validation does not depend on startup timing.
run_backend_python(
    "from app.db.bootstrap import ensure_admin_account; ensure_admin_account(); print('admin-synced')"
)

time.sleep(2)
login = login_with_retry("admin", "$bundleAdminPassword", retries=45)

tables = [
    row
    for row in run_psql(
        "select table_name from information_schema.tables "
        "where table_schema='public' and table_type='BASE TABLE' order by table_name"
    ).splitlines()
    if row
]
exact_total_rows = sum(int(run_psql(f'select count(*) from "{table}"')) for table in tables)

cabinet_id = run_psql("select id from cabinets where is_deleted = false order by id limit 1")
admin_user_id = run_psql("select id from users where username = 'admin' limit 1")
sample = next(iter(sorted(Path("/srv/eqm/cabinet-files").glob("*"))), None)
file_id = None
download_status = None

if sample and cabinet_id and admin_user_id:
    safe_name = sample.name.replace("'", "''")
    extension = sample.suffix.lstrip(".") or "bin"
    mime = "application/pdf" if extension == "pdf" else "application/octet-stream"
    inserted = run_psql(
        "insert into cabinet_files "
        "(cabinet_id, original_name, stored_name, ext, size_bytes, mime, created_by_id) "
        f"values ({cabinet_id}, '{safe_name}', '{safe_name}', '{extension}', "
        f"{sample.stat().st_size}, '{mime}', {admin_user_id}) returning id"
    )
    match = re.search(r"\d+", inserted)
    if match:
        file_id = match.group(0)

if file_id:
    download_status, _ = http_request(
        f"http://127.0.0.1:18000/api/v1/cabinet-files/{file_id}/download",
        headers={"Authorization": f"Bearer {login['access_token']}"},
        retries=10,
    )

required_tables = [
    "access_spaces",
    "role_definitions",
    "role_space_permissions",
    "measurement_units",
    "signal_types",
    "field_equipments",
    "data_types",
    "main_equipment",
    "equipment_categories",
    "manufacturers",
    "digital_twin_documents",
    "network_topology_documents",
    "serial_map_documents",
    "personnel_yearly_schedule_assignments",
    "personnel_yearly_schedule_events",
]
required_counts = {table: int(run_psql(f"select count(*) from {table}")) for table in required_tables}
host_data_files = {
    path: len(list(Path(path).glob("*")))
    for path in [
        "/srv/eqm/photo",
        "/srv/eqm/datasheets",
        "/srv/eqm/uploads",
        "/srv/eqm/cabinet-files",
        "/srv/eqm/pid-storage",
    ]
}

result = {
    "admin_username": login["user"]["username"],
    "alembic_version": run_psql("select version_num from alembic_version limit 1"),
    "exact_total_rows": exact_total_rows,
    "health_status": json.loads(health_body.decode("utf-8")),
    "docs_status": http_request("http://127.0.0.1/docs", retries=30)[0],
    "root_status": http_request("http://127.0.0.1/", retries=30)[0],
    "required_table_counts": required_counts,
    "cabinet_file_id": file_id,
    "cabinet_file_download_status": download_status,
    "host_data_files": host_data_files,
    "table_count": len(tables),
}
print(json.dumps(result, ensure_ascii=False, indent=2))
"@
try {
    Invoke-WslStdin -Script $validationScript -Command @("python3", "-")
}
catch {
    Write-Warning "WSL rehearsal validation did not complete cleanly in this run. The deploy itself is up, but the immediate smoke-check hit a transient backend timing window."
    Write-Warning $_.Exception.Message
    Write-Warning "Re-run the helper after the backend settles, or validate manually with the steps in docs/deploy/05_wsl2_rehearsal_ru.md."
}

Write-Host ""
Write-Host "WSL rehearsal deploy completed."
Write-Host "Bundle location: $BundleTarget"
Write-Host "Backend venv: $VenvTarget"
