/**
 * DevSuite API Tester — v3.0
 * Features: Environments, variable interpolation, pre-request scripts, tests/assertions, history,
 *           OAuth 2.0, GraphQL, collection export/import, OpenAPI import, folder hierarchy
 */

// ─── State ────────────────────────────────────────────────────────────────────
let reqEditor, respEditor, preReqEditor, testsEditor;
let graphqlQueryEditor, graphqlVarsEditor;
let collections = [];
let environments = [];
let activeEnvId = '';
let runtimeVars = {};
let selectedEnvId = null;
let oauth2Token = null;

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const els = {
    method:             document.getElementById('req-method'),
    url:                document.getElementById('req-url'),
    btnSend:            document.getElementById('btn-send'),

    authType:           document.getElementById('auth-type'),
    authBearerConfig:   document.getElementById('auth-bearer-config'),
    authBasicConfig:    document.getElementById('auth-basic-config'),
    authApikeyConfig:   document.getElementById('auth-apikey-config'),
    authOauth2Config:   document.getElementById('auth-oauth2-config'),
    authToken:          document.getElementById('auth-token'),
    authUsername:       document.getElementById('auth-username'),
    authPassword:       document.getElementById('auth-password'),
    authApikeyHeader:   document.getElementById('auth-apikey-header'),
    authApikeyValue:    document.getElementById('auth-apikey-value'),

    oauth2Grant:        document.getElementById('oauth2-grant'),
    oauth2TokenUrl:     document.getElementById('oauth2-token-url'),
    oauth2ClientId:     document.getElementById('oauth2-client-id'),
    oauth2ClientSecret: document.getElementById('oauth2-client-secret'),
    oauth2PasswordFields: document.getElementById('oauth2-password-fields'),
    oauth2PwUsername:   document.getElementById('oauth2-pw-username'),
    oauth2PwPassword:   document.getElementById('oauth2-pw-password'),
    oauth2Scope:        document.getElementById('oauth2-scope'),
    btnFetchOauth2:     document.getElementById('btn-fetch-oauth2'),
    oauth2TokenStatus:  document.getElementById('oauth2-token-status'),
    oauth2TokenDisplay: document.getElementById('oauth2-token-display'),
    oauth2TokenValue:   document.getElementById('oauth2-token-value'),

    bodyRadios:         document.getElementsByName('bodyType'),
    reqBodyEditorWrap:  document.getElementById('req-body-editor-wrap'),
    reqTextBodyWrap:    document.getElementById('req-text-body-wrap'),
    reqFormDataWrap:    document.getElementById('req-form-data-wrap'),
    reqGraphqlWrap:     document.getElementById('req-graphql-wrap'),
    reqTextBody:        document.getElementById('req-text-body'),

    respMeta:           document.getElementById('resp-meta'),
    respStatus:         document.getElementById('resp-status'),
    respTime:           document.getElementById('resp-time'),
    respSize:           document.getElementById('resp-size'),
    respProxyChip:      document.getElementById('resp-proxy-chip'),
    respPlaceholder:    document.getElementById('resp-placeholder'),
    respEditorEl:       document.getElementById('resp-editor'),
    respFallback:       document.getElementById('resp-fallback'),
    testSummary:        document.getElementById('test-summary'),

    collectionsList:    document.getElementById('collections-list'),
    collectionsCount:   document.getElementById('collections-count'),
    saveBtn:            document.getElementById('save-collection-btn'),
    btnExportCollections: document.getElementById('btn-export-collections'),
    btnImportCollections: document.getElementById('btn-import-collections'),
    importCollectionsFile: document.getElementById('import-collections-file'),
    btnImportOpenapi:   document.getElementById('btn-import-openapi'),

    envSelect:          document.getElementById('env-select'),
    btnManageEnvs:      document.getElementById('btn-manage-envs'),
    envModal:           document.getElementById('env-modal'),
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

    openapiModal:       document.getElementById('openapi-modal'),
    closeOpenapiModal:  document.getElementById('close-openapi-modal'),
    btnOpenapiLoadFile: document.getElementById('btn-openapi-load-file'),
    openapiFileInput:   document.getElementById('openapi-file-input'),
    openapiSpecInput:   document.getElementById('openapi-spec-input'),
    btnOpenapiImport:   document.getElementById('btn-openapi-import'),
    btnOpenapiCancel:   document.getElementById('btn-openapi-cancel'),
    openapiImportStatus: document.getElementById('openapi-import-status'),

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

    graphqlQueryEditor = monaco.editor.create(document.getElementById('req-graphql-query'), {
        value: 'query {\n\t# your query here\n}',
        language: 'graphql', theme: monacoTheme, automaticLayout: true, minimap: { enabled: false }
    });

    graphqlVarsEditor = monaco.editor.create(document.getElementById('req-graphql-vars'), {
        value: '{}',
        language: 'json', theme: monacoTheme, automaticLayout: true, minimap: { enabled: false }
    });
});

function resolveMonacoTheme(ts) {
    if (ts === 'ios-glass' || ts === 'vs-dark') return 'vs-dark';
    if (ts === 'hc-black') return 'hc-black';
    return 'vs';
}

globalThis.addEventListener('devsuite-theme-changed', (e) => {
    if (typeof monaco !== 'undefined') monaco.editor.setTheme(resolveMonacoTheme(e.detail.theme));
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
    els.authOauth2Config.style.display  = 'none';
    if (e.target.value === 'bearer')  els.authBearerConfig.style.display  = 'block';
    if (e.target.value === 'basic')   els.authBasicConfig.style.display   = 'block';
    if (e.target.value === 'api-key') els.authApikeyConfig.style.display  = 'block';
    if (e.target.value === 'oauth2')  els.authOauth2Config.style.display  = 'block';
});

function clearOAuth2Token() {
    oauth2Token = null;
    els.oauth2TokenDisplay.style.display = 'none';
    els.oauth2TokenValue.value = '';
    els.oauth2TokenStatus.textContent = '';
}

// OAuth2 grant type toggle
els.oauth2Grant.addEventListener('change', (e) => {
    els.oauth2PasswordFields.style.display = e.target.value === 'password' ? 'block' : 'none';
    clearOAuth2Token();
});

// Clear cached token whenever any OAuth2 config field changes
[els.oauth2TokenUrl, els.oauth2ClientId, els.oauth2ClientSecret,
 els.oauth2Scope, els.oauth2PwUsername, els.oauth2PwPassword].forEach(el => {
    el.addEventListener('input', clearOAuth2Token);
});

// Fetch OAuth2 token
els.btnFetchOauth2.addEventListener('click', async () => {
    const tokenUrl    = interpolate(els.oauth2TokenUrl.value.trim());
    const clientId    = interpolate(els.oauth2ClientId.value.trim());
    const clientSecret = els.oauth2ClientSecret.value.trim();
    const scope       = els.oauth2Scope.value.trim();
    const grantType   = els.oauth2Grant.value;

    if (!tokenUrl || !clientId) {
        showToast('Token URL and Client ID are required', 'error');
        return;
    }

    els.btnFetchOauth2.textContent = 'Fetching…';
    els.btnFetchOauth2.disabled = true;
    els.oauth2TokenStatus.textContent = '';

    try {
        const token = await fetchOAuth2Token({
            grantType, tokenUrl, clientId, clientSecret, scope,
            username: els.oauth2PwUsername.value.trim(),
            password: els.oauth2PwPassword.value,
        });
        oauth2Token = token;
        els.oauth2TokenValue.value = token;
        els.oauth2TokenDisplay.style.display = 'block';
        els.oauth2TokenStatus.textContent = 'Token fetched';
        els.oauth2TokenStatus.style.color = '#15803d';
        showToast('OAuth2 token fetched', 'success');
    } catch (e) {
        els.oauth2TokenStatus.textContent = e.message;
        els.oauth2TokenStatus.style.color = '#dc2626';
        showToast(`OAuth2 error: ${e.message}`, 'error');
    } finally {
        els.btnFetchOauth2.textContent = 'Fetch Token';
        els.btnFetchOauth2.disabled = false;
    }
});

async function fetchOAuth2Token({ grantType, tokenUrl, clientId, clientSecret, scope, username, password }) {
    const params = new URLSearchParams();
    params.set('grant_type', grantType);
    params.set('client_id', clientId);
    if (clientSecret) params.set('client_secret', clientSecret);
    if (scope) params.set('scope', scope);
    if (grantType === 'password') {
        params.set('username', username);
        params.set('password', password);
    }

    let response, data;
    try {
        response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
    } catch {
        // CORS fallback via local proxy
        const proxyRes = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: tokenUrl,
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            }),
        });
        const proxyData = await proxyRes.json();
        let parsedBody = proxyData.body;
        if (typeof parsedBody === 'string') {
            try { parsedBody = JSON.parse(parsedBody); } catch { throw new Error(`Token endpoint error: ${parsedBody}`); }
        }
        if (!proxyData.status || proxyData.status >= 400) {
            throw new Error(parsedBody?.error_description || parsedBody?.error || `HTTP ${proxyData.status}`);
        }
        return parsedBody?.access_token || (() => { throw new Error('No access_token in response'); })();
    }

    data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.error || `HTTP ${response.status}`);
    if (!data.access_token) throw new Error('No access_token in response');
    return data.access_token;
}

// ─── Body UI ──────────────────────────────────────────────────────────────────
Array.from(els.bodyRadios).forEach(r => {
    r.addEventListener('change', (e) => {
        els.reqBodyEditorWrap.style.display = 'none';
        els.reqFormDataWrap.style.display   = 'none';
        els.reqTextBodyWrap.style.display   = 'none';
        els.reqGraphqlWrap.style.display    = 'none';
        if (e.target.value === 'json')      els.reqBodyEditorWrap.style.display = 'flex';
        if (e.target.value === 'form-data') els.reqFormDataWrap.style.display   = 'block';
        if (e.target.value === 'text')      els.reqTextBodyWrap.style.display   = 'flex';
        if (e.target.value === 'graphql')   els.reqGraphqlWrap.style.display    = 'flex';
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

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (els.envModal.open) closeEnvModal();
        if (els.openapiModal.open) closeOpenapiModal();
    }
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
    return str.replaceAll(/\{\{([^}]{1,256})\}\}/g, (_, raw) => {
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
        const fn = new Function('ds', 'console', `return (async()=>{ ${code} })()`); // NOSONAR — intentional scripting sandbox; code is user-authored in the Monaco editor
        await fn(makeDs(), makeCapturedConsole(logs)); // NOSONAR
    } catch (e) {
        logs.push({ type: 'error', text: `Pre-request error: ${e.message}` });
    }
    return logs;
}

function expect(val) {
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
            return chain;
        }
    });
    return chain;
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

    try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('ds', 'test', 'expect', 'console', `return (async()=>{ ${code} })()`); // NOSONAR — intentional scripting sandbox; code is user-authored in the Monaco editor
        await fn(makeDs({ response: dsResponse }), test, expect, makeCapturedConsole(logs)); // NOSONAR
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
    if (preReqLogs.length) { all.push({ type: 'section', text: '── Pre-Request ──' }, ...preReqLogs); }
    if (testLogs.length)   { all.push({ type: 'section', text: '── Tests ──' }, ...testLogs); }

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
    const bodyType = document.querySelector('input[name="bodyType"]:checked').value;
    const config = {
        url:         interpolate(els.url.value.trim()),
        method:      els.method.value,
        queryParams: interpolateObj(paramsListObj.get()),
        headers:     interpolateObj(headersListObj.get()),
        auth:        { type: els.authType.value },
        bodyType,
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
    if (config.auth.type === 'oauth2') {
        if (oauth2Token) {
            config.auth.type = 'bearer';
            config.auth.token = oauth2Token;
        } else {
            showToast('No OAuth2 token — click "Fetch Token" in the Auth tab first', 'error');
        }
    }

    if (bodyType === 'json' && reqEditor)        config.body = interpolate(reqEditor.getValue());
    if (bodyType === 'form-data')                config.body = interpolateObj(formDataListObj.get());
    if (bodyType === 'text')                     config.body = interpolate(els.reqTextBody.value);
    if (bodyType === 'graphql' && graphqlQueryEditor) {
        let vars = {};
        try { vars = JSON.parse(graphqlVarsEditor?.getValue() || '{}'); } catch { /* ignore */ }
        config.body = JSON.stringify({ query: graphqlQueryEditor.getValue(), variables: vars });
        config.bodyType = 'json';
        if (!config.headers['Content-Type']) config.headers['Content-Type'] = 'application/json';
    }

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
    if (config.auth.type === 'bearer')   config.auth.token      = els.authToken.value;
    if (config.auth.type === 'basic') {  config.auth.username   = els.authUsername.value; config.auth.password = els.authPassword.value; }
    if (config.auth.type === 'api-key'){ config.auth.headerName = els.authApikeyHeader.value.trim(); config.auth.headerValue = els.authApikeyValue.value.trim(); }
    if (config.auth.type === 'oauth2') {
        config.auth.grantType    = els.oauth2Grant.value;
        config.auth.tokenUrl     = els.oauth2TokenUrl.value.trim();
        config.auth.clientId     = els.oauth2ClientId.value.trim();
        config.auth.scope        = els.oauth2Scope.value.trim();
    }
    if (bodyType === 'json'      && reqEditor)         config.body = reqEditor.getValue();
    if (bodyType === 'form-data')                      config.body = formDataListObj.getAll();
    if (bodyType === 'text')                           config.body = els.reqTextBody.value;
    if (bodyType === 'graphql'   && graphqlQueryEditor) {
        config.graphqlQuery = graphqlQueryEditor.getValue();
        config.graphqlVars  = graphqlVarsEditor?.getValue() || '{}';
    }
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
    els.respProxyChip.style.display = response.wasProxied ? 'inline-flex' : 'none';
    els.respPlaceholder.style.display = 'none';

    const bodyText = response.body ? JSON.stringify(response.body, null, 2) : (response.bodyText || '');
    if (respEditor) {
        const ct = response.contentType || '';
        let lang = 'json';
        if (ct.includes('xml'))       lang = 'xml';
        else if (ct.includes('html')) lang = 'html';
        monaco.editor.setModelLanguage(respEditor.getModel(), lang);
        respEditor.setValue(bodyText);
        els.respFallback.style.display = 'none';
        els.respEditorEl.style.display = 'block';
    } else {
        els.respEditorEl.style.display = 'none';
        els.respFallback.textContent = bodyText;
        els.respFallback.style.display = 'flex';
    }

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

    if (response.error || response.status === 0) {
        showToast('Network error — check console', 'error');
    } else {
        showToast(`${response.status} ${response.statusText} in ${response.timeMs}ms`, response.status < 400 ? 'success' : 'error');
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
        const preCode = preReqEditor ? preReqEditor.getValue() : '';
        preReqLogs = await runPreRequestScript(preCode);

        const config   = buildRequestConfig();
        const response = await globalThis.ApiClient.execute(config);

        addToHistory({ ...buildRawConfig(), timestamp: Date.now() });
        renderResponse(response);

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

// ─── Collections — Folder Rendering ──────────────────────────────────────────
function renderCollections() {
    els.collectionsList.innerHTML = '';
    const count = collections.length;
    if (els.collectionsCount) els.collectionsCount.textContent = `${count} request${count !== 1 ? 's' : ''}`;

    // Group by folder
    const folderMap = new Map();
    const noFolder = [];

    collections.forEach((item, idx) => {
        if (item.folder) {
            if (!folderMap.has(item.folder)) folderMap.set(item.folder, []);
            folderMap.get(item.folder).push({ item, idx });
        } else {
            noFolder.push({ item, idx });
        }
    });

    noFolder.forEach(({ item, idx }) => appendCollectionItem(els.collectionsList, item, idx));

    folderMap.forEach((items, folderName) => {
        const folderLi = createFolderElement(folderName, items);
        els.collectionsList.appendChild(folderLi);
    });
}

function createFolderElement(folderName, items) {
    const li = document.createElement('li');
    li.className = 'collection-folder';

    const header = document.createElement('div');
    header.className = 'folder-header';
    const _svg = (attrs, childTag, childAttrs) => {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        Object.entries(attrs).forEach(([k, v]) => k === 'style' ? (el.style.cssText = v) : el.setAttribute(k, v));
        if (childTag) {
            const ch = document.createElementNS('http://www.w3.org/2000/svg', childTag);
            Object.entries(childAttrs).forEach(([k, v]) => ch.setAttribute(k, v));
            el.appendChild(ch);
        }
        return el;
    };
    const arrowSvg = _svg({ class: 'folder-arrow', width: '10', height: '10', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'aria-hidden': 'true' }, 'polyline', { points: '6 9 12 15 18 9' });
    const folderSvg = _svg({ width: '12', height: '12', viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none', 'aria-hidden': 'true', style: 'color:var(--vio); opacity:0.7; flex-shrink:0;' }, 'path', { d: 'M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z' });
    const nameSpan = document.createElement('span');
    nameSpan.className = 'folder-name';
    nameSpan.textContent = folderName;
    const countSpan = document.createElement('span');
    countSpan.className = 'folder-count';
    countSpan.textContent = items.length;
    header.appendChild(arrowSvg);
    header.appendChild(folderSvg);
    header.appendChild(nameSpan);
    header.appendChild(countSpan);

    const content = document.createElement('ul');
    content.className = 'folder-content sidebar-content';
    content.style.cssText = 'padding:0.2rem 0 0.2rem 0.75rem; overflow:visible;';
    items.forEach(({ item, idx }) => appendCollectionItem(content, item, idx));

    let open = true;
    header.addEventListener('click', () => {
        open = !open;
        content.style.display = open ? 'block' : 'none';
        header.classList.toggle('folder-collapsed', !open);
    });

    li.appendChild(header);
    li.appendChild(content);
    return li;
}

function appendCollectionItem(parent, item, idx) {
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
    parent.appendChild(li);
}

function escHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ─── Load Item (restore request) ──────────────────────────────────────────────
function loadItem(item) {
    els.method.value = item.method || 'GET';
    updateMethodColor();
    els.url.value    = item.url || '';

    paramsListObj.clear();
    headersListObj.clear();
    formDataListObj.clear();
    els.authType.value = 'none';
    els.authType.dispatchEvent(new Event('change'));

    const toEntries = (v) => Array.isArray(v) ? v : Object.entries(v || {}).map(([key, value]) => ({ key, value, enabled: true }));
    toEntries(item.queryParams).forEach(r => paramsListObj.add(r.key, r.value, r.enabled !== false));
    toEntries(item.headers).forEach(r => headersListObj.add(r.key, r.value, r.enabled !== false));

    if (item.auth) restoreAuth(item.auth);
    if (item.bodyType) restoreBody(item.bodyType, item);
    if (item.preRequestScript && preReqEditor) preReqEditor.setValue(item.preRequestScript);
    if (item.testsScript && testsEditor)       testsEditor.setValue(item.testsScript);
}

function restoreAuth(auth) {
    els.authType.value = auth.type || 'none';
    els.authType.dispatchEvent(new Event('change'));
    if (auth.type === 'bearer')  els.authToken.value = auth.token || '';
    if (auth.type === 'basic') { els.authUsername.value = auth.username || ''; els.authPassword.value = auth.password || ''; }
    if (auth.type === 'api-key'){ els.authApikeyHeader.value = auth.headerName || ''; els.authApikeyValue.value = auth.headerValue || ''; }
    if (auth.type === 'oauth2') {
        clearOAuth2Token();
        els.oauth2Grant.value    = auth.grantType    || 'client_credentials';
        els.oauth2TokenUrl.value = auth.tokenUrl     || '';
        els.oauth2ClientId.value = auth.clientId     || '';
        els.oauth2Scope.value    = auth.scope        || '';
        els.oauth2Grant.dispatchEvent(new Event('change'));
    }
}

function restoreBody(bodyType, item) {
    const rb = document.querySelector(`input[name="bodyType"][value="${bodyType}"]`);
    if (rb) { rb.checked = true; rb.dispatchEvent(new Event('change')); }
    const body = item.body;
    if (bodyType === 'json' && reqEditor) reqEditor.setValue(typeof body === 'string' ? body : JSON.stringify(body ?? {}, null, 2));
    if (bodyType === 'text') els.reqTextBody.value = body || '';
    if (bodyType === 'form-data') {
        const entries = Array.isArray(body) ? body : Object.entries(body || {}).map(([key, value]) => ({ key, value, enabled: true }));
        entries.forEach(r => formDataListObj.add(r.key, r.value, r.enabled !== false));
    }
    if (bodyType === 'graphql') {
        if (graphqlQueryEditor && item.graphqlQuery) graphqlQueryEditor.setValue(item.graphqlQuery);
        if (graphqlVarsEditor  && item.graphqlVars)  graphqlVarsEditor.setValue(item.graphqlVars);
    }
}

// ─── Save to Collection ───────────────────────────────────────────────────────
els.saveBtn.addEventListener('click', () => {
    const raw = prompt('Name this request:\n(Use "FolderName/RequestName" to save into a folder)');
    if (!raw) return;
    const slashIdx = raw.indexOf('/');
    let folder, name;
    if (slashIdx > 0 && slashIdx < raw.length - 1) {
        folder = raw.slice(0, slashIdx).trim();
        name   = raw.slice(slashIdx + 1).trim();
    } else {
        folder = undefined;
        name   = raw.trim();
    }
    const item = { ...buildRawConfig(), name };
    if (folder) item.folder = folder;
    collections.push(item);
    saveCollections();
    renderCollections();
});

document.getElementById('refresh-collections-btn').addEventListener('click', loadCollections);

// ─── Collection Export ────────────────────────────────────────────────────────
els.btnExportCollections.addEventListener('click', () => {
    if (!collections.length) return showToast('No collections to export', 'info');
    const blob = new Blob([JSON.stringify({ version: 1, items: collections }, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'devsuite-collections.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${collections.length} request${collections.length !== 1 ? 's' : ''}`, 'success');
});

// ─── Collection Import ────────────────────────────────────────────────────────
els.btnImportCollections.addEventListener('click', () => els.importCollectionsFile.click());

els.importCollectionsFile.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        const imported = data.items || (Array.isArray(data) ? data : []);
        if (!imported.length) return showToast('No items found in file', 'error');
        if (!confirm(`Import ${imported.length} request(s)? Executable scripts will be stripped from imported items.`)) return;
        const sanitized = imported.map(({ preRequestScript: _p, testsScript: _t, ...rest }) => rest);
        if (collections.length && confirm(`Replace all ${collections.length} existing request(s)?\n\nOK = Replace all\nCancel = Merge (add to existing)`)) {
            collections = sanitized;
        } else {
            collections = [...collections, ...sanitized];
        }
        await saveCollections();
        renderCollections();
        showToast(`Imported ${imported.length} request(s)`, 'success');
    } catch (err) {
        showToast(`Import failed: ${err.message}`, 'error');
    }
    e.target.value = '';
});

// ─── OpenAPI Import ───────────────────────────────────────────────────────────
els.btnImportOpenapi.addEventListener('click', openOpenapiModal);
els.closeOpenapiModal.addEventListener('click', closeOpenapiModal);
els.btnOpenapiCancel.addEventListener('click', closeOpenapiModal);
els.openapiModal.addEventListener('click', (e) => { if (e.target === els.openapiModal) closeOpenapiModal(); });

els.btnOpenapiLoadFile.addEventListener('click', () => els.openapiFileInput.click());
els.openapiFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    els.openapiSpecInput.value = text;
    e.target.value = '';
});

els.btnOpenapiImport.addEventListener('click', () => {
    const raw = els.openapiSpecInput.value.trim();
    if (!raw) return showToast('Paste a spec first', 'error');

    let spec;
    try {
        spec = JSON.parse(raw);
    } catch {
        els.openapiImportStatus.textContent = 'Invalid JSON — only JSON specs are supported';
        els.openapiImportStatus.style.color = '#dc2626';
        return;
    }

    const imported = parseOpenApiSpec(spec);
    if (!imported.length) {
        els.openapiImportStatus.textContent = 'No paths found in spec';
        els.openapiImportStatus.style.color = '#dc2626';
        return;
    }

    collections = [...collections, ...imported];
    saveCollections();
    renderCollections();
    closeOpenapiModal();
    showToast(`Imported ${imported.length} endpoint${imported.length !== 1 ? 's' : ''} from OpenAPI spec`, 'success');
});

function openOpenapiModal() {
    els.openapiSpecInput.value = '';
    els.openapiImportStatus.textContent = '';
    els.openapiModal.showModal();
}

function closeOpenapiModal() {
    els.openapiModal.close();
}

function resolveBaseUrl(spec) {
    const isSwagger2 = spec.swagger && spec.swagger.startsWith('2');
    return isSwagger2
        ? `${spec.schemes?.[0] || 'https'}://${spec.host || ''}${spec.basePath || ''}`
        : (spec.servers?.[0]?.url || '');
}

function mergeParameters(pathItem, operation) {
    const seen = new Set();
    const result = { queryParams: [], headers: [] };
    for (const p of [...(pathItem.parameters || []), ...(operation.parameters || [])]) {
        if (seen.has(p.name)) continue;
        seen.add(p.name);
        const entry = { key: p.name, value: p.example != null ? String(p.example) : '', enabled: true };
        if (p.in === 'query')  result.queryParams.push(entry);
        if (p.in === 'header') result.headers.push(entry);
    }
    return result;
}

function extractRequestBody(operation, isSwagger2) {
    const requestBody = operation.requestBody;
    if (requestBody) {
        const jsonContent = requestBody.content?.['application/json'];
        if (jsonContent) {
            const example = jsonContent.example ?? jsonContent.schema?.example;
            return { bodyType: 'json', body: example != null ? JSON.stringify(example, null, 2) : buildSchemaExample(jsonContent.schema) };
        }
    }
    if (isSwagger2 && !requestBody) {
        const bodyParam = (operation.parameters || []).find(p => p.in === 'body');
        if (bodyParam) {
            return {
                bodyType: 'json',
                body: bodyParam.schema?.example != null
                    ? JSON.stringify(bodyParam.schema.example, null, 2)
                    : buildSchemaExample(bodyParam.schema),
            };
        }
    }
    return { bodyType: 'none' };
}

function parseOpenApiSpec(spec) {
    const isSwagger2 = spec.swagger && spec.swagger.startsWith('2');
    const baseUrl = resolveBaseUrl(spec);
    const items = [];

    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
        for (const method of ['get','post','put','delete','patch','head','options']) {
            const operation = pathItem[method];
            if (!operation) continue;

            const name = operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`;
            const folder = operation.tags?.[0] || spec.info?.title || undefined;
            const { queryParams, headers } = mergeParameters(pathItem, operation);
            const bodyInfo = extractRequestBody(operation, isSwagger2);

            const item = { name, method: method.toUpperCase(), url: baseUrl + path, queryParams, headers, auth: { type: 'none' }, ...bodyInfo };
            if (folder) item.folder = folder;
            items.push(item);
        }
    }

    return items;
}

function buildSchemaExample(schema) {
    if (!schema) return '{}';
    if (schema.example != null) return JSON.stringify(schema.example, null, 2);
    if (schema.type === 'object' || schema.properties) {
        const obj = {};
        for (const [k, v] of Object.entries(schema.properties || {})) {
            obj[k] = v.example ?? v.default ?? typeDefault(v.type);
        }
        return JSON.stringify(obj, null, 2);
    }
    return '{}';
}

function typeDefault(t) {
    if (t === 'string')  return '';
    if (t === 'number' || t === 'integer') return 0;
    if (t === 'boolean') return false;
    if (t === 'array')   return [];
    return null;
}

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
