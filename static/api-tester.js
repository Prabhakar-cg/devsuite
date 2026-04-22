/**
 * DevSuite API Tester UI Logic
 */

let reqEditor, respEditor;
let collections = [];

// UI Elements
const els = {
    method: document.getElementById('req-method'),
    url: document.getElementById('req-url'),
    btnSend: document.getElementById('btn-send'),
    
    // Auth
    authType: document.getElementById('auth-type'),
    authBearerConfig: document.getElementById('auth-bearer-config'),
    authBasicConfig: document.getElementById('auth-basic-config'),
    authToken: document.getElementById('auth-token'),
    authUsername: document.getElementById('auth-username'),
    authPassword: document.getElementById('auth-password'),
    
    // Body Type
    bodyRadios: document.getElementsByName('bodyType'),
    reqBodyEditorWrap: document.getElementById('req-body-editor-wrap'),
    reqFormDataWrap: document.getElementById('req-form-data-wrap'),
    
    // Tabs
    reqBtns: document.querySelectorAll('#req-tabs .tab-btn'),
    reqContents: document.querySelectorAll('.req-tab-content'),
    
    respMeta: document.getElementById('resp-meta'),
    respStatus: document.getElementById('resp-status'),
    respTime: document.getElementById('resp-time'),
    respSize: document.getElementById('resp-size'),
    respPlaceholder: document.getElementById('resp-placeholder'),
    respEditorContainer: document.getElementById('resp-editor'),
    
    collectionsList: document.getElementById('collections-list'),
    saveBtn: document.getElementById('save-collection-btn')
};

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

// Initialize Monaco Editors
require.config({ paths: { 'vs': '/static/libs/vs' } });
require(['vs/editor/editor.main'], function() {
    const savedTheme = localStorage.getItem('devsuite-theme') || 'vs-dark';
    const monacoTheme = resolveMonacoTheme(savedTheme);

    reqEditor = monaco.editor.create(document.getElementById('req-body-editor'), {
        value: `{\n\t"key": "value"\n}`,
        language: 'json',
        theme: monacoTheme,
        automaticLayout: true,
        minimap: { enabled: false }
    });

    respEditor = monaco.editor.create(els.respEditorContainer, {
        value: '',
        language: 'json',
        theme: monacoTheme,
        automaticLayout: true,
        readOnly: true,
        minimap: { enabled: false }
    });
});

function resolveMonacoTheme(ts) {
    if (ts === 'ios-glass' || ts === 'vs-dark') return 'vs-dark';
    if (ts === 'hc-black') return 'hc-black';
    return 'vs';
}

globalThis.addEventListener('devsuite-theme-changed', (e) => {
    if (reqEditor && respEditor) {
        monaco.editor.setTheme(resolveMonacoTheme(e.detail.theme));
    }
});

// Tab Switching logic
function setupTabs(btnSelector, contentSelector) {
    const btns = document.querySelectorAll(btnSelector);
    const contents = document.querySelectorAll(contentSelector);
    
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.style.display = 'none');

            btn.classList.add('active');
            const target = btn.dataset.target;
            const t = document.getElementById(target);
            if (t) {
                t.style.display = (t.classList.contains('resp-tab-content') && target === 'resp-body') ? 'flex' : 'block';
            }
        });
    });
}
setupTabs('#req-tabs .tab-btn', '.req-tab-content');
setupTabs('#resp-tabs .tab-btn', '.resp-tab-content');

// Dynamic Key-Value Lists (Params, Headers, FormData)
function setupDynamicList(containerId, addBtnId) {
    const container = document.getElementById(containerId);
    const addBtn = document.getElementById(addBtnId);
    
    const addRow = (k = '', v = '') => {
        const row = document.createElement('div');
        row.className = 'kv-row';
        
        const kput = document.createElement('input');
        kput.className = 'kv-input'; kput.type = 'text'; kput.placeholder = 'Key'; kput.value = k;
        
        const vput = document.createElement('input');
        vput.className = 'kv-input'; vput.type = 'text'; vput.placeholder = 'Value'; vput.value = v;
        
        const rem = document.createElement('button');
        rem.className = 'kv-remove'; rem.textContent = '✕';
        rem.onclick = () => row.remove();
        
        row.appendChild(kput);
        row.appendChild(vput);
        row.appendChild(rem);
        container.appendChild(row);
    };
    
    addBtn.addEventListener('click', () => addRow());
    return {
        clear: () => { container.innerHTML = ''; },
        add: addRow,
        get: () => {
            let res = {};
            Array.from(container.children).forEach(row => {
                let inputs = row.querySelectorAll('input');
                let k = inputs[0].value.trim();
                let v = inputs[1].value.trim();
                if (k) res[k] = v;
            });
            return res;
        }
    };
}

const paramsListObj = setupDynamicList('params-list', 'btn-add-param');
const headersListObj = setupDynamicList('headers-list', 'btn-add-header');
const formDataListObj = setupDynamicList('form-data-list', 'btn-add-form-data');

// Auth UI Toggle
els.authType.addEventListener('change', (e) => {
    els.authBearerConfig.style.display = 'none';
    els.authBasicConfig.style.display = 'none';
    if (e.target.value === 'bearer') els.authBearerConfig.style.display = 'block';
    if (e.target.value === 'basic') els.authBasicConfig.style.display = 'block';
});

// Body UI Toggle
Array.from(els.bodyRadios).forEach(r => {
    r.addEventListener('change', (e) => {
        els.reqBodyEditorWrap.style.display = 'none';
        els.reqFormDataWrap.style.display = 'none';
        if(e.target.value === 'json') els.reqBodyEditorWrap.style.display = 'flex';
        if(e.target.value === 'form-data') els.reqFormDataWrap.style.display = 'block';
    });
});

// Build the request config from current UI state
function buildRequestConfig() {
    const url = els.url.value.trim();
    const config = {
        url,
        method: els.method.value,
        queryParams: paramsListObj.get(),
        headers: headersListObj.get(),
        auth: { type: els.authType.value }
    };

    if (config.auth.type === 'bearer') config.auth.token = els.authToken.value;
    if (config.auth.type === 'basic') {
        config.auth.username = els.authUsername.value;
        config.auth.password = els.authPassword.value;
    }

    const selectedBody = document.querySelector('input[name="bodyType"]:checked').value;
    config.bodyType = selectedBody;
    if (selectedBody === 'json' && reqEditor) {
        config.body = reqEditor.getValue();
    } else if (selectedBody === 'form-data') {
        config.body = formDataListObj.get();
    }

    return config;
}

// Render the response into the UI
function renderResponse(response) {
    els.respMeta.style.display = 'flex';
    els.respStatus.textContent = `${response.status} ${response.statusText}`;
    els.respStatus.className = `meta-value ${response.status >= 200 && response.status < 300 ? 'status-ok' : 'status-err'}`;
    els.respTime.textContent = `${response.timeMs} ms`;
    els.respSize.textContent = `${(response.sizeBytes / 1024).toFixed(2)} KB`;

    els.respPlaceholder.style.display = 'none';

    if (respEditor) {
        const outVal = response.body ? JSON.stringify(response.body, null, 2) : response.bodyText;
        respEditor.setValue(outVal);
    }

    const hContainer = document.getElementById('resp-headers');
    hContainer.innerHTML = '';
    for (const [k, v] of Object.entries(response.headers)) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.borderBottom = '1px solid var(--border)';
        row.style.padding = '0.5rem 0';
        const kspan = document.createElement('span');
        kspan.style.fontWeight = '600'; kspan.style.width = '30%'; kspan.textContent = k;
        const vspan = document.createElement('span');
        vspan.style.fontFamily = 'var(--font-mono)'; vspan.textContent = v;
        vspan.style.flex = '1'; vspan.style.wordBreak = 'break-all';
        row.appendChild(kspan);
        row.appendChild(vspan);
        hContainer.appendChild(row);
    }

    if (response.error || response.status === 0) {
        showToast('Network Error - Check console for details', 'error');
    } else if (response.wasProxied) {
        showToast(`Completed in ${response.timeMs}ms (Auto CORS Bypass)`, 'info');
    } else {
        showToast(`Completed in ${response.timeMs}ms`, 'success');
    }
}

// Execute Request
els.btnSend.addEventListener('click', async () => {
    const url = els.url.value.trim();
    if (!url) return showToast('URL is required', 'error');

    els.btnSend.textContent = 'Sending...';
    els.btnSend.disabled = true;

    try {
        const config = buildRequestConfig();
        const response = await globalThis.ApiClient.execute(config);
        renderResponse(response);
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        els.btnSend.textContent = 'Send';
        els.btnSend.disabled = false;
    }
});

// Collections Backend Logic
async function loadCollections() {
    try {
        const res = await fetch('/api/collections');
        if (!res.ok) throw new Error('Failed to load collections');
        const data = await res.json();
        collections = data.items || [];
        renderCollections();
    } catch (e) {
        console.warn("Could not load collections, backend might be missing", e);
    }
}

async function saveCollections() {
    try {
        await fetch('/api/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: collections })
        });
        showToast('Saved to ~/.devsuite/collections.json', 'success');
    } catch (e) {
        console.error('Failed to save collections:', e);
        showToast('Failed to save collection to disk', 'error');
    }
}

function renderCollections() {
    els.collectionsList.innerHTML = '';
    collections.forEach((item, idx) => {
        const d = document.createElement('li');
        d.className = 'collection-item';
        
        const badge = document.createElement('span');
        badge.className = `method-badge ${item.method}`;
        badge.textContent = item.method;
        
        const title = document.createElement('span');
        title.style.whiteSpace = 'nowrap';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';
        title.textContent = item.name || item.url;
        
        // Delete button
        const del = document.createElement('span');
        del.textContent = '✕';
        del.style.marginLeft = 'auto';
        del.style.color = 'var(--text-muted)';
        del.onclick = (e) => {
            e.stopPropagation();
            collections.splice(idx, 1);
            saveCollections();
            renderCollections();
        };

        d.appendChild(badge);
        d.appendChild(title);
        d.appendChild(del);
        
        d.onclick = () => loadCollectionItem(item);
        els.collectionsList.appendChild(d);
    });
}

function restoreAuth(auth) {
    els.authType.value = auth.type;
    els.authType.dispatchEvent(new Event('change'));
    if (auth.type === 'bearer') els.authToken.value = auth.token || '';
    if (auth.type === 'basic') {
        els.authUsername.value = auth.username || '';
        els.authPassword.value = auth.password || '';
    }
}

function restoreBody(bodyType, body) {
    const rb = document.querySelector(`input[name="bodyType"][value="${bodyType}"]`);
    if (rb) { rb.checked = true; rb.dispatchEvent(new Event('change')); }
    if (!body) return;
    if (bodyType === 'json' && reqEditor) {
        reqEditor.setValue(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    } else if (bodyType === 'form-data') {
        Object.entries(body).forEach(([k, v]) => formDataListObj.add(k, v));
    }
}

function loadCollectionItem(item) {
    els.method.value = item.method || 'GET';
    els.url.value = item.url || '';

    paramsListObj.clear();
    headersListObj.clear();
    formDataListObj.clear();
    els.authType.value = 'none';
    els.authType.dispatchEvent(new Event('change'));

    if (item.queryParams) Object.entries(item.queryParams).forEach(([k, v]) => paramsListObj.add(k, v));
    if (item.headers) Object.entries(item.headers).forEach(([k, v]) => headersListObj.add(k, v));
    if (item.auth) restoreAuth(item.auth);
    if (item.bodyType) restoreBody(item.bodyType, item.body);
}

els.saveBtn.addEventListener('click', () => {
    const name = prompt("Name this request:");
    if (!name) return;
    const config = { ...buildRequestConfig(), name };
    collections.push(config);
    saveCollections();
    renderCollections();
});

document.getElementById('refresh-collections-btn').addEventListener('click', loadCollections);

// Init — gate behind master-password auth (8-hour session)
async function initApp() {
    await AuthGuard.init('API Tester', '📡');
    loadCollections();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initApp();
} else {
    document.addEventListener('DOMContentLoaded', initApp);
}