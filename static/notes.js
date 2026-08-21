// notes.js — Notes Workspace v1
// Encrypted (Vault-equivalent v2 WebCrypto scheme) Notebook -> Section -> Page
// workspace with a Monaco Markdown editor, wiki-links, backlinks, tags, and
// full-text search. Pure link/tag/search logic lives in notes-links.js.

// ──────────────────────────────────────────
// Global state
// ──────────────────────────────────────────
let notesKenc   = null;   // Uint8Array(32) — AES-256-GCM key, never leaves the browser
let notesSaltHex = null;  // hex PBKDF2 salt for THIS store (independent from Vault's own salt)
let tree = { version: 1, notebooks: {}, sections: {}, pages: {} };
let indexes = { titleIndex: new Map(), backlinks: new Map(), tagIndex: new Map() };

let openTabs = [];         // ordered array of pageIds
let currentPageId = null;
let editorMode = 'edit';   // 'edit' | 'preview'

let monacoEditor = null;
let monacoModel  = null;
let currentDecorationIds = [];
let completionProviderRegistered = false;

let saveDebounceTimer = null;
const SAVE_DEBOUNCE_MS = 800;

const expandedNotebooks = new Set();
const expandedSections  = new Set();

// ──────────────────────────────────────────
// SVG icons (no emoji in UI chrome — SPEC §9.8/§9.9)
// ──────────────────────────────────────────
const ICON_PATHS = {
    notebook:     '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    section:      '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    page:         '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    chevronDown:  '<polyline points="6 9 12 15 18 9"/>',
    edit:         '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash:        '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    close:        '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    plus:         '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    copy:         '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
};
function svgIcon(name, { size = 14, strokeWidth = 2, className = '' } = {}) {
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

function genId() {
    const rnd = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    return Date.now().toString(36) + rnd.slice(-6);
}

function toast(msg, type = 'info') {
    if (globalThis.DevSuite?.toast) DevSuite.toast(msg, type);
}

// ──────────────────────────────────────────
// v2 WebCrypto encryption (mirrors static/vault.js's _deriveMasterKeysV2 /
// encryptVaultGCM / decryptVaultGCM — research.md item 2). Notes only needs
// Kenc (the first 256 bits); Kauth (server session auth) is already handled
// by auth-guard.js against Vault's own challenge — Notes never authenticates
// a session itself.
// ──────────────────────────────────────────
function _hexToBytes(hex) {
    const b = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) b[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
    return b;
}
function _bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveNotesKenc(password, saltHex) {
    const keyMaterial = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: _hexToBytes(saltHex), iterations: 310000 },
        keyMaterial, 512
    );
    return new Uint8Array(bits).slice(0, 32); // Kenc only
}

async function encryptTreeGCM(treeObj, kenc) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aesKey = await crypto.subtle.importKey('raw', kenc, { name: 'AES-GCM' }, false, ['encrypt']);
    const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(JSON.stringify(treeObj)));
    return { ciphertext: _bytesToHex(new Uint8Array(buf)), iv: _bytesToHex(iv) };
}

async function decryptTreeGCM(ciphertextHex, ivHex, kenc) {
    const aesKey = await crypto.subtle.importKey('raw', kenc, { name: 'AES-GCM' }, false, ['decrypt']);
    const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: _hexToBytes(ivHex) }, aesKey, _hexToBytes(ciphertextHex));
    return JSON.parse(new TextDecoder().decode(buf));
}

function _sessionHeaders(extra = {}) {
    const csrf = DevSuite.csrfToken();
    return csrf ? { 'X-CSRF-Token': csrf, ...extra } : { ...extra };
}

// ──────────────────────────────────────────
// Load / save the whole tree
// ──────────────────────────────────────────
async function loadNotesTree() {
    const r = await fetch('/api/notes', { headers: _sessionHeaders() });
    if (!r.ok) throw new Error(`Failed to load notes: ${r.status}`);
    const data = await r.json();

    if (!data.encrypted_blob) {
        // First run — initialize an empty tree with a fresh salt.
        notesSaltHex = _bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
        notesKenc = await deriveNotesKenc(masterPassword, notesSaltHex);
        tree = { version: 1, notebooks: {}, sections: {}, pages: {} };
        return;
    }

    notesSaltHex = data.salt;
    notesKenc = await deriveNotesKenc(masterPassword, notesSaltHex);
    try {
        tree = await decryptTreeGCM(data.encrypted_blob, data.iv, notesKenc);
    } catch {
        throw new Error('Wrong password or corrupted notes store.');
    }
    normalizeTree();
    rebuildIndexes();
}

function rebuildIndexes() {
    indexes = NotesLinks.buildIndexes(tree);
}

// data-model.md §4: sectionOrder/pageOrder must exactly match the set of
// child ids that actually exist — repair dangling/missing ids after a
// partial write before anything else reads the tree.
function normalizeTree() {
    tree = { version: 1, notebooks: {}, sections: {}, pages: {}, ...tree };
    for (const sec of Object.values(tree.sections)) {
        const existing = Object.values(tree.pages).filter(p => p.sectionId === sec.id).map(p => p.id);
        sec.pageOrder = (sec.pageOrder || []).filter(id => existing.includes(id))
            .concat(existing.filter(id => !(sec.pageOrder || []).includes(id)));
    }
    for (const nb of Object.values(tree.notebooks)) {
        const existing = Object.values(tree.sections).filter(s => s.notebookId === nb.id).map(s => s.id);
        nb.sectionOrder = (nb.sectionOrder || []).filter(id => existing.includes(id))
            .concat(existing.filter(id => !(nb.sectionOrder || []).includes(id)));
    }
}

async function persistNotesTreeNow() {
    if (!notesKenc) return;
    const payload = await encryptTreeGCM(tree, notesKenc);
    const r = await fetch('/api/notes', {
        method: 'POST',
        headers: _sessionHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ encrypted_blob: payload.ciphertext, iv: payload.iv, salt: notesSaltHex, version: 2 }),
    });
    if (!r.ok) throw new Error(`Notes save failed: HTTP ${r.status}`);
}

function scheduleSave() {
    rebuildIndexes();
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
        saveDebounceTimer = null;
        persistNotesTreeNow().catch(e => { console.error(e); toast('Failed to save notes: ' + e.message, 'error'); });
    }, SAVE_DEBOUNCE_MS);
}

function flushSaveNow() {
    if (saveDebounceTimer) { clearTimeout(saveDebounceTimer); saveDebounceTimer = null; }
    persistNotesTreeNow().catch(e => console.error(e));
}

// visibilitychange fires while the document can still complete async work;
// beforeunload cannot await the encrypt+fetch chain, so a tab closed within
// SAVE_DEBOUNCE_MS of the last keystroke would otherwise lose that edit.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        flushCurrentEditorToTree();
        flushSaveNow();
    }
});
window.addEventListener('beforeunload', flushSaveNow);

// ──────────────────────────────────────────
// Title helpers
// ──────────────────────────────────────────
function generateUniqueTitle(base) {
    let candidate = base;
    let n = 2;
    while (!NotesLinks.isTitleAvailable(tree, candidate, null)) {
        candidate = `${base} ${n}`;
        n += 1;
    }
    return candidate;
}

// ──────────────────────────────────────────
// Notebook / Section / Page CRUD
// ──────────────────────────────────────────
function createNotebook(name) {
    const id = genId();
    tree.notebooks[id] = { id, name, sectionOrder: [], createdAt: Date.now(), updatedAt: Date.now() };
    expandedNotebooks.add(id);
    scheduleSave();
    return id;
}

function renameNotebook(id, name) {
    const nb = tree.notebooks[id];
    if (!nb) return;
    nb.name = name;
    nb.updatedAt = Date.now();
    scheduleSave();
}

function deleteNotebook(id) {
    const nb = tree.notebooks[id];
    if (!nb) return;
    for (const secId of nb.sectionOrder) deleteSection(secId, /*skipSave*/ true);
    delete tree.notebooks[id];
    scheduleSave();
}

function countPagesInNotebook(id) {
    const nb = tree.notebooks[id];
    if (!nb) return 0;
    return nb.sectionOrder.reduce((sum, secId) => sum + (tree.sections[secId]?.pageOrder.length || 0), 0);
}

function createSection(notebookId, name) {
    const nb = tree.notebooks[notebookId];
    if (!nb) return null;
    const id = genId();
    tree.sections[id] = { id, notebookId, name, pageOrder: [], createdAt: Date.now(), updatedAt: Date.now() };
    nb.sectionOrder.push(id);
    expandedSections.add(id);
    scheduleSave();
    return id;
}

function renameSection(id, name) {
    const sec = tree.sections[id];
    if (!sec) return;
    sec.name = name;
    sec.updatedAt = Date.now();
    scheduleSave();
}

function deleteSection(id, skipSave = false) {
    const sec = tree.sections[id];
    if (!sec) return;
    for (const pageId of sec.pageOrder) deletePage(pageId, /*skipSave*/ true);
    const nb = tree.notebooks[sec.notebookId];
    if (nb) nb.sectionOrder = nb.sectionOrder.filter(x => x !== id);
    delete tree.sections[id];
    if (!skipSave) scheduleSave();
}

function createPage(sectionId, title) {
    const sec = tree.sections[sectionId];
    if (!sec) return null;
    const uniqueTitle = generateUniqueTitle(title || 'Untitled');
    const id = genId();
    tree.pages[id] = { id, sectionId, title: uniqueTitle, body: '', createdAt: Date.now(), updatedAt: Date.now() };
    sec.pageOrder.push(id);
    scheduleSave();
    return id;
}

function renamePage(id, newTitle) {
    const page = tree.pages[id];
    if (!page) return { ok: false, error: 'Page not found.' };
    if (!NotesLinks.isTitleAvailable(tree, newTitle, id)) {
        return { ok: false, error: 'That title is already used by another page.' };
    }
    const oldTitle = page.title;
    page.title = newTitle;
    page.updatedAt = Date.now();
    // FR-011: propagate the rename to every referencing page's body.
    for (const p of Object.values(tree.pages)) {
        const rewritten = NotesLinks.renameLinksInBody(p.body, oldTitle, newTitle);
        if (rewritten !== p.body) { p.body = rewritten; p.updatedAt = Date.now(); }
    }
    scheduleSave();
    return { ok: true };
}

function deletePage(id, skipSave = false) {
    const page = tree.pages[id];
    if (!page) return;
    const sec = tree.sections[page.sectionId];
    if (sec) sec.pageOrder = sec.pageOrder.filter(x => x !== id);
    delete tree.pages[id];
    // FR-012: other pages' bodies are left untouched — their [[links]] simply
    // stop resolving on next index rebuild. No body mutation here.
    closeTab(id, /*skipRender*/ true);
    if (!skipSave) scheduleSave();
}

// ──────────────────────────────────────────
// Rendering: tree sidebar
// ──────────────────────────────────────────
function _treeMatchesFilter(item, q) {
    if (!q) return true;
    return (item.name || item.title || '').toLowerCase().includes(q);
}

function renderTree() {
    const host = document.getElementById('notes-tree');
    host.innerHTML = '';
    const q = (document.getElementById('tree-filter-input').value || '').trim().toLowerCase();
    const notebookIds = Object.keys(tree.notebooks).sort((a, b) => tree.notebooks[a].name.localeCompare(tree.notebooks[b].name));

    if (notebookIds.length === 0) {
        host.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'notes-empty-tree';
        empty.textContent = 'No notebooks yet. Click "New Notebook" to get started.';
        host.appendChild(empty);
        return;
    }

    for (const nbId of notebookIds) {
        const nb = tree.notebooks[nbId];
        const nbEl = _buildNotebookRow(nb, q);
        if (nbEl) host.appendChild(nbEl);
    }
}

function _notebookHasFilterMatch(nb, q) {
    if (!q) return true;
    if ((nb.name || '').toLowerCase().includes(q)) return true;
    return nb.sectionOrder.some(secId => {
        const sec = tree.sections[secId];
        if (!sec) return false;
        if ((sec.name || '').toLowerCase().includes(q)) return true;
        return sec.pageOrder.some(pid => _treeMatchesFilter(tree.pages[pid], q));
    });
}

function _buildNotebookRow(nb, q) {
    if (!_notebookHasFilterMatch(nb, q)) return null;

    const group = document.createElement('div');
    group.className = 'nb-group';

    const expanded = expandedNotebooks.has(nb.id);
    const header = document.createElement('div');
    header.className = 'nb-header';
    header.appendChild(_iconSpan(expanded ? 'chevronDown' : 'chevronRight', 'nb-toggle'));
    header.appendChild(_iconSpan('notebook', 'nb-icon'));
    const nameSpan = document.createElement('span');
    nameSpan.className = 'nb-name';
    nameSpan.textContent = nb.name;
    header.appendChild(nameSpan);

    const actions = document.createElement('div');
    actions.className = 'nb-actions';
    actions.appendChild(_actionIcon('plus', 'New Section', e => { e.stopPropagation(); const id = createSection(nb.id, generateUniqueSectionName(nb.id)); renderTree(); _startInlineSectionRename(id); }));
    actions.appendChild(_actionIcon('edit', 'Rename Notebook', e => { e.stopPropagation(); openNotebookModal(nb); }));
    actions.appendChild(_actionIcon('trash', 'Delete Notebook', e => {
        e.stopPropagation();
        const n = countPagesInNotebook(nb.id);
        if (!confirm(`Delete notebook "${nb.name}"? This removes ${n} page(s) across ${nb.sectionOrder.length} section(s). This cannot be undone.`)) return;
        deleteNotebook(nb.id);
        renderTree();
        renderEmptyOrEditor();
    }, true));
    header.appendChild(actions);
    header.addEventListener('click', () => { expanded ? expandedNotebooks.delete(nb.id) : expandedNotebooks.add(nb.id); renderTree(); });
    group.appendChild(header);

    if (expanded) {
        const children = document.createElement('div');
        children.className = 'nb-children';
        for (const secId of nb.sectionOrder) {
            const sec = tree.sections[secId];
            if (!sec) continue;
            const secEl = _buildSectionRow(sec, q);
            if (secEl) children.appendChild(secEl);
        }
        group.appendChild(children);
    }
    return group;
}

function generateUniqueSectionName(notebookId) {
    return 'New Section';
}

function _sectionHasFilterMatch(sec, q) {
    if (!q) return true;
    if ((sec.name || '').toLowerCase().includes(q)) return true;
    return sec.pageOrder.some(pid => _treeMatchesFilter(tree.pages[pid], q));
}

function _buildSectionRow(sec, q) {
    if (!_sectionHasFilterMatch(sec, q)) return null;

    const group = document.createElement('div');
    group.className = 'sec-group';
    group.draggable = true;
    group.dataset.sectionId = sec.id;

    const expanded = expandedSections.has(sec.id);
    const header = document.createElement('div');
    header.className = 'sec-header';
    header.appendChild(_iconSpan(expanded ? 'chevronDown' : 'chevronRight', 'sec-toggle'));
    header.appendChild(_iconSpan('section', 'sec-icon'));
    const nameSpan = document.createElement('span');
    nameSpan.className = 'sec-name';
    nameSpan.textContent = sec.name;
    header.appendChild(nameSpan);

    const actions = document.createElement('div');
    actions.className = 'sec-actions';
    actions.appendChild(_actionIcon('plus', 'New Page', e => { e.stopPropagation(); const id = createPage(sec.id, 'Untitled'); renderTree(); openPage(id); }));
    actions.appendChild(_actionIcon('edit', 'Rename Section', e => { e.stopPropagation(); _startInlineSectionRename(sec.id); }));
    actions.appendChild(_actionIcon('trash', 'Delete Section', e => {
        e.stopPropagation();
        if (!confirm(`Delete section "${sec.name}" and its ${sec.pageOrder.length} page(s)? This cannot be undone.`)) return;
        deleteSection(sec.id);
        renderTree();
        renderEmptyOrEditor();
    }, true));
    header.appendChild(actions);
    header.addEventListener('click', () => { expanded ? expandedSections.delete(sec.id) : expandedSections.add(sec.id); renderTree(); });
    group.appendChild(header);

    _wireSectionDragReorder(group, sec);

    if (expanded) {
        const children = document.createElement('div');
        children.className = 'sec-children';
        for (const pageId of sec.pageOrder) {
            const page = tree.pages[pageId];
            if (!page) continue;
            if (q && !_treeMatchesFilter(page, q) && !(sec.name || '').toLowerCase().includes(q)) continue;
            children.appendChild(_buildPageRow(page));
        }
        group.appendChild(children);
    }
    return group;
}

function _buildPageRow(page) {
    const item = document.createElement('div');
    item.className = 'page-item' + (page.id === currentPageId ? ' active' : '');
    item.draggable = true;
    item.dataset.pageId = page.id;
    item.appendChild(_iconSpan('page', 'page-icon'));
    const titleSpan = document.createElement('span');
    titleSpan.className = 'page-title';
    titleSpan.textContent = page.title;
    item.appendChild(titleSpan);

    const actions = document.createElement('div');
    actions.className = 'page-actions';
    actions.appendChild(_actionIcon('edit', 'Rename Page', e => { e.stopPropagation(); _startInlinePageRename(page.id, titleSpan); }));
    actions.appendChild(_actionIcon('trash', 'Delete Page', e => {
        e.stopPropagation();
        if (!confirm(`Delete page "${page.title}"? This cannot be undone.`)) return;
        deletePage(page.id);
        renderTree();
        renderTabStrip();
        renderEmptyOrEditor();
    }, true));
    item.appendChild(actions);

    item.addEventListener('click', () => openPage(page.id));
    _wirePageDragReorder(item, page);
    return item;
}

function _iconSpan(name, cls) {
    const span = document.createElement('span');
    span.className = cls;
    span.appendChild(svgIcon(name));
    return span;
}
function _actionIcon(name, title, onClick, danger = false) {
    const el = document.createElement('div');
    el.className = 'tree-action-icon' + (danger ? ' danger' : '');
    el.title = title;
    el.appendChild(svgIcon(name, { size: 12 }));
    el.addEventListener('click', onClick);
    return el;
}

// ── Inline rename ──
function _startInlineSectionRename(id) {
    renderTree();
    const el = document.querySelector(`.sec-group[data-section-id="${id}"] .sec-name`);
    if (el) _swapForRenameInput(el, tree.sections[id].name, v => v.trim() && renameSection(id, v.trim()));
}
function _startInlinePageRename(id, titleSpanEl) {
    _swapForRenameInput(titleSpanEl, tree.pages[id].title, v => {
        if (!v.trim()) return;
        const result = renamePage(id, v.trim());
        if (!result.ok) { toast(result.error, 'error'); renderTree(); return; }
        renderTree(); renderTabStrip(); renderBacklinksPanel();
        if (id === currentPageId) document.getElementById('notes-current-title').textContent = v.trim();
    });
}
function _swapForRenameInput(labelEl, currentValue, onCommit) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-rename-input';
    input.value = currentValue;
    labelEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    function commit() {
        if (done) return;
        done = true;
        onCommit(input.value);
        if (input.isConnected) renderTree();
    }
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { done = true; renderTree(); }
    });
    input.addEventListener('blur', commit);
}

// ── Drag-to-reorder ──
function _wireSectionDragReorder(el, sec) {
    el.addEventListener('dragstart', e => { e.stopPropagation(); e.dataTransfer.setData('text/notes-section', sec.id); });
    el.addEventListener('dragover', e => {
        if (!e.dataTransfer.types.includes('text/notes-section')) return;
        e.preventDefault(); e.stopPropagation();
        el.classList.add('drag-over-top');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over-top'));
    el.addEventListener('drop', e => {
        if (!e.dataTransfer.types.includes('text/notes-section')) return;
        e.preventDefault(); e.stopPropagation();
        el.classList.remove('drag-over-top');
        const draggedId = e.dataTransfer.getData('text/notes-section');
        if (draggedId === sec.id) return;
        const nb = tree.notebooks[sec.notebookId];
        if (!nb?.sectionOrder.includes(draggedId)) return;
        nb.sectionOrder = nb.sectionOrder.filter(x => x !== draggedId);
        const targetIdx = nb.sectionOrder.indexOf(sec.id);
        nb.sectionOrder.splice(targetIdx, 0, draggedId);
        scheduleSave();
        renderTree();
    });
}
function _wirePageDragReorder(el, page) {
    el.addEventListener('dragstart', e => { e.stopPropagation(); e.dataTransfer.setData('text/notes-page', page.id); });
    el.addEventListener('dragover', e => {
        if (!e.dataTransfer.types.includes('text/notes-page')) return;
        e.preventDefault(); e.stopPropagation();
        el.classList.add('drag-over-top');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over-top'));
    el.addEventListener('drop', e => {
        if (!e.dataTransfer.types.includes('text/notes-page')) return;
        e.preventDefault(); e.stopPropagation();
        el.classList.remove('drag-over-top');
        const draggedId = e.dataTransfer.getData('text/notes-page');
        if (draggedId === page.id) return;
        const sec = tree.sections[page.sectionId];
        if (!sec?.pageOrder.includes(draggedId)) return;
        sec.pageOrder = sec.pageOrder.filter(x => x !== draggedId);
        const targetIdx = sec.pageOrder.indexOf(page.id);
        sec.pageOrder.splice(targetIdx, 0, draggedId);
        scheduleSave();
        renderTree();
    });
}

// ──────────────────────────────────────────
// Notebook modal
// ──────────────────────────────────────────
function openNotebookModal(nb = null) {
    document.getElementById('notebook-modal-title').textContent = nb ? 'Rename Notebook' : 'New Notebook';
    document.getElementById('notebook-modal-id').value = nb ? nb.id : '';
    document.getElementById('notebook-name-input').value = nb ? nb.name : '';
    document.getElementById('notebook-modal-error').style.display = 'none';
    document.getElementById('notebook-modal-overlay').style.display = 'flex';
    setTimeout(() => document.getElementById('notebook-name-input').focus(), 50);
}
document.getElementById('new-notebook-btn').addEventListener('click', () => openNotebookModal());
document.getElementById('notebook-modal-cancel').addEventListener('click', () => {
    document.getElementById('notebook-modal-overlay').style.display = 'none';
});
document.getElementById('notebook-modal-save').addEventListener('click', () => {
    const name = document.getElementById('notebook-name-input').value.trim();
    const errEl = document.getElementById('notebook-modal-error');
    if (!name) { errEl.textContent = 'Name is required.'; errEl.style.display = 'flex'; return; }
    const id = document.getElementById('notebook-modal-id').value;
    if (id) renameNotebook(id, name); else createNotebook(name);
    document.getElementById('notebook-modal-overlay').style.display = 'none';
    renderTree();
});
document.getElementById('notebook-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('notebook-modal-save').click();
});

// ──────────────────────────────────────────
// Tabs / editor
// ──────────────────────────────────────────
function openPage(pageId) {
    if (!tree.pages[pageId]) return;
    if (pageId !== currentPageId) flushCurrentEditorToTree(); // never lose unsaved edits when switching
    if (!openTabs.includes(pageId)) openTabs.push(pageId);
    currentPageId = pageId;
    renderTabStrip();
    renderTree();
    renderEmptyOrEditor();
}

function closeTab(pageId, skipRender = false) {
    const idx = openTabs.indexOf(pageId);
    if (idx === -1) return;
    openTabs.splice(idx, 1);
    if (currentPageId === pageId) {
        currentPageId = openTabs.length ? openTabs.at(-1) : null;
    }
    if (!skipRender) {
        renderTabStrip();
        renderTree();
        renderEmptyOrEditor();
    }
}

function renderTabStrip() {
    const strip = document.getElementById('notes-tab-strip');
    strip.innerHTML = '';
    for (const pageId of openTabs) {
        const page = tree.pages[pageId];
        if (!page) continue;
        const tab = document.createElement('div');
        tab.className = 'notes-tab' + (pageId === currentPageId ? ' active' : '');
        const titleDiv = document.createElement('div');
        titleDiv.className = 'notes-tab-title';
        titleDiv.textContent = page.title;
        tab.appendChild(titleDiv);
        const closeDiv = document.createElement('div');
        closeDiv.className = 'notes-tab-close';
        closeDiv.appendChild(svgIcon('close', { size: 9, strokeWidth: 2.5 }));
        tab.appendChild(closeDiv);
        tab.addEventListener('click', () => { flushCurrentEditorToTree(); openPage(pageId); });
        closeDiv.addEventListener('click', e => { e.stopPropagation(); flushCurrentEditorToTree(); closeTab(pageId); });
        strip.appendChild(tab);
    }
}

function renderEmptyOrEditor() {
    const empty = document.getElementById('notes-empty-state');
    const editorCol = document.getElementById('notes-editor-col');
    const backlinksPanel = document.getElementById('notes-backlinks-panel');

    if (!currentPageId || !tree.pages[currentPageId]) {
        empty.style.display = 'flex';
        editorCol.style.display = 'none';
        backlinksPanel.style.display = 'none';
        if (Object.keys(tree.notebooks).length === 0) {
            document.getElementById('notes-empty-title').textContent = 'Notes Workspace';
            document.getElementById('notes-empty-desc').textContent = 'Create a notebook to get started.';
        } else {
            document.getElementById('notes-empty-title').textContent = 'No page open';
            document.getElementById('notes-empty-desc').textContent = 'Select a page from the sidebar, or create a new one.';
        }
        return;
    }

    empty.style.display = 'none';
    editorCol.style.display = 'flex';
    backlinksPanel.style.display = 'block';
    loadPageIntoEditor(tree.pages[currentPageId]);
    renderBacklinksPanel();
}

function flushCurrentEditorToTree() {
    if (!currentPageId || !monacoModel) return;
    const page = tree.pages[currentPageId];
    if (!page) return;
    const value = monacoModel.getValue();
    if (value !== page.body) {
        page.body = value;
        page.updatedAt = Date.now();
        scheduleSave();
    }
}

function loadPageIntoEditor(page) {
    document.getElementById('notes-current-title').textContent = page.title;
    if (!monacoEditor) return; // Monaco still loading — will be applied once ready (see boot())
    monacoModel.setValue(page.body || '');
    applyLinkDecorations();
    if (editorMode === 'preview') renderPreview();
}

// ──────────────────────────────────────────
// Backlinks panel
// ──────────────────────────────────────────
function renderBacklinksPanel() {
    const list = document.getElementById('notes-backlinks-list');
    list.innerHTML = '';
    if (!currentPageId) return;
    const refs = indexes.backlinks.get(currentPageId) || [];
    if (refs.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'notes-backlinks-empty';
        empty.textContent = 'No pages link here yet.';
        list.appendChild(empty);
        return;
    }
    for (const ref of refs) {
        const fromPage = tree.pages[ref.fromPageId];
        if (!fromPage) continue;
        const item = document.createElement('div');
        item.className = 'notes-backlink-item';
        const from = document.createElement('div');
        from.className = 'notes-backlink-from';
        from.textContent = fromPage.title;
        const snippet = document.createElement('div');
        snippet.className = 'notes-backlink-snippet';
        snippet.textContent = ref.snippet;
        item.appendChild(from);
        item.appendChild(snippet);
        item.addEventListener('click', () => { flushCurrentEditorToTree(); openPage(ref.fromPageId); });
        list.appendChild(item);
    }
}

// ──────────────────────────────────────────
// Monaco editor + wiki-links + preview
// ──────────────────────────────────────────
function applyLinkDecorations() {
    if (!monacoEditor || !monacoModel) return;
    const body = monacoModel.getValue();
    const decorations = NotesLinks.parseWikiLinks(body).map(link => {
        const resolved = !!NotesLinks.resolveLink(link.title, indexes.titleIndex);
        const startPos = monacoModel.getPositionAt(link.index);
        const endPos = monacoModel.getPositionAt(link.index + link.length);
        return {
            range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
            options: { inlineClassName: resolved ? 'notes-link-resolved' : 'notes-link-unresolved' },
        };
    });
    currentDecorationIds = monacoEditor.deltaDecorations(currentDecorationIds, decorations);
}

function _followOrCreateLink(title) {
    flushCurrentEditorToTree();
    const targetId = NotesLinks.resolveLink(title, indexes.titleIndex);
    if (targetId) {
        openPage(targetId);
        return;
    }
    // Unresolved — create-on-link (FR-009), then resolve every link pointing at it.
    const notebookIds = Object.keys(tree.notebooks);
    if (notebookIds.length === 0) { toast('Create a notebook first.', 'warning'); return; }
    const firstSectionId = tree.notebooks[notebookIds[0]].sectionOrder[0];
    if (!firstSectionId) { toast('Create a section first.', 'warning'); return; }
    if (!NotesLinks.isTitleAvailable(tree, title, null)) { toast('A page with that title already exists.', 'error'); return; }
    const newId = createPage(firstSectionId, title); // title is available, so it's used as-is
    renderTree();
    openPage(newId);
}

function registerWikiLinkCompletionProvider() {
    if (completionProviderRegistered) return;
    completionProviderRegistered = true;
    monaco.languages.registerCompletionItemProvider('markdown', {
        triggerCharacters: ['['],
        provideCompletionItems(model, position) {
            const lineUpToCursor = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
            const match = /\[\[([^[\]]*)$/.exec(lineUpToCursor);
            if (!match) return { suggestions: [] };
            const partial = match[1].toLowerCase();
            const startColumn = position.column - partial.length;
            const range = new monaco.Range(position.lineNumber, startColumn, position.lineNumber, position.column);
            const suggestions = Object.values(tree.pages)
                .filter(p => p.title.toLowerCase().includes(partial))
                .slice(0, 20)
                .map(p => ({
                    label: p.title,
                    kind: monaco.languages.CompletionItemKind.Reference,
                    insertText: `${p.title}]]`,
                    range,
                }));
            return { suggestions };
        },
    });
}

function initMonacoEditor() {
    monacoModel = monaco.editor.createModel('', 'markdown');
    monacoEditor = monaco.editor.create(document.getElementById('notes-monaco-host'), {
        model: monacoModel,
        automaticLayout: true,
        fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
        lineHeight: 22, minimap: { enabled: false },
        wordWrap: 'on', scrollBeyondLastLine: false,
        padding: { top: 12, bottom: 12 },
    });

    registerWikiLinkCompletionProvider();

    monacoEditor.onDidChangeModelContent(() => {
        flushCurrentEditorToTree();
        applyLinkDecorations();
    });

    monacoEditor.onMouseDown(e => {
        if (!(e.event.ctrlKey || e.event.metaKey)) return;
        if (e.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT || !e.target.position) return;
        const offset = monacoModel.getOffsetAt(e.target.position);
        const body = monacoModel.getValue();
        const link = NotesLinks.parseWikiLinks(body).find(l => offset >= l.index && offset <= l.index + l.length);
        if (link) _followOrCreateLink(link.title);
    });

    // If a page was already selected before Monaco finished loading, populate it now.
    if (currentPageId && tree.pages[currentPageId]) loadPageIntoEditor(tree.pages[currentPageId]);
}

// ──────────────────────────────────────────
// Formatting toolbar (FR-023/FR-024/FR-026)
// ──────────────────────────────────────────

/** Wrap the current selection (or a placeholder, pre-selected) in a marker pair, e.g. **bold**. */
function _wrapSelection(marker, placeholder) {
    if (!monacoEditor || !monacoModel) return;
    const sel = monacoEditor.getSelection();
    const hasSelection = !sel.isEmpty();
    const inner = hasSelection ? monacoModel.getValueInRange(sel) : placeholder;
    const startOffset = monacoModel.getOffsetAt(sel.getStartPosition());
    monacoEditor.executeEdits('notes-toolbar', [{ range: sel, text: marker + inner + marker }]);
    _selectOffsetRange(startOffset + marker.length, startOffset + marker.length + inner.length);
}

/** Select the given [start, end) character offsets in the (already-edited) model and focus it. */
function _selectOffsetRange(startOffset, endOffset) {
    const p1 = monacoModel.getPositionAt(startOffset);
    const p2 = monacoModel.getPositionAt(endOffset);
    monacoEditor.setSelection(new monaco.Range(p1.lineNumber, p1.column, p2.lineNumber, p2.column));
    monacoEditor.focus();
    flushCurrentEditorToTree();
}

function insertCodeBlock() {
    if (!monacoEditor || !monacoModel) return;
    const sel = monacoEditor.getSelection();
    const body = sel.isEmpty() ? '' : monacoModel.getValueInRange(sel);
    const startOffset = monacoModel.getOffsetAt(sel.getStartPosition());
    monacoEditor.executeEdits('notes-toolbar', [{ range: sel, text: '```\n' + body + '\n```' }]);
    _selectOffsetRange(startOffset + 4, startOffset + 4 + body.length);
}

function insertLink() {
    if (!monacoEditor || !monacoModel) return;
    const sel = monacoEditor.getSelection();
    const hasSelection = !sel.isEmpty();
    const linkText = hasSelection ? monacoModel.getValueInRange(sel) : 'link text';
    const startOffset = monacoModel.getOffsetAt(sel.getStartPosition());
    monacoEditor.executeEdits('notes-toolbar', [{ range: sel, text: `[${linkText}](url)` }]);
    // With a selection, the text is fixed and the URL placeholder is what needs typing next;
    // with no selection, the placeholder link text itself is what needs typing first.
    if (hasSelection) {
        const urlStart = startOffset + 1 + linkText.length + 1;
        _selectOffsetRange(urlStart, urlStart + 3); // "url"
    } else {
        _selectOffsetRange(startOffset + 1, startOffset + 1 + linkText.length); // "link text"
    }
}

const ATTACH_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ATTACH_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp']);

/** FR-026: embed an image inline as a base64 data: URI — no separate file store, no network. */
function attachImageFile(file) {
    if (!monacoEditor || !monacoModel) return;
    if (!ATTACH_IMAGE_MIME_TYPES.has(file.type)) {
        toast('Unsupported file type — attach a PNG, JPEG, GIF, WebP, or BMP image.', 'error');
        return;
    }
    if (file.size > ATTACH_IMAGE_MAX_BYTES) {
        toast('Image too large — 5 MB max.', 'error');
        return;
    }
    const originPageId = currentPageId;
    const originSelection = monacoEditor.getSelection();
    const reader = new FileReader();
    reader.onload = () => {
        if (currentPageId !== originPageId) {
            toast('Image discarded — you switched notes before it finished loading.', 'error');
            return;
        }
        const altText = (file.name || 'image').replaceAll(/[[\]]/g, '');
        const dataUri = String(reader.result); // readAsDataURL guarantees a string result
        monacoEditor.executeEdits('notes-toolbar', [{ range: originSelection, text: `![${altText}](${dataUri})` }]);
        monacoEditor.focus();
        flushCurrentEditorToTree();
    };
    reader.onerror = () => toast('Failed to read the image file.', 'error');
    reader.readAsDataURL(file);
}

document.getElementById('fmt-bold-btn').addEventListener('click', () => _wrapSelection('**', 'bold text'));
document.getElementById('fmt-italic-btn').addEventListener('click', () => _wrapSelection('*', 'italic text'));
document.getElementById('fmt-inline-code-btn').addEventListener('click', () => _wrapSelection('`', 'code'));
document.getElementById('fmt-code-block-btn').addEventListener('click', insertCodeBlock);
document.getElementById('fmt-link-btn').addEventListener('click', insertLink);
document.getElementById('fmt-image-btn').addEventListener('click', () => document.getElementById('fmt-image-input').click());
document.getElementById('fmt-image-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (file) attachImageFile(file);
});

/** FR-025: copy-to-clipboard control on every fenced code block shown in Preview. */
function _attachCodeCopyButtons(pane) {
    pane.querySelectorAll('pre').forEach(pre => {
        const codeEl = pre.querySelector('code');
        if (!codeEl) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'notes-code-copy-btn';
        btn.title = 'Copy code';
        btn.appendChild(svgIcon('copy', { size: 14 }));
        btn.addEventListener('click', () => {
            if (!navigator.clipboard?.writeText) {
                toast('Failed to copy code', 'error');
                return;
            }
            navigator.clipboard.writeText(codeEl.textContent)
                .then(() => toast('Code copied to clipboard', 'success'))
                .catch(() => toast('Failed to copy code', 'error'));
        });
        pre.appendChild(btn);
    });
}

function renderPreview() {
    const pane = document.getElementById('notes-preview-pane');
    if (!currentPageId) { pane.innerHTML = ''; return; }
    const body = monacoModel ? monacoModel.getValue() : (tree.pages[currentPageId]?.body || '');
    // Constitution Art. V — never insert unsanitized HTML. marked has no
    // built-in sanitizer; DOMPurify strips script/event-handler vectors
    // before this ever reaches the DOM (research.md item 5). Wiring lives in
    // NotesLinks.sanitizeMarkdownBody so it's covered by a DOM-free test.
    pane.innerHTML = NotesLinks.sanitizeMarkdownBody(body, marked, DOMPurify); // NOSONAR — sanitized via DOMPurify inside sanitizeMarkdownBody
    _attachCodeCopyButtons(pane);
}

function setEditorMode(mode) {
    editorMode = mode;
    document.getElementById('mode-edit-btn').classList.toggle('active', mode === 'edit');
    document.getElementById('mode-preview-btn').classList.toggle('active', mode === 'preview');
    document.getElementById('notes-monaco-host').parentElement.style.display = mode === 'edit' ? 'block' : 'none';
    document.getElementById('notes-preview-pane').classList.toggle('visible', mode === 'preview');
    if (mode === 'preview') renderPreview();
}
document.getElementById('mode-edit-btn').addEventListener('click', () => setEditorMode('edit'));
document.getElementById('mode-preview-btn').addEventListener('click', () => setEditorMode('preview'));

// ──────────────────────────────────────────
// Search palette
// ──────────────────────────────────────────
function openSearchModal() {
    document.getElementById('search-modal-overlay').style.display = 'flex';
    const input = document.getElementById('search-query-input');
    input.value = '';
    document.getElementById('search-results').innerHTML = '';
    setTimeout(() => input.focus(), 50);
}
function closeSearchModal() { document.getElementById('search-modal-overlay').style.display = 'none'; }

document.getElementById('search-btn').addEventListener('click', openSearchModal);
document.getElementById('search-modal-overlay').addEventListener('click', e => { if (e.target.id === 'search-modal-overlay') closeSearchModal(); });
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearchModal(); }
    if (e.key === 'Escape') { closeSearchModal(); closeTagModal(); }
});

document.getElementById('search-query-input').addEventListener('input', () => {
    const q = document.getElementById('search-query-input').value;
    const results = NotesLinks.searchNotes(tree, q);
    const host = document.getElementById('search-results');
    host.innerHTML = '';
    if (!q.trim()) return;
    if (results.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'notes-search-empty';
        empty.textContent = 'No matching pages.';
        host.appendChild(empty);
        return;
    }
    for (const res of results) {
        const item = document.createElement('div');
        item.className = 'notes-search-result';
        const title = document.createElement('div');
        title.className = 'notes-search-result-title';
        title.textContent = res.title;
        item.appendChild(title);
        for (const snip of res.snippets) {
            const s = document.createElement('div');
            s.className = 'notes-search-result-snippet';
            s.textContent = snip;
            item.appendChild(s);
        }
        item.addEventListener('click', () => { flushCurrentEditorToTree(); openPage(res.pageId); closeSearchModal(); });
        host.appendChild(item);
    }
});

// ──────────────────────────────────────────
// Tag browser
// ──────────────────────────────────────────
function openTagModal() {
    rebuildIndexes();
    const list = document.getElementById('tag-list');
    list.innerHTML = '';
    document.getElementById('tag-pages').style.display = 'none';
    const tagNames = [...indexes.tagIndex.keys()].sort((a, b) => a.localeCompare(b));
    if (tagNames.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'notes-tag-empty';
        empty.textContent = 'No tags yet — type #tagname in a page to create one.';
        list.appendChild(empty);
    } else {
        for (const tag of tagNames) {
            const chip = document.createElement('div');
            chip.className = 'notes-tag-chip';
            chip.textContent = `#${tag}`;
            chip.addEventListener('click', () => _showTagPages(tag, chip));
            list.appendChild(chip);
        }
    }
    document.getElementById('tag-modal-overlay').style.display = 'flex';
}
function closeTagModal() { document.getElementById('tag-modal-overlay').style.display = 'none'; }

function _showTagPages(tag, chipEl) {
    document.querySelectorAll('.notes-tag-chip').forEach(c => c.classList.remove('active'));
    chipEl.classList.add('active');
    const pagesHost = document.getElementById('tag-pages');
    pagesHost.innerHTML = '';
    pagesHost.style.display = 'block';
    const pageIds = [...(indexes.tagIndex.get(tag) || [])];
    for (const pid of pageIds) {
        const page = tree.pages[pid];
        if (!page) continue;
        const item = document.createElement('div');
        item.className = 'notes-tag-page-item';
        item.textContent = page.title;
        item.addEventListener('click', () => { flushCurrentEditorToTree(); openPage(pid); closeTagModal(); });
        pagesHost.appendChild(item);
    }
}

document.getElementById('tags-btn').addEventListener('click', openTagModal);
document.getElementById('tag-modal-overlay').addEventListener('click', e => { if (e.target.id === 'tag-modal-overlay') closeTagModal(); });

// ──────────────────────────────────────────
// Tree filter
// ──────────────────────────────────────────
document.getElementById('tree-filter-input').addEventListener('input', renderTree);

// ──────────────────────────────────────────
// Boot
// ──────────────────────────────────────────
let masterPassword = null;

(async () => { // NOSONAR — top-level await requires ES module; script loads in non-module context
    masterPassword = await AuthGuard.init('Notes Workspace');
    if (!masterPassword) {
        // FR-021: Notes has no unencrypted fallback (unlike SSH Manager) — a
        // master password is mandatory. AuthGuard already shows its own
        // "set up a master password" panel; just leave the workspace empty.
        document.getElementById('notes-empty-title').textContent = 'Master password required';
        document.getElementById('notes-empty-desc').textContent = 'Set up a master password in Secret Vault first, then reopen Notes Workspace.';
        return;
    }

    try {
        await loadNotesTree();
    } catch (e) {
        toast(e.message, 'error');
        return;
    }

    renderTree();
    renderEmptyOrEditor();

    DevSuite.initMonaco(() => {
        initMonacoEditor();
    });
})();
