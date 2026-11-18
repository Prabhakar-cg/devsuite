# Verification: 026 Bento Showcase (2026-11-17)

Headless Chromium + axe 4.11 (dev-time), reduced-motion emulation, isolated server.
- axe on `/` and `/tools` × 6 themes: **0 violations (12/12 clean)**.
- 320px: no horizontal overflow on either page.
- Keyboard: tiles focusable with visible ring; Enter on the Text Diff tile navigates to `/diff`.
- Screenshots reviewed: dark, light, midnight, phone (single column), Tools hub in context.
- Suites: pytest 334, JS 191.
