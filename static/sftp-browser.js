// sftp-browser.js
'use strict';

// ──────────────────────────────────────────
// State
// ──────────────────────────────────────────
let masterKey  = null;
let profiles   = [];             // decrypted SSH profiles (from shared blob)
let activeConn = null;           // { profile, path }

// ──────────────────────────────────────────
// Toast
// ──────────────────────────────────────────
function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 3200);
}

// ──────────────────────────────────────────
// Crypto helpers (CryptoJS AES, same as SSH manager)
// ──────────────────────────────────────────
function encryptData(str, pwd)     { return CryptoJS.AES.encrypt(str, pwd).toString(); }
function decryptData(cipher, pwd)  {
    try { return CryptoJS.AES.decrypt(cipher, pwd).toString(CryptoJS.enc.Utf8); }
    catch { return null; }
}

// ──────────────────────────────────────────
// Shared profile blob (same endpoint as SSH manager)
// ──────────────────────────────────────────
function _sessionHeaders(extra = {}) {
    const token = sessionStorage.getItem('devsuite_server_token') || '';
    return token ? { 'X-Session-Token': token, ...extra } : { ...extra };
}

async function loadBlob() {
    const r = await fetch('/api/ssh/profiles', { headers: _sessionHeaders() });
    if (!r.ok) throw new Error(`Failed to load profiles: ${r.status}`);
    const d = await r.json();
    return d.encrypted_blob || '';
}

async function saveBlob(blob) {
    const r = await fetch('/api/ssh/profiles', {
        method: 'POST',
        headers: _sessionHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ encrypted_blob: blob })
    });
    if (!r.ok) {
        const error = new Error('Save failed');
        showToast(error.message, 'error');
        throw error;
    }
}

// ──────────────────────────────────────────
// Unlock
// ──────────────────────────────────────────
document.getElementById('unlock-btn').addEventListener('click', async () => {
    const pwd = document.getElementById('master-password').value;
    if (!pwd) { showError('Master Password is required.'); return; }

    let blob;
    try {
        blob = await loadBlob();
    } catch (e) {
        showError('Failed to load profiles: ' + e.message);
        return;
    }

    if (!blob) {
        // First-time: create empty vault
        try {
            masterKey = pwd;
            profiles  = [];
            await saveBlob(encryptData('[]', pwd));
            dismissOverlay();
            renderSidebar();
        } catch (e) {
            showError('Failed to initialize vault: ' + e.message);
        }
        return;
    }

    const dec = decryptData(blob, pwd);
    if (!dec) { showError('Incorrect password or corrupted vault.'); return; }

    try {
        profiles  = JSON.parse(dec);
        masterKey = pwd;
        dismissOverlay();
        renderSidebar();
    } catch {
        showError('Failed to parse profile vault.');
    }
});

document.getElementById('master-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('unlock-btn').click();
});

function showError(msg) {
    const el = document.getElementById('unlock-error');
    el.textContent = msg;
    el.style.display = 'block';
}
function dismissOverlay() {
    document.getElementById('master-password-overlay').style.display = 'none';
}

// ──────────────────────────────────────────
// Sidebar rendering
// ──────────────────────────────────────────
function renderSidebar() {
    const query = (document.getElementById('session-search').value || '').toLowerCase();
    const list  = document.getElementById('session-list');
    list.innerHTML = '';

    const filtered = profiles.filter(p =>
        (!query) ||
        (p.name  || '').toLowerCase().includes(query) ||
        (p.host  || '').toLowerCase().includes(query) ||
        (p.group || '').toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        list.innerHTML = `<div class="sftp-no-sessions">
            ${profiles.length === 0
                ? 'No saved sessions yet.<br>Add sessions in <a href="/ssh" style="color:#0ea5e9;">Secure Terminal</a>.'
                : 'No sessions match your search.'}
        </div>`;
        return;
    }

    // Group by group name
    const groups = {};
    filtered.forEach(p => {
        const g = p.group ? p.group.trim() : 'Ungrouped';
        if (!groups[g]) groups[g] = [];
        groups[g].push(p);
    });

    Object.keys(groups).sort().forEach(gName => {
        const label = document.createElement('div');
        label.className = 'sftp-group-label';
        label.textContent = gName;
        list.appendChild(label);

        groups[gName].forEach(p => {
            const item = document.createElement('div');
            item.className = 'sftp-session-item';
            if (activeConn && activeConn.profile.id === p.id) item.classList.add('active');

            const initials = (p.name || p.host || '?').slice(0, 2).toUpperCase();
            item.innerHTML = `
                <div class="sftp-session-icon">${initials}</div>
                <div class="sftp-session-info">
                    <div class="sftp-session-name">${escHtml(p.name || p.host)}</div>
                    <div class="sftp-session-host">${escHtml(p.user || '')}@${escHtml(p.host)}:${p.port || 22}</div>
                </div>
            `;
            item.addEventListener('click', () => connectTo(p));
            list.appendChild(item);
        });
    });
}

document.getElementById('session-search').addEventListener('input', renderSidebar);

// ──────────────────────────────────────────
// Quick Connect Modal
// ──────────────────────────────────────────
document.getElementById('quick-connect-btn').addEventListener('click', () => {
    document.getElementById('connect-modal-overlay').style.display = 'flex';
    document.getElementById('q-host').focus();
});
document.getElementById('cancel-connect-btn').addEventListener('click', () => {
    document.getElementById('connect-modal-overlay').style.display = 'none';
});
document.getElementById('do-connect-btn').addEventListener('click', () => {
    const prof = {
        id:   'quick-' + Date.now(),
        name: document.getElementById('q-host').value,
        host: document.getElementById('q-host').value.trim(),
        port: document.getElementById('q-port').value || 22,
        user: document.getElementById('q-user').value.trim(),
        pass: document.getElementById('q-pass').value,
        key:  document.getElementById('q-key').value.trim(),
    };
    if (!prof.host || !prof.user) {
        showToast('Host and username are required.', 'error');
        return;
    }
    document.getElementById('connect-modal-overlay').style.display = 'none';
    connectTo(prof);
});

// ──────────────────────────────────────────
// Connection & Browse
// ──────────────────────────────────────────
async function connectTo(profile) {
    activeConn = { profile, path: '/' };
    renderSidebar();     // highlight active

    showBrowserPanel();
    document.getElementById('sftp-conn-label').textContent =
        `${profile.user || ''}@${profile.host}:${profile.port || 22}`;

    await loadDirectory('/');
}

document.getElementById('disconnect-btn').addEventListener('click', () => {
    activeConn = null;
    renderSidebar();
    hideBrowserPanel();
});

document.getElementById('go-up-btn').addEventListener('click', () => {
    if (!activeConn) return;
    const parts = activeConn.path.replace(/\/$/, '').split('/');
    parts.pop();
    activeConn.path = parts.join('/') || '/';
    loadDirectory(activeConn.path);
});

document.getElementById('refresh-btn').addEventListener('click', () => {
    if (activeConn) loadDirectory(activeConn.path);
});

async function loadDirectory(path) {
    if (!activeConn) return;
    activeConn.path = path;

    // Capture current connection to detect stale responses
    const currentConn = activeConn;

    // UI state
    document.getElementById('path-input').value = path;
    document.getElementById('go-up-btn').disabled = (path === '/');
    renderBreadcrumb(path);

    const loading  = document.getElementById('sftp-loading');
    const errEl    = document.getElementById('sftp-file-error');
    const grid     = document.getElementById('file-grid');

    errEl.style.display  = 'none';
    grid.innerHTML       = '';
    loading.style.display = 'flex';

    try {
        const payload = {
            host:        currentConn.profile.host,
            port:        parseInt(currentConn.profile.port || 22),
            username:    currentConn.profile.user,
            password:    currentConn.profile.pass  || null,
            private_key: currentConn.profile.key   || null,
            path:        path
        };

        const r = await fetch('/api/sftp/list', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });

        // Check if connection changed during fetch
        if (activeConn !== currentConn) return;

        if (!r.ok) {
            const e = await r.json();
            throw new Error(e.detail || `Server error ${r.status}`);
        }

        const data = await r.json();

        // Check again after parsing
        if (activeConn !== currentConn) return;

        loading.style.display = 'none';
        renderFileGrid(data.files || []);
    } catch (e) {
        // Check if connection changed during error handling
        if (activeConn !== currentConn) return;

        loading.style.display = 'none';
        errEl.textContent    = `Error: ${e.message}`;
        errEl.style.display  = 'block';
        showToast(e.message, 'error');
    }
}

// ──────────────────────────────────────────
// File grid
// ──────────────────────────────────────────
function renderFileGrid(files) {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '';

    if (files.length === 0) {
        grid.innerHTML = '<div class="sftp-empty-dir">This directory is empty.</div>';
        return;
    }

    files.forEach(f => {
        const card = document.createElement('div');
        card.className = f.is_dir ? 'sftp-file-card sftp-dir-card' : 'sftp-file-card';

        const icon = f.is_dir ? '📁' : getFileIcon(f.name);
        const size = f.is_dir ? '' : formatSize(f.size);

        // Create icon element
        const iconDiv = document.createElement('div');
        iconDiv.className = 'sftp-file-icon';
        iconDiv.textContent = icon;

        // Create name element
        const nameDiv = document.createElement('div');
        nameDiv.className = 'sftp-file-name';
        nameDiv.textContent = f.name;
        nameDiv.title = f.name;

        // Create meta element
        const metaDiv = document.createElement('div');
        metaDiv.className = 'sftp-file-meta';
        metaDiv.textContent = size;

        card.appendChild(iconDiv);
        card.appendChild(nameDiv);
        card.appendChild(metaDiv);

        if (f.is_dir) {
            card.addEventListener('dblclick', () => {
                const newPath = activeConn.path === '/'
                    ? '/' + f.name
                    : activeConn.path + '/' + f.name;
                loadDirectory(newPath);
            });
            card.title = 'Double-click to open';
        }

        grid.appendChild(card);
    });
}

// ──────────────────────────────────────────
// Breadcrumb
// ──────────────────────────────────────────
function renderBreadcrumb(path) {
    const el = document.getElementById('sftp-breadcrumb');
    el.innerHTML = '';

    const parts = path === '/' ? [''] : path.split('/');

    parts.forEach((part, idx) => {
        const label    = idx === 0 ? '/' : part;
        const crumb    = document.createElement('span');
        const isActive = idx === parts.length - 1;
        crumb.className = 'sftp-crumb' + (isActive ? ' active' : '');
        crumb.textContent = label;

        if (!isActive) {
            crumb.addEventListener('click', () => {
                const newPath = idx === 0 ? '/' : parts.slice(0, idx + 1).join('/');
                loadDirectory(newPath || '/');
            });
        }
        el.appendChild(crumb);

        if (!isActive && parts.length > 1) {
            const sep = document.createElement('span');
            sep.className   = 'sftp-crumb-sep';
            sep.textContent = ' / ';
            el.appendChild(sep);
        }
    });
}

// ──────────────────────────────────────────
// Panel visibility helpers
// ──────────────────────────────────────────
function showBrowserPanel() {
    document.getElementById('sftp-empty-state').style.display  = 'none';
    document.getElementById('sftp-browser-panel').style.display = 'flex';
}
function hideBrowserPanel() {
    document.getElementById('sftp-empty-state').style.display  = 'flex';
    document.getElementById('sftp-browser-panel').style.display = 'none';
}

// ──────────────────────────────────────────
// Utility
// ──────────────────────────────────────────
function escHtml(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatSize(bytes) {
    if (bytes === null || bytes === undefined) return '';
    if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes > 1024)        return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}

function getFileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const iconMap = {
        js: '📜', ts: '📜', py: '🐍', rb: '💎', go: '🐹',
        sh: '⚙️', bash: '⚙️', zsh: '⚙️',
        html: '🌐', css: '🎨', json: '📋', yaml: '📋', yml: '📋',
        toml: '📋', xml: '📋', md: '📝', txt: '📝', log: '📝',
        pdf: '📄', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️',
        svg: '🖼️', ico: '🖼️', zip: '📦', tar: '📦', gz: '📦',
        bz2: '📦', xz: '📦', deb: '📦', rpm: '📦',
        mp3: '🎵', mp4: '🎬', mkv: '🎬', avi: '🎬',
        dockerfile: '🐳', lock: '🔒',
    };
    return iconMap[ext] || '📄';
}