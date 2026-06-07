/* ================================================================
   DevSuite — AuthGuard  (auth-guard.js)
   Shared 8-hour session authentication for tools that store data
   in DevDB.  Vault and DB Manager have their own always-ask flows;
   this module is for API Tester, SSH Manager, and similar tools.

   Usage:
       const pwd = await AuthGuard.init('Tool Name', '🔧');
       // pwd is the verified master password; use it for decryption
   ================================================================ */

'use strict';

const AuthGuard = (() => {
    // ── Constants ─────────────────────────────────────────────────
    const LS_EXPIRY_KEY = 'devsuite_session_expiry';   // localStorage (non-sensitive: expiry only)
    const SESSION_MS    = 8 * 60 * 60 * 1000;         // 8 hours
    const PBKDF2_ITER   = 50000;
    const PBKDF2_KS     = 256 / 32;

    // ── In-memory session state (never persisted to storage) ───────
    // Storing the password or derived key in sessionStorage is too broad:
    // any same-origin XSS could read it. Keep it here, in the module
    // closure, so it's gone on page unload (re-prompt is the safe default).
    let _sessionPwd    = null;   // master password, cleared on unload/lock
    let _sessionKeyHex = null;   // PBKDF2-derived auth key, used to re-acquire server session

    // ── Inject styles (once) ──────────────────────────────────────
    const _css = `
        #ag-overlay {
            position: fixed; inset: 0; z-index: 9999;
            background: #0b0e1a;
            display: none; align-items: center; justify-content: center;
            padding: 24px;
            font-family: 'Inter', system-ui, sans-serif;
        }
        .ag-card {
            background: #111526;
            border: 1px solid rgba(100,120,255,0.35);
            border-radius: 12px;
            padding: 36px 32px 28px;
            width: 100%; max-width: 400px;
            display: flex; flex-direction: column; align-items: center;
            gap: 14px;
            box-shadow: 0 8px 48px rgba(0,0,0,0.6);
            animation: ag-slide 0.25s ease;
        }
        @keyframes ag-slide {
            from { opacity:0; transform:translateY(18px); }
            to   { opacity:1; transform:translateY(0); }
        }
        .ag-icon  { font-size: 2.4rem; line-height:1; filter: drop-shadow(0 0 16px rgba(100,119,255,0.4)); }
        .ag-title { font-size: 20px; font-weight: 700; color: #e2e8f0; margin: 0; }
        .ag-desc  { font-size: 13px; color: #64748b; text-align: center; line-height: 1.6; margin: 0; }
        .ag-notice {
            background: rgba(245,158,11,0.12);
            border: 1px solid rgba(245,158,11,0.3);
            border-radius: 8px; padding: 10px 14px;
            font-size: 13px; color: #f59e0b;
            display: flex; gap: 8px; align-items: flex-start;
            width: 100%; line-height: 1.5;
        }
        .ag-link { color: #6477ff; text-decoration: underline; }
        #ag-form { width: 100%; display: flex; flex-direction: column; gap: 10px; }
        .ag-input {
            width: 100%; padding: 11px 14px;
            background: #161c33; border: 1px solid rgba(100,120,255,0.12);
            border-radius: 8px; color: #e2e8f0; font-size: 14px; outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ag-input:focus {
            border-color: #6477ff;
            box-shadow: 0 0 0 3px rgba(100,119,255,0.15);
        }
        .ag-error {
            background: rgba(239,68,68,0.12);
            border: 1px solid rgba(239,68,68,0.3);
            border-radius: 8px; padding: 8px 12px;
            font-size: 13px; color: #ef4444;
        }
        .ag-hint { font-size: 11px; color: #64748b; text-align: center; margin: 0; }
        .ag-btn {
            width: 100%; padding: 12px;
            background: #6477ff; border: none; border-radius: 8px;
            color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
            transition: opacity 0.2s, transform 0.2s;
        }
        .ag-btn:hover  { opacity: 0.9; }
        .ag-btn:active { transform: scale(0.98); }
        .ag-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ag-warning {
            display: flex; align-items: flex-start; gap: 7px;
            font-size: 11px; color: #64748b;
            text-align: left; line-height: 1.5; width: 100%;
        }
        .ag-session-badge {
            display: flex; align-items: center; gap: 6px;
            background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25);
            border-radius: 20px; padding: 4px 12px;
            font-size: 11px; color: #22c55e;
        }
    `;

    let _styleInjected = false;
    function _injectStyle() {
        if (_styleInjected) return;
        const s = document.createElement('style');
        s.textContent = _css;
        document.head.appendChild(s);
        _styleInjected = true;
    }

    // ── Session helpers ───────────────────────────────────────────
    function _sessionValid() {
        const exp = localStorage.getItem(LS_EXPIRY_KEY);
        return !!(exp && Date.now() < Number.parseInt(exp, 10));
    }

    function _cachedPwd() {
        return _sessionPwd;
    }

    function _sessionExpiresIn() {
        const exp = Number.parseInt(localStorage.getItem(LS_EXPIRY_KEY) || '0', 10);
        const ms  = exp - Date.now();
        if (ms <= 0) return null;
        const h = Math.floor(ms / 3_600_000);
        const m = Math.floor((ms % 3_600_000) / 60_000);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    function _cacheSession(pwd) {
        localStorage.setItem(LS_EXPIRY_KEY, String(Date.now() + SESSION_MS));
        _sessionPwd = pwd;  // in-memory only — never written to sessionStorage
    }

    // ── Hex helpers ───────────────────────────────────────────────
    function _hexToBytes(hex) {
        const b = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.slice(i, i + 2), 16);
        return b;
    }
    function _bytesToHex(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ── Password verification ─────────────────────────────────────
    // Supports both challenge formats:
    //   v1: CryptoJS PBKDF2-SHA1/50k → AES-CBC verify_blob (legacy)
    //   v2: WebCrypto PBKDF2-SHA256/310k → 512-bit split → Kauth + Kenc;
    //       Kauth used for AES-GCM verify_blob; Kenc NEVER sent to server.
    async function _verify(pwd) {
        const resp = await fetch('/api/auth/challenge');
        if (!resp.ok) return { ok: false, keyHex: null };
        const ch = await resp.json();
        if (!ch.salt || !ch.verify_blob) return { ok: false, keyHex: null };

        const version = ch.challenge_version || 1;

        if (version === 2) {
            // ── v2: WebCrypto — domain-separated keys, AES-GCM verify_blob ──
            if (!ch.verify_nonce) return { ok: false, keyHex: null };
            try {
                const km = await crypto.subtle.importKey(
                    'raw', new TextEncoder().encode(pwd), 'PBKDF2', false, ['deriveBits']
                );
                const bits = await crypto.subtle.deriveBits(
                    { name: 'PBKDF2', hash: 'SHA-256', salt: _hexToBytes(ch.salt), iterations: 310000 },
                    km, 512
                );
                const arr    = new Uint8Array(bits);
                const Kauth  = arr.slice(32, 64);  // second 256 bits — sent to server
                // Kenc = arr.slice(0, 32)         // first 256 bits — vault encryption, never sent
                const aesKey = await crypto.subtle.importKey(
                    'raw', Kauth, { name: 'AES-GCM' }, false, ['decrypt']
                );
                const plainBuf = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: _hexToBytes(ch.verify_nonce) },
                    aesKey, _hexToBytes(ch.verify_blob)
                );
                const plain = new TextDecoder().decode(plainBuf);
                const ok    = plain === 'DEVSUITE_MASTER_OK';
                return { ok, keyHex: ok ? _bytesToHex(Kauth) : null };
            } catch {
                return { ok: false, keyHex: null };
            }
        }

        // ── v1 (legacy): CryptoJS PBKDF2-SHA1/50k → AES-CBC ────────────────
        if (!ch.verify_iv) return { ok: false, keyHex: null };
        const key = CryptoJS.PBKDF2(pwd, CryptoJS.enc.Hex.parse(ch.salt), {
            keySize: PBKDF2_KS, iterations: PBKDF2_ITER,
        });
        const dec = CryptoJS.AES.decrypt(ch.verify_blob, key, {
            iv: CryptoJS.enc.Hex.parse(ch.verify_iv),
        });
        const ok = dec.toString(CryptoJS.enc.Utf8) === 'DEVSUITE_MASTER_OK';
        return { ok, keyHex: ok ? key.toString() : null };
    }

    // ── Acquire server-side session cookie ────────────────────────
    // The server responds by setting an HttpOnly ds_session cookie and a
    // readable ds_csrf cookie.  No token is stored in JS storage.
    // Returns true on success; returns false on non-ok responses or network errors.
    async function _acquireServerSession(keyHex) {
        try {
            const r = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key_hex: keyHex }),
            });
            if (r.ok) {
                _sessionKeyHex = keyHex;  // in-memory only — NOT written to sessionStorage
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    // ── Overlay HTML ──────────────────────────────────────────────
    // Built with DOM methods (not innerHTML) so toolName/toolIcon — though
    // currently static call-site literals — cannot become an injection vector
    // if future callers pass dynamic content (SPEC.md §2 / CLAUDE.md rule 4).
    function _buildOverlay(toolName, toolIcon, sessionInfo) {
        if (document.getElementById('ag-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'ag-overlay';

        const card = document.createElement('div');
        card.className = 'ag-card';

        // Icon
        const iconEl = document.createElement('div');
        iconEl.className = 'ag-icon';
        iconEl.textContent = toolIcon || '🔒';

        // Title
        const titleEl = document.createElement('h2');
        titleEl.className = 'ag-title';
        titleEl.textContent = toolName;

        card.appendChild(iconEl);
        card.appendChild(titleEl);

        // Optional session badge (non-sensitive: just a countdown string)
        if (sessionInfo) {
            const badge = document.createElement('div');
            badge.className = 'ag-session-badge';
            badge.textContent = `✅ Session active · expires in ${sessionInfo}`;
            card.appendChild(badge);
        }

        // Description paragraph
        const desc = document.createElement('p');
        desc.className = 'ag-desc';
        desc.id = 'ag-desc';
        desc.textContent = 'Enter your DevSuite master password to continue.';
        card.appendChild(desc);

        // Not-setup notice
        const notSetup = document.createElement('div');
        notSetup.id = 'ag-not-setup';
        notSetup.className = 'ag-notice';
        notSetup.style.display = 'none';
        const nsIcon = document.createElement('span');
        nsIcon.textContent = '⚠️';
        const nsText = document.createElement('span');
        nsText.textContent = 'No master password configured yet. Visit ';
        const nsLink = document.createElement('a');
        nsLink.href = '/vault';
        nsLink.className = 'ag-link';
        nsLink.textContent = 'Secret Vault';
        const nsTextEnd = document.createTextNode(' first to set one up.');
        nsText.appendChild(nsLink);
        nsText.appendChild(nsTextEnd);
        notSetup.appendChild(nsIcon);
        notSetup.appendChild(nsText);
        card.appendChild(notSetup);

        // Form
        const form = document.createElement('div');
        form.id = 'ag-form';
        form.style.display = 'none';

        const pwInput = document.createElement('input');
        pwInput.type = 'password';
        pwInput.id = 'ag-pw';
        pwInput.className = 'ag-input';
        pwInput.placeholder = 'Master Password';
        pwInput.autocomplete = 'off';
        pwInput.spellcheck = false;

        const errDiv = document.createElement('div');
        errDiv.id = 'ag-err';
        errDiv.className = 'ag-error';
        errDiv.style.display = 'none';

        const hint = document.createElement('p');
        hint.className = 'ag-hint';
        hint.textContent = '🕐 Your session will be remembered for 8 hours.';

        const btn = document.createElement('button');
        btn.id = 'ag-btn';
        btn.className = 'ag-btn';
        btn.textContent = 'Unlock';

        form.appendChild(pwInput);
        form.appendChild(errDiv);
        form.appendChild(hint);
        form.appendChild(btn);
        card.appendChild(form);

        // Footer warning (static copy — safe as textContent)
        const warning = document.createElement('div');
        warning.className = 'ag-warning';
        warning.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        const warnText = document.createTextNode(' Same master password as Secret Vault · Session valid for 8 hours');
        warning.appendChild(warnText);
        card.appendChild(warning);

        overlay.appendChild(card);
        document.body.insertBefore(overlay, document.body.firstChild);
    }

    // ── Public: init ──────────────────────────────────────────────
    /**
     * Gate a tool behind master-password auth with an 8-hour session.
     * @param {string} toolName  Display name shown on the lock card
     * @param {string} toolIcon  Emoji shown at the top of the lock card
     * @returns {Promise<string>} Resolves with the master password once verified.
     *                            If master password is not set up, resolves with null
     *                            (caller should handle gracefully).
     */
    async function init(toolName, toolIcon) {
        _injectStyle();

        // Fast path: session still valid in this page's lifetime (password is in-memory).
        // Re-acquire the server cookie on every fast-path hit so server restarts
        // (which clear the in-memory session store) are handled transparently.
        if (_sessionValid() && _cachedPwd()) {
            if (_sessionKeyHex) await _acquireServerSession(_sessionKeyHex);
            return _cachedPwd();
        }

        // Need to show the overlay
        const sessionInfo = _sessionValid() ? _sessionExpiresIn() : null;
        _buildOverlay(toolName, toolIcon || '🔒', sessionInfo);
        const overlay = document.getElementById('ag-overlay');
        overlay.style.display = 'flex';

        // Check if master password has been configured
        let isSetup = false;
        try {
            const st = await fetch('/api/auth/status').then(r => r.json());
            isSetup = st.is_setup;
        } catch { /* server error — leave isSetup=false */ }

        if (!isSetup) {
            document.getElementById('ag-not-setup').style.display = 'flex';
            // Resolve with null — caller decides whether to allow unauthenticated access
            return null;
        }

        document.getElementById('ag-form').style.display = 'flex';
        setTimeout(() => document.getElementById('ag-pw').focus(), 80);

        return new Promise((resolve) => {
            async function doUnlock() {
                const pw  = document.getElementById('ag-pw').value;
                const err = document.getElementById('ag-err');
                const btn = document.getElementById('ag-btn');
                err.style.display = 'none';

                if (!pw) {
                    err.textContent = 'Please enter the master password.';
                    err.style.display = 'block';
                    return;
                }

                btn.disabled = true;
                btn.textContent = 'Verifying…';

                try {
                    const { ok, keyHex } = await _verify(pw);
                    if (!ok) {
                        err.textContent = '❌ Incorrect master password.';
                        err.style.display = 'block';
                        return;
                    }
                    if (keyHex) {
                        const ok = await _acquireServerSession(keyHex);
                        if (!ok) {
                            err.textContent = '❌ Session could not be established — server may be unreachable.';
                            err.style.display = 'block';
                            return;
                        }
                    }
                    _cacheSession(pw);
                    overlay.style.display = 'none';
                    resolve(pw);
                } catch {
                    err.textContent = '❌ Verification failed — server may be unreachable.';
                    err.style.display = 'block';
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Unlock';
                }
            }

            document.getElementById('ag-btn').addEventListener('click', doUnlock);
            document.getElementById('ag-pw').addEventListener('keydown', e => {
                if (e.key === 'Enter') doUnlock();
            });
        });
    }

    // ── Public: helpers ───────────────────────────────────────────
    /** Return the currently cached password (null if session expired or no session). */
    function cachedPwd() {
        return _sessionValid() ? _cachedPwd() : null;
    }

    /** Invalidate the current session (e.g., on explicit sign-out). */
    async function clearSession() {
        try {
            const m = /(?:^|;\s*)ds_csrf=([^;]+)/.exec(document.cookie);
            const csrfToken = m ? decodeURIComponent(m[1]) : '';
            const headers = csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
            await fetch('/api/auth/logout', { method: 'POST', headers });
        } catch { /* best-effort — local state is cleared regardless */ }
        localStorage.removeItem(LS_EXPIRY_KEY);
        _sessionPwd    = null;
        _sessionKeyHex = null;
    }

    return { init, cachedPwd, clearSession };
})();
