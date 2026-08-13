/* ================================================================
   DevSuite — Secret Vault  (vault.js)
   AES-256 encrypted secrets manager, KeePass-style.
   All crypto is client-side via CryptoJS (already bundled).
   ================================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────────────
// V1 legacy state (CryptoJS — used only during migration of old vaults)
let masterKey = null;       // CryptoJS WordArray (v1 path only; null when unlocked via v2)

// V2 domain-separated keys (WebCrypto — current scheme)
let masterKenc  = null;     // Uint8Array 32 bytes — vault encryption key, NEVER sent to server
let masterKauth = null;     // Uint8Array 32 bytes — server auth key (sent as key_hex to /api/auth/session)

let vaultSaltHex = null;    // Hex-encoded PBKDF2 salt (kept in memory, persisted with every save)
let vaultEntries = [];      // Decrypted entries array
let activeFilter = 'all';
let searchQuery  = '';
let selectedId   = null;
let editingId    = null;    // null = new entry
let revealedFields = new Set(); // field ids currently revealed
let autoLockTimer = null;
// V1 KDF constants (legacy — kept for migration path only)
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

// ── V1 Crypto helpers (legacy — migration path only) ─────────────
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

// ── V2 Crypto helpers (WebCrypto — current scheme) ───────────────
// Uses WebCrypto APIs (always available in modern browsers) to provide:
//   • PBKDF2-HMAC-SHA256 @ 310 000 iterations → 512-bit root
//   • First 256 bits = Kenc  (AES-256-GCM vault encryption — never leaves browser)
//   • Second 256 bits = Kauth (server auth — replaces the old single shared key)
// This satisfies SPEC.md §2 / §7.5: "The backend is an opaque store — it never
// decrypts these."

function _hexToBytes(hex) {
    const b = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) b[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
    return b;
}
function _bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive Kenc + Kauth from password + salt using WebCrypto PBKDF2-SHA256/310k.
 * Returns { Kenc: Uint8Array(32), Kauth: Uint8Array(32) }.
 * Kenc is the vault encryption key (never sent to server).
 * Kauth is the server authentication key (sent as key_hex to /api/auth/session).
 */
async function _deriveMasterKeysV2(password, saltHex) {
    const keyMaterial = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: _hexToBytes(saltHex), iterations: 310000 },
        keyMaterial, 512
    );
    const arr = new Uint8Array(bits);
    return { Kenc: arr.slice(0, 32), Kauth: arr.slice(32, 64) };
}

/** Encrypt vault entries with AES-256-GCM. Returns {version:2, ciphertext, iv} (all hex). */
async function encryptVaultGCM(entries, Kenc) {
    const iv     = crypto.getRandomValues(new Uint8Array(12));
    const aesKey = await crypto.subtle.importKey('raw', Kenc, { name: 'AES-GCM' }, false, ['encrypt']);
    const buf    = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        new TextEncoder().encode(JSON.stringify(entries))
    );
    return { version: 2, ciphertext: _bytesToHex(new Uint8Array(buf)), iv: _bytesToHex(iv) };
}

/** Decrypt AES-256-GCM vault ciphertext (hex) + iv (hex) with Kenc. Returns parsed entries. */
async function decryptVaultGCM(ciphertextHex, ivHex, Kenc) {
    const aesKey = await crypto.subtle.importKey('raw', Kenc, { name: 'AES-GCM' }, false, ['decrypt']);
    const buf    = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: _hexToBytes(ivHex) },
        aesKey,
        _hexToBytes(ciphertextHex)
    );
    return JSON.parse(new TextDecoder().decode(buf));
}

// ── ID generator ──────────────────────────────────────────────────
function genId() {
    const rnd = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    return Date.now().toString(36) + rnd.slice(-5);
}

// ── CSRF token helpers ────────────────────────────────────────────
// DevSuite.csrfToken() is the canonical implementation (components.js).
// This thin wrapper keeps the call-site spelling unchanged.
function _csrfToken() { return DevSuite.csrfToken(); }

function _authHeaders(extra) {
    const csrf = _csrfToken();
    const h = { ...extra };
    if (csrf) h['X-CSRF-Token'] = csrf;
    return h;
}

// Server sets HttpOnly ds_session + readable ds_csrf cookie on success.
// Returns true on success, throws a user-visible Error on failure.
async function _acquireServerSession(keyHex) {
    const r = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_hex: keyHex }),
    });
    if (r.status === 429) throw new Error('Too many attempts — please wait a minute and try again.');
    if (r.status === 401) throw new Error('Incorrect master password.');
    if (!r.ok) throw new Error(`Session request failed (HTTP ${r.status}).`);
    return true;
}

// ── Persist vault to server ───────────────────────────────────────
async function persistVault() {
    if (!masterKenc) return;
    const payload = await encryptVaultGCM(vaultEntries, masterKenc);
    const res = await fetch('/api/vault', {
        method: 'POST',
        headers: _authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            encrypted_blob: payload.ciphertext,
            iv:      payload.iv,
            salt:    vaultSaltHex,
            version: 2,
        }),
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

// ── Unlock helpers (extracted to reduce cognitive complexity) ─────

/**
 * Validates the new-password form fields during setup mode.
 * Returns an error string, or null if validation passes.
 */
function _validateSetupPassword(password) {
    const confirm = document.getElementById('master-pw-confirm').value;
    if (password !== confirm) return '❌ Passwords do not match.';
    if (password.length < 8) return '❌ Master password must be at least 8 characters.';
    return null;
}

/**
 * Derives the auth key from the challenge salt and acquires a server session.
 * Handles both v1 (CryptoJS PBKDF2-SHA1/50k) and v2 (WebCrypto PBKDF2-SHA256/310k
 * with domain-separated Kauth) challenge formats.
 *
 * Throws a user-visible Error on wrong password or rate-limit.
 * Returns silently (no-op) when no challenge is configured (first-time setup path).
 *
 * In v2 mode also sets masterKenc + masterKauth so the caller doesn't need
 * to re-derive them.
 */
async function _acquireChallengeSession(password) {
    const chRes = await fetch('/api/auth/challenge');
    if (chRes.status === 429) throw new Error('Too many attempts — please wait a minute and try again.');
    if (!chRes.ok) return;  // 404 = no challenge configured yet (setup path handles it)
    const ch = await chRes.json();
    if (!ch.salt) return;

    const version = ch.challenge_version || 1;

    if (version === 2) {
        // V2: derive both keys — Kenc never leaves the browser
        const keys = await _deriveMasterKeysV2(password, ch.salt);
        masterKenc  = keys.Kenc;
        masterKauth = keys.Kauth;
        await _acquireServerSession(_bytesToHex(keys.Kauth));  // throws on wrong password
    } else {
        // V1 (legacy): single PBKDF2-SHA1/50k key
        const sessionKey = CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(ch.salt), {
            keySize: 256 / 32, iterations: 50000,
        });
        await _acquireServerSession(sessionKey.toString());  // throws on wrong password
        // masterKenc/masterKauth remain null; v1 unlock path uses masterKey instead
        masterKey = sessionKey;
    }
}

/**
 * Resolves (or initialises) the vault PBKDF2 salt from the given API response.
 * Sets vaultSaltHex and returns the CryptoJS WordArray salt.
 */
async function _resolveVaultSalt(data) {
    if (data.salt) {
        vaultSaltHex = data.salt;
        return CryptoJS.enc.Hex.parse(data.salt);
    }
    // No salt stored — generate one; persistence is handled by the caller once
    // a session/CSRF is established (e.g. _registerSetupChallenge).
    const salt = CryptoJS.lib.WordArray.random(16);
    vaultSaltHex = salt.toString();
    return salt;
}

/**
 * Registers the master-password challenge on first-run or after KDF migration.
 * Uses v2 format: WebCrypto AES-256-GCM verify_blob with Kauth (not Kenc).
 *
 * @param {Uint8Array} Kenc  - vault encryption key (never sent to server)
 * @param {Uint8Array} Kauth - server authentication key (sent as key_hex)
 * @param {string}     saltHex - hex salt used for key derivation
 */
async function _registerSetupChallenge(Kenc, Kauth, saltHex) {
    // Build AES-GCM verify_blob using Kauth — the server verifies this, NOT Kenc.
    const nonce    = crypto.getRandomValues(new Uint8Array(12));
    const aesKey   = await crypto.subtle.importKey('raw', Kauth, { name: 'AES-GCM' }, false, ['encrypt']);
    const encBuf   = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        aesKey,
        new TextEncoder().encode('DEVSUITE_MASTER_OK')
    );
    const verifyBlob  = _bytesToHex(new Uint8Array(encBuf));
    const verifyNonce = _bytesToHex(nonce);

    const setupRes = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            salt:              saltHex,
            verify_blob:       verifyBlob,
            verify_nonce:      verifyNonce,
            challenge_version: 2,
        }),
    });
    if (!setupRes.ok) throw new Error(`Setup failed (HTTP ${setupRes.status})`);

    // Acquire server session using Kauth (domain-separated from Kenc).
    await _acquireServerSession(_bytesToHex(Kauth));
    if (!_csrfToken()) throw new Error('Session could not be established — please reload.');

    if (isNewVault) {
        const vaultRes = await fetch('/api/vault', {
            method: 'POST',
            headers: _authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ encrypted_blob: '', iv: '', salt: vaultSaltHex, version: 2 }),
        });
        if (!vaultRes.ok) throw new Error(`Initial vault save failed (HTTP ${vaultRes.status})`);
    }
    isSetupMode = false;
    document.getElementById('lock-setup-desc').textContent =
        'Your secrets are encrypted with AES-256-GCM. Enter your master password to unlock.';
    document.getElementById('master-pw-confirm-wrap').style.display = 'none';
    document.getElementById('unlock-btn').textContent = 'Unlock Vault';
}

// ── Lock / Unlock ─────────────────────────────────────────────────
function lockVault() {
    masterKey   = null;
    masterKenc  = null;
    masterKauth = null;
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

/**
 * Attempts to decrypt data.encrypted_blob.
 * Detects version from data.version:
 *   v2 (GCM) — uses module-level masterKenc (Uint8Array); ignores keyV1 param.
 *   v1 (CBC) — uses keyV1 (CryptoJS WordArray); migration to v2 is the caller's job.
 * Sets vaultEntries on success. Shows errEl and returns false on wrong password.
 */
async function _tryDecryptBlob(data, keyV1, errEl) {
    if (!data.encrypted_blob) { vaultEntries = []; return true; }
    try {
        if ((data.version || 1) === 2) {
            // V2: authenticated AES-GCM — masterKenc must already be set by caller
            vaultEntries = await decryptVaultGCM(data.encrypted_blob, data.iv, masterKenc);
        } else {
            // V1: unauthenticated AES-CBC (legacy migration path)
            vaultEntries = decryptVault(data.encrypted_blob, data.iv, keyV1);
        }
        return true;
    } catch {
        errEl.textContent = '❌ Incorrect password — cannot decrypt vault.';
        errEl.style.display = 'block';
        return false;
    }
}

// masterKenc / masterKauth / vaultEntries are all set before this is called.
function _finalizeUnlock(successMsg) {
    document.getElementById('lock-overlay').style.display = 'none';
    renderAll();
    toast(successMsg, 'success');
    startAutoLock();
}

// ── First-time setup: no challenge or session exists yet ────────
// Generate salt/key locally using v2 (WebCrypto), register the challenge
// (CSRF-exempt), acquire a session, then persist the empty vault.
async function _unlockSetupNewVault(password, errEl) {
    const validationError = _validateSetupPassword(password);
    if (validationError) {
        errEl.textContent = validationError;
        errEl.style.display = 'block';
        return;
    }
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    vaultSaltHex    = _bytesToHex(saltBytes);
    const keys      = await _deriveMasterKeysV2(password, vaultSaltHex);
    masterKenc  = keys.Kenc;
    masterKauth = keys.Kauth;
    masterKey   = null;
    await _registerSetupChallenge(masterKenc, masterKauth, vaultSaltHex);
    vaultEntries = [];
    _finalizeUnlock('Vault created and unlocked ✓');
}

// ── Migration: vault exists but no challenge registered yet ────
// Read the encrypted blob via the session-free migration endpoint,
// verify the password by attempting to decrypt, register v2 challenge,
// re-encrypt the vault with GCM, then proceed.
async function _unlockSetupMigration(password, errEl) {
    const migRes = await fetch('/api/vault/migrate');
    if (!migRes.ok) throw new Error(`Migration read failed (HTTP ${migRes.status}).`);
    const migData = await migRes.json();

    vaultSaltHex = migData.salt;

    // Decrypt whatever format the migrated vault is in
    const blobVersion = migData.version || 1;
    if (blobVersion === 2) {
        // Already v2 — derive v2 keys and decrypt
        const keys = await _deriveMasterKeysV2(password, vaultSaltHex);
        masterKenc  = keys.Kenc;
        masterKauth = keys.Kauth;
        masterKey   = null;
        if (!await _tryDecryptBlob(migData, null, errEl)) return;
    } else {
        // V1 blob — decrypt with CryptoJS then migrate up
        masterKenc = null;  // ensure _tryDecryptBlob uses v1 path
        const salt = CryptoJS.enc.Hex.parse(migData.salt);
        const key  = deriveKey(password, salt);
        if (!await _tryDecryptBlob(migData, key, errEl)) return;
        // Derive v2 keys for the new challenge
        const keys = await _deriveMasterKeysV2(password, vaultSaltHex);
        masterKenc  = keys.Kenc;
        masterKauth = keys.Kauth;
        masterKey   = null;
    }

    // Register v2 challenge and (if new vault) persist initial empty vault
    await _registerSetupChallenge(masterKenc, masterKauth, vaultSaltHex);
    // Re-encrypt existing vault data under v2 GCM
    await persistVault();
    _finalizeUnlock('Vault unlocked and security upgraded ✓');
}

// ── Normal unlock: acquire session then load vault ───────────────
async function _unlockVaultNormal(password, errEl) {
    // _acquireChallengeSession sets masterKenc/masterKauth (v2) or masterKey (v1)
    await _acquireChallengeSession(password);

    const res = await fetch('/api/vault', { headers: _authHeaders() });
    if (!res.ok) {
        errEl.textContent = res.status === 401
            ? '❌ Session could not be established — please reload and try again.'
            : `❌ Could not load vault (HTTP ${res.status}).`;
        errEl.style.display = 'block';
        return;
    }
    const data = await res.json();
    await _resolveVaultSalt(data);  // sets vaultSaltHex

    const blobVersion = data.version || 1;

    if (blobVersion === 2 && masterKenc) {
        // V2 blob + v2 keys — straightforward decrypt
        if (!await _tryDecryptBlob(data, null, errEl)) return;
    } else if (blobVersion === 1 && masterKey) {
        // V1 blob + v1 key — decrypt, then auto-migrate to v2
        const v1key = masterKey;  // CryptoJS WordArray set by _acquireChallengeSession
        // Temporarily set masterKenc to null so _tryDecryptBlob uses the v1 path
        masterKenc = null;
        if (!await _tryDecryptBlob(data, v1key, errEl)) return;

        // ── Migrate: derive v2 keys and re-register the challenge ──
        toast('Upgrading vault encryption — please wait…', 'success');
        const keys = await _deriveMasterKeysV2(password, vaultSaltHex);
        masterKenc  = keys.Kenc;
        masterKauth = keys.Kauth;
        masterKey   = null;  // clear v1 key from memory
        try {
            await _registerSetupChallenge(masterKenc, masterKauth, vaultSaltHex);
            await persistVault();  // re-encrypt with GCM and save
            toast('Vault upgraded to AES-256-GCM ✓', 'success');
        } catch (migrateErr) {
            // Non-fatal: vault is decrypted in memory; migration can retry on next unlock
            console.warn('v1→v2 migration failed (will retry next unlock):', migrateErr);
        }
    } else {
        errEl.textContent = '❌ Unexpected vault/challenge version mismatch — please reload.';
        errEl.style.display = 'block';
        return;
    }

    _finalizeUnlock('Vault unlocked ✓');
}

async function unlockVault(password) {
    const errEl = document.getElementById('lock-error');
    errEl.style.display = 'none';

    if (isSetupMode && isNewVault) return _unlockSetupNewVault(password, errEl);
    if (isSetupMode)               return _unlockSetupMigration(password, errEl);
    return _unlockVaultNormal(password, errEl);
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
    } else if (autoLockTimer) {
        clearTimeout(autoLockTimer);
        autoLockTimer = null;
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
        case 'note':     return (e.content || '').slice(0, 60).replaceAll('\n', ' ');
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
        empty.replaceChildren();

        const icon = document.createElement('div');
        icon.className = 'icon';

        const message = document.createElement('p');

        if (searchQuery) {
            icon.textContent = '🔍';
            message.append('No results for "');
            const strong = document.createElement('strong');
            strong.textContent = searchQuery;
            message.appendChild(strong);
            message.append('"');
        } else {
            icon.textContent = '🔐';
            message.append('No secrets yet.');
            message.appendChild(document.createElement('br'));
            message.append('Click ');
            const strong = document.createElement('strong');
            strong.textContent = 'New Secret';
            message.appendChild(strong);
            message.append(' to add one.');
        }

        empty.appendChild(icon);
        empty.appendChild(message);
        return;
    }

    empty.style.display = 'none';
    const m = TYPE_META;
    entries.forEach(e => {
        const item = document.createElement('div');
        item.className = 'entry-item' + (e.id === selectedId ? ' selected' : '');
        item.dataset.id = e.id;
        const sub = subtitleFor(e);

        // entry-item-header / badge
        const header = document.createElement('div');
        header.className = 'entry-item-header';
        const badge = document.createElement('span');
        badge.className = `entry-type-badge ${m[e.type].badgeClass}`;
        badge.textContent = `${m[e.type].emoji} ${m[e.type].label}`;
        header.appendChild(badge);
        item.appendChild(header);

        // title
        const titleEl = document.createElement('div');
        titleEl.className = 'entry-title';
        titleEl.textContent = e.title;
        item.appendChild(titleEl);

        // optional subtitle
        if (sub) {
            const subEl = document.createElement('div');
            subEl.className = 'entry-subtitle';
            subEl.textContent = sub;
            item.appendChild(subEl);
        }

        // modified timestamp (SVG clock is static markup)
        const modEl = document.createElement('div');
        modEl.className = 'entry-modified';
        modEl.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'; // static SVG
        modEl.appendChild(document.createTextNode(' ' + relativeTime(e.modified)));
        item.appendChild(modEl);

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

// ── Per-type detail field builders (extracted to reduce cognitive complexity) ──

function _buildPasswordFields(e, c) {
    if (e.username) addFieldRow(c, { label: 'Username', value: e.username, secret: false, fieldId: 'username', clipLabel: 'Username' });
    addFieldRow(c, { label: 'Password', value: e.password, secret: true, fieldId: 'password', clipLabel: 'Password' });
    if (e.url) addFieldRow(c, { label: 'Website', value: e.url, secret: false, fieldId: 'url', clipLabel: 'URL', isUrl: true });
    if (e.notes) addNotesRow(c, e.notes);
}

function _buildTokenFields(e, c) {
    if (e.service) addFieldRow(c, { label: 'Service', value: e.service, secret: false, fieldId: 'service', clipLabel: 'Service' });
    addFieldRow(c, { label: 'Token', value: e.token, secret: true, fieldId: 'token', clipLabel: 'Token' });
    if (e.expiry) addFieldRow(c, { label: 'Expiry', value: e.expiry, secret: false, fieldId: 'expiry', clipLabel: 'Expiry' });
    if (e.environment) addFieldRow(c, { label: 'Environment', value: e.environment, secret: false });
    if (e.notes) addNotesRow(c, e.notes);
}

function _buildSshFields(e, c) {
    if (e.host) addFieldRow(c, { label: 'Host', value: e.host, secret: false, fieldId: 'host', clipLabel: 'Host' });
    if (e.username) addFieldRow(c, { label: 'Username', value: e.username, secret: false, fieldId: 'username', clipLabel: 'Username' });
    addFieldRow(c, { label: 'Private Key', value: e.private_key, secret: true, fieldId: 'private_key', clipLabel: 'Private Key', isTextarea: true });
    if (e.passphrase) addFieldRow(c, { label: 'Passphrase', value: e.passphrase, secret: true, fieldId: 'passphrase', clipLabel: 'Passphrase' });
    if (e.notes) addNotesRow(c, e.notes);
}

function _buildApiFields(e, c) {
    if (e.service) addFieldRow(c, { label: 'Service', value: e.service, secret: false, fieldId: 'service', clipLabel: 'Service' });
    addFieldRow(c, { label: 'API Key', value: e.api_key, secret: true, fieldId: 'api_key', clipLabel: 'API Key', isTextarea: true });
    if (e.environment) addFieldRow(c, { label: 'Environment', value: e.environment, secret: false });
    if (e.notes) addNotesRow(c, e.notes);
}

function _buildEnvFields(e, c) {
    addFieldRow(c, { label: 'Variable Name', value: e.varname, secret: false, fieldId: 'varname', clipLabel: 'Variable Name' });
    addFieldRow(c, { label: 'Value', value: e.value, secret: true, fieldId: 'value', clipLabel: 'Value', isTextarea: true });
    if (e.notes) addNotesRow(c, e.notes);
}

const _TYPE_FIELD_BUILDERS = {
    password: _buildPasswordFields,
    token:    _buildTokenFields,
    ssh:      _buildSshFields,
    api:      _buildApiFields,
    env:      _buildEnvFields,
    note:     (e, c) => addNotesRow(c, e.content),
};

function buildDetailFields(e, container) {
    const builder = _TYPE_FIELD_BUILDERS[e.type];
    if (builder) builder(e, container);
}

function addFieldRow(container, { label, value, secret, fieldId, clipLabel, isUrl = false, isTextarea = false }) {
    const row = document.createElement('div');
    row.className = 'field-row';

    // Label
    const labelEl = document.createElement('div');
    labelEl.className = 'field-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    // Value wrap
    const wrap = document.createElement('div');
    wrap.className = 'field-val-wrap';

    const fvClasses = ['field-val'];
    if (secret)     fvClasses.push('secret-hidden');
    if (isTextarea) fvClasses.push('is-textarea');
    if (isUrl)      fvClasses.push('url-val');

    const fvEl = document.createElement('div');
    fvEl.className = fvClasses.join(' ');
    if (fieldId) fvEl.id = `fv-${fieldId}`;
    fvEl.dataset.secret = secret;
    fvEl.dataset.raw    = encodeURIComponent(value); // encodeURIComponent so raw value never lives in an HTML attribute unescaped

    if (secret) {
        fvEl.textContent = '••••••••••••';
    } else if (isUrl) {
        // Wrap in a <span> for URL-specific styling; value is text, not HTML
        const inner = document.createElement('span');
        inner.className = 'url-inner';
        inner.textContent = value;
        fvEl.appendChild(inner);
    } else {
        fvEl.textContent = value;
    }
    wrap.appendChild(fvEl);

    // Optional reveal button (secret fields only) — SVG is static markup
    if (secret) {
        const revBtn = document.createElement('button');
        revBtn.className = 'field-action-btn js-reveal-btn';
        revBtn.title = 'Reveal / hide';
        const eyeIdAttr = fieldId ? ` id="eye-${fieldId}"` : '';
        const svgTag = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"${eyeIdAttr}>`;
        revBtn.innerHTML = `${svgTag}<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`; // static SVG
        wrap.appendChild(revBtn);
    }

    // Copy button — SVG is static markup
    const copyBtn = document.createElement('button');
    copyBtn.className = 'field-action-btn js-copy-btn';
    copyBtn.title = 'Copy to clipboard';
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`; // static SVG
    wrap.appendChild(copyBtn);

    row.appendChild(wrap);
    container.appendChild(row);

    // Wire actions via listeners instead of inline onclick. Secret values must never be
    // interpolated into an attribute/JS-string context — encodeURIComponent does not
    // escape single quotes, which made the old inline onclick an injection vector.
    const revealBtn = row.querySelector('.js-reveal-btn');
    if (revealBtn) revealBtn.addEventListener('click', () => toggleReveal(fieldId));
    // copyBtn was created above — use it directly rather than re-querying the DOM.
    copyBtn.addEventListener('click', () => copyToClipboard(value, clipLabel || label));

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

    const labelEl = document.createElement('div');
    labelEl.className = 'field-label';
    labelEl.textContent = 'Notes';
    row.appendChild(labelEl);

    const notesEl = document.createElement('div');
    notesEl.className = 'field-notes';
    notesEl.textContent = text;
    row.appendChild(notesEl);

    container.appendChild(row);
}

globalThis.toggleReveal = function(fieldId) {
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

// ── Backup / Restore ────────────────────────────────────────────────
// Export: re-encrypts the in-memory entries with the current session's Kenc and
// downloads a self-contained JSON envelope (no server round-trip, no new endpoint).
// Restore: decrypts a chosen backup with a user-supplied password + the backup's own
// embedded salt, then re-persists the recovered entries under the CURRENT session's
// key via the existing persistVault()/POST /api/vault path.
const BACKUP_APP_ID = 'devsuite-vault-backup';
let pendingRestoreBackup = null; // parsed+validated backup envelope awaiting a password

async function exportBackup() {
    if (!masterKenc) return;
    try {
        const payload = await encryptVaultGCM(vaultEntries, masterKenc);
        const backup = {
            app: BACKUP_APP_ID,
            backup_version: 1,
            exported_at: new Date().toISOString(),
            vault: { encrypted_blob: payload.ciphertext, iv: payload.iv, salt: vaultSaltHex, version: 2 },
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `devsuite-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast(`Backup exported — ${vaultEntries.length} secret${vaultEntries.length === 1 ? '' : 's'}`);
    } catch (e) {
        toast('Export failed: ' + e.message, 'error');
    }
}

function _restoreError(msg) {
    const el = document.getElementById('restore-error');
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.textContent = msg;
    el.style.display = 'block';
}

function openRestoreModal() {
    if (!masterKenc) return;
    pendingRestoreBackup = null;
    document.getElementById('restore-file-name').textContent = '';
    document.getElementById('restore-pw-input').value = '';
    document.getElementById('restore-confirm-btn').disabled = true;
    _restoreError(null);
    document.getElementById('restore-modal').classList.add('open');
}

function closeRestoreModal() {
    document.getElementById('restore-modal').classList.remove('open');
    pendingRestoreBackup = null;
}

async function handleRestoreFileChosen(file) {
    _restoreError(null);
    document.getElementById('restore-confirm-btn').disabled = true;
    pendingRestoreBackup = null;
    if (!file) return;
    try {
        const parsed = JSON.parse(await file.text());
        const v = parsed?.vault;
        if (parsed?.app !== BACKUP_APP_ID || !v?.encrypted_blob || !v?.iv || !v?.salt) {
            throw new Error('Not a valid DevSuite vault backup file.');
        }
        pendingRestoreBackup = parsed;
        document.getElementById('restore-file-name').textContent = `Selected: ${file.name}`;
        document.getElementById('restore-confirm-btn').disabled = false;
    } catch {
        document.getElementById('restore-file-name').textContent = '';
        _restoreError('Not a valid DevSuite vault backup file.');
    }
}

async function performRestore() {
    if (!pendingRestoreBackup || !masterKenc) return;
    const pw = document.getElementById('restore-pw-input').value;
    if (!pw) { _restoreError('Enter the master password this backup was encrypted with.'); return; }
    if (!confirm('This will replace every secret currently in your vault with the contents of this backup. This cannot be undone. Continue?')) return;

    const btn = document.getElementById('restore-confirm-btn');
    btn.disabled = true;
    _restoreError(null);

    let restoredEntries;
    try {
        const { vault } = pendingRestoreBackup;
        const { Kenc } = await _deriveMasterKeysV2(pw, vault.salt);
        restoredEntries = await decryptVaultGCM(vault.encrypted_blob, vault.iv, Kenc);
        if (!Array.isArray(restoredEntries)) throw new Error('not an array');
    } catch {
        _restoreError('Incorrect backup password, or the file is corrupted.');
        btn.disabled = false;
        return;
    }

    vaultEntries = restoredEntries;
    selectedId = null;
    editingId = null;
    try {
        await persistVault(); // re-encrypts under the CURRENT session's masterKenc
    } catch (e) {
        _restoreError('Decrypted successfully but failed to save: ' + e.message);
        btn.disabled = false;
        return;
    }

    renderCounts();
    renderEntryList();
    renderDetail();
    closeRestoreModal();
    toast(`Vault restored — ${vaultEntries.length} secret${vaultEntries.length === 1 ? '' : 's'}`);
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

function _modalPassword(base) {
    const pw = document.getElementById('f-pw-password').value;
    if (!pw) { toast('Password is required', 'error'); return null; }
    return { ...base, username: document.getElementById('f-pw-username').value.trim(),
        password: pw, url: document.getElementById('f-pw-url').value.trim(),
        notes: document.getElementById('f-pw-notes').value.trim() };
}
function _modalToken(base) {
    const tok = document.getElementById('f-tok-value').value.trim();
    if (!tok) { toast('Token value is required', 'error'); return null; }
    return { ...base, service: document.getElementById('f-tok-service').value.trim(),
        token: tok, expiry: document.getElementById('f-tok-expiry').value,
        environment: document.getElementById('f-tok-env').value,
        notes: document.getElementById('f-tok-notes').value.trim() };
}
function _modalSsh(base) {
    const key = document.getElementById('f-ssh-key').value.trim();
    if (!key) { toast('Private key is required', 'error'); return null; }
    return { ...base, host: document.getElementById('f-ssh-host').value.trim(),
        username: document.getElementById('f-ssh-username').value.trim(),
        private_key: key, passphrase: document.getElementById('f-ssh-passphrase').value,
        notes: document.getElementById('f-ssh-notes').value.trim() };
}
function _modalApi(base) {
    const ak = document.getElementById('f-api-key').value.trim();
    if (!ak) { toast('API key is required', 'error'); return null; }
    return { ...base, service: document.getElementById('f-api-service').value.trim(),
        api_key: ak, environment: document.getElementById('f-api-env').value,
        notes: document.getElementById('f-api-notes').value.trim() };
}
function _modalEnv(base) {
    const varname = document.getElementById('f-env-varname').value.trim();
    const val     = document.getElementById('f-env-value').value.trim();
    if (!varname || !val) { toast('Variable name and value are required', 'error'); return null; }
    return { ...base, varname, value: val,
        notes: document.getElementById('f-env-notes').value.trim() };
}
function _modalNote(base) {
    const content = document.getElementById('f-note-content').value.trim();
    if (!content) { toast('Note content is required', 'error'); return null; }
    return { ...base, content };
}

function buildEntryFromModal() {
    const type  = currentModalType;
    const title = document.getElementById('f-title').value.trim();
    if (!title) { toast('Title is required', 'error'); return null; }

    const base = { id: editingId || genId(), type, title, modified: Date.now() };
    const builders = {
        password: _modalPassword, token: _modalToken,
        ssh: _modalSsh, api: _modalApi,
        env: _modalEnv, note: _modalNote,
    };
    return builders[type]?.(base) ?? null;
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
    return str.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
              .replaceAll('"','&quot;').replaceAll("'",'&#39;');
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
        } catch (e) {
            const err = document.getElementById('lock-error');
            err.textContent = '❌ ' + (e.message || 'Unknown error — check the browser console.');
            err.style.display = 'block';
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

    // Backup / Restore
    document.getElementById('backup-btn').addEventListener('click', exportBackup);
    document.getElementById('restore-btn').addEventListener('click', openRestoreModal);
    document.getElementById('restore-modal-close').addEventListener('click', closeRestoreModal);
    document.getElementById('restore-cancel-btn').addEventListener('click', closeRestoreModal);
    document.getElementById('restore-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('restore-modal')) closeRestoreModal();
    });
    const restoreFileInput = document.getElementById('restore-file-input');
    document.getElementById('restore-choose-file-btn').addEventListener('click', () => restoreFileInput.click());
    restoreFileInput.addEventListener('change', () => {
        handleRestoreFileChosen(restoreFileInput.files[0]);
        restoreFileInput.value = ''; // allow re-selecting the same file
    });
    document.getElementById('restore-confirm-btn').addEventListener('click', performRestore);
    document.getElementById('restore-pw-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !document.getElementById('restore-confirm-btn').disabled) performRestore();
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
        if (e.key === 'Escape') { closeModal(); closeRestoreModal(); }
    });

    // Initial render (vault is locked until master password is entered)
    renderAll();
});

// expose for inline onclick attributes
globalThis.copyToClipboard = copyToClipboard;
