/**
 * DevSuite API Tester — v2.0
 * Bruno-inspired: Environments, variable interpolation, pre-request scripts, tests/assertions, history
 */

// ─── State ────────────────────────────────────────────────────────────────────
let reqEditor, respEditor, preReqEditor, testsEditor;
let collections = [];
let environments = [];
let activeEnvId = '';
let runtimeVars = {};
let selectedEnvId = null; // id of env open in modal editor

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const els = {
    method:             document.getElementById('req-method'),
    url:                document.getElementById('req-url'),
    btnSend:            document.getElementById('btn-send'),

    authType:           document.getElementById('auth-type'),
    authBearerConfig:   document.getElementById('auth-bearer-config'),
    authBasicConfig:    document.getElementById('auth-basic-config'),
    authApikeyConfig:   document.getElementById('auth-apikey-config'),
    authToken:          document.getElementById('auth-token'),
    authUsername:       document.getElementById('auth-username'),
    authPassword:       document.getElementById('auth-password'),
    authApikeyHeader:   document.getElementById('auth-apikey-header'),
    authApikeyValue:    document.getElementById('auth-apikey-value'),

    bodyRadios:         document.getElementsByName('bodyType'),
    reqBodyEditorWrap:  document.getElementById('req-body-editor-wrap'),
    reqTextBodyWrap:    document.getElementById('req-text-body-wrap'),
    reqFormDataWrap:    document.getElementById('req-form-data-wrap'),
    reqTextBody:        document.getElementById('req-text-body'),

    respMeta:           document.getElementById('resp-meta'),
    respStatus:         document.getElementById('resp-status'),
    respTime:           document.getElementById('resp-time'),
    respSize:           document.getElementById('resp-size'),
    respPlaceholder:    document.getElementById('resp-placeholder'),
    respEditorEl:       document.getElementById('resp-editor'),
    respFallback:       document.getElementById('resp-fallback'),
    testSummary:        document.getElementById('test-summary'),

    collectionsList:    document.getElementById('collections-list'),
    collectionsCount:   document.getElementById('collections-count'),
    saveBtn:            document.getElementById('save-collection-btn'),

    envSelect:          document.getElementById('env-select'),
    btnManageEnvs:      document.getElementById('btn-manage-envs'),
    envModal:           document.getElementById('env-modal'),
    envModalBackdrop:   document.getElementById('env-modal-backdrop'),
    closeEnvModal:      document.getElementById('close-env-modal'),
    btnAddEnv:          document.getElementById('btn-add-env'),
    envListUl:          document.getElementById('env-list-ul'),
    envNameInput:       document.getElementById('env-name-input'),
    envVarsList:        document.getElementById('env-vars-list'),
    btnAddEnvVar:       document.getElementById('btn-add-env-var'),
    btnSaveEnv:         document.getElementById('btn-save-env'),
    btnDeleteEnv:       document.getElementById('btn-delete-env'),
    envEditorEmpty:     document.getElementById('env-editor-empty'),
    envEditorForm:      document.getElementById('env-editor-form'),

    consoleBadge:       document.getElementById('console-badge'),
    consoleEntries:     document.getElementById('console-entries'),
    consolePlaceholder: document.getElementById('console-placeholder'),
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ─── Monaco ───────────────────────────────────────────────────────────────────
require.config({ paths: { 'vs': '/static/libs/vs' } });
require(['vs/editor/editor.main'], function () {
    const monacoTheme = resolveMonacoTheme(localStorage.getItem('devsuite-theme') || 'vs-dark');

    reqEditor = monaco.editor.create(document.getElementById('req-body-editor'), {
        value: '{\n\t"key": "value"\n}',
        language: 'json', theme: monacoTheme, automaticLayout: true, minimap: { enabled: false }
    });

    respEditor = monaco.editor.create(els.respEditorEl, {
        value: '', language: 'json', theme: monacoTheme, automaticLayout: true,
        readOnly: true, minimap: { enabled: false }
    });

    preReqEditor = monaco.editor.create(document.getElementById('pre-request-editor'), {
        value: [
            '// Pre-request script — runs before the request is sent',
            '// ds.setVar("authToken", "my-token");',
            '// ds.setEnvVar("baseUrl", "https://api.example.com");',
            '// console.log("Active env var:", ds.getEnvVar("baseUrl"));',
        ].join('\n'),
        language: 'javascript', theme: monacoTheme, automaticLayout: true, minimap: { enabled: false }
    });

    testsEditor = monaco.editor.create(document.getElementById('tests-editor'), {
        value: [
            '// Tests — run after the response is received',
            'test("Status is 200", () => {',
            '\texpect(ds.response.status).to.equal(200);',
            '});',
            '',
            'test("Response has data property", () => {',
            '\texpect(ds.response.body).to.have.property("data");',
            '});',
        ].join('\n'),
        language: 'javascript', theme: monacoTheme, automaticLayout: true, minimap: { enabled: false }
    });
});

function resolveMonacoTheme(ts) {
    if (ts === 'ios-glass' || ts === 'vs-dark') return 'vs-dark';
    if (ts === 'hc-black') return 'hc-black';
    return 'vs';
}

globalThis.addEventListener('devsuite-theme-changed', (e) => {
    if (monaco) monaco.editor.setTheme(resolveMonacoTheme(e.detail.theme));
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function setupTabs(btnSelector, contentSelector) {
    const btns = document.querySelectorAll(btnSelector);
    const contents = document.querySelectorAll(contentSelector);
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
            contents.forEach(c => { c.style.display = 'none'; });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            const t = document.getElementById(btn.dataset.target);
            if (t) {
                const flexTargets = ['tab-body', 'tab-pre-request', 'tab-tests', 'resp-body'];
                t.style.display = flexTargets.includes(btn.dataset.target) ? 'flex' : 'block';
            }
        });
    });
}
setupTabs('#req-tabs .tab-btn', '.req-tab-content');
setupTabs('#resp-tabs .tab-btn', '.resp-tab-content');

// Sidebar tabs
document.querySelectorAll('.sidebar-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-tab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
        document.querySelectorAll('.sidebar-panel').forEach(p => { p.style.display = 'none'; });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const panel = document.getElementById(`sidebar-${btn.dataset.sidebar}`);
        if (panel) panel.style.display = 'flex';
        if (btn.dataset.sidebar === 'history') renderHistory();
    });
});

// ─── Dynamic KV Lists (with enabled checkbox) ─────────────────────────────────
function setupDynamicList(containerId, addBtnId) {
    const container = document.getElementById(containerId);
    const addBtn = document.getElementById(addBtnId);

    const addRow = (k = '', v = '', enabled = true) => {
        const row = document.createElement('div');
        row.className = 'kv-row';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'kv-checkbox';
        checkbox.checked = enabled;
        checkbox.title = 'Enable / disable this entry';

        const kput = document.createElement('input');
        kput.className = 'kv-input'; kput.type = 'text'; kput.placeholder = 'Key'; kput.value = k;

        const vput = document.createElement('input');
        vput.className = 'kv-input'; vput.type = 'text'; vput.placeholder = 'Value'; vput.value = v;

        const rem = document.createElement('button');
        rem.className = 'kv-remove'; rem.textContent = '✕'; rem.title = 'Remove';
        rem.onclick = () => row.remove();

        row.appendChild(checkbox);
        row.appendChild(kput);
        row.appendChild(vput);
        row.appendChild(rem);
        container.appendChild(row);
    };

    if (addBtn) addBtn.addEventListener('click', () => addRow());

    return {
        clear: () => { container.innerHTML = ''; },
        add: addRow,
        get: () => {
            const res = {};
            Array.from(container.children).forEach(row => {
                const inputs = row.querySelectorAll('input[type=text]');
                const cb = row.querySelector('input[type=checkbox]');
                const k = inputs[0]?.value.trim();
                const v = inputs[1]?.value.trim() ?? '';
                if (k && (!cb || cb.checked)) res[k] = v;
            });
            return res;
        },
        getAll: () => {
            return Array.from(container.children).map(row => {
                const inputs = row.querySelectorAll('input[type=text]');
                const cb = row.querySelector('input[type=checkbox]');
                return { key: inputs[0]?.value.trim() ?? '', value: inputs[1]?.value.trim() ?? '', enabled: cb?.checked ?? true };
            });
        },
    };
}

const paramsListObj   = setupDynamicList('params-list',    'btn-add-param');
const headersListObj  = setupDynamicList('headers-list',   'btn-add-header');
const formDataListObj = setupDynamicList('form-data-list', 'btn-add-form-data');

// ─── Method Color ─────────────────────────────────────────────────────────────
const METHOD_COLORS = {
    GET: '#10b981', POST: '#f59e0b', PUT: '#3b82f6',
    DELETE: '#ef4444', PATCH: '#8b5cf6', HEAD: '#6b7280', OPTIONS: '#6b7280',
};

function updateMethodColor() {
    els.method.style.color = METHOD_COLORS[els.method.value] || 'var(--text-primary)';
}

els.method.addEventListener('change', updateMethodColor);

// ─── Auth UI ──────────────────────────────────────────────────────────────────
els.authType.addEventListener('change', (e) => {
    els.authBearerConfig.style.display  = 'none';
    els.authBasicConfig.style.display   = 'none';
    els.authApikeyConfig.style.display  = 'none';
    if (e.target.value === 'bearer')  els.authBearerConfig.style.display  = 'block';
    if (e.target.value === 'basic')   els.authBasicConfig.style.display   = 'block';
    if (e.target.value === 'api-key') els.authApikeyConfig.style.display  = 'block';
});

// ─── Body UI ──────────────────────────────────────────────────────────────────
Array.from(els.bodyRadios).forEach(r => {
    r.addEventListener('change', (e) => {
        els.reqBodyEditorWrap.style.display = 'none';
        els.reqFormDataWrap.style.display   = 'none';
        els.reqTextBodyWrap.style.display   = 'none';
        if (e.target.value === 'json')      els.reqBodyEditorWrap.style.display = 'flex';
        if (e.target.value === 'form-data') els.reqFormDataWrap.style.display   = 'block';
        if (e.target.value === 'text')      els.reqTextBodyWrap.style.display   = 'flex';
    });
});

// ─── Environments ─────────────────────────────────────────────────────────────
function loadEnvironments() {
    try {
        environments = JSON.parse(localStorage.getItem('devsuite-api-environments') || '[]');
        activeEnvId  = localStorage.getItem('devsuite-api-active-env') || '';
    } catch { environments = []; }
    renderEnvSelect();
}

function saveEnvironments() {
    localStorage.setItem('devsuite-api-environments', JSON.stringify(environments));
    localStorage.setItem('devsuite-api-active-env', activeEnvId);
}

function getActiveEnv() {
    return environments.find(e => e.id === activeEnvId) || null;
}

function getEnvVar(key) {
    return getActiveEnv()?.vars?.[key];
}

function renderEnvSelect() {
    els.envSelect.innerHTML = '<option value="">No Environment</option>';
    environments.forEach(env => {
        const opt = document.createElement('option');
        opt.value = env.id;
        opt.textContent = env.name;
        if (env.id === activeEnvId) opt.selected = true;
        els.envSelect.appendChild(opt);
    });
}

els.envSelect.addEventListener('change', (e) => {
    activeEnvId = e.target.value;
    saveEnvironments();
    const name = getActiveEnv()?.name;
    showToast(name ? `Environment: ${name}` : 'No environment active', 'info');
});

// ─── Environment Modal ────────────────────────────────────────────────────────
els.btnManageEnvs.addEventListener('click', openEnvModal);
els.closeEnvModal.addEventListener('click', closeEnvModal);
els.envModal.addEventListener('click', (e) => { if (e.target === els.envModal) closeEnvModal(); });

// Close on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.envModal.open) closeEnvModal();
});

function openEnvModal() {
    selectedEnvId = null;
    renderEnvList();
    showEnvEditorEmpty();
    els.envModal.showModal();
}

function closeEnvModal() {
    els.envModal.close();
}

function renderEnvList() {
    els.envListUl.innerHTML = '';
    environments.forEach(env => {
        const li = document.createElement('li');
        li.className = 'env-list-item' + (env.id === selectedEnvId ? ' active' : '');
        li.textContent = env.name;
        li.onclick = () => editEnv(env.id);
        els.envListUl.appendChild(li);
    });
}

function showEnvEditorEmpty() {
    els.envEditorEmpty.style.display = 'flex';
    els.envEditorForm.style.display  = 'none';
}

function editEnv(envId) {
    const env = environments.find(e => e.id === envId);
    if (!env) return;
    selectedEnvId = envId;
    renderEnvList();
    els.envEditorEmpty.style.display = 'none';
    els.envEditorForm.style.display  = 'flex';
    els.envNameInput.value = env.name;
    renderEnvVarRows(env.vars || {});
}

function renderEnvVarRows(vars) {
    els.envVarsList.innerHTML = '';
    Object.entries(vars).forEach(([k, v]) => addEnvVarRow(k, v));
}

function addEnvVarRow(k = '', v = '') {
    const row = document.createElement('div');
    row.className = 'kv-row';
    const kput = document.createElement('input');
    kput.className = 'kv-input'; kput.type = 'text'; kput.placeholder = 'Variable name'; kput.value = k;
    const vput = document.createElement('input');
    vput.className = 'kv-input'; vput.type = 'text'; vput.placeholder = 'Value'; vput.value = v;
    const rem = document.createElement('button');
    rem.className = 'kv-remove'; rem.textContent = '✕'; rem.onclick = () => row.remove();
    row.appendChild(kput); row.appendChild(vput); row.appendChild(rem);
    els.envVarsList.appendChild(row);
}

els.btnAddEnv.addEventListener('click', () => {
    const id = crypto.randomUUID();
    environments.push({ id, name: 'New Environment', vars: {} });
    saveEnvironments();
    renderEnvSelect();
    renderEnvList();
    editEnv(id);
});

els.btnAddEnvVar.addEventListener('click', () => addEnvVarRow());

els.btnSaveEnv.addEventListener('click', () => {
    const idx = environments.findIndex(e => e.id === selectedEnvId);
    if (idx === -1) return;
    const vars = {};
    Array.from(els.envVarsList.children).forEach(row => {
        const [kInput, vInput] = row.querySelectorAll('input[type=text]');
        const k = kInput?.value.trim();
        if (k) vars[k] = vInput?.value.trim() ?? '';
    });
    environments[idx] = { ...environments[idx], name: els.envNameInput.value.trim() || 'Unnamed', vars };
    saveEnvironments();
    renderEnvSelect();
    renderEnvList();
    showToast('Environment saved', 'success');
});

els.btnDeleteEnv.addEventListener('click', () => {
    const env = environments.find(e => e.id === selectedEnvId);
    if (!env || !confirm(`Delete environment "${env.name}"?`)) return;
    environments = environments.filter(e => e.id !== selectedEnvId);
    if (activeEnvId === selectedEnvId) activeEnvId = '';
    selectedEnvId = null;
    saveEnvironments();
    renderEnvSelect();
    renderEnvList();
    showEnvEditorEmpty();
});

// ─── Variable Interpolation ───────────────────────────────────────────────────
function interpolate(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/\{\{([^}]+)\}\}/g, (_, raw) => {
        const key = raw.trim();
        if (runtimeVars[key] !== undefined) return runtimeVars[key];
        const envVal = getEnvVar(key);
        if (envVal !== undefined) return envVal;
        return `{{${key}}}`;
    });
}

function interpolateObj(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[interpolate(k)] = interpolate(v);
    return out;
}

// ─── Script Execution ─────────────────────────────────────────────────────────
function makeCapturedConsole(logs) {
    const fmt = (...args) => args.map(a => (typeof a === 'object' ? jsonSafe(a) : String(a))).join(' ');
    return {
        log:   (...args) => logs.push({ type: 'log',   text: fmt(...args) }),
        warn:  (...args) => logs.push({ type: 'warn',  text: fmt(...args) }),
        error: (...args) => logs.push({ type: 'error', text: fmt(...args) }),
        info:  (...args) => logs.push({ type: 'info',  text: fmt(...args) }),
    };
}

function makeDs(extra = {}) {
    return {
        setVar:    (k, v) => { runtimeVars[k] = v; },
        getVar:    (k)    => runtimeVars[k] ?? getEnvVar(k),
        setEnvVar: (k, v) => {
            const env = getActiveEnv();
            if (env) { env.vars = env.vars || {}; env.vars[k] = v; saveEnvironments(); }
        },
        getEnvVar: (k) => getEnvVar(k),
        ...extra,
    };
}

async function runPreRequestScript(code) {
    const logs = [];
    if (!code.trim()) return logs;
    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('ds', 'console', `return (async()=>{ ${code} })()`);
        await fn(makeDs(), makeCapturedConsole(logs));
    } catch (e) {
        logs.push({ type: 'error', text: `Pre-request error: ${e.message}` });
    }
    return logs;
}

async function runTestScript(code, dsResponse) {
    const logs = [];
    const results = [];
    if (!code.trim()) return { logs, results };

    function test(name, fn) {
        try {
            fn();
            results.push({ name, passed: true });
            logs.push({ type: 'pass', text: `✓  ${name}` });
        } catch (e) {
            results.push({ name, passed: false, error: e.message });
            logs.push({ type: 'fail', text: `✗  ${name}: ${e.message}` });
        }
    }

    function expect(val) {
        // Proxy-based fluent chain: expect(x).to.equal(y) / .to.be.ok / .to.have.property / etc.
        const assert = (pass, msg) => { if (!pass) throw new Error(msg); };
        const chain = new Proxy({}, {
            get(_, prop) {
                if (prop === 'equal')    return (exp) => assert(val === exp, `Expected ${jsonSafe(val)} to equal ${jsonSafe(exp)}`);
                if (prop === 'include')  return (str) => assert(String(val).includes(String(str)), `Expected "${val}" to include "${str}"`);
                if (prop === 'property') return (key) => assert(val != null && key in Object(val), `Expected object to have property "${key}"`);
                if (prop === 'status')   return (code) => assert(val?.status === code, `Expected status ${val?.status} to equal ${code}`);
                if (prop === 'ok')       return assert(Boolean(val), `Expected ${jsonSafe(val)} to be truthy`);
                if (prop === 'above')    return (n) => assert(val > n, `Expected ${val} to be above ${n}`);
                if (prop === 'below')    return (n) => assert(val < n, `Expected ${val} to be below ${n}`);
                if (prop === 'a')        return (t) => assert(typeof val === t, `Expected typeof ${typeof val} to be ${t}`);
                // Chainable no-ops: .to .be .have .not
                return chain;
            }
        });
        return chain;
    }

    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('ds', 'test', 'expect', 'console', `return (async()=>{ ${code} })()`);
        await fn(makeDs({ response: dsResponse }), test, expect, makeCapturedConsole(logs));
    } catch (e) {
        logs.push({ type: 'error', text: `Test script error: ${e.message}` });
    }
    return { logs, results };
}

function jsonSafe(v) {
    try { return JSON.stringify(v); } catch { return String(v); }
}

// ─── Console Rendering ────────────────────────────────────────────────────────
function renderConsole(preReqLogs, testLogs, testResults) {
    els.consoleEntries.innerHTML = '';
    const all = [];
    if (preReqLogs.length) { all.push({ type: 'section', text: '── Pre-Request ──' }); all.push(...preReqLogs); }
    if (testLogs.length)   { all.push({ type: 'section', text: '── Tests ──' }); all.push(...testLogs); }

    if (!all.length) {
        els.consolePlaceholder.style.display = 'block';
        els.consoleBadge.style.display = 'none';
        return;
    }
    els.consolePlaceholder.style.display = 'none';

    all.forEach(entry => {
        const row = document.createElement('div');
        row.className = `console-entry console-${entry.type}`;
        row.textContent = entry.text;
        els.consoleEntries.appendChild(row);
    });

    const passCount = testResults.filter(r => r.passed).length;
    const failCount = testResults.filter(r => !r.passed).length;
    if (testResults.length) {
        els.consoleBadge.style.display = 'inline-block';
        els.consoleBadge.textContent = `${passCount}/${testResults.length}`;
        els.consoleBadge.className = `console-badge ${failCount ? 'badge-fail' : 'badge-pass'}`;
        els.testSummary.style.display = 'flex';
        els.testSummary.innerHTML =
            `<span style="color:#10b981;">✓ ${passCount} passed</span>` +
            (failCount ? `<span style="color:#ef4444; margin-left:0.75rem;">✗ ${failCount} failed</span>` : '');
    } else {
        els.consoleBadge.style.display = 'none';
        els.testSummary.style.display = 'none';
    }
}

// ─── Build Request Config ─────────────────────────────────────────────────────
function buildRequestConfig() {
    const config = {
        url:         interpolate(els.url.value.trim()),
        method:      els.method.value,
        queryParams: interpolateObj(paramsListObj.get()),
        headers:     interpolateObj(headersListObj.get()),
        auth:        { type: els.authType.value },
    };

    if (config.auth.type === 'bearer') {
        config.auth.token = interpolate(els.authToken.value);
    }
    if (config.auth.type === 'basic') {
        config.auth.username = interpolate(els.authUsername.value);
        config.auth.password = interpolate(els.authPassword.value);
    }
    if (config.auth.type === 'api-key') {
        const h = interpolate(els.authApikeyHeader.value.trim());
        const v = interpolate(els.authApikeyValue.value.trim());
        if (h && v) config.headers[h] = v;
    }

    const bodyType = document.querySelector('input[name="bodyType"]:checked').value;
    config.bodyType = bodyType;
    if (bodyType === 'json' && reqEditor)  config.body = interpolate(reqEditor.getValue());
    if (bodyType === 'form-data')          config.body = interpolateObj(formDataListObj.get());
    if (bodyType === 'text')               config.body = interpolate(els.reqTextBody.value);

    return config;
}

// Raw config (pre-interpolation) used for saving/history
function buildRawConfig() {
    const bodyType = document.querySelector('input[name="bodyType"]:checked').value;
    const config = {
        url:         els.url.value.trim(),
        method:      els.method.value,
        queryParams: paramsListObj.getAll(),
        headers:     headersListObj.getAll(),
        auth:        { type: els.authType.value },
        bodyType,
    };
    if (config.auth.type === 'bearer')  config.auth.token      = els.authToken.value;
    if (config.auth.type === 'basic') { config.auth.username   = els.authUsername.value; config.auth.password = els.authPassword.value; }
    if (config.auth.type === 'api-key'){ config.auth.headerName= els.authApikeyHeader.value.trim(); config.auth.headerValue = els.authApikeyValue.value.trim(); }
    if (bodyType === 'json'  && reqEditor) config.body = reqEditor.getValue();
    if (bodyType === 'form-data')          config.body = formDataListObj.getAll();
    if (bodyType === 'text')               config.body = els.reqTextBody.value;
    if (preReqEditor) config.preRequestScript = preReqEditor.getValue();
    if (testsEditor)  config.testsScript      = testsEditor.getValue();
    return config;
}

// ─── Render Response ──────────────────────────────────────────────────────────
function renderResponse(response) {
    els.respMeta.style.display = 'flex';
    els.respStatus.textContent = `${response.status} ${response.statusText}`;
    els.respStatus.className   = `meta-value ${response.status >= 200 && response.status < 300 ? 'status-ok' : 'status-err'}`;
    els.respTime.textContent   = `${response.timeMs} ms`;
    els.respSize.textContent   = `${(response.sizeBytes / 1024).toFixed(2)} KB`;
    els.respPlaceholder.style.display = 'none';

    const bodyText = response.body ? JSON.stringify(response.body, null, 2) : (response.bodyText || '');
    if (respEditor) {
        const ct = response.contentType || '';
        const lang = ct.includes('xml') ? 'xml' : ct.includes('html') ? 'html' : 'json';
        monaco.editor.setModelLanguage(respEditor.getModel(), lang);
        respEditor.setValue(bodyText);
        els.respFallback.style.display = 'none';
        els.respEditorEl.style.display = 'block';
    } else {
        els.respEditorEl.style.display = 'none';
        els.respFallback.textContent = bodyText;
        els.respFallback.style.display = 'flex';
    }

    // Response headers tab
    const hContainer = document.getElementById('resp-headers-tab');
    hContainer.innerHTML = '';
    for (const [k, v] of Object.entries(response.headers || {})) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; border-bottom:1px solid var(--border); padding:0.5rem 1rem; align-items:baseline;';
        const kspan = document.createElement('span');
        kspan.style.cssText = 'font-weight:600; font-size:0.82rem; width:35%; flex-shrink:0;';
        kspan.textContent = k;
        const vspan = document.createElement('span');
        vspan.style.cssText = 'font-family:var(--font-mono); font-size:0.82rem; flex:1; word-break:break-all; color:var(--text-secondary);';
        vspan.textContent = v;
        row.appendChild(kspan); row.appendChild(vspan);
        hContainer.appendChild(row);
    }

    const label = response.wasProxied ? ' (CORS proxy)' : '';
    if (response.error || response.status === 0) {
        showToast('Network error — check console', 'error');
    } else {
        showToast(`${response.status} in ${response.timeMs}ms${label}`, response.status < 400 ? 'success' : 'error');
    }
}

// ─── Execute Request ──────────────────────────────────────────────────────────
els.btnSend.addEventListener('click', async () => {
    if (!els.url.value.trim()) return showToast('URL is required', 'error');

    els.btnSend.textContent = 'Sending…';
    els.btnSend.disabled = true;
    runtimeVars = {};

    let preReqLogs = [], testLogs = [], testResults = [];

    try {
        // 1. Pre-request script
        const preCode = preReqEditor ? preReqEditor.getValue() : '';
        preReqLogs = await runPreRequestScript(preCode);

        // 2. Send request (vars are now resolved with runtimeVars populated by script)
        const config   = buildRequestConfig();
        const response = await globalThis.ApiClient.execute(config);

        // 3. Save to history
        addToHistory({ ...buildRawConfig(), timestamp: Date.now() });

        // 4. Render response
        renderResponse(response);

        // 5. Run tests
        const testCode = testsEditor ? testsEditor.getValue() : '';
        const dsResp   = {
            status: response.status, statusText: response.statusText,
            headers: response.headers, body: response.body,
            bodyText: response.bodyText, timeMs: response.timeMs,
        };
        const testRun = await runTestScript(testCode, dsResp);
        testLogs      = testRun.logs;
        testResults   = testRun.results;

    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        // 6. Render console (always, even on error)
        renderConsole(preReqLogs, testLogs, testResults);
        els.btnSend.textContent = 'Send';
        els.btnSend.disabled = false;
    }
});

// ─── History ─────────────────────────────────────────────────────────────────
function getHistory() {
    try { return JSON.parse(localStorage.getItem('devsuite-api-history') || '[]'); } catch { return []; }
}
function addToHistory(item) {
    const h = getHistory();
    h.unshift(item);
    localStorage.setItem('devsuite-api-history', JSON.stringify(h.slice(0, 50)));
}
function renderHistory() {
    const list = document.getElementById('history-list');
    const history = getHistory();
    list.innerHTML = '';
    if (!history.length) {
        list.innerHTML = '<li style="padding:1rem; color:var(--text-muted); font-size:0.83rem;">No history yet</li>';
        return;
    }
    history.forEach(item => {
        const li = document.createElement('li');
        li.className = 'collection-item';
        const badge = document.createElement('span');
        badge.className = `method-badge ${item.method}`;
        badge.textContent = item.method;
        const info = document.createElement('div');
        info.style.cssText = 'flex:1; min-width:0;';
        const urlEl = document.createElement('div');
        urlEl.style.cssText = 'font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-primary);';
        urlEl.textContent = item.url;
        const timeEl = document.createElement('div');
        timeEl.style.cssText = 'font-size:0.7rem; color:var(--text-muted); margin-top:0.1rem;';
        timeEl.textContent = new Date(item.timestamp).toLocaleTimeString();
        info.appendChild(urlEl); info.appendChild(timeEl);
        li.appendChild(badge); li.appendChild(info);
        li.onclick = () => loadItem(item);
        list.appendChild(li);
    });
}

document.getElementById('clear-history-btn').addEventListener('click', () => {
    localStorage.removeItem('devsuite-api-history');
    renderHistory();
});

// ─── Collections ──────────────────────────────────────────────────────────────
async function loadCollections() {
    try {
        const res = await fetch('/api/collections');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        collections = data.items || [];
        renderCollections();
    } catch (e) {
        console.warn('Could not load collections', e);
    }
}

function getCsrfToken() {
    const m = /(?:^|;\s*)ds_csrf=([^;]+)/.exec(document.cookie);
    return m ? decodeURIComponent(m[1]) : '';
}

async function saveCollections() {
    const headers = { 'Content-Type': 'application/json' };
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
    try {
        await fetch('/api/collections', { method: 'POST', headers, body: JSON.stringify({ items: collections }) });
        showToast('Saved to ~/.devsuite/collections.json', 'success');
    } catch {
        showToast('Failed to save collection', 'error');
    }
}

function renderCollections() {
    els.collectionsList.innerHTML = '';
    if (els.collectionsCount) els.collectionsCount.textContent = `${collections.length} request${collections.length !== 1 ? 's' : ''}`;

    collections.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = 'collection-item';

        const badge = document.createElement('span');
        badge.className = `method-badge ${item.method}`;
        badge.textContent = item.method;

        const label = document.createElement('span');
        label.style.cssText = 'flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.82rem;';
        label.textContent = item.name || item.url;

        const del = document.createElement('button');
        del.textContent = '✕';
        del.className = 'kv-remove';
        del.title = 'Delete';
        del.onclick = (e) => {
            e.stopPropagation();
            collections.splice(idx, 1);
            saveCollections();
            renderCollections();
        };

        li.appendChild(badge); li.appendChild(label); li.appendChild(del);
        li.onclick = () => loadItem(item);
        els.collectionsList.appendChild(li);
    });
}

function loadItem(item) {
    els.method.value = item.method || 'GET';
    els.url.value    = item.url || '';

    paramsListObj.clear();
    headersListObj.clear();
    formDataListObj.clear();
    els.authType.value = 'none';
    els.authType.dispatchEvent(new Event('change'));

    // Restore params/headers — support both {key,value} array (raw) and {k:v} object formats
    const toEntries = (v) => Array.isArray(v) ? v : Object.entries(v || {}).map(([key, value]) => ({ key, value, enabled: true }));
    toEntries(item.queryParams).forEach(r => paramsListObj.add(r.key, r.value, r.enabled !== false));
    toEntries(item.headers).forEach(r => headersListObj.add(r.key, r.value, r.enabled !== false));

    if (item.auth) restoreAuth(item.auth);
    if (item.bodyType) restoreBody(item.bodyType, item.body);
    if (item.preRequestScript && preReqEditor) preReqEditor.setValue(item.preRequestScript);
    if (item.testsScript && testsEditor)       testsEditor.setValue(item.testsScript);
}

function restoreAuth(auth) {
    els.authType.value = auth.type || 'none';
    els.authType.dispatchEvent(new Event('change'));
    if (auth.type === 'bearer')  els.authToken.value = auth.token || '';
    if (auth.type === 'basic')  { els.authUsername.value = auth.username || ''; els.authPassword.value = auth.password || ''; }
    if (auth.type === 'api-key'){ els.authApikeyHeader.value = auth.headerName || ''; els.authApikeyValue.value = auth.headerValue || ''; }
}

function restoreBody(bodyType, body) {
    const rb = document.querySelector(`input[name="bodyType"][value="${bodyType}"]`);
    if (rb) { rb.checked = true; rb.dispatchEvent(new Event('change')); }
    if (!body) return;
    if (bodyType === 'json' && reqEditor) reqEditor.setValue(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    if (bodyType === 'text') els.reqTextBody.value = body;
    if (bodyType === 'form-data') {
        const entries = Array.isArray(body) ? body : Object.entries(body).map(([key, value]) => ({ key, value, enabled: true }));
        entries.forEach(r => formDataListObj.add(r.key, r.value, r.enabled !== false));
    }
}

els.saveBtn.addEventListener('click', () => {
    const name = prompt('Name this request:');
    if (!name) return;
    collections.push({ ...buildRawConfig(), name });
    saveCollections();
    renderCollections();
});

document.getElementById('refresh-collections-btn').addEventListener('click', loadCollections);

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initApp() {
    updateMethodColor();
    const guard = await AuthGuard.init('API Tester', '📡');
    if (guard !== null) {
        loadCollections();
        loadEnvironments();
    }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initApp(); // NOSONAR — intentional fire-and-forget init in non-module script
} else {
    document.addEventListener('DOMContentLoaded', initApp);
}
