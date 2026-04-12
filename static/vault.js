/* ================================================================
   DevSuite — Secret Vault  (vault.js)
   AES-256 encrypted secrets manager, KeePass-style.
   All crypto is client-side via CryptoJS (already bundled).
   ================================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────────────
let masterKey = null;       // Derived CryptoJS key (in-memory only)
let vaultSaltHex = null;    // Hex-encoded PBKDF2 salt (kept in memory, persisted with every save)
let vaultEntries = [];      // Decrypted entries array
let activeFilter = 'all';
let searchQuery  = '';
let selectedId   = null;
let editingId    = null;    // null = new entry
let revealedFields = new Set(); // field ids currently revealed
let autoLockTimer = null;
const PBKDF2_ITERATIONS = 50000;
const PBKDF2_KEYSIZE    = 256 / 32;  // 256-bit key → 8 32-bit words

// ── Setup-mode state ──────────────────────────────────────────────
// isSetupMode  = true when no master password has been configured yet
// isNewVault   = true when the vault store has no data (brand new install)
let isSetupMode = false;
let isNewVault  = false;

// ── Type metadata ─────────────────────────────────────────────────
const TYPE_META = {
    password: { emoji: '🔑', label: 'Password',    badgeClass: 'badge-password', iconClass: 'icon-password' },
    token:    { emoji: '🪙', label: 'Token',        badgeClass: 'badge-token',    iconClass: 'icon-token'    },
    ssh:      { emoji: '🗝️', label: 'SSH Key',      badgeClass: 'badge-ssh',      iconClass: 'icon-ssh'      },
    api:      { emoji: '⚡',  label: 'API Key',      badgeClass: 'badge-api',      iconClass: 'icon-api'      },
    env:      { emoji: '📦', label: 'Env Secret',   badgeClass: 'badge-env',      iconClass: 'icon-env'      },
    note:     { emoji: '📝', label: 'Secure Note',  badgeClass: 'badge-note',     iconClass: 'icon-note'     },
};

// ── Crypto helpers ────────────────────────────────────────────────
function deriveKey(password, salt) {
    return CryptoJS.PBKDF2(password, salt, {
        keySize: PBKDF2_KEYSIZE,
        iterations: PBKDF2_ITERATIONS,
    });
}

function encryptVault(entries, key) {
    const plain = JSON.stringify(entries);
    const iv    = CryptoJS.lib.WordArray.random(16);
    const enc   = CryptoJS.AES.encrypt(plain, key, { iv });
    return {
        ciphertext: enc.toString(),
        iv: iv.toString(),
    };
}

function decryptVault(ciphertext, iv, key) {
    const dec = CryptoJS.AES.decrypt(ciphertext, key, {
        iv: CryptoJS.enc.Hex.parse(iv),
    });
    return JSON.parse(dec.toString(CryptoJS.enc.Utf8));
}

// ── ID generator ──────────────────────────────────────────────────
function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Session token helpers ─────────────────────────────────────────
function _serverToken() {
    return sessionStorage.getItem('devsuite_server_token') || '';
}

function _authHeaders(extra) {
    const token = _serverToken();
    const h = Object.assign({}, extra);
    if (token) h['X-Session-Token'] = token;
    return h;
}

async function _acquireServerSession(keyHex) {
    try {
        const r = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key_hex: keyHex }),
        });
        if (!r.ok) return;
        const { session_token } = await r.json();
        if (session_token) sessionStorage.setItem('devsuite_server_token', session_token);
    } catch { /* non-fatal */ }
}

// ── Persist vault to server ───────────────────────────────────────
async function persistVault() {
    if (!masterKey) return;
    const payload = encryptVault(vaultEntries, masterKey);
    const res = await fetch('/api/vault', {
        method: 'POST',
        headers: _authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ encrypted_blob: payload.ciphertext, iv: payload.iv, salt: vaultSaltHex }),
    });
    if (!res.ok) throw new Error(`Vault save failed: HTTP ${res.status}`);
}

// ── Load vault from server ────────────────────────────────────────
async function loadVault(key) {
    const res  = await fetch('/api/vault', { headers: _authHeaders() });
    const data = await res.json();
    if (!data.encrypted_blob) {
        // New vault — initialize empty
        return [];
    }
    try {
        return decryptVault(data.encrypted_blob, data.iv, key);
    } catch {
        throw new Error('Wrong password or corrupted vault.');
    }
}

// ── Lock / Unlock ─────────────────────────────────────────────────
function lockVault() {
    masterKey = null;
    vaultSaltHex = null;
    vaultEntries = [];
    selectedId = null;
    editingId = null;
    revealedFields.clear();
    clearAutoLock();
    document.getElementById('lock-overlay').style.display = 'flex';
    document.getElementById('master-pw-input').value = '';
    document.getElementById('lock-error').style.display = 'none';
    renderAll();
}

async function unlockVault(password) {
    const errEl = document.getElementById('lock-error');
    errEl.style.display = 'none';

    // ── Setup-mode validations ──────────────────────────────────────
    if (isSetupMode && isNewVault) {
        // Creating a brand-new master password: enforce confirm match + min length
        const confirm = document.getElementById('master-pw-confirm').value;
        if (password !== confirm) {
            errEl.textContent = '❌ Passwords do not match.';
            errEl.style.display = 'block';
            return;
        }
        if (password.length < 8) {
            errEl.textContent = '❌ Master password must be at least 8 characters.';
            errEl.style.display = 'block';
            return;
        }
    }

    // Acquire a server session before hitting the protected API.
    // Use the auth-challenge salt for the server session key derivation.
    const PBKDF2_AG_ITER = 50000;
    const PBKDF2_AG_KS   = 256 / 32;
    try {
        const chRes = await fetch('/api/auth/challenge');
        if (chRes.ok) {
            const ch = await chRes.json();
            if (ch.salt) {
                const sessionKey = CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(ch.salt), {
                    keySize: PBKDF2_AG_KS, iterations: PBKDF2_AG_ITER,
                });
                await _acquireServerSession(sessionKey.toString());
            }
        }
    } catch { /* non-fatal */ }

    const res  = await fetch('/api/vault', { headers: _authHeaders() });
    const data = await res.json();

    let salt;
    if (data.salt) {
        vaultSaltHex = data.salt;
        salt = CryptoJS.enc.Hex.parse(data.salt);
    } else {
        // New vault — generate a salt and save it
        salt = CryptoJS.lib.WordArray.random(16);
        vaultSaltHex = salt.toString();
        await fetch('/api/vault', {
            method: 'POST',
            headers: _authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ encrypted_blob: '', iv: '', salt: vaultSaltHex }),
        });
    }

    const key = deriveKey(password, salt);

    if (data.encrypted_blob) {
        try {
            vaultEntries = decryptVault(data.encrypted_blob, data.iv, key);
        } catch {
            errEl.textContent = '❌ Incorrect password — cannot decrypt vault.';
            errEl.style.display = 'block';
            return;
        }
    } else {
        vaultEntries = [];
    }

    // ── Register master password challenge (first-time or migration) ─
    if (isSetupMode) {
        try {
            const verifyIv   = CryptoJS.lib.WordArray.random(16);
            const verifyBlob = CryptoJS.AES.encrypt('DEVSUITE_MASTER_OK', key, { iv: verifyIv });
            const setupRes = await fetch('/api/auth/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    salt:        salt.toString(),
                    verify_blob: verifyBlob.toString(),
                    verify_iv:   verifyIv.toString(),
                }),
            });
            if (setupRes.ok) {
                // Challenge is now registered — acquire a server session immediately.
                // key and sessionKey are identical (same salt + iterations), so key.toString()
                // is the correct hex to pass to /api/auth/session.
                await _acquireServerSession(key.toString());
                // Retry the initial vault-salt save that failed earlier (no session at that point).
                if (isNewVault) {
                    await fetch('/api/vault', {
                        method: 'POST',
                        headers: _authHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({ encrypted_blob: '', iv: '', salt: vaultSaltHex }),
                    });
                }
            }
            isSetupMode = false;
            // Reset lock screen to normal-unlock appearance for future locks
            document.getElementById('lock-setup-desc').textContent =
                'Your secrets are encrypted with AES-256. Enter your master password to unlock.';
            document.getElementById('master-pw-confirm-wrap').style.display = 'none';
            document.getElementById('unlock-btn').textContent = 'Unlock Vault';
        } catch (e) {
            // Non-fatal — vault still works; warn in console
            console.warn('Failed to register master password challenge:', e);
        }
    }

    masterKey = key;
    document.getElementById('lock-overlay').style.display = 'none';
    renderAll();
    toast('Vault unlocked ✓', 'success');
    startAutoLock();
}

// ── Auto-lock on page hide > 5 min ───────────────────────────────
let hiddenSince = null;
const AUTO_LOCK_AFTER_MS = 5 * 60 * 1000;

function startAutoLock() {
    document.addEventListener('visibilitychange', onVisibilityChange);
}
function clearAutoLock() {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    hiddenSince = null;
    if (autoLockTimer) { clearTimeout(autoLockTimer); autoLockTimer = null; }
}
function onVisibilityChange() {
    if (document.hidden) {
        hiddenSince = Date.now();
        autoLockTimer = setTimeout(() => {
            if (masterKey) { lockVault(); toast('Vault auto-locked after inactivity', 'error'); }
        }, AUTO_LOCK_AFTER_MS);
    } else {
        if (autoLockTimer) { clearTimeout(autoLockTimer); autoLockTimer = null; }
    }
}

// ── Clipboard (auto-clear after 30s) ─────────────────────────────
let clipTimer = null;
function copyToClipboard(text, label = 'Value') {
    navigator.clipboard.writeText(text).then(() => {
        toast(`${label} copied — cleared in 30s`, 'success');
        if (clipTimer) clearTimeout(clipTimer);
        clipTimer = setTimeout(() => navigator.clipboard.writeText(''), 30000);
    });
}

// ── Toast ─────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3200);
}

// ── Filters & search ─────────────────────────────────────────────
function filteredEntries() {
    return vaultEntries
        .filter(e => activeFilter === 'all' || e.type === activeFilter)
        .filter(e => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                e.title.toLowerCase().includes(q) ||
                (e.subtitle || '').toLowerCase().includes(q)
            );
        })
        .sort((a, b) => b.modified - a.modified);
}

function subtitleFor(e) {
    switch (e.type) {
        case 'password': return e.username || e.url || '';
        case 'token':    return e.service + (e.environment ? ` · ${e.environment}` : '');
        case 'ssh':      return e.host || '';
        case 'api':      return e.service + (e.environment ? ` · ${e.environment}` : '');
        case 'env':      return e.varname || '';
        case 'note':     return (e.content || '').slice(0, 60).replace(/\n/g, ' ');
        default: return '';
    }
}

// ── Render counts in sidebar ──────────────────────────────────────
function renderCounts() {
    const types = ['password','token','ssh','api','env','note'];
    document.getElementById('count-all').textContent = vaultEntries.length;
    types.forEach(t => {
        document.getElementById(`count-${t}`).textContent =
            vaultEntries.filter(e => e.type === t).length;
    });
}

// ── Render entry list ─────────────────────────────────────────────
function renderEntryList() {
    const list  = document.getElementById('entry-list');
    const empty = document.getElementById('empty-list');
    const countEl = document.getElementById('entry-count');
    const headEl  = document.getElementById('list-heading');

    const TYPE_LABELS = { all:'All Secrets', password:'Passwords', token:'Tokens', ssh:'SSH Keys', api:'API Keys', env:'Env Secrets', note:'Secure Notes' };
    headEl.textContent = TYPE_LABELS[activeFilter] || 'All Secrets';

    const entries = filteredEntries();
    countEl.textContent = entries.length;

    // clear without removing the empty-list div
    [...list.querySelectorAll('.entry-item')].forEach(el => el.remove());

    if (entries.length === 0) {
        empty.style.display = 'flex';
        empty.innerHTML = searchQuery
            ? `<div class="icon">🔍</div><p>No results for "<strong>${escHtml(searchQuery)}</strong>"</p>`
            : `<div class="icon">🔐</div><p>No secrets yet.<br>Click <strong>New Secret</strong> to add one.</p>`;
        return;
    }

    empty.style.display = 'none';
    const m = TYPE_META;
    entries.forEach(e => {
        const item = document.createElement('div');
        item.className = 'entry-item' + (e.id === selectedId ? ' selected' : '');
        item.dataset.id = e.id;
        const sub = subtitleFor(e);
        item.innerHTML = `
            <div class="entry-item-header">
                <span class="entry-type-badge ${m[e.type].badgeClass}">${m[e.type].emoji} ${m[e.type].label}</span>
            </div>
            <div class="entry-title">${escHtml(e.title)}</div>
            ${sub ? `<div class="entry-subtitle">${escHtml(sub)}</div>` : ''}
            <div class="entry-modified">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${relativeTime(e.modified)}
            </div>`;
        item.addEventListener('click', () => selectEntry(e.id));
        list.appendChild(item);
    });
}

// ── Render detail panel ───────────────────────────────────────────
function renderDetail() {
    const emptyEl   = document.getElementById('detail-empty');
    const contentEl = document.getElementById('detail-content');

    if (!selectedId) {
        emptyEl.style.display='flex'; contentEl.style.display='none'; return;
    }
    const e = vaultEntries.find(x => x.id === selectedId);
    if (!e) { emptyEl.style.display='flex'; contentEl.style.display='none'; return; }

    emptyEl.style.display='none'; contentEl.style.display='flex';

    const m = TYPE_META[e.type];
    const iconEl = document.getElementById('detail-icon');
    iconEl.className = `detail-type-icon ${m.iconClass}`;
    iconEl.style.fontSize = '1.5rem';
    iconEl.textContent = m.emoji;

    document.getElementById('detail-title').textContent = e.title;
    document.getElementById('detail-type-label').textContent = `${m.label} · Modified ${relativeTime(e.modified)}`;

    document.getElementById('edit-btn').onclick = () => openModal(e.id);
    document.getElementById('duplicate-btn').onclick = () => duplicateEntry(e.id);

    const fieldsEl = document.getElementById('detail-fields');
    fieldsEl.innerHTML = '';
    revealedFields.clear();

    buildDetailFields(e, fieldsEl);
}

function buildDetailFields(e, container) {
    switch(e.type) {
        case 'password':
            if (e.username) addFieldRow(container, 'Username', e.username, false, 'username', 'Username');
            addFieldRow(container, 'Password', e.password, true, 'password', 'Password');
            if (e.url) addFieldRow(container, 'Website', e.url, false, 'url', 'URL', true);
            if (e.notes) addNotesRow(container, e.notes);
            break;
        case 'token':
            if (e.service) addFieldRow(container, 'Service', e.service, false, 'service', 'Service');
            addFieldRow(container, 'Token', e.token, true, 'token', 'Token');
            if (e.expiry) addFieldRow(container, 'Expiry', e.expiry, false, 'expiry', 'Expiry');
            if (e.environment) addFieldRow(container, 'Environment', e.environment, false);
            if (e.notes) addNotesRow(container, e.notes);
            break;
        case 'ssh':
            if (e.host) addFieldRow(container, 'Host', e.host, false, 'host', 'Host');
            if (e.username) addFieldRow(container, 'Username', e.username, false, 'username', 'Username');
            addFieldRow(container, 'Private Key', e.private_key, true, 'private_key', 'Private Key', false, true);
            if (e.passphrase) addFieldRow(container, 'Passphrase', e.passphrase, true, 'passphrase', 'Passphrase');
            if (e.notes) addNotesRow(container, e.notes);
            break;
        case 'api':
            if (e.service) addFieldRow(container, 'Service', e.service, false, 'service', 'Service');
            addFieldRow(container, 'API Key', e.api_key, true, 'api_key', 'API Key', false, true);
            if (e.environment) addFieldRow(container, 'Environment', e.environment, false);
            if (e.notes) addNotesRow(container, e.notes);
            break;
        case 'env':
            addFieldRow(container, 'Variable Name', e.varname, false, 'varname', 'Variable Name');
            addFieldRow(container, 'Value', e.value, true, 'value', 'Value', false, true);
            if (e.notes) addNotesRow(container, e.notes);
            break;
        case 'note':
            addNotesRow(container, e.content);
            break;
    }
}

function addFieldRow(container, label, value, secret, fieldId, clipLabel, isUrl=false, isTextarea=false) {
    const row = document.createElement('div');
    row.className = 'field-row';

    let displayVal = secret ? '••••••••••••' : (isUrl ? `<span class="url-inner">${escHtml(value)}</span>` : escHtml(value));
    let hiddenClass = secret ? 'secret-hidden' : '';
    let textareaClass = isTextarea ? 'is-textarea' : '';
    let urlClass = isUrl ? 'url-val' : '';

    row.innerHTML = `
        <div class="field-label">${escHtml(label)}</div>
        <div class="field-val-wrap">
            <div class="field-val ${hiddenClass} ${textareaClass} ${urlClass}" id="fv-${fieldId}"
                 data-secret="${secret}" data-raw="${encodeURIComponent(value)}">
                ${displayVal}
            </div>
            ${secret ? `
            <button class="field-action-btn" title="Reveal / hide" onclick="toggleReveal('${fieldId}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="eye-${fieldId}">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
            </button>` : ''}
            <button class="field-action-btn" title="Copy to clipboard" onclick="copyToClipboard(decodeURIComponent('${encodeURIComponent(value)}'),'${clipLabel || label}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
            </button>
        </div>`;
    container.appendChild(row);

    // Attach safe URL opener — validates scheme before opening
    if (isUrl) {
        const fvEl = document.getElementById(`fv-${fieldId}`);
        if (fvEl) {
            fvEl.style.cursor = 'pointer';
            fvEl.addEventListener('click', function () {
                try {
                    const raw = decodeURIComponent(this.dataset.raw);
                    const parsed = new URL(raw);
                    if (!/^https?:$/.test(parsed.protocol)) return;
                    window.open(raw, '_blank', 'noopener,noreferrer');
                } catch { /* invalid URL — do nothing */ }
            });
        }
    }
}

function addNotesRow(container, text) {
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `
        <div class="field-label">Notes</div>
        <div class="field-notes">${escHtml(text)}</div>`;
    container.appendChild(row);
}

window.toggleReveal = function(fieldId) {
    const el = document.getElementById(`fv-${fieldId}`);
    if (!el) return;
    const raw = decodeURIComponent(el.dataset.raw);
    if (revealedFields.has(fieldId)) {
        revealedFields.delete(fieldId);
        el.classList.add('secret-hidden');
        el.textContent = '••••••••••••';
    } else {
        revealedFields.add(fieldId);
        el.classList.remove('secret-hidden');
        el.textContent = raw;
    }
};

// ── Entry CRUD ────────────────────────────────────────────────────
function selectEntry(id) {
    selectedId = id;
    renderEntryList();
    renderDetail();
}

async function duplicateEntry(id) {
    const src = vaultEntries.find(x => x.id === id);
    if (!src) return;
    const dupe = { ...src, id: genId(), title: src.title + ' (copy)', modified: Date.now() };
    vaultEntries.unshift(dupe);
    try { await persistVault(); } catch (e) { toast('Save failed: ' + e.message, 'error'); return; }
    renderCounts();
    selectedId = dupe.id;
    renderEntryList();
    renderDetail();
    toast('Entry duplicated');
}

async function deleteEntry(id) {
    if (!confirm('Delete this secret? This cannot be undone.')) return;
    vaultEntries = vaultEntries.filter(x => x.id !== id);
    try { await persistVault(); } catch (e) { toast('Save failed: ' + e.message, 'error'); return; }
    if (selectedId === id) { selectedId = null; }
    closeModal();
    renderCounts();
    renderEntryList();
    renderDetail();
    toast('Secret deleted', 'error');
}

// ── Modal ─────────────────────────────────────────────────────────
let currentModalType = 'password';

function openModal(id = null) {
    editingId = id;
    const isEdit = id !== null;
    const e = isEdit ? vaultEntries.find(x => x.id === id) : null;

    document.getElementById('modal-title').textContent = isEdit ? 'Edit Secret' : 'New Secret';
    document.getElementById('delete-btn').style.display = isEdit ? 'inline-flex' : 'none';
    document.getElementById('type-picker-group').style.display = isEdit ? 'none' : 'block';

    const type = isEdit ? e.type : 'password';
    currentModalType = type;

    // Reset type opts
    document.querySelectorAll('.type-opt').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.type === type);
    });

    // Show correct field set
    switchFieldSet(type);

    // Populate fields if editing
    if (isEdit && e) populateModal(e);
    else clearModalFields();

    document.getElementById('secret-modal').classList.add('open');
    setTimeout(() => document.getElementById('f-title').focus(), 100);
}

function closeModal() {
    document.getElementById('secret-modal').classList.remove('open');
    editingId = null;
}

function switchFieldSet(type) {
    ['password','token','ssh','api','env','note'].forEach(t => {
        document.getElementById(`fields-${t}`).style.display = t === type ? 'block' : 'none';
    });
    currentModalType = type;
}

function clearModalFields() {
    ['f-title','f-pw-username','f-pw-password','f-pw-url','f-pw-notes',
     'f-tok-service','f-tok-value','f-tok-expiry','f-tok-notes',
     'f-ssh-host','f-ssh-username','f-ssh-key','f-ssh-passphrase','f-ssh-notes',
     'f-api-service','f-api-key','f-api-notes',
     'f-env-varname','f-env-value','f-env-notes',
     'f-note-content'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('f-tok-env').value = '';
    document.getElementById('f-api-env').value = '';
}

function populateModal(e) {
    document.getElementById('f-title').value = e.title || '';
    switch(e.type) {
        case 'password':
            document.getElementById('f-pw-username').value = e.username || '';
            document.getElementById('f-pw-password').value = e.password || '';
            document.getElementById('f-pw-url').value = e.url || '';
            document.getElementById('f-pw-notes').value = e.notes || '';
            break;
        case 'token':
            document.getElementById('f-tok-service').value = e.service || '';
            document.getElementById('f-tok-value').value = e.token || '';
            document.getElementById('f-tok-expiry').value = e.expiry || '';
            document.getElementById('f-tok-env').value = e.environment || '';
            document.getElementById('f-tok-notes').value = e.notes || '';
            break;
        case 'ssh':
            document.getElementById('f-ssh-host').value = e.host || '';
            document.getElementById('f-ssh-username').value = e.username || '';
            document.getElementById('f-ssh-key').value = e.private_key || '';
            document.getElementById('f-ssh-passphrase').value = e.passphrase || '';
            document.getElementById('f-ssh-notes').value = e.notes || '';
            break;
        case 'api':
            document.getElementById('f-api-service').value = e.service || '';
            document.getElementById('f-api-key').value = e.api_key || '';
            document.getElementById('f-api-env').value = e.environment || '';
            document.getElementById('f-api-notes').value = e.notes || '';
            break;
        case 'env':
            document.getElementById('f-env-varname').value = e.varname || '';
            document.getElementById('f-env-value').value = e.value || '';
            document.getElementById('f-env-notes').value = e.notes || '';
            break;
        case 'note':
            document.getElementById('f-note-content').value = e.content || '';
            break;
    }
}

function buildEntryFromModal() {
    const type  = currentModalType;
    const title = document.getElementById('f-title').value.trim();
    if (!title) { toast('Title is required', 'error'); return null; }

    const base = {
        id: editingId || genId(),
        type,
        title,
        modified: Date.now(),
    };

    switch(type) {
        case 'password': {
            const pw = document.getElementById('f-pw-password').value;
            if (!pw) { toast('Password is required', 'error'); return null; }
            return { ...base,
                username: document.getElementById('f-pw-username').value.trim(),
                password: pw,
                url:      document.getElementById('f-pw-url').value.trim(),
                notes:    document.getElementById('f-pw-notes').value.trim(),
            };
        }
        case 'token': {
            const tok = document.getElementById('f-tok-value').value.trim();
            if (!tok) { toast('Token value is required', 'error'); return null; }
            return { ...base,
                service:     document.getElementById('f-tok-service').value.trim(),
                token:       tok,
                expiry:      document.getElementById('f-tok-expiry').value,
                environment: document.getElementById('f-tok-env').value,
                notes:       document.getElementById('f-tok-notes').value.trim(),
            };
        }
        case 'ssh': {
            const key = document.getElementById('f-ssh-key').value.trim();
            if (!key) { toast('Private key is required', 'error'); return null; }
            return { ...base,
                host:        document.getElementById('f-ssh-host').value.trim(),
                username:    document.getElementById('f-ssh-username').value.trim(),
                private_key: key,
                passphrase:  document.getElementById('f-ssh-passphrase').value,
                notes:       document.getElementById('f-ssh-notes').value.trim(),
            };
        }
        case 'api': {
            const ak = document.getElementById('f-api-key').value.trim();
            if (!ak) { toast('API key is required', 'error'); return null; }
            return { ...base,
                service:     document.getElementById('f-api-service').value.trim(),
                api_key:     ak,
                environment: document.getElementById('f-api-env').value,
                notes:       document.getElementById('f-api-notes').value.trim(),
            };
        }
        case 'env': {
            const varname = document.getElementById('f-env-varname').value.trim();
            const val     = document.getElementById('f-env-value').value.trim();
            if (!varname || !val) { toast('Variable name and value are required', 'error'); return null; }
            return { ...base,
                varname,
                value: val,
                notes: document.getElementById('f-env-notes').value.trim(),
            };
        }
        case 'note': {
            const content = document.getElementById('f-note-content').value.trim();
            if (!content) { toast('Note content is required', 'error'); return null; }
            return { ...base, content };
        }
        default: return null;
    }
}

async function saveModal() {
    const entry = buildEntryFromModal();
    if (!entry) return;

    if (editingId) {
        const idx = vaultEntries.findIndex(x => x.id === editingId);
        if (idx >= 0) vaultEntries[idx] = entry;
    } else {
        vaultEntries.unshift(entry);
    }

    entry.subtitle = subtitleFor(entry); // cached subtitle hint

    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
        await persistVault();
    } catch (e) {
        toast('Failed to save secret — check console', 'error');
        console.error('persistVault error:', e);
        return;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Secret';
    }

    selectedId = entry.id;
    closeModal();
    renderCounts();
    renderEntryList();
    renderDetail();
    toast(editingId ? 'Secret updated ✓' : 'Secret saved ✓');
}

// ── Render all ────────────────────────────────────────────────────
function renderAll() {
    renderCounts();
    renderEntryList();
    renderDetail();
}

// ── Utilities ─────────────────────────────────────────────────────
function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
              .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function relativeTime(ts) {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(ts).toLocaleDateString();
}

// ── Detect first-run / setup mode ────────────────────────────────
async function initVaultMode() {
    try {
        const authRes  = await fetch('/api/auth/status');
        const authData = await authRes.json();

        isSetupMode = !authData.is_setup;
        isNewVault  = !authData.vault_has_data;

        if (isSetupMode && isNewVault) {
            // Brand-new install: ask to create the master password
            document.getElementById('lock-setup-desc').textContent =
                'Welcome to DevSuite! Create a master password to encrypt your Vault and all secure data. ' +
                'This password is never stored — keep it safe!';
            document.getElementById('master-pw-confirm-wrap').style.display = 'block';
            document.getElementById('master-pw-input').placeholder = 'New Master Password';
            document.getElementById('unlock-btn').textContent = 'Create Master Password';
        } else if (isSetupMode) {
            // Vault exists but challenge not yet registered (first upgrade from older build)
            document.getElementById('lock-setup-desc').textContent =
                'Enter your existing vault password to register it as the DevSuite master password.';
            document.getElementById('unlock-btn').textContent = 'Unlock & Register';
        }
    } catch (e) {
        console.warn('initVaultMode error:', e);
    }
}

// ── Wire up UI ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // Detect first-run / setup mode before showing the lock screen
    initVaultMode();

    // Lock screen
    const pwInput = document.getElementById('master-pw-input');
    const unlockBtn = document.getElementById('unlock-btn');

    unlockBtn.addEventListener('click', async () => {
        const pw = pwInput.value;
        if (!pw) {
            const err = document.getElementById('lock-error');
            err.textContent = 'Please enter a master password.';
            err.style.display = 'block';
            return;
        }
        const prevText = unlockBtn.textContent;
        unlockBtn.textContent = 'Unlocking…';
        unlockBtn.disabled = true;
        try {
            await unlockVault(pw);
        } finally {
            // Only restore if vault is still locked (unlockVault hides the overlay on success)
            if (document.getElementById('lock-overlay').style.display !== 'none') {
                unlockBtn.textContent = prevText;
            }
            unlockBtn.disabled = false;
        }
    });
    pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') unlockBtn.click(); });

    // Lock now button
    document.getElementById('lock-now-btn').addEventListener('click', () => {
        lockVault();
        toast('Vault locked', 'error');
    });

    // Sidebar filter
    document.getElementById('filter-list').addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.type;
        selectedId = null;
        renderEntryList();
        renderDetail();
    });

    // Search
    document.getElementById('search-input').addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        selectedId = null;
        renderEntryList();
        renderDetail();
    });

    // New secret button
    document.getElementById('sidebar-add-btn').addEventListener('click', () => openModal(null));

    // Type picker in modal
    document.querySelectorAll('.type-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-opt').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            switchFieldSet(btn.dataset.type);
        });
    });

    // Modal close/cancel
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('secret-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('secret-modal')) closeModal();
    });

    // Save secret
    document.getElementById('modal-save-btn').addEventListener('click', saveModal);

    // Delete button (inside modal, needs the editingId)
    document.getElementById('delete-btn').addEventListener('click', () => {
        if (editingId) deleteEntry(editingId);
    });

    // Escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
    });

    // Initial render (vault is locked until master password is entered)
    renderAll();
});

// expose for inline onclick attributes
window.copyToClipboard = copyToClipboard;
