#!/usr/bin/env python3
"""Browser smoke test (BACKLOG DX-6, first slice): load every page and fail on JS errors or 4xx/5xx.

Optional — needs Playwright (`pip install playwright && playwright install chromium`) and a running
server:   python -m uvicorn main:app --port 8000   then   python tests/e2e/smoke.py [base_url]
Pre-unlock 401s on gated tools are expected and ignored. Found the File Converter / SSH dashboard /
DevDB unlock runtime bugs that static review missed (specs/025-security-hardening/assessment.md).
"""
import sys

from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
PAGES = ["/", "/tools", "/diff", "/data-linter", "/json", "/yaml", "/xml", "/regex", "/base64", "/crypto",
         "/api-tester", "/ssh", "/sftp", "/cron", "/vault", "/db-manager", "/file-converter", "/notes",
         "/roadmap", "/id-generator", "/ws-tester", "/secret-scanner"]


def main() -> int:
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for path in PAGES:
            ctx = browser.new_context(reduced_motion="reduce")
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e, errs=errs: errs.append(f"pageerror: {str(e)[:120]}"))
            page.on("console", lambda m, errs=errs: errs.append(f"console: {m.text[:120]}")
                    if m.type == "error" and "401" not in m.text else None)
            page.on("response", lambda r, errs=errs: errs.append(f"HTTP {r.status} {r.url[len(BASE):][:80]}")
                    if r.status >= 400 and r.status != 401 and r.url.startswith(BASE) else None)
            page.goto(BASE + path, wait_until="load", timeout=20000)
            page.wait_for_timeout(800)
            status = "ok " if not errs else "FAIL"
            print(f"{status} {path} {errs[:2] if errs else ''}")
            if errs:
                failures.append(path)
            ctx.close()
        browser.close()
    print(f"\n{len(PAGES) - len(failures)}/{len(PAGES)} pages clean")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
