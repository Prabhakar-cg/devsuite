#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting setup for Local dev suite..."

# Function to check if a command exists
command_exists () {
    command -v "$1" >/dev/null 2>&1 ;
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

# Install prerequisites if on a Debian/Ubuntu-based system
if command_exists apt-get; then
    echo "Checking core system prerequisites..."
    MISSING_PKGS=""
    if ! command_exists python3; then MISSING_PKGS="$MISSING_PKGS python3"; fi
    
    # Check if python3-venv is installed (commonly required on Debian/Ubuntu)
    if ! python3 -c "import venv" &> /dev/null; then 
        MISSING_PKGS="$MISSING_PKGS python3-venv python3-pip"
    fi

    # Check for npm and nodejs (required for TypeScript compilation)
    if ! command_exists npm; then MISSING_PKGS="$MISSING_PKGS npm nodejs"; fi

    if [ -n "$MISSING_PKGS" ]; then
        echo "Root privileges are required to install missing system packages:$MISSING_PKGS"
        run_as_root apt-get update
        run_as_root apt-get install -y $MISSING_PKGS
    fi
else
    echo "Not a Debian/Ubuntu system or apt-get missing. Please ensure Python 3, venv, and Node.js are installed."
    if ! command_exists python3; then
        echo "Error: python3 is not installed."
        exit 1
    fi

    # Verify venv module is available
    if ! python3 -m venv --help >/dev/null 2>&1; then
        echo "Error: python3 venv module is not available. Please install python3-venv."
        exit 1
    fi

    # Verify Node.js tooling is available
    if ! command_exists node; then
        echo "Error: node is not installed. Please install Node.js."
        exit 1
    fi

    if ! command_exists npm && ! command_exists yarn; then
        echo "Error: neither npm nor yarn is installed. Please install npm or yarn."
        exit 1
    fi
fi

# Install typescript globally if npm is available but tsc is not
if command_exists npm; then
    if ! command_exists tsc; then
        echo "TypeScript compiler not found. Installing typescript globally..."
        sudo npm install -g typescript
    fi
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install dependencies explicitly to avoid caching issues across environments
echo "Installing dependencies..."
pip install -r requirements.txt

# Start the server
echo "Starting FastAPI server on http://localhost:8000..."
uvicorn main:app --port 8000