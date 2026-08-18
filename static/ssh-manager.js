// ssh-manager.js  v3

// ──────────────────────────────────────────
// Global State
// ──────────────────────────────────────────
let masterKey        = null;
let profilesEncrypted = true;   // false when no master password is configured
let profiles         = [];
let wslProfiles      = [];
// activeTabs: tabId → { id, profile, term, fitAddon, ws, paneDom }
let activeTabs   = {};
let currentTabId = null;

// SFTP state — sftpConn holds profile and current path; dashConn holds profile and websocket
let sftpConn = null;
let dashConn = null;
let dashCharts = { cpu_history: [], ram_history: [], instances: {}, disksRendered: false };

function destroyAllDashCharts() {
    if (dashCharts?.instances) {
        Object.values(dashCharts.instances).forEach(c => {
            try { c.destroy(); } catch {}
        });
    }
    const disksContainer = document.getElementById('dash-disks-container');
    if (disksContainer) {
        disksContainer.innerHTML = '<div style="color:var(--text-muted); font-size: 0.85rem; grid-column: 1/-1; text-align: center; margin-top: 2rem;">Waiting for metric data...</div>';
    }
    dashCharts = { cpu_history: [], ram_history: [], instances: {}, disksRendered: false };
}

// Current view: 'terminal' | 'sftp' | 'dashboard'
let currentView  = 'terminal';

// ──────────────────────────────────────────
// SVG Icons (no emoji in UI chrome — SPEC §9.8/§9.9)
// ──────────────────────────────────────────
const ICON_PATHS = {
    host:         '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
    folder:       '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    edit:         '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash:        '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    close:        '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    chevronDown:  '<polyline points="6 9 12 15 18 9"/>',
    file:         '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    fileText:     '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
    code:         '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    image:        '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    archive:      '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    media:        '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
    lock:         '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    check:        '<polyline points="20 6 9 17 4 12"/>',
    warning:      '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    refresh:      '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    alertCircle:  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    info:         '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
};

/** Builds an inline stroke-SVG icon element. `name` must be a key in ICON_PATHS (static, not user data). */
function svgIcon(name, { size = 15, strokeWidth = 2, className = '' } = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', String(strokeWidth));
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('width', String(size));
    el.setAttribute('height', String(size));
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('focusable', 'false');
    if (className) el.setAttribute('class', className);
    el.innerHTML = ICON_PATHS[name] || ''; // NOSONAR — static constant markup, not user input
    return el;
}

// ──────────────────────────────────────────
// Toast
// ──────────────────────────────────────────
const TOAST_ICONS = { error: 'alertCircle', success: 'check', warning: 'warning', info: 'info' };

function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.appendChild(svgIcon(TOAST_ICONS[type] || 'host', { size: 15 }));

    const body = document.createElement('span');
    body.className = 'toast-body';
    body.textContent = msg;

    t.appendChild(icon);
    t.appendChild(body);
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

function _sessionHeaders(extra = {}) {
    const m    = /(?:^|;\s*)ds_csrf=([^;]+)/.exec(document.cookie);
    const csrf = m ? decodeURIComponent(m[1]) : '';
    return csrf ? { 'X-CSRF-Token': csrf, ...extra } : { ...extra };
}

async function loadProfilesBlob() {
    const r = await fetch('/api/ssh/profiles', { headers: _sessionHeaders() });
    if (!r.ok) throw new Error(`Failed to load profiles: ${r.status}`);
    const d = await r.json();
    return d.encrypted_blob || '';
}

async function saveProfilesBlob(blob) {
    const r = await fetch('/api/ssh/profiles', {
        method: 'POST',
        headers: _sessionHeaders({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify({ encrypted_blob: blob })
    });
    if (!r.ok) {
        const error = new Error('Failed to save profiles.');
        showToast(error.message, 'error');
        throw error;
    }
    showToast('Profile saved.', 'success');
}

// ──────────────────────────────────────────
// Init & Unlock (via DevSuite master password)
// ──────────────────────────────────────────

// After auth-guard verifies the master password, use it to decrypt SSH profiles.
// If existing profiles were encrypted with a different (old) password, show a
// one-time migration panel so the user can provide the old password and re-encrypt.

async function _applyMasterKey(pwd) {
    let blob;
    try { blob = await loadProfilesBlob(); }
    catch (e) { showToast('Failed to load profiles: ' + e.message, 'error'); return; }

    if (!blob) {
        // No profiles yet — initialize with master password
        masterKey = pwd;
        profiles  = [];
        await saveProfilesBlob(encryptData('[]', pwd));
        document.getElementById('master-password-overlay').style.display = 'none';
        discoverWsl();
        renderSidebar(); renderSftpSidebar(); renderDashboardSidebar();
        return;
    }

    const dec = decryptData(blob, pwd);
    if (dec) {
        // Master password matches — load profiles
        try {
            profiles  = JSON.parse(dec);
            masterKey = pwd;
            document.getElementById('master-password-overlay').style.display = 'none';
            discoverWsl();
            renderSidebar(); renderSftpSidebar(); renderDashboardSidebar();
        } catch { showToast('Failed to parse profiles.', 'error'); }
        return;
    }

    // Decryption failed — profiles were encrypted with a different password.
    // Show migration UI so the user can supply the old password.
    _showMigrationPanel(blob, pwd);
}

function _showMigrationPanel(encryptedBlob, newPwd) {
    const overlay = document.getElementById('master-password-overlay');
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <div class="modal-header-icon">${svgIcon('refresh', { size: 17 }).outerHTML}</div>
                <h2>Migrate SSH Profiles</h2>
            </div>
            <p class="modal-desc">
                Your SSH profiles were encrypted with a <strong>different password</strong>.
                Enter the old password to migrate them to your DevSuite master password,
                or start fresh (your existing profiles will be lost).
            </p>
            <div class="field-group" style="margin-top:1rem;">
                <label class="field-label" for="migrate-old-pwd">Old SSH Password</label>
                <input type="password" id="migrate-old-pwd" class="field-input"
                       placeholder="Old SSH password" autocomplete="off" spellcheck="false">
            </div>
            <div id="migrate-err" class="field-error" style="display:none;"></div>
            <div style="display:flex;gap:8px;">
                <button id="migrate-btn" class="btn btn-primary" style="flex:1;">Migrate</button>
                <button id="migrate-fresh-btn" class="btn" style="flex:1;">Start Fresh</button>
            </div>
        </div>`;
    overlay.style.display = 'flex';

    document.getElementById('migrate-btn').addEventListener('click', async () => {
        const oldPwd  = document.getElementById('migrate-old-pwd').value;
        const errEl   = document.getElementById('migrate-err');
        errEl.style.display = 'none';
        if (!oldPwd) { errEl.textContent = 'Enter the old password.'; errEl.style.display = 'block'; return; }

        const dec = decryptData(encryptedBlob, oldPwd);
        if (!dec) {
            errEl.textContent = 'Incorrect old password.';
            errEl.style.display = 'block';
            return;
        }
        try {
            profiles = JSON.parse(dec);
        } catch {
            errEl.textContent = 'Could not parse profiles — data may be corrupted.';
            errEl.style.display = 'block';
            return;
        }
        // Re-encrypt with the master password and save
        masterKey = newPwd;
        await saveProfilesBlob(encryptData(JSON.stringify(profiles), newPwd));
        overlay.style.display = 'none';
        showToast('SSH profiles migrated to master password', 'success');
        discoverWsl();
        renderSidebar(); renderSftpSidebar(); renderDashboardSidebar();
    });

    document.getElementById('migrate-fresh-btn').addEventListener('click', async () => {
        if (!confirm('This will delete all existing SSH profiles. Are you sure?')) return;
        masterKey = newPwd;
        profiles  = [];
        await saveProfilesBlob(encryptData('[]', newPwd));
        overlay.style.display = 'none';
        showToast('SSH profiles reset.', 'info');
        discoverWsl();
        renderSidebar(); renderSftpSidebar(); renderDashboardSidebar();
    });
}

// Boot: run auth-guard first, then unlock profiles with the master password
(async () => { // NOSONAR — top-level await requires ES module; script loads in non-module context
    const pwd = await AuthGuard.init('Secure Terminal');
    if (pwd) {
        await _applyMasterKey(pwd);
    } else {
        // No master password set — store and retrieve profiles as plain JSON
        profilesEncrypted = false;
        masterKey = '';
        showToast('No master password set — profiles are stored unencrypted.', 'warning');
        document.getElementById('master-password-overlay').style.display = 'none';
        // Load existing plain profiles if any
        try {
            const r = await fetch('/api/ssh/profiles', { headers: _sessionHeaders() });
            if (r.ok) {
                const d = await r.json();
                const raw = d.plain_profiles || d.encrypted_blob || '';
                if (raw) {
                    try { profiles = JSON.parse(raw); } catch { profiles = []; }
                }
            }
        } catch { profiles = []; }
        discoverWsl();
        renderSidebar(); renderSftpSidebar(); renderDashboardSidebar();
    }
})();

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
document.getElementById('strip-dashboard')?.addEventListener('click', () => switchView('dashboard'));
document.getElementById('terminal-overlay-sftp-btn').addEventListener('click', () => switchView('sftp'));

function switchView(view) {
    currentView = view;

    // Strip button states
    document.getElementById('strip-sessions').classList.toggle('active', view === 'terminal');
    document.getElementById('strip-sftp').classList.toggle('active',    view === 'sftp');
    if (document.getElementById('strip-dashboard')) {
        document.getElementById('strip-dashboard').classList.toggle('active', view === 'dashboard');
    }

    // Panel visibility
    document.getElementById('terminal-panel').style.display = view === 'terminal' ? 'flex' : 'none';
    document.getElementById('sftp-panel').style.display     = view === 'sftp'     ? 'flex' : 'none';
    if (document.getElementById('dashboard-panel')) {
        document.getElementById('dashboard-panel').style.display = view === 'dashboard' ? 'flex' : 'none';
    }

    // Sidebar content
    document.getElementById('sessions-sidebar-content').style.display = view === 'terminal' ? 'flex' : 'none';
    document.getElementById('sftp-sidebar-content').style.display     = view === 'sftp'     ? 'flex' : 'none';
    if (document.getElementById('dashboard-sidebar-content')) {
        document.getElementById('dashboard-sidebar-content').style.display = view === 'dashboard' ? 'flex' : 'none';
    }

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

function makeDeleteHandler(p) {
    return async e => {
        e.stopPropagation();
        if (!confirm(`Delete session "${p.name || p.host}"?`)) return;
        const nextProfiles = profiles.filter(x => x.id !== p.id);
        const serialized = JSON.stringify(nextProfiles);
        const blob = profilesEncrypted ? encryptData(serialized, masterKey) : serialized;
        try {
            await saveProfilesBlob(blob);
            profiles = nextProfiles;
            renderSidebar();
            renderSftpSidebar();
        } catch (err) {
            console.error('Failed to delete profile:', err);
            alert('Failed to delete profile. Please try again.');
        }
    };
}

function _buildServerItem(p) {
    const d = document.createElement('div');
    d.className = 'server-item';
    if (Object.values(activeTabs).some(t => t.profile.id === p.id)) d.classList.add('active');

    const nameLbl = document.createElement('div');
    nameLbl.className = 'server-name-lbl';
    nameLbl.appendChild(svgIcon('host', { size: 14, className: 'server-item-icon' }));
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name || p.host;
    nameLbl.appendChild(nameSpan);
    nameLbl.addEventListener('click', () => openTerminalTab(p));
    d.appendChild(nameLbl);

    if (!p.isWsl) {
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'display:flex;gap:0.25rem;';

        const editBtn = document.createElement('div');
        editBtn.className = 'edit-srv-icon';
        editBtn.title = 'Edit Session';
        editBtn.appendChild(svgIcon('edit', { size: 13 }));
        editBtn.addEventListener('click', e => { e.stopPropagation(); openServerModal(p); });
        actionsDiv.appendChild(editBtn);

        const delBtn = document.createElement('div');
        delBtn.className = 'del-srv-icon';
        delBtn.title = 'Delete Session';
        delBtn.appendChild(svgIcon('trash', { size: 13 }));
        delBtn.addEventListener('click', makeDeleteHandler(p));
        actionsDiv.appendChild(delBtn);

        d.appendChild(actionsDiv);
    }
    return d;
}

function _buildGroupDiv(gName, items) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'tree-group';

    const header = document.createElement('div');
    header.className = 'tree-folder-header';
    const isExpanded = expandedFolders.has(gName) || document.getElementById('quick-connect').value.length > 0;

    const toggleSpan = document.createElement('span');
    toggleSpan.className = 'folder-toggle';
    toggleSpan.appendChild(svgIcon(isExpanded ? 'chevronDown' : 'chevronRight', { size: 11 }));

    const iconSpan = document.createElement('span');
    iconSpan.className = 'folder-icon';
    iconSpan.appendChild(svgIcon('folder', { size: 14 }));

    const nameSpan = document.createElement('span');
    nameSpan.textContent = gName;

    header.appendChild(toggleSpan);
    header.appendChild(iconSpan);
    header.appendChild(nameSpan);

    const childrenDiv = document.createElement('div');
    childrenDiv.className = 'folder-children';
    childrenDiv.style.display = isExpanded ? 'flex' : 'none';

    header.addEventListener('click', () => {
        const open = childrenDiv.style.display !== 'none';
        childrenDiv.style.display = open ? 'none' : 'flex';
        const toggle = header.querySelector('.folder-toggle');
        toggle.innerHTML = '';
        toggle.appendChild(svgIcon(open ? 'chevronRight' : 'chevronDown', { size: 11 }));
        open ? expandedFolders.delete(gName) : expandedFolders.add(gName);
    });

    items.forEach(p => childrenDiv.appendChild(_buildServerItem(p)));

    groupDiv.appendChild(header);
    groupDiv.appendChild(childrenDiv);
    return groupDiv;
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
        list.appendChild(_buildGroupDiv(gName, items));
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

    Object.keys(groups).sort((a, b) => a.localeCompare(b)).forEach(gName => {
        const label    = document.createElement('div');
        label.className = 'sftp-group-lbl';
        label.textContent = gName;
        list.appendChild(label);

        groups[gName].forEach(p => {
            list.appendChild(_buildSftpSessItem(p, sftpConn, sftpConnectTo));
        });
    });
}

/** Shared SFTP/Dashboard session list item builder — no innerHTML with user data. */
function _buildSftpSessItem(p, activeConn, onClickFn, avatarStyle) {
    const item = document.createElement('div');
    item.className = 'sftp-sess-item';
    if (activeConn && activeConn.profile.id === p.id) item.classList.add('active');

    const avatar = document.createElement('div');
    avatar.className = 'sftp-sess-avatar';
    if (avatarStyle) avatar.style.cssText = avatarStyle;
    avatar.textContent = (p.name || p.host || '?').slice(0, 2).toUpperCase();

    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'overflow:hidden;';

    const nameDiv = document.createElement('div');
    nameDiv.style.cssText = 'font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.875rem;';
    nameDiv.textContent = p.name || p.host;

    const hostDiv = document.createElement('div');
    hostDiv.style.cssText = 'font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    hostDiv.textContent = `${p.user || ''}@${p.host}:${p.port || 22}`;

    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(hostDiv);
    item.appendChild(avatar);
    item.appendChild(infoDiv);
    item.addEventListener('click', () => onClickFn(p));
    return item;
}

document.getElementById('sftp-session-search').addEventListener('input', renderSftpSidebar);

// ──────────────────────────────────────────
// Dashboard Sidebar
// ──────────────────────────────────────────
function renderDashboardSidebar() {
    const q    = (document.getElementById('dashboard-session-search')?.value || '').toLowerCase();
    const list = document.getElementById('dashboard-session-list');
    if (!list) return;
    list.innerHTML = '';

    const filtered = profiles.filter(p =>
        (!q) ||
        (p.name  || '').toLowerCase().includes(q) ||
        (p.host  || '').toLowerCase().includes(q) ||
        (p.group || '').toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
        list.innerHTML = `<div style="padding:1.5rem 1rem;text-align:center;color:var(--text-muted);font-size:0.875rem;line-height:1.6;">
            ${profiles.length === 0
                ? 'Add SSH sessions using the <strong>+ Add Session</strong> button to use Dashboard.'
                : 'No sessions match your search.'}
        </div>`;
        return;
    }

    const groups = {};
    filtered.forEach(p => {
        const g = p.group ? p.group.trim() : 'Ungrouped';
        if (!groups[g]) groups[g] = [];
        groups[g].push(p);
    });

    Object.keys(groups).sort((a, b) => a.localeCompare(b)).forEach(gName => {
        const label = document.createElement('div');
        label.className = 'sftp-group-lbl';
        label.textContent = gName;
        list.appendChild(label);

        groups[gName].forEach(p => {
            list.appendChild(_buildSftpSessItem(p, dashConn, dashConnectTo, 'background:linear-gradient(135deg,#8b5cf6,#a855f7);'));
        });
    });
}
if(document.getElementById('dashboard-session-search')) document.getElementById('dashboard-session-search').addEventListener('input', renderDashboardSidebar);

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
    return '10000000-1000-4000-8000-100000000000'.replaceAll(/[018]/g, c =>
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

    const serialized = JSON.stringify(profiles);
    const blob = profilesEncrypted ? encryptData(serialized, masterKey) : serialized;
    await saveProfilesBlob(blob);
    renderSidebar();
    renderSftpSidebar();
    document.getElementById('server-modal-overlay').style.display = 'none';
});

document.getElementById('add-server-btn').addEventListener('click', () => openServerModal());

document.getElementById('delete-srv-btn').addEventListener('click', async () => {
    const id = document.getElementById('srv-id').value;
    profiles  = profiles.filter(x => x.id !== id);
    const serialized = JSON.stringify(profiles);
    const blob = profilesEncrypted ? encryptData(serialized, masterKey) : serialized;
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

    const host     = globalThis.location.host;
    const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl    = p.isWsl ? `${protocol}//${host}/api/local/terminal` : `${protocol}//${host}/api/ssh/terminal`;
    const ws       = new WebSocket(wsUrl);

    activeTabs[tabId] = { id: tabId, profile: p, term, fitAddon, ws, paneDom: pane };

    ws.onopen = () => {
        if (p.isWsl) {
            ws.send(JSON.stringify({ distro: p.distro }));
        } else {
            ws.send(JSON.stringify({ host: p.host, port: Number.parseInt(p.port), username: p.user, password: p.pass, private_key: p.key }));
        }
        setTimeout(() => { if (ws.readyState === WebSocket.OPEN) ws.send(`\x1b[resize;${term.cols};${term.rows}m`); }, 500);
    };
    ws.onmessage  = evt => {
        // Intercept host-key approval requests (JSON control messages)
        try {
            const msg = JSON.parse(evt.data);
            if (msg?.type === 'host_key_approval') {
                const fp = msg.fingerprint || '(unknown)';
                const approved = confirm(
                    `New SSH host detected:\n\n${msg.host}:${msg.port}\nFingerprint: ${fp}\n\nTrust this host key?`
                );
                ws.send(JSON.stringify({ type: 'host_key_response', approve: approved }));
                return;
            }
        } catch { /* not a JSON control message — fall through */ }
        term.write(evt.data);
    };
    ws.onclose    = ()  => { try { term.write('\r\nConnection closed.'); } catch {} };
    ws.onerror    = ()  => { try { term.write('\r\nWebSocket error.'); }   catch {} };
    term.onData(d => { if (ws?.readyState === WebSocket.OPEN) ws.send(d); });
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
        const titleDiv = document.createElement('div');
        titleDiv.className = 'term-tab-title';
        titleDiv.appendChild(svgIcon('chevronRight', { size: 12, className: 'term-tab-arrow' }));
        titleDiv.appendChild(document.createTextNode(' ' + (tab.profile.name || tab.profile.host)));
        d.appendChild(titleDiv);

        const closeDiv = document.createElement('div');
        closeDiv.className = 'tab-close';
        closeDiv.appendChild(svgIcon('close', { size: 11, strokeWidth: 2.5 }));
        d.appendChild(closeDiv);

        d.addEventListener('click', () => switchTab(tab.id));
        closeDiv.addEventListener('click', e => { e.stopPropagation(); closeTab(tab.id); });
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
        switchTab(keys.at(-1));
    }
    renderTabsHeader();
    renderSidebar();
}

window.addEventListener('resize', () => {
    if (currentTabId && activeTabs[currentTabId]?.fitAddon) {
        const t = activeTabs[currentTabId];
        t.fitAddon.fit();
        if (t.ws?.readyState === WebSocket.OPEN) t.ws.send(`\x1b[resize;${t.term.cols};${t.term.rows}m`);
    }
});

// ──────────────────────────────────────────
// SFTP Browser Logic
// ──────────────────────────────────────────
async function sftpConnectTo(profile) {
    sftpConn = { profile, path: '/' };
    renderSftpSidebar();

    // Update connection indicator
    document.getElementById('sftp-status-dot').className = 'status-dot status-dot-connected';
    document.getElementById('sftp-conn-label').textContent = `${profile.user}@${profile.host}:${profile.port || 22}`;
    document.getElementById('sftp-disconnect-btn').style.display = 'inline-block';
    document.getElementById('sftp-refresh-btn').style.display    = 'inline-block';
    document.getElementById('sftp-upload-btn').style.display     = 'inline-block';

    await sftpLoadDir('/');
}

document.getElementById('sftp-disconnect-btn').addEventListener('click', () => {
    // Clear active load token before disconnecting
    if (sftpConn) {
        sftpConn.activeLoad = null;
    }
    sftpConn = null;
    renderSftpSidebar();
    // Reset UI
    document.getElementById('sftp-status-dot').className = 'status-dot';
    document.getElementById('sftp-conn-label').textContent  = 'Not connected — select a session';
    document.getElementById('sftp-disconnect-btn').style.display = 'none';
    document.getElementById('sftp-refresh-btn').style.display    = 'none';
    document.getElementById('sftp-upload-btn').style.display     = 'none';
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

    // Create load token to track this request
    const loadToken = Symbol('loadToken');
    sftpConn.activeLoad = loadToken;

    document.getElementById('sftp-path-input').value         = path;
    document.getElementById('sftp-up-btn').disabled           = (path === '/');
    document.getElementById('sftp-empty-state').style.display = 'none';
    document.getElementById('sftp-error-msg').style.display   = 'none';
    document.getElementById('sftp-file-grid').innerHTML        = '';
    document.getElementById('sftp-loading').style.display      = 'flex';

    try {
        const payload = {
            host:        sftpConn.profile.host,
            port:        Number.parseInt(sftpConn.profile.port || 22),
            username:    sftpConn.profile.user,
            password:    sftpConn.profile.pass  || null,
            private_key: sftpConn.profile.key   || null,
            path
        };
        let r = await fetch('/api/sftp/list', {
            method:  'POST',
            headers: _sessionHeaders({ 'Content-Type': 'application/json' }),
            body:    JSON.stringify(payload)
        });

        // Host-key approval required (TOFU gate)
        if (r.status === 409) {
            const errBody = await r.json().catch(() => ({}));
            if (errBody.error === 'host_key_approval_required') {
                const fp = errBody.fingerprint || '(unknown)';
                const approved = confirm(
                    `New SFTP host detected:\n\n${errBody.host}:${errBody.port}\nFingerprint: ${fp}\n\nTrust this host key?`
                );
                if (!approved) { throw new Error('Host key rejected by user.'); }
                r = await fetch('/api/sftp/list', {
                    method:  'POST',
                    headers: _sessionHeaders({ 'Content-Type': 'application/json' }),
                    body:    JSON.stringify({ ...payload, approved_fingerprint: fp })
                });
            }
        }

        // Check if this request is still active
        if (sftpConn?.activeLoad !== loadToken) return;

        if (!r.ok) {
            const e = await r.json();
            throw new Error(e.detail || `Server error ${r.status}`);
        }
        const data = await r.json();

        // Check again after parsing
        if (sftpConn?.activeLoad !== loadToken) return;

        document.getElementById('sftp-loading').style.display = 'none';
        renderSftpGrid(data.files || []);
    } catch (e) {
        // Check if this request is still active
        if (sftpConn?.activeLoad !== loadToken) return;

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
        const size      = f.is_dir ? '' : formatFileSize(f.size);
        const { icon, cls } = f.is_dir ? { icon: 'folder', cls: 'file-icon-dir' } : getSftpFileIcon(f.name);

        // Create icon element
        const iconDiv = document.createElement('div');
        iconDiv.className = `sftp-card-icon ${cls}`;
        iconDiv.appendChild(svgIcon(icon, { size: 28 }));

        // Create name element
        const nameDiv = document.createElement('div');
        nameDiv.className = 'sftp-card-name';
        nameDiv.textContent = f.name;
        nameDiv.title = f.name;

        // Create meta element
        const metaDiv = document.createElement('div');
        metaDiv.className = 'sftp-card-meta';
        metaDiv.textContent = size;

        card.appendChild(iconDiv);
        card.appendChild(nameDiv);
        card.appendChild(metaDiv);

        if (f.is_dir) {
            card.title = 'Double-click to open';
            card.addEventListener('dblclick', () => {
                if (!sftpConn) return;
                const newPath = sftpConn.path === '/' ? '/' + f.name : sftpConn.path + '/' + f.name;
                sftpLoadDir(newPath);
            });
        } else {
            card.title = 'Click to download';
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => sftpDownloadFile(f.name));
        }
        grid.appendChild(card);
    });
}

// ──────────────────────────────────────────
// SFTP Download
// ──────────────────────────────────────────
async function sftpDownloadFile(filename) {
    if (!sftpConn) return;
    const filePath = sftpConn.path === '/' ? '/' + filename : sftpConn.path + '/' + filename;
    showToast(`Downloading ${filename}…`, 'info');
    try {
        const payload = {
            host:        sftpConn.profile.host,
            port:        Number.parseInt(sftpConn.profile.port || 22),
            username:    sftpConn.profile.user,
            password:    sftpConn.profile.pass  || null,
            private_key: sftpConn.profile.key   || null,
            path:        filePath
        };
        let r = await fetch('/api/sftp/download', {
            method:  'POST',
            headers: _sessionHeaders({ 'Content-Type': 'application/json' }),
            body:    JSON.stringify(payload)
        });
        // Host-key approval required (TOFU gate)
        if (r.status === 409) {
            const errBody = await r.json().catch(() => ({}));
            const errCode = errBody.error || errBody.detail?.error;
            if (errCode === 'host_key_approval_required') {
                const host        = errBody.host        || errBody.detail?.host        || '';
                const port        = errBody.port        || errBody.detail?.port        || '';
                const fingerprint = errBody.fingerprint || errBody.detail?.fingerprint || '(unknown)';
                const approved = confirm(
                    `New SFTP host detected:\n\n${host}:${port}\nFingerprint: ${fingerprint}\n\nTrust this host key?`
                );
                if (!approved) { throw new Error('Host key rejected by user.'); }
                r = await fetch('/api/sftp/download', {
                    method:  'POST',
                    headers: _sessionHeaders({ 'Content-Type': 'application/json' }),
                    body:    JSON.stringify({ ...payload, approved_fingerprint: fingerprint })
                });
            }
        }
        if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            throw new Error(e.detail?.error || e.detail || `Server error ${r.status}`);
        }
        const blob = await r.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`Downloaded ${filename}`, 'success');
    } catch (e) {
        showToast(`Download failed: ${e.message}`, 'error');
    }
}

// ──────────────────────────────────────────
// SFTP Upload
// ──────────────────────────────────────────
document.getElementById('sftp-upload-btn').addEventListener('click', () => {
    if (!sftpConn) return;
    document.getElementById('sftp-upload-input').click();
});

document.getElementById('sftp-upload-input').addEventListener('change', async (evt) => {
    const files = Array.from(evt.target.files);
    evt.target.value = '';  // reset so same file can be re-selected
    if (!files.length || !sftpConn) return;
    for (const file of files) {
        await sftpUploadFile(file);
    }
});

function sftpRetryUpload(fd, file, fp, resolve) {
    fd.append('approved_fingerprint', fp);
    const retryXhr = new XMLHttpRequest();
    retryXhr.open('POST', '/api/sftp/upload');
    const retryHeaders = _sessionHeaders();
    if (retryHeaders['X-CSRF-Token']) retryXhr.setRequestHeader('X-CSRF-Token', retryHeaders['X-CSRF-Token']);
    retryXhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            showToast(`Uploading ${file.name}… ${pct}%`, 'info');
        }
    };
    retryXhr.onload = async () => {
        if (retryXhr.status >= 200 && retryXhr.status < 300) {
            showToast(`Uploaded ${file.name}`, 'success');
            await sftpLoadDir(sftpConn.path);
        } else {
            let d = `Server error ${retryXhr.status}`;
            try { d = JSON.parse(retryXhr.response).detail || d; } catch {}
            showToast(`Upload failed: ${d}`, 'error');
        }
        resolve();
    };
    retryXhr.onerror = () => { showToast(`Upload failed: network error`, 'error'); resolve(); };
    retryXhr.send(fd);
}

async function sftpHandle409(xhr, fd, file, resolve) {
    let errBody = {};
    try { errBody = JSON.parse(xhr.response); } catch {}
    const det = errBody.detail || {};
    if (det.error !== 'host_key_approval_required') {
        const msg = det.error || (typeof det === 'string' ? det : `Server error ${xhr.status}`);
        showToast(`Upload failed: ${msg}`, 'error');
        resolve();
        return;
    }
    const fp = det.fingerprint || '(unknown)';
    const approved = confirm(
        `New SFTP host detected:\n\n${det.host}:${det.port}\nFingerprint: ${fp}\n\nTrust this host key?`
    );
    if (approved) {
        sftpRetryUpload(fd, file, fp, resolve); // resolve() called by retryXhr
    } else {
        showToast(`Upload cancelled: host key rejected.`, 'warning');
        resolve();
    }
}

function _buildUploadForm(file) {
    const fd = new FormData();
    fd.append('host',        sftpConn.profile.host);
    fd.append('port',        sftpConn.profile.port || '22');
    fd.append('username',    sftpConn.profile.user);
    if (sftpConn.profile.pass) fd.append('password',    sftpConn.profile.pass);
    if (sftpConn.profile.key)  fd.append('private_key', sftpConn.profile.key);
    fd.append('remote_path', sftpConn.path);
    fd.append('file',        file, file.name);
    return fd;
}

async function _handleUploadLoad(xhr, fd, file, resolve) {
    if (xhr.status >= 200 && xhr.status < 300) {
        showToast(`Uploaded ${file.name}`, 'success');
        await sftpLoadDir(sftpConn.path);
        resolve();
    } else if (xhr.status === 409) {
        await sftpHandle409(xhr, fd, file, resolve);
    } else {
        let detail = `Server error ${xhr.status}`;
        try { detail = JSON.parse(xhr.response).detail || detail; } catch {}
        showToast(`Upload failed: ${detail}`, 'error');
        resolve();
    }
}

async function sftpUploadFile(file) {
    if (!sftpConn) return;
    showToast(`Uploading ${file.name}… 0%`, 'info');
    const fd = _buildUploadForm(file);

    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/sftp/upload');
        const uploadHeaders = _sessionHeaders();
        if (uploadHeaders['X-CSRF-Token']) xhr.setRequestHeader('X-CSRF-Token', uploadHeaders['X-CSRF-Token']);
        xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
                showToast(`Uploading ${file.name}… ${Math.round((evt.loaded / evt.total) * 100)}%`, 'info');
            }
        };
        xhr.onload = () => _handleUploadLoad(xhr, fd, file, resolve);
        xhr.onerror = () => { showToast(`Upload failed: network error`, 'error'); resolve(); };
        xhr.send(fd);
    });
}

// ──────────────────────────────────────────
// Utility
// ──────────────────────────────────────────
function escHtml(str) {
    return (str || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatFileSize(bytes) {
    if (bytes == null) return '';
    if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes > 1024)    return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}

const SFTP_ICON_GROUPS = {
    code:    { icon: 'code',     cls: 'file-icon-code',    exts: ['js', 'ts', 'py', 'rb', 'go', 'sh', 'bash', 'html', 'css'] },
    doc:     { icon: 'fileText', cls: 'file-icon-doc',     exts: ['json', 'yaml', 'yml', 'toml', 'xml', 'md', 'txt', 'log', 'pdf'] },
    image:   { icon: 'image',    cls: 'file-icon-image',   exts: ['png', 'jpg', 'jpeg', 'gif', 'svg'] },
    archive: { icon: 'archive',  cls: 'file-icon-archive', exts: ['zip', 'tar', 'gz', 'bz2', 'xz', 'deb'] },
    media:   { icon: 'media',    cls: 'file-icon-media',   exts: ['mp3', 'mp4', 'mkv'] },
    lock:    { icon: 'lock',     cls: 'file-icon-lock',    exts: ['lock'] },
};

function getSftpFileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    for (const group of Object.values(SFTP_ICON_GROUPS)) {
        if (group.exts.includes(ext)) return { icon: group.icon, cls: group.cls };
    }
    return { icon: 'file', cls: 'file-icon-generic' };
}

// ──────────────────────────────────────────
// Dashboard Logic
// ──────────────────────────────────────────
async function dashConnectTo(profile) {
    if (dashConn?.ws) {
        dashConn.ws.close();
        dashConn = null;
    }

    destroyAllDashCharts();
    
    dashConn = { profile, ws: null };
    renderDashboardSidebar();

    document.getElementById('dashboard-status-dot').className = 'status-dot status-dot-connecting';
    document.getElementById('dashboard-conn-label').textContent = `Connecting to ${profile.user}@${profile.host}...`;
    document.getElementById('dashboard-disconnect-btn').style.display = 'inline-block';
    
    document.getElementById('dashboard-empty-state').style.display = 'none';
    document.getElementById('dashboard-metrics').style.display = 'none';
    document.getElementById('dashboard-error-msg').style.display = 'none';
    document.getElementById('dashboard-loading').style.display = 'flex';

    try {
        const host     = globalThis.location.host;
        const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl    = `${protocol}//${host}/api/ssh/dashboard`;
        
        const ws = new WebSocket(wsUrl);
        dashConn.ws = ws;
        const expectedWs = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({
                host: profile.host,
                port: Number.parseInt(profile.port || 22),
                username: profile.user,
                password: profile.pass,
                private_key: profile.key
            }));
        };

        ws.onmessage = evt => {
            if (dashConn?.ws !== expectedWs) return;
            try {
                const msg = JSON.parse(evt.data);

                if (msg.type === 'host_key_approval') {
                    const fp = msg.fingerprint || '(unknown)';
                    const approved = confirm(
                        `New SSH host detected:\n\n${msg.host}:${msg.port}\nFingerprint: ${fp}\n\nTrust this host key?`
                    );
                    ws.send(JSON.stringify({ type: 'host_key_response', approve: approved }));
                    return;
                }

                if (msg.error) {
                    throw new Error(msg.error);
                }

                if (msg.status === 'connected') {
                    document.getElementById('dashboard-status-dot').className = 'status-dot status-dot-connected';
                    document.getElementById('dashboard-conn-label').textContent = `${profile.user}@${profile.host}:${profile.port || 22}`;

                    document.getElementById('dashboard-loading').style.display = 'none';
                    document.getElementById('dashboard-metrics').style.display = 'flex';
                    document.getElementById('dash-host-title').textContent = profile.name || profile.host;
                    return;
                }

                if (msg.type === 'metrics') {
                    updateDashboardGauges(msg);
                }

            } catch (e) {
                document.getElementById('dashboard-loading').style.display = 'none';
                document.getElementById('dashboard-metrics').style.display = 'none';
                const errEl = document.getElementById('dashboard-error-msg');
                errEl.textContent = `Error: ${e.message}`;
                errEl.style.display = 'block';
                ws.close();
            }
        };

        ws.onclose = () => {
            if (!dashConn?.ws || dashConn.ws !== expectedWs) return;
            document.getElementById('dashboard-status-dot').className = 'status-dot status-dot-error';
            document.getElementById('dashboard-conn-label').textContent = 'Disconnected';
        };
    } catch (e) {
        document.getElementById('dashboard-loading').style.display = 'none';
        const errEl = document.getElementById('dashboard-error-msg');
        errEl.textContent = `Error: ${e.message}`;
        errEl.style.display = 'block';
    }
}

// Configure Chart.js global defaults if Chart is loaded
if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
}

function upsertChart(key, canvasId, applyUpdate, buildConfig) {
    if (dashCharts.instances[key]) {
        applyUpdate(dashCharts.instances[key]);
        dashCharts.instances[key].update('none');
    } else {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (ctx) dashCharts.instances[key] = new Chart(ctx, buildConfig());
    }
}

function updateDashboardGauges(metrics) {
    if (typeof Chart === 'undefined') return; // wait for chart.js to load
    
    const sec = Number.parseInt(metrics.uptime);
    const d = Math.floor(sec / (3600*24));
    const h = Math.floor(sec % (3600*24) / 3600);
    const m = Math.floor(sec % 3600 / 60);
    let upStr = '';
    if (d > 0) upStr += `${d}d `;
    if (h > 0 || d > 0) upStr += `${h}h `;
    upStr += `${m}m`;
    document.getElementById('dash-uptime-val').textContent = upStr || '< 1m';
    
    const now = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
    
    // CPU
    const cpuPct = Math.round(metrics.cpu || 0);
    document.getElementById('dash-cpu-val').textContent = cpuPct;
    dashCharts.cpu_history.push({ t: now, y: cpuPct });
    if (dashCharts.cpu_history.length > 30) dashCharts.cpu_history.shift();
    
    upsertChart('cpu', 'dash-cpu-canvas',
        (chart) => {
            chart.data.labels = dashCharts.cpu_history.map(d=>d.t);
            chart.data.datasets[0].data = dashCharts.cpu_history.map(d=>d.y);
        },
        () => ({
            type: 'line',
            data: { labels: dashCharts.cpu_history.map(d=>d.t), datasets: [{ label: 'CPU Usage %', data: dashCharts.cpu_history.map(d=>d.y), borderColor: '#0071e3', backgroundColor: 'rgba(0,113,227,0.1)', fill: true, tension: 0.4, pointRadius: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, animation: {duration: 0}, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, border: {display: false}, grid: {color: 'rgba(255,255,255,0.05)'} }, x: { border: {display: false}, grid: {color: 'transparent'}, ticks: {maxTicksLimit: 5} } } }
        })
    );
    
    // RAM
    const ramPct = Math.round(metrics.ram_pct || 0);
    document.getElementById('dash-ram-val').textContent = ramPct;
    document.getElementById('dash-ram-sub').textContent = `${(metrics.ram_used_mb || 0).toFixed(0)} / ${(metrics.ram_total_mb || 0).toFixed(0)} MB`;
    dashCharts.ram_history.push({ t: now, y: ramPct });
    if (dashCharts.ram_history.length > 30) dashCharts.ram_history.shift();
    
    upsertChart('ram', 'dash-ram-canvas',
        (chart) => {
            chart.data.labels = dashCharts.ram_history.map(d=>d.t);
            chart.data.datasets[0].data = dashCharts.ram_history.map(d=>d.y);
        },
        () => ({
            type: 'line',
            data: { labels: dashCharts.ram_history.map(d=>d.t), datasets: [{ label: 'RAM Usage %', data: dashCharts.ram_history.map(d=>d.y), borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', fill: true, tension: 0.4, pointRadius: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, animation: {duration: 0}, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, border: {display: false}, grid: {color: 'rgba(255,255,255,0.05)'} }, x: { border: {display: false}, grid: {color: 'transparent'}, ticks: {maxTicksLimit: 5} } } }
        })
    );
    
    // Swap
    const swapPct = Math.round(metrics.swap_pct || 0);
    document.getElementById('dash-swap-sub').textContent = `${(metrics.swap_used_mb || 0).toFixed(0)} / ${(metrics.swap_total_mb || 0).toFixed(0)} MB`;
    
    upsertChart('swap', 'dash-swap-canvas',
        (chart) => { chart.data.datasets[0].data = [swapPct, 100 - swapPct]; },
        () => ({
            type: 'doughnut',
            data: { labels: ['Used', 'Free'], datasets: [{ data: [swapPct, 100 - swapPct], backgroundColor: ['#ef4444', 'rgba(255, 255, 255, 0.05)'], borderWidth: 0, cutout: '75%' }] },
            options: { responsive: true, maintainAspectRatio: false, animation: {animateRotate: false}, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
        })
    );
    
    // Disks
    const disksContainer = document.getElementById('dash-disks-container');
    if ((metrics.disks || []).length === 0) {
        if (!dashCharts.disksRendered) {
            disksContainer.innerHTML = '<div style="color:var(--text-muted); font-size: 0.85rem; grid-column: 1/-1; text-align: center; margin-top: 2rem;">No standard physical disks detected.</div>';
            dashCharts.disksRendered = true;
        }
    } else {
        if (!dashCharts.disksRendered) {
             disksContainer.innerHTML = '';
             dashCharts.disksRendered = true;
        }
        
        metrics.disks.forEach((disk, idx) => {
            const diskId = `dash-disk-${idx}`;
            let wrap = document.getElementById(`${diskId}-wrap`);
            if (!wrap) {
                 wrap = document.createElement('div');
                 wrap.id = `${diskId}-wrap`;
                 wrap.className = 'dashboard-card';
                 wrap.style.padding = '1rem';
                 wrap.style.background = 'var(--bg-3)';
                 wrap.style.display = 'flex';
                 wrap.style.flexDirection = 'column';

                 const title = document.createElement('div');
                 title.style.fontWeight = '500';
                 title.style.fontSize = '0.85rem';
                 title.style.marginBottom = '0.5rem';
                 title.style.textAlign = 'center';
                 title.style.color = 'var(--text-color)';
                 title.textContent = disk.mount == null ? '' : String(disk.mount);

                 const canvasWrap = document.createElement('div');
                 canvasWrap.style.height = '100px';
                 canvasWrap.style.position = 'relative';

                 const canvas = document.createElement('canvas');
                 canvas.id = `${diskId}-canvas`;
                 canvasWrap.appendChild(canvas);

                 const subWrap = document.createElement('div');
                 subWrap.style.textAlign = 'center';
                 subWrap.style.marginTop = '0.5rem';
                 subWrap.style.fontSize = '0.75rem';
                 subWrap.style.color = 'var(--text-muted)';

                 const sub = document.createElement('span');
                 sub.id = `${diskId}-sub`;
                 subWrap.appendChild(sub);

                 wrap.appendChild(title);
                 wrap.appendChild(canvasWrap);
                 wrap.appendChild(subWrap);
                 disksContainer.appendChild(wrap);
            }
            
            const dpct = Math.round(disk.pct || 0);
            let color = '#22c55e';
            if (dpct > 80) color = '#eab308';
            if (dpct > 90) color = '#ef4444';
            
            const usedGb = (disk.used_mb || 0) / 1024;
            const totalGb = (disk.total_mb || 0) / 1024;
            document.getElementById(`${diskId}-sub`).textContent = `${usedGb.toFixed(1)} / ${totalGb.toFixed(1)} GB`;
            
            upsertChart(diskId, `${diskId}-canvas`,
                (chart) => {
                    chart.data.datasets[0].data = [dpct, 100 - dpct];
                    chart.data.datasets[0].backgroundColor[0] = color;
                },
                () => ({
                    type: 'doughnut',
                    data: { labels: ['Used', 'Free'], datasets: [{ data: [dpct, 100 - dpct], backgroundColor: [color, 'rgba(255, 255, 255, 0.05)'], borderWidth: 0, cutout: '70%' }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: {animateRotate: false}, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
                })
            );
        });
    }
}

if(document.getElementById('dashboard-disconnect-btn')) {
    document.getElementById('dashboard-disconnect-btn').addEventListener('click', () => {
        dashConn?.ws?.close();
        dashConn = null;
        destroyAllDashCharts();
        renderDashboardSidebar();
        
        document.getElementById('dashboard-status-dot').className = 'status-dot';
        document.getElementById('dashboard-conn-label').textContent  = 'Not connected — select a session';
        document.getElementById('dashboard-disconnect-btn').style.display = 'none';
        
        document.getElementById('dashboard-metrics').style.display = 'none';
        document.getElementById('dashboard-error-msg').style.display = 'none';
        document.getElementById('dashboard-empty-state').style.display = 'flex';
    });
}