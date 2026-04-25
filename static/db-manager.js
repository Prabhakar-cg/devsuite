/* ================================================================
   DevDB Manager — db-manager.js
   Handles: metadata loading, store display, export, import,
            password management, backup, and format inspection.
   ================================================================ */
'use strict';

// ── Store metadata ────────────────────────────────────────────────────────────
const STORE_META = {
    vault:        { icon: '🔐', label: 'Secret Vault',    locked: true,  desc: 'AES-256-GCM encrypted secrets' },
    collections:  { icon: '📡', label: 'API Collections', locked: false, desc: 'API Tester saved collections' },
    ssh_profiles: { icon: '🖥️', label: 'SSH Profiles',   locked: true,  desc: 'Encrypted SSH session profiles' },
    url_db:       { icon: '🔗', label: 'URL Shortener',   locked: false, desc: 'Short URL mappings' },
    app_prefs:    { icon: '⚙️', label: 'App Preferences', locked: false, desc: 'Global DevSuite settings' },
};

// ── State ─────────────────────────────────────────────────────────────────────
let _meta = null;
let _authenticated = false;

function _csrfToken() {
    const m = document.cookie.match(/(?:^|;\s*)ds_csrf=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
}

function _authHeaders() {
    const csrf = _csrfToken();
    return csrf ? { 'X-CSRF-Token': csrf } : {};
}

async function _authFetch(url, opts = {}) {
    const res = await fetch(url, { ...opts, headers: { ..._authHeaders(), ...opts.headers } });
    return res;
}

const PBKDF2_ITERATIONS = 50000;
const PBKDF2_KEYSIZE    = 256 / 32;

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmtBytes(bytes) {
    if (bytes === 0)    return '0 B';
    if (bytes < 1024)   return `${bytes} B`;
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/(1024*1024)).toFixed(2)} MB`;
}

function fmtTs(ms) {
    if (!ms) return '—';
    return new Date(ms).toLocaleString();
}

function relTime(ms) {
    if (!ms) return '—';
    const diff = Date.now() - ms;
    const s = Math.floor(diff / 1000);
    if (s < 5)   return 'just now';
    if (s < 60)  return `${s}s ago`;
    const m = Math.floor(s/60);
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m/60);
    if (h < 24)  return `${h}h ago`;
    return `${Math.floor(h/24)}d ago`;
}

function storeEntryCount(name, count) {
    // Check name first so locked stores always show the lock marker
    if (name === 'vault' || name === 'ssh_profiles') return '🔒'; // opaque
    if (count === null || count === undefined) return null;
    return count;
}

// ── Lock screen ───────────────────────────────────────────────────────────────
async function initLockScreen() {
    const overlay = document.getElementById('lock-overlay');

    // DB Manager always re-asks for the password on every page load.
    // (Vault does the same — no session caching for either.)

    // Show the DB file path on the lock screen (path is not sensitive)
    try {
        const meta = await _authFetch('/api/db/meta').then(r => r.json());
        if (meta.path) {
            document.getElementById('lock-db-path-text').textContent = meta.path;
            document.getElementById('lock-db-path').style.display = 'flex';
            // Also populate the main banner immediately
            renderFileBanner(meta);
            renderStores(meta);
            updateEncryptionBadge(meta.encrypted);
            _meta = meta;
        }
    } catch (e) { console.error(e); }

    // Check whether master password has been configured
    let isSetup = false;
    try {
        const status = await fetch('/api/auth/status').then(r => r.json());
        isSetup = status.is_setup;
    } catch (e) {
        toast('Could not check auth status: ' + e.message, 'error');
    }

    if (isSetup) {
        document.getElementById('lock-form').style.display = 'block';
        // Focus password field after a tick
        setTimeout(() => document.getElementById('lock-pw-input').focus(), 80);
    } else {
        document.getElementById('not-setup-notice').style.display = 'flex';
        document.getElementById('lock-form').style.display = 'none';
    }

    overlay.style.display = 'flex';
}

async function attemptUnlock() {
    const pw    = document.getElementById('lock-pw-input').value;
    const errEl = document.getElementById('lock-error');
    errEl.style.display = 'none';

    if (!pw) {
        errEl.textContent = 'Please enter the master password.';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('lock-unlock-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying…';

    try {
        const challenge = await fetch('/api/auth/challenge').then(r => r.json());
        const salt = CryptoJS.enc.Hex.parse(challenge.salt);
        const key  = CryptoJS.PBKDF2(pw, salt, { keySize: PBKDF2_KEYSIZE, iterations: PBKDF2_ITERATIONS });
        const dec  = CryptoJS.AES.decrypt(challenge.verify_blob, key, {
            iv: CryptoJS.enc.Hex.parse(challenge.verify_iv),
        });
        const plaintext = dec.toString(CryptoJS.enc.Utf8);

        if (plaintext !== 'DEVSUITE_MASTER_OK') {
            errEl.textContent = '❌ Incorrect master password.';
            errEl.style.display = 'block';
            return;
        }

        // Exchange verified key for session cookies (HttpOnly ds_session + readable ds_csrf).
        const sr = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key_hex: key.toString() }),
        });
        if (!sr.ok) {
            errEl.textContent = '❌ Session exchange failed. Please try again.';
            errEl.style.display = 'block';
            return;
        }

        // Success — show the manager
        document.getElementById('lock-overlay').style.display = 'none';
        _authenticated = true;
        document.getElementById('lock-pw-input').value = '';
        loadMeta();
        toast('✅ Access granted', 'success');
    } catch (e) {
        console.error(e);
        errEl.textContent = '❌ Incorrect master password.';
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Unlock';
    }
}

// ── Load & render metadata ─────────────────────────────────────────────────────
async function loadMeta() {
    if (!_authenticated) return;
    try {
        const r = await _authFetch('/api/db/meta');
        if (r.status === 401) {
            // Session expired — re-lock the UI
            _authenticated = false;
            document.getElementById('lock-overlay').style.display = 'flex';
            toast('Session expired. Please unlock again.', 'warn');
            return;
        }
        const data = await r.json();
        _meta = data;
        renderFileBanner(data);
        renderStores(data);
        updateEncryptionBadge(data.encrypted);
    } catch (err) {
        toast('Failed to load database info: ' + err.message, 'error');
    }
}

function renderFileBanner(data) {
    document.getElementById('db-path').textContent     = data.path || '—';
    document.getElementById('db-size').textContent     = fmtBytes(data.size || 0);
    document.getElementById('db-modified').textContent = relTime(data.meta?.modified);
    document.getElementById('db-created').textContent  = fmtTs(data.meta?.created);
    document.getElementById('db-version').textContent  = `v${data.meta?.version || 1}`;
    document.getElementById('db-enc-stat').textContent = data.encrypted ? '🔑 Encrypted' : '📄 Plaintext';
    document.getElementById('db-enc-stat').className   = 'stat-value ' + (data.encrypted ? 'amber' : 'green');
}

function renderStores(data) {
    const grid  = document.getElementById('stores-grid');
    const sizes = data.stores || {};
    const storesToShow = Object.keys(STORE_META);

    grid.innerHTML = '';
    storesToShow.forEach(name => {
        const m        = STORE_META[name];
        const storeInfo = sizes[name];
        const kb       = storeInfo ? fmtBytes(storeInfo.bytes) : null;
        const hasData  = Boolean(storeInfo);

        const card = document.createElement('div');
        card.className = 'store-card' + (hasData ? '' : ' empty');
        const entryCount = storeEntryCount(name, storeInfo?.count ?? null);
        const entryDisplay = entryCount ?? '—';
        const entriesHtml = hasData
            ? `<div class="store-card-entries">${entryDisplay}</div>`
            : '<div class="store-card-entries" style="font-size:16px;color:var(--text-muted)">Empty</div>';
        card.innerHTML = `
            <div class="store-card-icon">${m.icon}</div>
            <div class="store-card-name">${m.label}</div>
            <div class="store-card-size">${kb ? kb + ' used' : 'No data'}</div>
            ${entriesHtml}
            ${m.locked ? '<div class="store-card-lock" title="Client-side encrypted">🔒</div>' : ''}
        `;
        grid.appendChild(card);
    });
}

function updateEncryptionBadge(encrypted) {
    const badge = document.getElementById('enc-badge');
    if (encrypted) {
        badge.textContent = '🔑 Server-Encrypted';
        badge.className   = 'header-badge badge-enc';
    } else {
        badge.textContent = '✅ Integrity-Checked';
        badge.className   = 'header-badge badge-secure';
    }
}

// ── Export ─────────────────────────────────────────────────────────────────────
async function doExport() {
    try {
        const res = await _authFetch('/api/db/export');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const ts = new Date().toISOString().slice(0, 10);
        const a  = document.createElement('a');
        a.href = objUrl;
        a.download = `devdb-backup-${ts}.dsb`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
        toast('💾 Database exported as .dsb file', 'success');
    } catch (err) {
        toast('Export failed: ' + err.message, 'error');
    }
}

// ── Import ─────────────────────────────────────────────────────────────────────
function setupImport() {
    const input = document.getElementById('import-file-input');
    const btn   = document.getElementById('import-btn');
    const bar   = document.getElementById('import-progress');
    const prog  = document.getElementById('import-bar');

    btn.addEventListener('click', () => input.click());

    input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;

        if (!file.name.endsWith('.dsb')) {
            toast('Only .dsb files can be imported', 'error');
            input.value = '';
            return;
        }

        btn.disabled = true;
        bar.style.display = 'block';
        prog.style.width  = '30%';

        try {
            const form = new FormData();
            form.append('file', file);
            prog.style.width = '60%';

            const res = await _authFetch('/api/db/import', { method: 'POST', body: form });
            prog.style.width = '100%';

            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.detail || `HTTP ${res.status}`);
            }
            const result = await res.json();
            toast(`✅ Imported ${result.imported_stores?.length || 0} stores from ${file.name}`, 'success');
            await loadMeta();
        } catch (err) {
            toast('Import failed: ' + err.message, 'error');
        } finally {
            btn.disabled     = false;
            input.value      = '';
            setTimeout(() => { bar.style.display = 'none'; prog.style.width = '0%'; }, 1200);
        }
    });
}

// ── Password modal ────────────────────────────────────────────────────────────
function openPasswordModal() {
    document.getElementById('pw-modal').showModal();
    document.getElementById('new-pw-input').focus();
}
function closePasswordModal() {
    document.getElementById('pw-modal').close();
    document.getElementById('new-pw-input').value    = '';
    document.getElementById('confirm-pw-input').value = '';
    document.getElementById('pw-modal-alert').style.display = 'none';
}

async function savePassword() {
    const pw1   = document.getElementById('new-pw-input').value;
    const pw2   = document.getElementById('confirm-pw-input').value;
    const alert = document.getElementById('pw-modal-alert');
    alert.style.display = 'none';

    // Allow empty password to remove encryption
    if (pw1 !== pw2) {
        alert.textContent    = 'Passwords do not match.';
        alert.style.display  = 'flex';
        return;
    }

    const saveBtn = document.getElementById('pw-save-btn');
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';

    try {
        let payload;
        if (pw1) {
            const salt      = CryptoJS.lib.WordArray.random(16);
            const key       = CryptoJS.PBKDF2(pw1, salt, { keySize: PBKDF2_KEYSIZE, iterations: PBKDF2_ITERATIONS });
            const verifyIv   = CryptoJS.lib.WordArray.random(16);
            const verifyBlob = CryptoJS.AES.encrypt('DEVSUITE_MASTER_OK', key, { iv: verifyIv });
            payload = {
                salt:        salt.toString(),
                verify_blob: verifyBlob.toString(),
                verify_iv:   verifyIv.toString(),
            };
        } else {
            payload = { salt: '', verify_blob: '', verify_iv: '' };
        }

        const res = await _authFetch('/api/auth/update-challenge', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Server error ${res.status}`);
        }
        toast('✅ Password updated successfully.', 'success');
        closePasswordModal();
    } catch (err) {
        alert.textContent   = err.message;
        alert.style.display = 'flex';
    } finally {
        saveBtn.disabled = false; saveBtn.textContent = 'Apply Password';
    }
}

// ── Refresh ────────────────────────────────────────────────────────────────────
async function doRefresh() {
    const btn = document.getElementById('refresh-btn');
    btn.disabled = true;
    const origText  = btn.textContent;
    btn.textContent = 'Refreshing…';
    await loadMeta();
    toast('✅ Refreshed', 'success');
    btn.disabled    = false;
    btn.textContent = origText;
}

// ── About / format panel ──────────────────────────────────────────────────────
function setupAboutPanel() {
    const toggle = document.getElementById('about-toggle');
    const body   = document.getElementById('about-body');
    toggle.addEventListener('click', () => {
        const open = body.classList.toggle('open');
        toggle.classList.toggle('open', open);
    });
}

// ── DOMContentLoaded ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Show lock screen (will call loadMeta internally once authenticated)
    initLockScreen();

    // Lock screen events
    document.getElementById('lock-unlock-btn').addEventListener('click', attemptUnlock);
    document.getElementById('lock-pw-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') attemptUnlock();
    });

    // Export
    document.getElementById('export-btn').addEventListener('click', doExport);

    // Import
    setupImport();

    // Refresh
    document.getElementById('refresh-btn').addEventListener('click', doRefresh);

    // Password modal
    document.getElementById('change-pw-btn').addEventListener('click', openPasswordModal);
    document.getElementById('pw-cancel-btn').addEventListener('click', closePasswordModal);
    document.getElementById('pw-save-btn').addEventListener('click',   savePassword);
    document.getElementById('pw-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('pw-modal')) closePasswordModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePasswordModal(); });

    // About panel
    setupAboutPanel();

    // Auto-refresh every 30 seconds (only fires when authenticated)
    setInterval(loadMeta, 30_000);
});
