$ErrorActionPreference = "Stop"

function Get-EqmRoot {
    return $PSScriptRoot
}

function Get-EqmVenvPython {
    $python = Join-Path (Get-EqmRoot) ".venv\Scripts\python.exe"
    if (-not (Test-Path $python)) {
        throw "Virtual environment not found at $python. Create it first with: python -m venv .venv"
    }
    return $python
}

function Get-EqmPostgresDataDir {
    $dataDir = Join-Path (Get-EqmRoot) ".postgres\data"
    if (-not (Test-Path $dataDir)) {
        throw "PostgreSQL data directory not found at $dataDir. Restore the local cluster into .postgres\\data first."
    }
    return $dataDir
}

function Get-EqmPostgresLogFile {
    return (Join-Path (Get-EqmRoot) ".postgres\postgres.log")
}

function Get-RequiredCommand([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required command '$Name' was not found in PATH. Install PostgreSQL tools or add them to PATH."
    }
    return $command.Source
}

function Test-PortOpen([string]$TargetHost, [int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($TargetHost, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(800)) {
            return $false
        }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Get-ListeningConnection([int]$Port) {
    return Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
}

function Get-ProcessByIdSafe([int]$ProcessId) {
    return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

function Get-ConflictingProcesses([string[]]$Patterns) {
    $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
    $matches = @()
    foreach ($process in $processes) {
        foreach ($pattern in $Patterns) {
            if ($process.CommandLine -like $pattern) {
                $matches += $process
                break
            }
        }
    }
    return $matches
}

function Stop-ProcessesByPatterns([string[]]$Patterns) {
    $processes = Get-ConflictingProcesses -Patterns $Patterns
    foreach ($process in $processes) {
        if ($process.ProcessId -ne $PID) {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Assert-PortFree([int]$Port, [string]$ServiceName) {
    $connection = Get-ListeningConnection -Port $Port
    if (-not $connection) {
        return
    }

    $process = Get-ProcessByIdSafe -ProcessId $connection.OwningProcess
    $path = if ($process) { $process.ExecutablePath } else { "unknown" }
    $commandLine = if ($process) { $process.CommandLine } else { "unknown" }
    throw "$ServiceName could not start because port $Port is already in use by PID $($connection.OwningProcess): $path :: $commandLine"
}

function Wait-PortFree([int]$Port, [int]$Attempts = 20) {
    for ($i = 0; $i -lt $Attempts; $i++) {
        if (-not (Get-ListeningConnection -Port $Port)) {
            return
        }
        Start-Sleep -Milliseconds 300
    }
}

function Stop-ListeningProcessIfMatches([int]$Port, [string[]]$Patterns) {
    $connection = Get-ListeningConnection -Port $Port
    if (-not $connection) {
        return
    }

    $process = Get-ProcessByIdSafe -ProcessId $connection.OwningProcess
    if (-not $process) {
        return
    }

    foreach ($pattern in $Patterns) {
        if ($process.CommandLine -like $pattern) {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
            Wait-PortFree -Port $Port
            return
        }
    }
}

function Ensure-LocalPostgresStarted {
    $pgCtl = Get-RequiredCommand -Name "pg_ctl"
    $dataDir = Get-EqmPostgresDataDir
    $logFile = Get-EqmPostgresLogFile

    & $pgCtl -D $dataDir status *> $null
    if ($LASTEXITCODE -eq 0) {
        return
    }

    $portConflict = Get-ListeningConnection -Port 5432
    if ($portConflict) {
        $process = Get-ProcessByIdSafe -ProcessId $portConflict.OwningProcess
        throw "Port 5432 is already in use by PID $($portConflict.OwningProcess): $($process.CommandLine). Stop that process or use the EQM local cluster."
    }

    & $pgCtl -D $dataDir -l $logFile start
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start PostgreSQL from $dataDir. Check $logFile for details."
    }

    for ($i = 0; $i -lt 20; $i++) {
        if (Test-PortOpen -TargetHost "127.0.0.1" -Port 5432) {
            return
        }
        Start-Sleep -Milliseconds 500
    }

    throw "PostgreSQL did not become reachable on localhost:5432. Check $(Get-EqmPostgresLogFile)."
}

function Stop-LocalPostgres {
    $pgCtl = Get-RequiredCommand -Name "pg_ctl"
    $dataDir = Get-EqmPostgresDataDir
    & $pgCtl -D $dataDir status *> $null
    if ($LASTEXITCODE -ne 0) {
        return
    }
    & $pgCtl -D $dataDir stop -m fast
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to stop PostgreSQL for data dir $dataDir."
    }
}

function Start-EqmBackendProcess {
    Ensure-LocalPostgresStarted
    Stop-ProcessesByPatterns -Patterns @("*uvicorn app.main:app*--port 8000*")
    Stop-ListeningProcessIfMatches -Port 8000 -Patterns @("*uvicorn app.main:app*", "*python.exe*uvicorn app.main:app*")
    Start-Sleep -Milliseconds 400
    if ((Get-ListeningConnection -Port 8000) -and (Test-HttpOk -Url "http://127.0.0.1:8000/docs")) {
        return [pscustomobject]@{
            Id = "existing"
            Status = "existing"
            Url = "http://127.0.0.1:8000/docs"
        }
    }
    Assert-PortFree -Port 8000 -ServiceName "EQM backend"

    $python = Get-EqmVenvPython
    $backendDir = Join-Path (Get-EqmRoot) "backend"
    $stdout = Join-Path (Get-EqmRoot) "backend.log"
    $stderr = Join-Path (Get-EqmRoot) "backend.err.log"

    return Start-Process -FilePath $python `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000" `
        -WorkingDirectory $backendDir `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru
}

function Start-EqmFrontendProcess {
    Stop-ProcessesByPatterns -Patterns @("*npm*run dev*--port 5173*", "*vite*--host 127.0.0.1 --port 5173*")
    Stop-ListeningProcessIfMatches -Port 5173 -Patterns @("*npm*run dev*", "*vite*", "*node.exe*vite*")
    Start-Sleep -Milliseconds 400
    if ((Get-ListeningConnection -Port 5173) -and (Test-HttpOk -Url "http://127.0.0.1:5173")) {
        return [pscustomobject]@{
            Id = "existing"
            Status = "existing"
            Url = "http://127.0.0.1:5173"
        }
    }
    Assert-PortFree -Port 5173 -ServiceName "EQM frontend"

    $frontendDir = Join-Path (Get-EqmRoot) "frontend"
    $stdout = Join-Path (Get-EqmRoot) "frontend.log"
    $stderr = Join-Path (Get-EqmRoot) "frontend.err.log"

    return Start-Process -FilePath "npm.cmd" `
        -ArgumentList "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173" `
        -WorkingDirectory $frontendDir `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru
}

function Wait-HttpOk([string]$Url, [int]$Attempts = 30) {
    for ($i = 0; $i -lt $Attempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return
            }
        } catch {
        }
        Start-Sleep -Seconds 1
    }
    throw "Timed out waiting for $Url"
}

function Test-HttpOk([string]$Url) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    } catch {
        return $false
    }
}

function Wait-PortOpen([string]$TargetHost, [int]$Port, [int]$Attempts = 30) {
    for ($i = 0; $i -lt $Attempts; $i++) {
        if (Test-PortOpen -TargetHost $TargetHost -Port $Port) {
            return
        }
        Start-Sleep -Seconds 1
    }
    throw "Timed out waiting for $TargetHost`:$Port"
}

function Stop-EqmBackendProcesses {
    Stop-ProcessesByPatterns -Patterns @("*uvicorn app.main:app*--port 8000*")
    Stop-ListeningProcessIfMatches -Port 8000 -Patterns @("*uvicorn app.main:app*", "*python.exe*uvicorn app.main:app*")
}

function Stop-EqmFrontendProcesses {
    Stop-ProcessesByPatterns -Patterns @("*npm*run dev*--port 5173*", "*vite*--host 127.0.0.1 --port 5173*")
    Stop-ListeningProcessIfMatches -Port 5173 -Patterns @("*npm*run dev*", "*vite*", "*node.exe*vite*")
}
