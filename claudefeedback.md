# DevSuite — Engineering Review

> **Reviewer role:** Senior front-end engineer / architect / Python + JavaScript developer / security engineer
> **Date:** 2026-06-06
> **Version reviewed:** 0.2.1 (per `main.py` `APP_VERSION`, `README.md`, `CHANGELOG.md`)
> **Verdict:** Strong, thoughtfully-built local dev suite with above-average security hygiene for a hobby/OSS project. There is **one architectural security flaw that breaks the product's headline guarantee**, one **SSRF control that is bypassable**, and a **complete absence of automated tests** for the very paths the project documents as security-critical. None are catastrophic on a single-user loopback box, but all are worth fixing before open-sourcing.

---

## 1. Scope & methodology

**Read in full:** `SPEC.md`, `main.py` (1,968 lines), `devdb.py`, `static/vault.js`, `static/auth-guard.js`, `static/devdb-client.js`, `static/components.js`.

**Sampled (targeted):** `static/ssh-manager.js`, `static/api-tester.js`, `static/db-manager.js` for XSS/DOM patterns; cross-file greps for `innerHTML`, inline `onclick`, `eval`/`new Function`, CSRF helpers, version strings, CORS config.

**Not deep-read:** `app.js`, `cron.js`, `theme.js`, `sftp-browser.js`, the HTML pages, and CSS. Findings about those are pattern-level, not line-by-line. Vendored `static/libs/**` and `*.min.js` were excluded per `CLAUDE.md`.

Where the spec and code disagree I flag it explicitly (per `CLAUDE.md` rule 2). I did **not** modify any code — this is a review only.

---

## 2. What's genuinely good

Credit where due — this is not a toy:

- **DevDB container crypto is correct.** AES-256-GCM (AEAD), PBKDF2-HMAC-SHA256 @ 200k, 32-byte random salt + 12-byte nonce per write, BLAKE2b integrity in plain mode, atomic writes (`mkstemp` → `fsync` → `os.replace`) with temp-file cleanup on `BaseException`. (`devdb.py`)
- **Session handling is well thought through.** `secrets.token_urlsafe(32)`, only the BLAKE2b digest stored server-side, HttpOnly + `SameSite=Strict` cookie, password rotation clears all sessions (`main.py:1135`).
- **CSRF** uses the double-submit pattern with `secrets.compare_digest` (constant-time) and a sensible exempt list (`main.py:172-180`).
- **SSRF protection exists and is non-trivial** — it resolves the host and rejects private/loopback/link-local/reserved IPs, restricts schemes, and rebuilds the URL from validated components to avoid taint flow (`main.py:702-793`). (It's bypassable via redirects — see 4.2 — but the intent and base implementation are good.)
- **WeasyPrint is sandboxed** with a custom `url_fetcher` that blocks non-`data:` schemes (`main.py:481-491`) — LFI/SSRF-aware, which many implementations miss.
- **Host-key approval flow** (ssh-keyscan → fingerprint → browser approval) instead of blind `AutoAddPolicy` (`main.py:1280-1322`).
- **Front-end escaping discipline is mostly consistent** — `escHtml()` is applied to user-controlled values across `vault.js`, `ssh-manager.js`; `db-manager.js` uses `textContent` throughout.
- WSL distro name is validated against a strict regex before `execvp` (`main.py:884`, `1895-1906`).

---

## 3. Architecture review

**Overall shape is sound** for the stated goal: single FastAPI process, static vanilla frontend, one encrypted file for persistence, no external DB. The constraints in `SPEC.md §2` are coherent and mostly upheld.

Observations:

- **`main.py` is a 1,968-line monolith.** It's well-sectioned with comment banners, but it mixes concerns: HTTP security middleware, file-conversion, auth, DevDB REST, CORS proxy, SSH/SFTP, WebSocket terminals, and metrics parsing all live in one module. This is the single biggest maintainability risk. Suggest splitting into `routes/`, `auth.py`, `proxy.py`, `ssh.py`, `convert.py` behind an `APIRouter` per area. (No behavior change; pure structure.)
- **Front-end has real duplication.** `_csrfToken()` and `_acquireServerSession()` are reimplemented in `vault.js`, `auth-guard.js`, `devdb-client.js`, and `db-manager.js`. Centralize in one shared module (`devdb-client.js` is the natural home).
- **`static/api-client.ts` + `static/api-client.js` both exist** in a "no build tools, vanilla JS only" project (`SPEC.md §2`). The `.ts` cannot run in the browser without compilation, and the spec's own file map (`§3.4`) lists both. This is dead/confusing — delete the `.ts` or document a build step (which would itself violate the no-build constraint).
- **`api-tester.js` executes user-authored scripts via `new Function()`** (`api-tester.js:673,717`). This is an intentional pre-request/test scripting feature and is the reason CSP needs `unsafe-eval`. Import strips scripts (`SPEC.md §4.7`), which is the right call. Acceptable, but it should be called out in the security model section of the spec (it currently isn't) so the `unsafe-eval` dependency is traceable.

---

## 4. Security review

Severities are relative to the product's **own stated threat model** (`SPEC.md §2, §7`), which markets client-side/zero-knowledge encryption. On a single-user loopback box several of these have lower *practical* exploitability — I note that per item rather than silently downgrading.

### 4.1 [HIGH] The vault encryption key is sent to the server — the "zero-knowledge" guarantee is not upheld

`SPEC.md §2` ("Client-side encryption only — the backend never decrypts… it never has access to plaintext secrets") and `§7.5` are the product's central promise. The implementation breaks it.

- The vault is encrypted with `key = CryptoJS.PBKDF2(password, vaultSalt, …)` (`vault.js:39-44`, used in `encryptVault` `vault.js:46-54`).
- The session/challenge key is derived the **same way from the same salt** (`vault.js:149-152`, `auth-guard.js:137-144`), and that key is **POSTed to the server as `key_hex`** (`vault.js:84-94`, `auth-guard.js:151-166`).
- In the setup path the two are provably identical: one salt is generated, used for both `deriveKey` and the challenge, and the same `key` is sent (`vault.js:256-269`, `_registerSetupChallenge` `vault.js:176-191`).

So on every unlock the server receives the literal AES key that decrypts the vault, and the stored ciphertext blob is right there in the `vault` store. A backdoored/again-distributed server build, a malicious dependency, a logging reverse proxy, a browser extension with `webRequest`, or anyone reading request bodies can decrypt the vault. The server *currently* uses the key only transiently (`main.py:1176-1194`) and discards it — but the guarantee is "can't," not "currently doesn't."

**Fix (domain separation):** derive two independent keys from the password, e.g. `Kenc = HKDF(masterKey, info="vault-enc")` and `Kauth = HKDF(masterKey, info="server-auth")`, and **only ever send `Kauth`** (or, better, a challenge-response proof) to the server. The encryption key never leaves the browser. This keeps the existing UX and the verify-blob mechanism while restoring the zero-knowledge property. (Loopback-only deployment lowers practical risk today, which is why this is HIGH and not CRITICAL — but it's the finding I'd fix first because it invalidates a documented, marketed security property and the fix is cheap.)

### 4.2 [HIGH] CORS proxy SSRF is bypassable via redirects (and DNS rebinding)

`/api/proxy` validates the target IP (`_resolve_target_ips` → `_check_ip_not_private`, `main.py:743-755`) and then calls `urllib.request.urlopen(...)` (`main.py:728`). Two bypasses:

1. **Redirects.** `urlopen` follows 3xx by default and does **not** re-run the private-IP check on the redirect target. A public URL that responds `302 Location: http://169.254.169.254/latest/meta-data/` (cloud metadata) or `http://127.0.0.1:8000/...` will be fetched. The SSRF control (`SPEC.md §5.9`) is defeated.
2. **TOCTOU / DNS rebinding.** The IP is validated against `getaddrinfo` results, but `urlopen` resolves the hostname *again* independently. A hostname with a low TTL can resolve to a public IP at check time and a private IP at fetch time.

**Fix:** install a custom `urllib` opener with a redirect handler that re-validates every hop's resolved IP (or disables redirects and surfaces the `Location` to the client). Better: resolve once, validate, then connect to the *validated IP* with an explicit `Host:` header so the fetched address can't drift. Also cap response size and request-body size (currently `resp.read()` is unbounded — memory DoS).

### 4.3 [MEDIUM] Vault uses AES-CBC with no authentication (no MAC)

`encryptVault` calls `CryptoJS.AES.encrypt(plain, key, { iv })` (`vault.js:49`). With a WordArray key this is **AES-256-CBC + PKCS7, no MAC**. Ciphertext is malleable: someone who can modify the stored blob (compromised `.dsb`, malicious server) can tamper without detection — `JSON.parse` failure is the only "integrity check," which is not authentication. Notably, **DevDB itself uses AES-GCM** — the client vault is the weaker of the two.

**Fix:** switch to authenticated encryption. CryptoJS has no GCM; either adopt **WebCrypto `AES-GCM`** (native, faster, authenticated) or encrypt-then-HMAC-SHA256. WebCrypto would also let you drop CryptoJS for the vault entirely.

### 4.4 [MEDIUM] Weak client KDF — PBKDF2-HMAC-SHA1 @ 50k

`CryptoJS.PBKDF2(password, salt, { keySize, iterations: 50000 })` (`vault.js:40-44`, `auth-guard.js:137-139`) passes **no `hasher`, so CryptoJS defaults to SHA-1**, at 50,000 iterations. This protects the actual secrets, yet is far weaker than DevDB's own SHA-256 @ 200k and well below OWASP 2023 guidance (PBKDF2-HMAC-SHA256 ≥ 600k, or Argon2id). Because `/api/auth/challenge` hands out the salt + verify blob (`main.py:1042-1057`), and the `.dsb`/blob may leak, **offline brute-force is the realistic attack** — and SHA-1/50k makes it cheap.

**Fix:** short-term, pass `hasher: CryptoJS.algo.SHA256` and raise iterations (≥310k). Long-term, Argon2id (already tracked as **SEC-13**) via WebCrypto/wasm. Rate-limiting the challenge (5/min, good) only slows *online* attempts; it does nothing for offline.

### 4.5 [MEDIUM] WebSocket endpoints bypass the session entirely

`/api/local/terminal` (`main.py:1943`), `/api/ssh/terminal` (`main.py:1471`), and `/api/ssh/dashboard` (`main.py:1843`) are gated **only** by `_ws_check_origin` — they never call `require_unlocked`. `/api/local/terminal` spawns a **local shell with the server's privileges** (`pty.fork` → `execvp`, `main.py:1958-1962`). The Origin check stops *browser* cross-site attacks, but any non-browser local process can set an arbitrary `Origin` header, and the endpoint requires no master-password session. For a tool that explicitly gates DevDB behind auth, leaving a local-shell socket un-gated is inconsistent.

Additionally, `_ws_check_origin` (`main.py:1334-1344`) has a logic gap: if `Origin` is present but the `Host` header is empty, the `and host and …` short-circuits to **allow**; and it accepts any scheme that ends in `//{host}`.

**Fix:** require the session token on WS connects (e.g. validate `ds_session` from the cookie in the handshake, or a first-message auth frame), and tighten the origin check to a strict allowlist with no `host`-empty fallthrough.

### 4.6 [MEDIUM] Master password + derived key cached in `sessionStorage`

`auth-guard.js` stores the plaintext master password (`devsuite_session_cred`, `auth-guard.js:128`) and the derived key (`devsuite_key_hex`, `auth-guard.js:159`) in `sessionStorage`. Any XSS (and there is a broad `innerHTML` surface — 71 sites) escalates to **full vault compromise**, not just a single-page defacement. The spec acknowledges the caching (`§7.1`) but not the blast-radius cost.

**Fix:** keep the key in a closure/in-memory variable only; if persistence across reloads is required, persist a *non-reversible* session marker, not the password or key. Re-prompt on reload is the safer default the Vault already uses.

### 4.7 [LOW→MED] Vault copy button: inline `onclick` injection via secret values

`addFieldRow` builds the copy button as a string with `onclick="copyToClipboard(decodeURIComponent('${encodeURIComponent(value)}'),'${clipLabel || label}')"` (`vault.js:558`). **`encodeURIComponent` does not escape the single quote `'`** — a secret value containing `'` breaks out of the JS string literal inside the attribute, enabling attribute/script breakout. It's primarily *self*-XSS (the value is the user's own secret), so severity is bounded, but it's a genuine injection bug and violates `SPEC.md §2/§7.7`. Tellingly, the **same function 10 lines above** does it the safe way for the URL opener (`addEventListener` + `dataset`, `vault.js:567-580`).

**Fix:** build the copy button with `createElement` + `addEventListener` reading `dataset.raw` — exactly mirroring the existing URL-opener pattern.

### 4.8 [LOW] Smaller hardening items

- `sftp_download` puts a user-derived filename straight into `Content-Disposition` (`main.py:1627`) — a `"`/CR/LF in the remote path is header-injection. Sanitize / RFC 5987-encode.
- `X-XSS-Protection: 1; mode=block` (`main.py:153`) is deprecated and can introduce issues in legacy browsers; modern guidance is `0` (rely on CSP).
- `~/.devsuite/` is created with default umask and `audit.log` isn't chmod'd (`main.py:841-843`); the `.dsb` is 600 via `mkstemp` but the dir isn't 700. On multi-user hosts, `chmod 700` the dir.
- `_check_ip_not_private` (`main.py:712`): the `169.254.` branch is dead code — `is_link_local` already covers `169.254.0.0/16` and raises first.
- **At-rest default is plaintext.** Without `DEVDB_PASSWORD`, the `.dsb` is plain mode, so `app_prefs` and `collections` sit in on-disk JSON (vault/ssh blobs remain client-encrypted regardless). This is a reasonable default but should be stated plainly in user-facing docs.

---

## 5. Backend (Python) review

- **[BUG vs spec] `__main__` ignores documented `HOST`/`PORT` env vars.** `uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)` is hardcoded (`main.py:1967`), but `SPEC.md §14.2` documents `HOST`/`PORT` as the binding controls. Either read `os.environ` here or correct the spec. `reload=True` is also a dev-only setting to ship behind a flag.
- **Broad `except Exception`** is pervasive (proxy, vault, collections, SFTP, WS handlers). It's defensible for a server's outer boundary and it does log, but it will trip linters (and can mask programming errors). Consider narrowing the inner ones.
- `_conv_json_to_xlsx` (`main.py:365-389`) assumes a list of dicts; a JSON array of scalars raises on `.keys()` → 500 instead of a 400. Minor robustness.
- `hashlib.md5` for cache-busting (`main.py:199`) is functionally fine but will be flagged by scanners — pass `usedforsecurity=False`.
- Lazy per-request imports of conversion libs (`io`, `openpyxl`, …) are a reasonable optional-dependency strategy and degrade to 503 cleanly. Good.

---

## 6. Front-end (JS) review

- **Escaping is mostly disciplined** but **inconsistent in mechanism.** There are 71 `innerHTML` assignments; the ones I sampled escape user data via `escHtml()`, but the spec constraint is "use `createElement` + `textContent`." The safest path is a single shared render helper (or adopt a tiny tagged-template sanitizer) so escaping can't be forgotten. The current "escHtml everywhere by hand" is one missed call away from XSS.
- **Duplication** of CSRF/session helpers across four files (see §3). DRY it.
- `components.js` Monaco error banner says *"Monaco CDN could not be reached"* (`components.js:64`) although Monaco is self-hosted from `/static/libs` — misleading copy; update to mention local assets.
- `auth-guard.js` `_buildOverlay` uses `innerHTML` with `${toolName}/${toolIcon}` (`auth-guard.js:181-207`). Inputs are static literals from call sites today, so not currently exploitable, but it's an `innerHTML` interpolation that future callers could feed dynamic data — convert to `textContent`.
- Good front-end touches worth keeping: clipboard auto-clear after 30s (`vault.js:346-352`), visibility-based auto-lock (`vault.js:320-342`), scheme-validated URL opener (`vault.js:567-580`).

---

## 7. Spec ⇄ code drift (flagged per CLAUDE.md rule 2)

| # | Spec says | Code does | Action |
|---|---|---|---|
| D-1 | `§2/§7.5`: server never sees the key/plaintext | Server receives `key_hex` (the vault key) on unlock | Fix code (§4.1); it's the marketed guarantee |
| D-2 | `§4.7`: `/api/collections` is **not** auth-gated | Both endpoints call `require_unlocked` (`main.py:666,683`) | Code is safer — **update the spec** |
| D-3 | `§14.2`: `HOST`/`PORT` env vars control binding | `__main__` hardcodes `127.0.0.1:8000` | Honor env or fix spec (§5) |
| D-4 | `§12.1`: version bumped in 3 places | All three match `0.2.1`, but `main.py` **docstring** still says `(v0.2.0)` (`main.py:2`) | Update the docstring |
| D-5 | `§10.4`: `db-manager.js:188` implicit global `_serverToken` (BLOCKER) | `_serverToken` not found in current `db-manager.js` | Likely already fixed — **re-validate & update spec** |
| D-6 | `SEC-3`: explicit CORS allowlist (open) | No `CORSMiddleware` registered at all (only `SlowAPIMiddleware`) | Confirms SEC-3 is open; harmless today (no `ACAO` header ⇒ browsers block cross-origin reads) but worth closing |

---

## 8. Testing — the biggest process gap

There is **no `tests/` directory**, despite:
- `pytest.ini` pointing at `tests/python`,
- `CLAUDE.md` rule 5: *"Any change to auth, CSRF, session tokens, rate limiting, PBKDF2, AES-GCM, or the CORS proxy must have a corresponding test,"*
- `SPEC.md §10.2` listing six **required** security-critical test cases.

So the most sensitive code in the project — PBKDF2/AES round-trips, CSRF enforcement, rate-limit 429s, SSRF blocking, session-token hashing — has **zero** automated coverage. `SPEC.md §10.1` honestly defers tests to v1.0.0, but that directly contradicts `CLAUDE.md` rule 5. This is the highest-ROI investment available: the SSRF-redirect bypass (§4.2) and the key-leak (§4.1) are exactly the kind of regression a 20-line test would have caught.

**Start here:** `tests/python/test_proxy_ssrf.py` (asserts redirect-to-private is blocked), `test_csrf.py` (mutating request without token → 403), `test_auth_session.py` (raw token absent from `_sessions`; 6th attempt → 429), `test_devdb_roundtrip.py` (GCM encrypt/decrypt + tamper → `InvalidTag`).

---

## 9. Prioritized recommendations

| Priority | Item | Effort | Ref |
|---|---|---|---|
| **P0** | Stop sending the encryption key to the server (domain-separate enc vs. auth keys) | M | §4.1 |
| **P0** | Block redirect/DNS-rebinding SSRF in `/api/proxy` | S | §4.2 |
| **P0** | Add tests for SSRF, CSRF, auth/session, DevDB round-trip | M | §8 |
| **P1** | Authenticated encryption for the vault (WebCrypto AES-GCM) | M | §4.3 |
| **P1** | Strengthen client KDF (SHA-256 + ≥310k now; Argon2id later / SEC-13) | S→M | §4.4 |
| **P1** | Gate WebSocket endpoints with the session; fix `_ws_check_origin` fallthrough | S | §4.5 |
| **P1** | Fix vault copy-button inline `onclick` injection | XS | §4.7 |
| **P2** | Don't cache master password/key in `sessionStorage` | S | §4.6 |
| **P2** | Honor `HOST`/`PORT`; gate `reload=True`; fix `v0.2.0` docstring | XS | §5, D-4 |
| **P2** | Resolve spec drift D-2/D-5; delete stray `api-client.ts` | XS | §7, §3 |
| **P3** | Split `main.py` into routers; centralize CSRF/session JS helpers | M | §3 |
| **P3** | Cap proxy response/body size; sanitize SFTP download filename; chmod dir/log; `X-XSS-Protection: 0` | S | §4.2, §4.8 |

---

## 10. Bottom line

DevSuite is **better engineered than most local dev tools** — the DevDB container, session model, CSRF, host-key flow, and front-end escaping show real care. The issues that matter cluster in the **client crypto boundary** (the server ends up holding the key; the vault isn't authenticated; the KDF is weak) and in **one bypassable SSRF control**, all compounded by **no tests on the security-critical paths**. Fix the P0/P1 set and close the spec drift, and this is genuinely solid enough to open-source with confidence.

*Review only — no source files were modified.*
