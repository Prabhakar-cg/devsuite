# Verification: 028 Tool Pages Bento Skin (2026-11-17)

Headless Chromium + axe 4.11 (dev-time), reduced-motion emulation, isolated server.

- axe: 9 ungated pages × 6 themes → 0 violations (after accent-on-tint fixes); locked states of api-tester/ssh/vault/notes/sftp/db-manager × 6 themes → 0 (after lock-card colour fixes); unlocked api-tester/ssh/vault/notes/sftp × {light, glass, Hi-Contrast} → 0.
- Monaco: editor rect == host rect on Linter (674×660), Regex (674×637/638), Base64 (674×647/648).
- Console/page errors: none on any of the 15 pages (401s before unlock excluded).
- 320px: no horizontal overflow on any page (Diff/SSH/Notes fixed via wrapping headers).
- Screenshots reviewed: all pages (default), Hi-Contrast (Linter, Cron), iOS Glass (ID Generator), dark (WS Tester), phone (Linter, Regex).
- Unlock harness note: `/api/auth/challenge` is rate-limited to 5/min; paced unlocks or server restart between batches.
