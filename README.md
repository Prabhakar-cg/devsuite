# Fancy Diff Checker

A beautiful, local web-based Diff Checker powered by FastAPI and the Monaco Editor (the same technology behind VS Code). 

## Features
- **Premium UI:** Dark mode, vibrant accents, and smooth micro-animations.
- **Advanced Diffing:** Inline and side-by-side comparison modes, using industry-standard diffing algorithms.
- **Syntax Highlighting:** Supports comprehensive formatting out of the box (Python, JS, Go, Rust, React, etc.).
- **DevOps Support:** Specialized syntax mapping for Ansible, Jenkinsfile, and Terraform.
- **Auto-Detect Language:** Automatically detects the programming language of pasted code to apply the correct grammar.

## Getting Started

### Prerequisites
- Python 3.8+

### Quick Start
You can easily install the dependencies and start the local server using the provided setup script:

```bash
chmod +x start.sh
./start.sh
```

Then, open your browser and navigate to **[http://localhost:8000](http://localhost:8000)**.

### Manual Setup
If you prefer not to use the script, you can run the application manually from the repository root:

```bash
# 1. Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start the server
uvicorn main:app --port 8000
```
