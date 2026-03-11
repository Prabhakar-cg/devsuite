# DiffChecker.io — Diff Checker from Hell

A beautiful, locally-hosted diff tool powered by **FastAPI** and the **Monaco Editor** (the engine behind VS Code). 100% private — all file reading is done client-side with the FileReader API.

## Features

### ⚡ Core Diffing
- **Side-by-side & Inline** comparison modes, switchable at any time.
- **Merge arrows** in each gutter — click to copy individual hunks left→right or right→left.
- **Merge All** buttons — copy all changes in one direction instantly.
- **Folder Diff** — compare two entire directory trees; sidebar lists changed, added, and removed files with filter chips.

### 🎨 Premium UI
- Glassmorphic header with gradient accent line.
- Electric indigo/blue design system with JetBrains Mono for code.
- **Live Diff Stats Bar** — color-coded `+additions / −removals / hunks` chips.
- Multi-type toast notifications (success / error / warning / info) with slide-in animation.
- Gradient scrollbar, glowing status dots, segmented button groups.

### 🛠 Developer Quality-of-Life
- **Keyboard shortcuts** — `Ctrl/Cmd + Enter` to compare; `Escape` to return to edit.
- **📋 Paste** button per panel — reads clipboard directly.
- **Copy** icon button per panel — copies content to clipboard.
- **Line count badges** — live count in each panel header.
- **Export Patch** — download as `.patch` or copy unified diff to clipboard.
- **Language auto-detect** via `highlight.js`; manual override via the Lang dropdown.
- **20+ languages** — Python, JS, TS, Go, Rust, Java, C/C++, SQL, YAML, Dockerfile, Shell, and more.
- **3 themes** — Dark, Light, High Contrast.

## Getting Started

### Prerequisites
- Python 3.8+

### Quick Start

```bash
chmod +x start.sh
./start.sh
```

Open **[http://localhost:8000](http://localhost:8000)** in your browser.

### Manual Setup

```bash
# 1. Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start the server
uvicorn main:app --port 8000 --reload
```

## Privacy

All file reading uses the browser's **FileReader API** — no file content is ever sent to the server. The `/upload` endpoint exists only as a fallback and is not used by default.

## Project Structure

```
DiffChecker/
├── main.py                  # FastAPI app — serves static files + /upload fallback
├── requirements.txt         # fastapi, uvicorn, python-multipart
├── start.sh                 # One-shot setup & run script
└── static/
    ├── index.html           # SPA entry point
    ├── style.css            # Premium design system
    ├── app.js               # All client-side logic (diff, merge, export, etc.)
    └── test_merge.html      # Unit-test harness for merge logic
```
