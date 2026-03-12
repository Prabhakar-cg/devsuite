# DevSuite — Developer Tools from Hell
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Prabhakar-cg/devsuite?utm_source=oss&utm_medium=github&utm_campaign=Prabhakar-cg%2Fdevsuite&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
A beautiful, locally-hosted developer tools suite powered by **FastAPI** and the **Monaco Editor**. 100% private — all file reading and data processing is done locally. No data ever leaves your machine.

## Supported Tools

### 1. Diff Checker
- **Side-by-side & Inline** comparison modes.
- **Merge arrows** to copy individual hunks left→right or right→left.
- **Folder Diff** — compare entire directory trees with filter chips.
- Export as `.patch` or copy unified diff.

### 2. JSON Linter & Formatter
- Validate JSON with real-time exact line/column error pointers.
- Pretty-print (format), minify, and sort keys alphabetically.

### 3. YAML Linter & Validator
- Parse and validate YAML configs (Kubernetes, Docker Compose, Actions).
- Format clean YAML or convert directly to JSON (pretty and minified).

### 4. Regex Tester
- Real-time match highlighting right inside the Monaco Editor.
- Group captures and named group display.
- Global `g`, case-insensitive `i`, multiline `m`, and dotall `s` flag toggles.

### 5. Base64 Encoder / Decoder
- Encode/Decode strings and files with full UTF-8 support.
- URL-safe mode.
- JWT decoding panel (splits header, payload, signature).

## 🎨 Premium UI
- Glassmorphic UI with dynamic gradients and ambient glow.
- Neumorphic buttons and customized scrollbars.
- **3 themes**: Dark, Light, High Contrast.

## Getting Started

### Prerequisites
- Python 3.10+

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

## Privacy & Security
All tools run strictly on your machine. File reading uses the browser's **FileReader API**, and parsing/generation (JSON/YAML/Regex/Base64) runs purely in-browser using JS and Web Workers.

## Project Structure

```
DevSuite/
├── main.py                  # FastAPI app — serves all HTML endpoints
├── requirements.txt         # fastapi, uvicorn, python-multipart
├── start.sh                 # One-shot setup & run script
└── static/
    ├── home.html & css      # Main DevSuite homepage
    ├── index.html & app.js  # Text/Folder Diff tool
    ├── json.html            # JSON Linter
    ├── yaml.html            # YAML Linter
    ├── regex.html           # Regex Tester
    ├── base64.html          # Base64 Coder
    └── linter.css           # Shared styling for linter/tester tools
```
