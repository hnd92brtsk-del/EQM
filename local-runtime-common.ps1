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

function Get-EqmRuntimeLogsRoot {
    return (Join-Path (Get-EqmRoot) "runtime-logs")
}

function Get-EqmRuntimeLogDir([string]$Service) {
    $dir = Join-Path (Get-EqmRuntimeLogsRoot) $Service
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    return $dir
}

function Remove-EqmOldRuntimeLogs([int]$RetentionHours = 24) {
    $root = Get-EqmRuntimeLogsRoot
    if (-not (Test-Path $root)) {
        return
    }

    $threshold = (Get-Date).AddHours(-$RetentionHours)
    Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $threshold } |
        ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }

    Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
        ForEach-Object {
            $lines = Get-Content $_.FullName -ErrorAction SilentlyContinue
            if ($null -ne $lines -and $lines.Count -gt 300) {
                try {
                    $lines | Select-Object -Last 300 | Set-Content $_.FullName -ErrorAction Stop
                } catch {
                    # Skip files locked by other local runtime processes (e.g. PostgreSQL logs).
                }
            }
        }
}

function Get-EqmRuntimeLogFile([string]$Service, [string]$Stream = "out") {
    $dir = Get-EqmRuntimeLogDir -Service $Service
    $dateStamp = Get-Date -Format "yyyy-MM-dd"
    $suffix = if ($Stream -eq "err") { "-err" } else { "" }
    return (Join-Path $dir "$Service$suffix-$dateStamp.log")
}

function Get-EqmPostgresLogFile {
    return (Get-EqmRuntimeLogFile -Service "postgres")
}

function Get-RequiredCommand([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required command '$Name' was not found in PATH. Install PostgreSQL tools or add them to PATH."
    }
    return $command.Source
}

function Test-PortOpen([string]$TargetHost, [int]$Port) {
    $candidates = New-Object System.Collections.Generic.List[System.Net.IPAddress]

    try {
        $parsed = $null
        if ([System.Net.IPAddress]::TryParse($TargetHost, [ref]$parsed)) {
            $candidates.Add($parsed) | Out-Null
        } else {
            foreach ($address in [System.Net.Dns]::GetHostAddresses($TargetHost)) {
                $candidates.Add($address) | Out-Null
            }
            if ($TargetHost -eq "localhost") {
                $candidates.Add([System.Net.IPAddress]::Loopback) | Out-Null
                $candidates.Add([System.Net.IPAddress]::IPv6Loopback) | Out-Null
            }
        }
    } catch {
        return $false
    }

    foreach ($address in ($candidates | Select-Object -Unique)) {
        $client = New-Object System.Net.Sockets.TcpClient($address.AddressFamily)
        try {
            $async = $client.BeginConnect($address, $Port, $null, $null)
            if (-not $async.AsyncWaitHandle.WaitOne(800)) {
                continue
            }
            $client.EndConnect($async)
            return $true
        } catch {
        } finally {
            $client.Dispose()
        }
    }

    return $false
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
    for ($i = 0; $i -lt 6; $i++) {
        $connection = Get-ListeningConnection -Port $Port
        if (-not $connection) {
            return
        }

        $process = Get-ProcessByIdSafe -ProcessId $connection.OwningProcess
        if ($process) {
            $path = $process.ExecutablePath
            $commandLine = $process.CommandLine
            throw "$ServiceName could not start because port $Port is already in use by PID $($connection.OwningProcess): $path :: $commandLine"
        }

        # Windows can briefly report a listening socket whose owning process is already gone.
        Start-Sleep -Milliseconds 500
    }
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

    # Uvicorn with --reload can leave the listening child process on the port while
    # the parent/reloader command line differs from the original pattern.
    if ($Port -eq 8000) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        Wait-PortFree -Port $Port
    }
}

function Ensure-LocalPostgresStarted {
    Remove-EqmOldRuntimeLogs
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
        if (Test-PortOpen -TargetHost "localhost" -Port 5432) {
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
    Remove-EqmOldRuntimeLogs
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
    $stdout = Get-EqmRuntimeLogFile -Service "backend" -Stream "out"
    $stderr = Get-EqmRuntimeLogFile -Service "backend" -Stream "err"

    return Start-Process -FilePath $python `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000" `
        -WorkingDirectory $backendDir `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru
}

function Start-EqmFrontendProcess {
    Remove-EqmOldRuntimeLogs
    Stop-ProcessesByPatterns -Patterns @("*npm*run dev*--port 5173*", "*vite*--host * --port 5173*")
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
    $stdout = Get-EqmRuntimeLogFile -Service "frontend" -Stream "out"
    $stderr = Get-EqmRuntimeLogFile -Service "frontend" -Stream "err"

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
    Stop-ProcessesByPatterns -Patterns @(
        "*uvicorn app.main:app*--port 8000*",
        "*-m uvicorn app.main:app*--port 8000*",
        "*multiprocessing-fork*parent_pid=*"
    )
    Stop-ListeningProcessIfMatches -Port 8000 -Patterns @(
        "*uvicorn app.main:app*",
        "*-m uvicorn app.main:app*",
        "*python.exe*uvicorn app.main:app*",
        "*multiprocessing-fork*"
    )

    if (Get-ListeningConnection -Port 8000) {
        $forkChildren = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq "python.exe" -and $_.CommandLine -like "*multiprocessing-fork*" }
        foreach ($process in $forkChildren) {
            if ($process.ProcessId -ne $PID) {
                Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
            }
        }
    }

    Wait-PortFree -Port 8000
}

function Stop-EqmFrontendProcesses {
    Stop-ProcessesByPatterns -Patterns @("*npm*run dev*--port 5173*", "*vite*--host * --port 5173*")
    Stop-ListeningProcessIfMatches -Port 5173 -Patterns @("*npm*run dev*", "*vite*", "*node.exe*vite*")
}
