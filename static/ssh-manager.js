// ssh-manager.js  v3

// ──────────────────────────────────────────
// Global State
// ──────────────────────────────────────────
let masterKey    = null;
let profiles     = [];
let wslProfiles  = [];
// activeTabs: tabId → { id, profile, term, fitAddon, ws, paneDom }
let activeTabs   = {};
let currentTabId = null;

// SFTP state
let sftpConn = null;  // { profile, path }

// Current view: 'terminal' | 'sftp'
let currentView  = 'terminal';

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
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3200);
}

// ──────────────────────────────────────────
// Profile Encryption / Decryption
// ──────────────────────────────────────────
function encryptData(str, pwd)  { return CryptoJS.AES.encrypt(str, pwd).toString(); }
function decryptData(ct, pwd)   {
    try { return CryptoJS.AES.decrypt(ct, pwd).toString(CryptoJS.enc.Utf8); }
    catch { return null; }
}

async function loadProfilesBlob() {
    try {
        const r = await fetch('/api/ssh/profiles');
        const d = await r.json();
        return d.encrypted_blob || '';
    } catch { return ''; }
}

async function saveProfilesBlob(blob) {
    try {
        const r = await fetch('/api/ssh/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ encrypted_blob: blob })
        });
        if (!r.ok) throw new Error('Failed to save profiles.');
        showToast('Profile saved.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

// ──────────────────────────────────────────
// Init & Unlock
// ──────────────────────────────────────────
document.getElementById('unlock-btn').addEventListener('click', async () => {
    const pwd = document.getElementById('master-password').value;
    if (!pwd) return showToast('Master Password required.', 'error');

    const blob = await loadProfilesBlob();
    if (!blob) {
        masterKey = pwd; profiles = [];
        await saveProfilesBlob(encryptData('[]', pwd));
        document.getElementById('master-password-overlay').style.display = 'none';
        renderSidebar(); renderSftpSidebar();
        return;
    }

    const dec = decryptData(blob, pwd);
    if (!dec) return showToast('Incorrect Master Password or corrupted vault.', 'error');

    try {
        profiles  = JSON.parse(dec);
        masterKey = pwd;
        document.getElementById('master-password-overlay').style.display = 'none';
        discoverWsl();
        renderSidebar();
        renderSftpSidebar();
    } catch { showToast('Failed to parse profiles.', 'error'); }
});

// ──────────────────────────────────────────
// WSL Discovery
// ──────────────────────────────────────────
async function discoverWsl() {
    try {
        const r = await fetch('/api/wsl/discover');
        if (!r.ok) return;
        const d = await r.json();
        wslProfiles = d.wsl_instances.map(name => ({
            id: 'wsl-' + name, name, group: 'WSL Environments',
            host: 'local', isWsl: true, distro: name
        }));
        wslProfiles.unshift({
            id: 'wsl-local', name: 'Local Terminal', group: 'WSL Environments',
            host: 'local', isWsl: true, distro: null
        });
        renderSidebar();
    } catch (e) { console.warn('WSL discover failed', e); }
}

// ──────────────────────────────────────────
// Strip Tab Switching
// ──────────────────────────────────────────
document.getElementById('strip-sessions').addEventListener('click', () => switchView('terminal'));
document.getElementById('strip-sftp').addEventListener('click',    () => switchView('sftp'));

function switchView(view) {
    currentView = view;

    // Strip button states
    document.getElementById('strip-sessions').classList.toggle('active', view === 'terminal');
    document.getElementById('strip-sftp').classList.toggle('active',    view === 'sftp');

    // Panel visibility
    document.getElementById('terminal-panel').style.display = view === 'terminal' ? 'flex' : 'none';
    document.getElementById('sftp-panel').style.display     = view === 'sftp'     ? 'flex' : 'none';

    // Sidebar content
    document.getElementById('sessions-sidebar-content').style.display = view === 'terminal' ? 'flex' : 'none';
    document.getElementById('sftp-sidebar-content').style.display     = view === 'sftp'     ? 'flex' : 'none';

    // Refit terminal if switching back
    if (view === 'terminal' && currentTabId && activeTabs[currentTabId]?.fitAddon) {
        setTimeout(() => activeTabs[currentTabId].fitAddon.fit(), 50);
    }
}

// Fix flex display for sidebar content blocks
document.getElementById('sessions-sidebar-content').style.display = 'flex';
document.getElementById('sessions-sidebar-content').style.flexDirection = 'column';
document.getElementById('sessions-sidebar-content').style.flex = '1';
document.getElementById('sessions-sidebar-content').style.overflow = 'hidden';

// ──────────────────────────────────────────
// Sessions Sidebar
// ──────────────────────────────────────────
const expandedFolders = new Set(['Ungrouped']);

function getGroupedProfiles() {
    const q = document.getElementById('quick-connect').value.toLowerCase().trim();
    const all = [...wslProfiles, ...profiles];
    const filtered = all.filter(p =>
        (p.name || p.host).toLowerCase().includes(q) ||
        p.host.toLowerCase().includes(q) ||
        (p.group || '').toLowerCase().includes(q)
    );
    const groups = { Ungrouped: [] };
    filtered.forEach(p => {
        const g = p.group ? p.group.trim() : 'Ungrouped';
        if (!groups[g]) groups[g] = [];
        groups[g].push(p);
    });
    return groups;
}

function renderSidebar() {
    const list = document.getElementById('server-list');
    list.innerHTML = '';
    const groups    = getGroupedProfiles();
    const groupNames = Object.keys(groups).sort((a, b) => {
        if (a === 'Ungrouped') return 1;
        if (b === 'Ungrouped') return -1;
        return a.localeCompare(b);
    });

    let totalRendered = 0;
    groupNames.forEach(gName => {
        const items = groups[gName];
        if (!items.length) return;
        totalRendered += items.length;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'tree-group';

        const header = document.createElement('div');
        header.className = 'tree-folder-header';
        const isExpanded = expandedFolders.has(gName) || document.getElementById('quick-connect').value.length > 0;
        header.innerHTML = `
            <span class="folder-toggle">${isExpanded ? '[-]' : '[+]'}</span>
            <span class="folder-icon">📂</span>
            <span>${gName}</span>
        `;

        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'folder-children';
        childrenDiv.style.display = isExpanded ? 'flex' : 'none';

        header.addEventListener('click', () => {
            const open = childrenDiv.style.display !== 'none';
            childrenDiv.style.display = open ? 'none' : 'flex';
            header.querySelector('.folder-toggle').textContent = open ? '[+]' : '[-]';
            open ? expandedFolders.delete(gName) : expandedFolders.add(gName);
        });

        items.forEach(p => {
            const d = document.createElement('div');
            d.className = 'server-item';
            if (Object.values(activeTabs).some(t => t.profile.id === p.id)) d.classList.add('active');
            d.innerHTML = `
                <div class="server-name-lbl">🖥️ <span>${p.name || p.host}</span></div>
                ${p.isWsl ? '' : '<div style="display:flex;gap:0.25rem;"><div class="edit-srv-icon" title="Edit Session">⚙</div><div class="del-srv-icon" title="Delete Session">🗑️</div></div>'}
            `;
            d.querySelector('.server-name-lbl').addEventListener('click', () => openTerminalTab(p));
            if (!p.isWsl) {
                d.querySelector('.edit-srv-icon').addEventListener('click', e => { e.stopPropagation(); openServerModal(p); });
                d.querySelector('.del-srv-icon').addEventListener('click', async e => {
                    e.stopPropagation();
                    if (!confirm(`Delete session "${p.name || p.host}"?`)) return;
                    profiles = profiles.filter(x => x.id !== p.id);
                    const blob = encryptData(JSON.stringify(profiles), masterKey);
                    await saveProfilesBlob(blob);
                    renderSidebar();
                    renderSftpSidebar();
                });
            }
            childrenDiv.appendChild(d);
        });

        groupDiv.appendChild(header);
        groupDiv.appendChild(childrenDiv);
        list.appendChild(groupDiv);
    });

    if (totalRendered === 0) {
        list.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding-top:1rem;font-size:0.9rem;">No sessions found.</div>`;
    }
}

document.getElementById('quick-connect').addEventListener('input', renderSidebar);

// ──────────────────────────────────────────
// SFTP Sidebar
// ──────────────────────────────────────────
function renderSftpSidebar() {
    const q    = (document.getElementById('sftp-session-search').value || '').toLowerCase();
    const list = document.getElementById('sftp-session-list');
    list.innerHTML = '';

    // Only SSH profiles (not WSL) can use SFTP
    const filtered = profiles.filter(p =>
        (!q) ||
        (p.name  || '').toLowerCase().includes(q) ||
        (p.host  || '').toLowerCase().includes(q) ||
        (p.group || '').toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
        list.innerHTML = `<div style="padding:1.5rem 1rem;text-align:center;color:var(--text-muted);font-size:0.875rem;line-height:1.6;">
            ${profiles.length === 0
                ? 'Add SSH sessions using the <strong>+ Add Session</strong> button to use SFTP.'
                : 'No sessions match your search.'}
        </div>`;
        return;
    }

    // Group
    const groups = {};
    filtered.forEach(p => {
        const g = p.group ? p.group.trim() : 'Ungrouped';
        if (!groups[g]) groups[g] = [];
        groups[g].push(p);
    });

    Object.keys(groups).sort().forEach(gName => {
        const label    = document.createElement('div');
        label.className = 'sftp-group-lbl';
        label.textContent = gName;
        list.appendChild(label);

        groups[gName].forEach(p => {
            const item = document.createElement('div');
            item.className = 'sftp-sess-item';
            if (sftpConn && sftpConn.profile.id === p.id) item.classList.add('active');

            const initials = (p.name || p.host || '?').slice(0, 2).toUpperCase();
            item.innerHTML = `
                <div class="sftp-sess-avatar">${initials}</div>
                <div style="overflow:hidden;">
                    <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.875rem;">${p.name || p.host}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.user || ''}@${p.host}:${p.port || 22}</div>
                </div>
            `;
            item.addEventListener('click', () => sftpConnectTo(p));
            list.appendChild(item);
        });
    });
}

document.getElementById('sftp-session-search').addEventListener('input', renderSftpSidebar);

// ──────────────────────────────────────────
// Session Modal
// ──────────────────────────────────────────
function openServerModal(p = null) {
    document.getElementById('srv-name').value  = p ? p.name  || '' : '';
    document.getElementById('srv-group').value = p ? p.group || '' : '';
    document.getElementById('srv-host').value  = p ? p.host  || '' : '';
    document.getElementById('srv-port').value  = p ? p.port  || '22' : '22';
    document.getElementById('srv-user').value  = p ? p.user  || '' : '';
    document.getElementById('srv-pass').value  = p ? p.pass  || '' : '';
    document.getElementById('srv-key').value   = p ? p.key   || '' : '';
    document.getElementById('srv-id').value    = p ? p.id       : '';
    document.getElementById('delete-srv-btn').style.display = p ? 'block' : 'none';
    document.getElementById('server-modal-overlay').style.display = 'flex';
}

document.getElementById('cancel-srv-btn').addEventListener('click', () => {
    document.getElementById('server-modal-overlay').style.display = 'none';
});

function uuidv4() {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

document.getElementById('save-srv-btn').addEventListener('click', async () => {
    const id  = document.getElementById('srv-id').value || uuidv4();
    const srv = {
        id,
        name:  document.getElementById('srv-name').value,
        group: document.getElementById('srv-group').value,
        host:  document.getElementById('srv-host').value,
        port:  document.getElementById('srv-port').value || 22,
        user:  document.getElementById('srv-user').value,
        pass:  document.getElementById('srv-pass').value,
        key:   document.getElementById('srv-key').value
    };
    if (!srv.host || !srv.user) return showToast('Host and Username are required.', 'error');

    const idx = profiles.findIndex(x => x.id === id);
    if (idx > -1) profiles[idx] = srv; else profiles.push(srv);

    const blob = encryptData(JSON.stringify(profiles), masterKey);
    await saveProfilesBlob(blob);
    renderSidebar();
    renderSftpSidebar();
    document.getElementById('server-modal-overlay').style.display = 'none';
});

document.getElementById('add-server-btn').addEventListener('click', () => openServerModal());

document.getElementById('delete-srv-btn').addEventListener('click', async () => {
    const id = document.getElementById('srv-id').value;
    profiles  = profiles.filter(x => x.id !== id);
    const blob = encryptData(JSON.stringify(profiles), masterKey);
    await saveProfilesBlob(blob);
    renderSidebar();
    renderSftpSidebar();
    document.getElementById('server-modal-overlay').style.display = 'none';
});

// ──────────────────────────────────────────
// Terminal Tab Logic
// ──────────────────────────────────────────
function openTerminalTab(p) {
    // Switch to terminal view first
    switchView('terminal');
    document.getElementById('terminal-overlay').style.display = 'none';

    const existing = Object.values(activeTabs).find(t => t.profile.id === p.id);
    if (existing) { switchTab(existing.id); return; }

    const tabId   = uuidv4();
    const wrapper = document.getElementById('terminals-wrapper');
    const pane    = document.createElement('div');
    pane.className = 'term-pane';
    pane.id        = `pane-${tabId}`;
    wrapper.appendChild(pane);

    const term     = new Terminal({ cursorBlink: true, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, theme: { background: '#000000', foreground: '#ffffff' } });
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(pane);

    const host     = window.location.host;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl    = p.isWsl ? `${protocol}//${host}/api/local/terminal` : `${protocol}//${host}/api/ssh/terminal`;
    const ws       = new WebSocket(wsUrl);

    activeTabs[tabId] = { id: tabId, profile: p, term, fitAddon, ws, paneDom: pane };

    ws.onopen = () => {
        if (p.isWsl) {
            ws.send(JSON.stringify({ distro: p.distro }));
        } else {
            ws.send(JSON.stringify({ host: p.host, port: parseInt(p.port), username: p.user, password: p.pass, private_key: p.key }));
        }
        setTimeout(() => { if (ws.readyState === WebSocket.OPEN) ws.send(`\x1b[resize;${term.cols};${term.rows}m`); }, 500);
    };
    ws.onmessage  = evt => term.write(evt.data);
    ws.onclose    = ()  => { try { term.write('\r\nConnection closed.'); } catch {} };
    ws.onerror    = ()  => { try { term.write('\r\nWebSocket error.'); }   catch {} };
    term.onData(d => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(d); });
    term.write(`Connecting to ${p.host}...\r\n`);

    renderTabsHeader();
    switchTab(tabId);
    renderSidebar();
}

function renderTabsHeader() {
    const strip = document.getElementById('tab-strip');
    strip.innerHTML = '';
    Object.values(activeTabs).forEach(tab => {
        const d = document.createElement('div');
        d.className = 'term-tab';
        if (tab.id === currentTabId) d.classList.add('active');
        d.innerHTML = `
            <div class="term-tab-title"><span style="color:#0ea5e9;">➜</span> ${tab.profile.name || tab.profile.host}</div>
            <div class="tab-close">✖</div>
        `;
        d.addEventListener('click', () => switchTab(tab.id));
        d.querySelector('.tab-close').addEventListener('click', e => { e.stopPropagation(); closeTab(tab.id); });
        strip.appendChild(d);
    });
}

function switchTab(tabId) {
    if (!activeTabs[tabId]) return;
    currentTabId = tabId;
    Object.values(activeTabs).forEach(t => {
        if (t.paneDom) t.paneDom.classList.toggle('active', t.id === tabId);
    });
    renderTabsHeader();
    if (activeTabs[tabId].fitAddon) activeTabs[tabId].fitAddon.fit();
}

function closeTab(tabId) {
    const t = activeTabs[tabId];
    if (!t) return;
    if (t.ws)      t.ws.close();
    if (t.term)    t.term.dispose();
    if (t.paneDom) t.paneDom.remove();
    delete activeTabs[tabId];

    const keys = Object.keys(activeTabs);
    if (keys.length === 0) {
        currentTabId = null;
        document.getElementById('terminal-overlay').style.display = 'flex';
    } else if (currentTabId === tabId) {
        switchTab(keys[keys.length - 1]);
    }
    renderTabsHeader();
    renderSidebar();
}

window.addEventListener('resize', () => {
    if (currentTabId && activeTabs[currentTabId]?.fitAddon) {
        const t = activeTabs[currentTabId];
        t.fitAddon.fit();
        if (t.ws && t.ws.readyState === WebSocket.OPEN) t.ws.send(`\x1b[resize;${t.term.cols};${t.term.rows}m`);
    }
});

// ──────────────────────────────────────────
// SFTP Browser Logic
// ──────────────────────────────────────────
async function sftpConnectTo(profile) {
    sftpConn = { profile, path: '/' };
    renderSftpSidebar();

    // Update connection indicator
    const dot   = document.getElementById('sftp-status-dot');
    dot.style.background = '#22c55e';
    dot.style.boxShadow  = '0 0 6px rgba(34,197,94,0.6)';
    document.getElementById('sftp-conn-label').textContent = `${profile.user}@${profile.host}:${profile.port || 22}`;
    document.getElementById('sftp-disconnect-btn').style.display = 'inline-block';
    document.getElementById('sftp-refresh-btn').style.display    = 'inline-block';

    await sftpLoadDir('/');
}

document.getElementById('sftp-disconnect-btn').addEventListener('click', () => {
    sftpConn = null;
    renderSftpSidebar();
    // Reset UI
    document.getElementById('sftp-status-dot').style.background = '#6b7280';
    document.getElementById('sftp-status-dot').style.boxShadow  = 'none';
    document.getElementById('sftp-conn-label').textContent  = 'Not connected — select a session';
    document.getElementById('sftp-disconnect-btn').style.display = 'none';
    document.getElementById('sftp-refresh-btn').style.display    = 'none';
    document.getElementById('sftp-up-btn').disabled              = true;
    document.getElementById('sftp-path-input').value             = '/';
    document.getElementById('sftp-file-grid').innerHTML          = '';
    document.getElementById('sftp-empty-state').style.display    = 'flex';
    document.getElementById('sftp-error-msg').style.display      = 'none';
});

document.getElementById('sftp-up-btn').addEventListener('click', () => {
    if (!sftpConn) return;
    const parts = sftpConn.path.replace(/\/$/, '').split('/');
    parts.pop();
    sftpLoadDir(parts.join('/') || '/');
});

document.getElementById('sftp-refresh-btn').addEventListener('click', () => {
    if (sftpConn) sftpLoadDir(sftpConn.path);
});

async function sftpLoadDir(path) {
    if (!sftpConn) return;
    sftpConn.path = path;

    document.getElementById('sftp-path-input').value         = path;
    document.getElementById('sftp-up-btn').disabled           = (path === '/');
    document.getElementById('sftp-empty-state').style.display = 'none';
    document.getElementById('sftp-error-msg').style.display   = 'none';
    document.getElementById('sftp-file-grid').innerHTML        = '';
    document.getElementById('sftp-loading').style.display      = 'flex';

    try {
        const payload = {
            host:        sftpConn.profile.host,
            port:        parseInt(sftpConn.profile.port || 22),
            username:    sftpConn.profile.user,
            password:    sftpConn.profile.pass  || null,
            private_key: sftpConn.profile.key   || null,
            path
        };
        const r = await fetch('/api/sftp/list', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });
        if (!r.ok) {
            const e = await r.json();
            throw new Error(e.detail || `Server error ${r.status}`);
        }
        const data = await r.json();
        document.getElementById('sftp-loading').style.display = 'none';
        renderSftpGrid(data.files || []);
    } catch (e) {
        document.getElementById('sftp-loading').style.display  = 'none';
        const errEl = document.getElementById('sftp-error-msg');
        errEl.textContent  = `Error: ${e.message}`;
        errEl.style.display = 'block';
        showToast(e.message, 'error');
    }
}

function renderSftpGrid(files) {
    const grid = document.getElementById('sftp-file-grid');
    grid.innerHTML = '';
    if (files.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:3rem 1rem;font-size:0.9rem;">This directory is empty.</div>`;
        return;
    }
    files.forEach(f => {
        const card      = document.createElement('div');
        card.className  = f.is_dir ? 'sftp-card sftp-card-dir' : 'sftp-card';
        const icon      = f.is_dir ? '📁' : getSftpFileIcon(f.name);
        const size      = f.is_dir ? '' : formatFileSize(f.size);
        card.innerHTML  = `
            <div class="sftp-card-icon">${icon}</div>
            <div class="sftp-card-name" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
            <div class="sftp-card-meta">${size}</div>
        `;
        if (f.is_dir) {
            card.title = 'Double-click to open';
            card.addEventListener('dblclick', () => {
                if (!sftpConn) return;
                const newPath = sftpConn.path === '/' ? '/' + f.name : sftpConn.path + '/' + f.name;
                sftpLoadDir(newPath);
            });
        }
        grid.appendChild(card);
    });
}

// ──────────────────────────────────────────
// Utility
// ──────────────────────────────────────────
function escHtml(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatFileSize(bytes) {
    if (bytes == null) return '';
    if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes > 1024)    return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}

function getSftpFileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const map = {
        js: '📜', ts: '📜', py: '🐍', rb: '💎', go: '🐹', sh: '⚙️', bash: '⚙️',
        html: '🌐', css: '🎨', json: '📋', yaml: '📋', yml: '📋', toml: '📋',
        xml: '📋', md: '📝', txt: '📝', log: '📝', pdf: '📄',
        png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
        zip: '📦', tar: '📦', gz: '📦', bz2: '📦', xz: '📦', deb: '📦',
        mp3: '🎵', mp4: '🎬', mkv: '🎬', lock: '🔒',
    };
    return map[ext] || '📄';
}
