#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting setup for Fancy Diff Checker..."

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
