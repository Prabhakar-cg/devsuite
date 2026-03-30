#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting setup for Local dev suite..."

# Function to check if a command exists
command_exists () {
    command -v "$1" >/dev/null 2>&1
}

# Helper to run commands as root when needed
run_as_root () {
    if [ "$(id -u)" -eq 0 ] || [ "${EUID:-$(id -u)}" -eq 0 ]; then
        "$@"
    else
        if command_exists sudo; then
            sudo "$@"
        else
            echo "Error: This script requires root privileges but sudo is not available."
            exit 1
        fi
    fi
}

# Function to ask for user permission
ask_permission () {
    local prompt="$1"
    read -p "$prompt (y/N): " -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return 1
    fi
    return 0
}

# Detect OS
OS_TYPE=$(uname -s)
case "$OS_TYPE" in
  Linux*)
    OS="Linux"
    if command_exists apt-get; then
       PKG_MGR="apt-get"
    elif command_exists dnf; then
       PKG_MGR="dnf"
    elif command_exists yum; then
       PKG_MGR="yum"
    elif command_exists pacman; then
       PKG_MGR="pacman"
    else
       PKG_MGR="unknown"
    fi
    ;;
  Darwin*)
    OS="macOS"
    if command_exists brew; then
       PKG_MGR="brew"
    else
       PKG_MGR="unknown"
    fi
    ;;
  CYGWIN*|MINGW*|MSYS*)
    OS="Windows"
    if command_exists choco; then
       PKG_MGR="choco"
    elif command_exists winget; then
       PKG_MGR="winget"
    elif command_exists scoop; then
       PKG_MGR="scoop"
    else
       PKG_MGR="unknown"
    fi
    ;;
  *)
    OS="unknown"
    PKG_MGR="unknown"
    ;;
esac

echo "Detected OS: $OS"
if [ "$PKG_MGR" != "unknown" ]; then
    echo "Detected Package Manager: $PKG_MGR"
fi

# Detect expected python command
if [ "$OS" = "Windows" ]; then
    PYTHON_CMD="python"
    VENV_ACTIVATE=".venv/Scripts/activate"
else
    # On macOS / Linux normally it's python3
    if command_exists python3; then
        PYTHON_CMD="python3"
    elif command_exists python; then
        if python -c "import sys; sys.exit(0 if sys.version_info.major >= 3 else 1)" 2>/dev/null; then
            PYTHON_CMD="python"
        else
            PYTHON_CMD="python3"
        fi
    else
        PYTHON_CMD="python3"
    fi
    VENV_ACTIVATE=".venv/bin/activate"
fi

MISSING_SOFTWARE=""
MISSING_PKGS=""

# Helper function to queue packages based on OS and package manager
queue_installation () {
    local soft_name="$1"
    local apt_pkg="$2"
    local brew_pkg="$3"
    local dnf_pkg="$4"
    local pacman_pkg="$5"
    local win_choco_scoop_pkg="$6"
    local winget_pkg="$7"

    MISSING_SOFTWARE="$MISSING_SOFTWARE- $soft_name\n"

    case "$PKG_MGR" in
        apt-get) MISSING_PKGS="$MISSING_PKGS $apt_pkg" ;;
        brew)    MISSING_PKGS="$MISSING_PKGS $brew_pkg" ;;
        dnf|yum) MISSING_PKGS="$MISSING_PKGS $dnf_pkg" ;;
        pacman)  MISSING_PKGS="$MISSING_PKGS $pacman_pkg" ;;
        choco)   MISSING_PKGS="$MISSING_PKGS $win_choco_scoop_pkg" ;;
        scoop)   MISSING_PKGS="$MISSING_PKGS $win_choco_scoop_pkg" ;;
        winget)  MISSING_PKGS="$MISSING_PKGS $winget_pkg" ;;
        *)       ;;
    esac
}

echo -n "Checking core system prerequisites... "

# Check Python and venv
if ! command_exists "$PYTHON_CMD"; then
    queue_installation "Python 3" "python3 python3-venv python3-pip" "python" "python3 python3-pip" "python python-pip" "python" "Python.Python"
else
    # Check venv specifically
    if ! "$PYTHON_CMD" -m venv --help >/dev/null 2>&1; then
        if [ "$PKG_MGR" = "apt-get" ]; then
            queue_installation "Python 3 venv & pip" "python3-venv python3-pip" "" "" "" "" ""
        elif [ "$PKG_MGR" = "unknown" ]; then
            MISSING_SOFTWARE="$MISSING_SOFTWARE- Python 3 venv module\n"
        fi
    fi
fi

# Check Node and npm
if ! command_exists node || ! command_exists npm; then
    queue_installation "Node.js & npm" "nodejs npm" "node" "nodejs" "nodejs npm" "nodejs" "OpenJS.NodeJS"
fi

# Trim leading space from packages list if present
MISSING_PKGS=$(echo "$MISSING_PKGS" | xargs)

if [ -n "$MISSING_PKGS" ]; then
    echo -e "Missing dependencies detected.\n\nThe following system dependencies are missing and need to be installed:"
    echo -e "$MISSING_SOFTWARE"
    
    if [ "$PKG_MGR" = "unknown" ]; then
        echo "Could not detect a supported package manager ($OS). Please install the above software manually."
        exit 1
    fi

    if ask_permission "Do you want to automatically install them using $PKG_MGR?"; then
        echo "Installing system packages: $MISSING_PKGS"
        case "$PKG_MGR" in
            apt-get)
                run_as_root apt-get update
                run_as_root apt-get install -y $MISSING_PKGS
                ;;
            brew)
                brew install $MISSING_PKGS
                ;;
            dnf|yum)
                run_as_root $PKG_MGR install -y $MISSING_PKGS
                ;;
            pacman)
                run_as_root pacman -S --noconfirm $MISSING_PKGS
                ;;
            choco)
                run_as_root choco install -y $MISSING_PKGS
                ;;
            winget)
                # Winget doesn't strictly need root, it handles UAC
                for pkg in $MISSING_PKGS; do
                    winget install --exact --id "$pkg" --accept-package-agreements --accept-source-agreements
                done
                ;;
            scoop)
                scoop install $MISSING_PKGS
                ;;
        esac
    else
        echo "Installation aborted by the user. Please install them manually and re-run this script."
        exit 1
    fi
elif [ -n "$MISSING_SOFTWARE" ] && [ "$PKG_MGR" = "unknown" ]; then
    echo -e "Missing dependencies detected.\n\nThe following system dependencies are missing:"
    echo -e "$MISSING_SOFTWARE"
    echo "Could not detect a supported package manager ($OS). Please install the above software manually."
    exit 1
else
    echo "All prerequisites met."
fi

# TypeScript global check
if command_exists npm; then
    if ! command_exists tsc; then
        echo -e "\nTypeScript compiler (tsc) is missing."
        if ask_permission "Do you want to run 'npm install -g typescript'?"; then
            echo "Installing typescript globally..."
            if [ "$OS" = "Windows" ] || [ "$OS" = "macOS" ]; then
                npm install -g typescript
            else
                run_as_root npm install -g typescript
            fi
        else
            echo "Installation aborted. You may need tsc for compiling frontend assets."
        fi
    fi
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo -e "\nCreating virtual environment in .venv..."
    "$PYTHON_CMD" -m venv .venv
fi

# Activate virtual environment
if [ -f "$VENV_ACTIVATE" ]; then
    source "$VENV_ACTIVATE"
else
    echo "Error: Virtual environment activation script not found at $VENV_ACTIVATE"
    exit 1
fi

# Determine how to call pip in venv
if command_exists pip; then
    PIP_CMD="pip"
else
    PIP_CMD="$PYTHON_CMD -m pip"
fi

# Install dependencies explicitly to avoid caching issues across environments
echo "Installing Python dependencies..."
$PIP_CMD install -r requirements.txt

# Start the server
echo -e "\nStarting FastAPI server on http://localhost:8000..."
if command_exists uvicorn; then
    uvicorn main:app --port 8000
else
    "$PYTHON_CMD" -m uvicorn main:app --port 8000
fi