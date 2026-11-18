# Quickstart: Validating 024

Automated: `pytest tests/python/` and `node tests/javascript/run.js` (theme-layer + extended contrast matrix).

Manual (headless Chromium, see memory note `env_playwright_no_sudo`): start an isolated server on :8001, run the 023 axe procedure over 18 pages × 6 themes, screenshot Hi-Contrast on Cron, Data Linter, Vault, API Tester; compare with `specs/023-ui-accessibility-foundation/checklists/verification.md` (target: contrast nodes 706 → <25).
