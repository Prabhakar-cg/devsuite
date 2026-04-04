# Exit immediately if a command exits with a non-zero status
$ErrorActionPreference = "Stop"

Write-Host "Starting setup for Local dev suite..."

# ---------------------------------------------------------------------------
# Helper: check if a command exists
# ---------------------------------------------------------------------------
function Command-Exists {
    param([string]$cmd)
    return $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

# ---------------------------------------------------------------------------
# Helper: ask for user permission
# ---------------------------------------------------------------------------
function Ask-Permission {
    param([string]$prompt)
    $reply = Read-Host "$prompt (y/N)"
    return $reply -match '^[Yy]$'
}

# ---------------------------------------------------------------------------
# Detect package manager (winget > choco > scoop)
# ---------------------------------------------------------------------------
$PKG_MGR = "unknown"
if (Command-Exists winget)  { $PKG_MGR = "winget" }
elseif (Command-Exists choco) { $PKG_MGR = "choco"  }
elseif (Command-Exists scoop) { $PKG_MGR = "scoop"  }

Write-Host "Detected OS: Windows"
if ($PKG_MGR -ne "unknown") {
    Write-Host "Detected Package Manager: $PKG_MGR"
}

# ---------------------------------------------------------------------------
# Determine python command
# ---------------------------------------------------------------------------
$PYTHON_CMD = $null
foreach ($candidate in @("python", "python3", "py")) {
    if (Command-Exists $candidate) {
        $ver = & $candidate -c "import sys; print(sys.version_info.major)" 2>$null
        if ($ver -eq "3") { $PYTHON_CMD = $candidate; break }
    }
}
if (-not $PYTHON_CMD) { $PYTHON_CMD = "python" }   # will be installed if missing

$VENV_ACTIVATE = ".venv\Scripts\Activate.ps1"

# ---------------------------------------------------------------------------
# Collect missing prerequisites
# ---------------------------------------------------------------------------
$missingSoftware = @()

# Packages indexed per manager: [winget, choco, scoop]
$missingPkgs = @()

function Queue-Installation {
    param(
        [string]$softName,
        [string]$wingetId,
        [string]$chocoPkg,
        [string]$scoopPkg
    )
    $script:missingSoftware += $softName
    switch ($script:PKG_MGR) {
        "winget" { $script:missingPkgs += @{ id = $wingetId } }
        "choco"  { $script:missingPkgs += @{ id = $chocoPkg } }
        "scoop"  { $script:missingPkgs += @{ id = $scoopPkg } }
    }
}

Write-Host -NoNewline "Checking core system prerequisites... "

# Check Python
$pythonOk = $false
if (Command-Exists $PYTHON_CMD) {
    $venvOk = & $PYTHON_CMD -m venv --help 2>$null
    if ($LASTEXITCODE -eq 0) { $pythonOk = $true }
}
if (-not $pythonOk) {
    Queue-Installation "Python 3" "Python.Python.3" "python" "python"
}

# Check Node.js / npm
if (-not (Command-Exists node) -or -not (Command-Exists npm)) {
    Queue-Installation "Node.js & npm" "OpenJS.NodeJS" "nodejs" "nodejs"
}

if ($missingPkgs.Count -gt 0) {
    Write-Host "Missing dependencies detected.`n`nThe following system dependencies are missing and need to be installed:"
    $missingSoftware | ForEach-Object { Write-Host "- $_" }
    Write-Host ""

    if ($PKG_MGR -eq "unknown") {
        Write-Host "Could not detect a supported package manager. Please install the above software manually."
        exit 1
    }

    if (Ask-Permission "Do you want to automatically install them using $PKG_MGR?") {
        foreach ($pkg in $missingPkgs) {
            $id = $pkg.id
            Write-Host "Installing: $id"
            switch ($PKG_MGR) {
                "winget" {
                    winget install --exact --id $id --accept-package-agreements --accept-source-agreements
                    if ($LASTEXITCODE -ne 0) {
                        Write-Host "Error: winget failed to install '$id' (exit code $LASTEXITCODE)."
                        exit 1
                    }
                }
                "choco" {
                    # Chocolatey requires an elevated session
                    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
                        [Security.Principal.WindowsBuiltInRole]::Administrator)
                    if (-not $isAdmin) {
                        Write-Host "Error: Chocolatey requires an elevated (Administrator) PowerShell session."
                        Write-Host "To retry, open PowerShell as Administrator and run:"
                        Write-Host "  .\start.ps1"
                        exit 1
                    }
                    choco install -y $id
                    if ($LASTEXITCODE -ne 0) {
                        Write-Host "Error: choco failed to install '$id' (exit code $LASTEXITCODE)."
                        exit 1
                    }
                }
                "scoop" {
                    scoop install $id
                    if ($LASTEXITCODE -ne 0) {
                        Write-Host "Error: scoop failed to install '$id' (exit code $LASTEXITCODE)."
                        exit 1
                    }
                }
            }
        }

        # Refresh PATH so newly installed tools are visible
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path", "User")

        # Re-resolve python command after potential installation
        foreach ($candidate in @("python", "python3", "py")) {
            if (Command-Exists $candidate) {
                $ver = & $candidate -c "import sys; print(sys.version_info.major)" 2>$null
                if ($ver -eq "3") { $PYTHON_CMD = $candidate; break }
            }
        }
    } else {
        Write-Host "Installation aborted by the user. Please install them manually and re-run this script."
        exit 1
    }
} else {
    Write-Host "All prerequisites met."
}

# ---------------------------------------------------------------------------
# TypeScript global check
# ---------------------------------------------------------------------------
if (Command-Exists npm) {
    if (-not (Command-Exists tsc)) {
        Write-Host "`nTypeScript compiler (tsc) is missing."
        if (Ask-Permission "Do you want to run 'npm install -g typescript'?") {
            Write-Host "Installing typescript globally..."
            npm install -g typescript
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Warning: npm failed to install typescript globally (exit code $LASTEXITCODE)."
            }
        } else {
            Write-Host "Installation aborted. You may need tsc for compiling frontend assets."
        }
    }
}

# ---------------------------------------------------------------------------
# Create virtual environment
# ---------------------------------------------------------------------------
if (-not (Test-Path ".venv")) {
    Write-Host "`nCreating virtual environment in .venv..."
    & $PYTHON_CMD -m venv .venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to create virtual environment."
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Activate virtual environment
# ---------------------------------------------------------------------------
if (Test-Path $VENV_ACTIVATE) {
    . $VENV_ACTIVATE
} else {
    Write-Host "Error: Virtual environment activation script not found at $VENV_ACTIVATE"
    exit 1
}

# ---------------------------------------------------------------------------
# Install Python dependencies
# ---------------------------------------------------------------------------
Write-Host "Installing Python dependencies..."
if (Command-Exists pip) {
    pip install -r requirements.txt
} else {
    & $PYTHON_CMD -m pip install -r requirements.txt
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to install Python dependencies."
    exit 1
}

# ---------------------------------------------------------------------------
# Start the FastAPI server
# ---------------------------------------------------------------------------
Write-Host "`nStarting FastAPI server on http://localhost:8000..."
if (Command-Exists uvicorn) {
    uvicorn main:app --port 8000
} else {
    & $PYTHON_CMD -m uvicorn main:app --port 8000
}
