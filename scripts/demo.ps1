$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$logDir = Join-Path $root ".demo-logs"
New-Item -ItemType Directory -Force $logDir | Out-Null

$apiOut = Join-Path $logDir "api.out.log"
$apiErr = Join-Path $logDir "api.err.log"

$webOut = Join-Path $logDir "web.out.log"
$webErr = Join-Path $logDir "web.err.log"

$simOut = Join-Path $logDir "simulator.out.log"
$simErr = Join-Path $logDir "simulator.err.log"

$apiProcess = $null
$webProcess = $null
$simProcess = $null


function Write-Step {
    param(
        [string]$Message,
        [ConsoleColor]$Color = "Cyan"
    )

    Write-Host ""
    Write-Host ">> $Message" -ForegroundColor $Color
}


function Test-Endpoint {
    param(
        [string]$Url
    )

    try {
        Invoke-RestMethod `
            -Uri $Url `
            -Method Get `
            -TimeoutSec 3 `
            -ErrorAction Stop |
            Out-Null

        return $true
    }
    catch {
        return $false
    }
}


function Wait-ForEndpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )

    for ($i = 1; $i -le $TimeoutSeconds; $i++) {

        if (Test-Endpoint $Url) {
            Write-Host "[OK] $Name" -ForegroundColor Green
            return $true
        }

        Start-Sleep -Seconds 1
    }

    Write-Host "[FAILED] $Name" -ForegroundColor Red
    return $false
}


function Kill-ProcessTree {
    param(
        $Process
    )

    if ($null -eq $Process) {
        return
    }

    try {
        if (-not $Process.HasExited) {
            & taskkill `
                /PID $Process.Id `
                /T `
                /F `
                2>$null |
                Out-Null
        }
    }
    catch {
    }
}


function Stop-PortOwner {
    param(
        [int]$Port
    )

    try {
        $owners =
            Get-NetTCPConnection `
                -LocalPort $Port `
                -State Listen `
                -ErrorAction SilentlyContinue |
            Select-Object `
                -ExpandProperty OwningProcess `
                -Unique

        foreach ($owner in $owners) {

            if (
                $owner -and
                $owner -ne $PID
            ) {
                Write-Host `
                    "Stopping old process on port $Port..."

                & taskkill `
                    /PID $owner `
                    /T `
                    /F `
                    2>$null |
                    Out-Null
            }
        }
    }
    catch {
    }
}


function Start-ManagedProcess {
    param(
        [string]$Name,
        [string]$Command,
        [string]$StdOut,
        [string]$StdErr
    )

    if (Test-Path $StdOut) {
        Remove-Item $StdOut -Force
    }

    if (Test-Path $StdErr) {
        Remove-Item $StdErr -Force
    }

    Write-Host "Starting $Name..."

    $arguments =
        "/d /s /c `"$Command`""

    return Start-Process `
        -FilePath "cmd.exe" `
        -ArgumentList $arguments `
        -WorkingDirectory $root `
        -WindowStyle Hidden `
        -RedirectStandardOutput $StdOut `
        -RedirectStandardError $StdErr `
        -PassThru
}


function Show-ServiceError {
    param(
        [string]$Name,
        [string]$LogFile
    )

    Write-Host ""
    Write-Host "$Name log:" -ForegroundColor Red

    if (Test-Path $LogFile) {
        Get-Content $LogFile -Tail 30
    }
}


try {

    Write-Host ""
    Write-Host "==============================================" `
        -ForegroundColor DarkGray

    Write-Host "              DRIVEPULSE DEMO" `
        -ForegroundColor White

    Write-Host "==============================================" `
        -ForegroundColor DarkGray


    # -----------------------------------------------------
    # Docker
    # -----------------------------------------------------

    $dockerPath =
        "C:\Program Files\Docker\Docker\resources\bin"

    if (
        Test-Path $dockerPath
    ) {
        $env:Path += ";$dockerPath"
    }


    Write-Step "Checking Docker"

    # Use cmd.exe here so an unavailable Docker daemon does
    # not trigger PowerShell's terminating error handling.
    & cmd.exe /d /s /c "docker info >nul 2>&1"

    $dockerReady =
        ($LASTEXITCODE -eq 0)

    if (-not $dockerReady) {

        Write-Host `
            "Docker is not running. Starting Docker Desktop..." `
            -ForegroundColor Yellow

        $dockerDesktop =
            "C:\Program Files\Docker\Docker\Docker Desktop.exe"

        if (-not (Test-Path $dockerDesktop)) {
            throw "Docker Desktop could not be found."
        }

        Start-Process `
            -FilePath $dockerDesktop

        Write-Host `
            "Waiting for Docker Desktop to become ready..."

        for ($i = 1; $i -le 60; $i++) {

            Start-Sleep -Seconds 2

            & cmd.exe /d /s /c `
                "docker info >nul 2>&1"

            if ($LASTEXITCODE -eq 0) {
                $dockerReady = $true
                break
            }

            if ($i % 5 -eq 0) {
                Write-Host `
                    "Still waiting for Docker... ($($i * 2)s)"
            }
        }
    }

    if (-not $dockerReady) {
        throw "Docker Desktop did not become ready after 120 seconds."
    }

    Write-Host "[OK] Docker" -ForegroundColor Green


    # -----------------------------------------------------
    # Infrastructure
    # -----------------------------------------------------

    Write-Step "Starting PostgreSQL and MQTT"

    & docker compose up -d

    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed."
    }


    $databaseReady = $false

    for ($i = 1; $i -le 30; $i++) {

        $health =
            & docker inspect `
                --format "{{.State.Health.Status}}" `
                drivepulse-postgres `
                2>$null

        if ($health -eq "healthy") {
            $databaseReady = $true
            break
        }

        Start-Sleep -Seconds 1
    }

    if (-not $databaseReady) {
        throw "PostgreSQL did not become healthy."
    }

    Write-Host "[OK] PostgreSQL" -ForegroundColor Green

    $mqttReady = $false

    for ($i = 1; $i -le 30; $i++) {

        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", 1883)
            $tcp.Close()

            $mqttReady = $true
            break
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }

    if (-not $mqttReady) {
        throw "MQTT broker did not become ready on port 1883."
    }

    Write-Host "[OK] MQTT" -ForegroundColor Green


    # -----------------------------------------------------
    # Clean old app processes
    # -----------------------------------------------------

    Write-Step "Cleaning previous DrivePulse processes"

    Stop-PortOwner 3000
    Stop-PortOwner 3010
    Stop-PortOwner 5173

    Start-Sleep -Seconds 2


    # -----------------------------------------------------
    # API
    # -----------------------------------------------------

    Write-Step "Starting DrivePulse API"

    $apiProcess =
        Start-ManagedProcess `
            "API" `
            "npm run dev:api" `
            $apiOut `
            $apiErr


    if (
        -not (
            Wait-ForEndpoint `
                "API" `
                "http://localhost:3000/health" `
                30
        )
    ) {
        Show-ServiceError "API" $apiErr
        throw "DrivePulse API failed to start."
    }


    if (
        -not (
            Wait-ForEndpoint `
                "Database connection" `
                "http://localhost:3000/health/database" `
                15
        )
    ) {
        throw "API started but database health check failed."
    }


    # -----------------------------------------------------
    # Simulator service
    # -----------------------------------------------------

    Write-Step "Starting simulator service"

    if (Test-Path $simOut) {
        Remove-Item $simOut -Force
    }

    if (Test-Path $simErr) {
        Remove-Item $simErr -Force
    }

    $pythonPath =
        Join-Path $root "apps\simulator\.venv\Scripts\python.exe"

    $servicePath =
        Join-Path $root "apps\simulator\service.py"

    Write-Host "Starting Simulator..."

    $simProcess =
        Start-Process `
            -FilePath $pythonPath `
            -ArgumentList "-u", "`"$servicePath`"" `
            -WorkingDirectory $root `
            -WindowStyle Hidden `
            -RedirectStandardOutput $simOut `
            -RedirectStandardError $simErr `
            -PassThru


    if (
        -not (
            Wait-ForEndpoint `
                "Simulator" `
                "http://localhost:3010/health" `
                20
        )
    ) {
        Show-ServiceError "Simulator" $simErr
        throw "Simulator service failed to start."
    }


    # -----------------------------------------------------
    # Frontend
    # -----------------------------------------------------

    Write-Step "Starting DrivePulse interface"

    $webProcess =
        Start-ManagedProcess `
            "Web" `
            "npm run dev:web" `
            $webOut `
            $webErr


    if (
        -not (
            Wait-ForEndpoint `
                "Web interface" `
                "http://localhost:5173" `
                30
        )
    ) {
        Show-ServiceError "Web" $webErr
        throw "DrivePulse web interface failed to start."
    }


    # -----------------------------------------------------
    # Ready
    # -----------------------------------------------------

    Write-Host ""
    Write-Host "==============================================" `
        -ForegroundColor Green

    Write-Host "           DRIVEPULSE DEMO READY" `
        -ForegroundColor Green

    Write-Host "==============================================" `
        -ForegroundColor Green

    Write-Host ""
    Write-Host "Web        http://localhost:5173" `
        -ForegroundColor White

    Write-Host "API        HEALTHY" `
        -ForegroundColor Green

    Write-Host "Database   HEALTHY" `
        -ForegroundColor Green

    Write-Host "MQTT       RUNNING" `
        -ForegroundColor Green

    Write-Host "Simulator  HEALTHY" `
        -ForegroundColor Green

    Write-Host ""
    Write-Host "DrivePulse is being monitored."
    Write-Host "If a service fails it will be restarted."
    Write-Host ""
    Write-Host "Press Ctrl+C when the demo is finished." `
        -ForegroundColor DarkGray

    Start-Process "http://localhost:5173"


    # -----------------------------------------------------
    # Supervisor
    # -----------------------------------------------------

    $apiFailures = 0
    $simFailures = 0
    $webFailures = 0


    while ($true) {

        Start-Sleep -Seconds 5


        # API monitoring

        if (
            Test-Endpoint `
                "http://localhost:3000/health"
        ) {
            $apiFailures = 0
        }
        else {
            $apiFailures++
        }


        if ($apiFailures -ge 2) {

            Write-Host ""
            Write-Host `
                "[RECOVERY] API became unavailable. Restarting..." `
                -ForegroundColor Yellow

            Kill-ProcessTree $apiProcess

            Start-Sleep -Seconds 1

            $apiProcess =
                Start-ManagedProcess `
                    "API" `
                    "npm run dev:api" `
                    $apiOut `
                    $apiErr

            if (
                Wait-ForEndpoint `
                    "API recovered" `
                    "http://localhost:3000/health" `
                    30
            ) {
                Write-Host `
                    "[RECOVERED] API is healthy again." `
                    -ForegroundColor Green
            }
            else {
                Show-ServiceError "API" $apiErr
            }

            $apiFailures = 0
        }


        # Simulator monitoring

        if (
            Test-Endpoint `
                "http://localhost:3010/health"
        ) {
            $simFailures = 0
        }
        else {
            $simFailures++
        }


        if ($simFailures -ge 2) {

            Write-Host ""
            Write-Host `
                "[RECOVERY] Simulator became unavailable. Restarting..." `
                -ForegroundColor Yellow

            Kill-ProcessTree $simProcess

            Start-Sleep -Seconds 1

            $simProcess =
                Start-Process `
                    -FilePath $pythonPath `
                    -ArgumentList "-u", "`"$servicePath`"" `
                    -WorkingDirectory $root `
                    -WindowStyle Hidden `
                    -RedirectStandardOutput $simOut `
                    -RedirectStandardError $simErr `
                    -PassThru

            Wait-ForEndpoint `
                "Simulator recovered" `
                "http://localhost:3010/health" `
                20 |
                Out-Null

            $simFailures = 0
        }


        # Frontend monitoring

        if (
            Test-Endpoint `
                "http://localhost:5173"
        ) {
            $webFailures = 0
        }
        else {
            $webFailures++
        }


        if ($webFailures -ge 2) {

            Write-Host ""
            Write-Host `
                "[RECOVERY] Web interface became unavailable. Restarting..." `
                -ForegroundColor Yellow

            Kill-ProcessTree $webProcess

            Start-Sleep -Seconds 1

            $webProcess =
                Start-ManagedProcess `
                    "Web" `
                    "npm run dev:web" `
                    $webOut `
                    $webErr

            Wait-ForEndpoint `
                "Web recovered" `
                "http://localhost:5173" `
                30 |
                Out-Null

            $webFailures = 0
        }
    }
}
catch {

    Write-Host ""
    Write-Host "DRIVEPULSE DEMO FAILED" `
        -ForegroundColor Red

    Write-Host $_.Exception.Message `
        -ForegroundColor Red

    Write-Host ""
    Write-Host "Logs are available in:"
    Write-Host $logDir `
        -ForegroundColor Yellow
}
finally {

    Write-Host ""
    Write-Host "Stopping DrivePulse demo processes..." `
        -ForegroundColor DarkGray

    Kill-ProcessTree $apiProcess
    Kill-ProcessTree $simProcess
    Kill-ProcessTree $webProcess
}