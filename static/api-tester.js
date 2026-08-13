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
let folderAuths = {};
let activeEnvId = '';
let runtimeVars = {};
let selectedEnvId = null;
let currentItemFolder = null;
let oauth2Token = null;

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const els = {
    method:             document.getElementById('req-method'),
    url:                document.getElementById('req-url'),
    proxyMode:          document.getElementById('req-proxy-mode'),
    btnSend:            document.getElementById('btn-send'),

    authType:           document.getElementById('auth-type'),
    authInheritConfig:  document.getElementById('auth-inherit-config'),
    authInheritStatus:  document.getElementById('auth-inherit-status'),
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
    btnImportEnv:       document.getElementById('btn-import-env'),
    importEnvFile:      document.getElementById('import-env-file'),
    envListUl:          document.getElementById('env-list-ul'),
    envNameInput:       document.getElementById('env-name-input'),
    envVarsList:        document.getElementById('env-vars-list'),
    btnAddEnvVar:       document.getElementById('btn-add-env-var'),
    btnSaveEnv:         document.getElementById('btn-save-env'),
    btnDeleteEnv:       document.getElementById('btn-delete-env'),
    envEditorEmpty:     document.getElementById('env-editor-empty'),
    envEditorForm:      document.getElementById('env-editor-form'),

    folderAuthModal:         document.getElementById('folder-auth-modal'),
    folderAuthModalName:     document.getElementById('folder-auth-modal-name'),
    closeFolderAuthModal:    document.getElementById('close-folder-auth-modal'),
    folderAuthType:          document.getElementById('folder-auth-type'),
    folderAuthBearerConfig:  document.getElementById('folder-auth-bearer-config'),
    folderAuthBasicConfig:   document.getElementById('folder-auth-basic-config'),
    folderAuthApikeyConfig:  document.getElementById('folder-auth-apikey-config'),
    folderAuthToken:         document.getElementById('folder-auth-token'),
    folderAuthUsername:      document.getElementById('folder-auth-username'),
    folderAuthPassword:      document.getElementById('folder-auth-password'),
    folderAuthApikeyHeader:  document.getElementById('folder-auth-apikey-header'),
    folderAuthApikeyValue:   document.getElementById('folder-auth-apikey-value'),
    btnSaveFolderAuth:       document.getElementById('btn-save-folder-auth'),
    btnCancelFolderAuth:     document.getElementById('btn-cancel-folder-auth'),

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

    btnExportZip:       document.getElementById('btn-export-zip'),
    btnRunCollection:   document.getElementById('btn-run-collection'),
    runnerModal:        document.getElementById('runner-modal'),
    runnerScope:        document.getElementById('runner-scope'),
    runnerList:         document.getElementById('runner-list'),
    runnerSummary:      document.getElementById('runner-summary'),
    btnRunnerStop:      document.getElementById('btn-runner-stop'),
    btnRunnerClose:     document.getElementById('btn-runner-close'),
    closeRunnerModal:   document.getElementById('close-runner-modal'),

    btnCode:            document.getElementById('btn-code'),
    codeModal:          document.getElementById('code-modal'),
    closeCodeModal:     document.getElementById('close-code-modal'),
    codeOutput:         document.getElementById('code-output'),
    codeOutputWrap:     document.getElementById('code-output-wrap'),
    codeImportWrap:     document.getElementById('code-import-wrap'),
    codeImportInput:    document.getElementById('code-import-input'),
    codeImportStatus:   document.getElementById('code-import-status'),
    btnCodeImport:      document.getElementById('btn-code-import'),
    btnCopyCode:        document.getElementById('btn-copy-code'),

    btnCookies:         document.getElementById('btn-cookies'),
    cookieCount:        document.getElementById('cookie-count'),
    cookiesModal:       document.getElementById('cookies-modal'),
    closeCookiesModal:  document.getElementById('close-cookies-modal'),
    cookiesList:        document.getElementById('cookies-list'),
    btnClearCookies:    document.getElementById('btn-clear-cookies'),
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
    els.authInheritConfig.style.display = 'none';
    els.authBearerConfig.style.display  = 'none';
    els.authBasicConfig.style.display   = 'none';
    els.authApikeyConfig.style.display  = 'none';
    els.authOauth2Config.style.display  = 'none';
    if (e.target.value === 'inherit')  { els.authInheritConfig.style.display = 'block'; updateInheritInfo(); }
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
        closeContextMenu();
        if (els.envModal.open) closeEnvModal();
        if (els.openapiModal.open) closeOpenapiModal();
        if (els.folderAuthModal?.open) els.folderAuthModal.close();
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

// ─── Environment Import ───────────────────────────────────────────────────────
els.btnImportEnv.addEventListener('click', () => els.importEnvFile.click());

els.importEnvFile.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return; // NOSONAR — guard clause
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        const toImport = parseEnvImport(data);
        if (!toImport.length) return showToast('No environments found in file', 'error');
        const label = toImport.length === 1 ? `"${toImport[0].name}"` : `${toImport.length} environments`;
        if (!confirm(`Import ${label}? Existing environments with the same name will be replaced.`)) return;
        for (const env of toImport) {
            const existing = environments.findIndex(ex => ex.name === env.name);
            if (existing >= 0) {
                environments[existing] = env;
            } else {
                environments.push(env);
            }
        }
        saveEnvironments();
        renderEnvSelect();
        renderEnvList();
        showToast(`Imported ${label}`, 'success');
    } catch (err) {
        showToast(`Import failed: ${err.message}`, 'error');
    }
    e.target.value = '';
});

function parseEnvImport(data) {
    // Postman single environment: { name, values: [{key, value, enabled}], _postman_variable_scope: "environment" }
    if (data._postman_variable_scope === 'environment' || (data.name && Array.isArray(data.values))) {
        const vars = {};
        for (const v of (data.values || [])) {
            if (v.key && v.enabled !== false) vars[v.key] = v.value ?? '';
        }
        return [{ id: crypto.randomUUID(), name: data.name || 'Imported', vars }];
    }
    // DevSuite native: [{id, name, vars}]
    if (Array.isArray(data)) {
        return data
            .filter(e => e.name && typeof e.vars === 'object')
            .map(e => ({ id: e.id || crypto.randomUUID(), name: e.name, vars: e.vars }));
    }
    return [];
}

// ─── Variable Interpolation ───────────────────────────────────────────────────
function interpolate(str) {
    if (typeof str !== 'string') return String(str ?? '');
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

// ─── Script Execution (sandboxed — SPEC §4.7.1) ───────────────────────────────
// User scripts run in a dedicated Web Worker (script-sandbox-worker.js) whose
// response carries its own scoped CSP; the document CSP has no unsafe-eval.
// The worker has no DOM and no network. Variable writes come back as mutations
// and are applied here after the script completes.
let _sandboxWorker = null;
let _sandboxToken = null;
let _sandboxSeq = 0;
const SCRIPT_TIMEOUT_MS = 10000;

function _getSandboxWorker() {
    if (!_sandboxWorker) {
        _sandboxToken = crypto.randomUUID();
        _sandboxWorker = new Worker('/static/script-sandbox-worker.js');
        _sandboxWorker.postMessage({ kind: 'init', token: _sandboxToken });
    }
    return _sandboxWorker;
}

// HMAC-SHA256(code) under the per-worker session token, so a script message can
// only have come from this page (not a co-loaded/compromised third-party script
// that lacks the token) — verified worker-side in verifySignedScript().
async function _signScript(code, token) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(String(token)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(code));
    return btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
}

function _applyScriptMutations(mutations) {
    Object.assign(runtimeVars, mutations.runtime || {});
    const envWrites = Object.entries(mutations.env || {});
    if (envWrites.length) {
        const env = getActiveEnv();
        if (env) {
            env.vars = env.vars || {};
            envWrites.forEach(([k, v]) => { env.vars[k] = v; });
            saveEnvironments();
        }
    }
}

function runScriptSandboxed(kind, code, dsResponse = null, timeoutMs = SCRIPT_TIMEOUT_MS) {
    return new Promise((resolve) => {
        if (!code || !code.trim()) { resolve({ logs: [], results: [] }); return; }
        let worker;
        try {
            worker = _getSandboxWorker();
        } catch (e) {
            resolve({ logs: [{ type: 'error', text: `Script sandbox unavailable: ${e.message}` }], results: [] });
            return;
        }
        const id = ++_sandboxSeq;
        let timer = null;

        function cleanup() {
            clearTimeout(timer);
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
        }
        function onMessage(ev) {
            if (ev.data?.id !== id) return;
            cleanup();
            _applyScriptMutations(ev.data.mutations || {});
            resolve({ logs: ev.data.logs || [], results: ev.data.results || [] });
        }
        function onError(ev) {
            cleanup();
            resolve({ logs: [{ type: 'error', text: `Script sandbox error: ${ev.message || 'worker failed to load'}` }], results: [] });
        }

        timer = setTimeout(() => {
            cleanup();
            worker.terminate();
            _sandboxWorker = null; // recreated lazily on the next run
            _sandboxToken = null;
            resolve({ logs: [{ type: 'error', text: `Script timed out after ${timeoutMs / 1000}s and was terminated` }], results: [] });
        }, timeoutMs);

        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);

        const token = _sandboxToken;
        _signScript(code, token).then((codeSig) => {
            worker.postMessage({
                id, kind, code, codeSig, authToken: token,
                runtimeVars: { ...runtimeVars },
                envVars: { ...(getActiveEnv()?.vars || {}) },
                response: dsResponse,
            });
        });
    });
}

async function runPreRequestScript(code) {
    const run = await runScriptSandboxed('pre', code);
    return run.logs;
}

async function runTestScript(code, dsResponse) {
    return runScriptSandboxed('test', code, dsResponse);
}

// ─── Console Rendering ────────────────────────────────────────────────────────
function renderConsole(preReqLogs, testLogs, testResults) {
    els.consoleEntries.innerHTML = '';
    const all = [];
    if (preReqLogs.length) { all.push({ type: 'section', text: '── Pre-Request ──' }, ...preReqLogs); }
    if (testLogs.length)   { all.push({ type: 'section', text: '── Tests ──' }, ...testLogs); }

    if (all.length) {
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
    } else {
        els.consoleBadge.style.display = 'none';
        els.consolePlaceholder.style.display = 'block';
    }
}

// ─── Build Request Config ─────────────────────────────────────────────────────

/** Nearest ancestor folder (walking up the `/` path) with a configured auth — SPEC §4.7.4. */
function resolveFolderAuth(folderPath) {
    let p = folderPath || '';
    while (p) {
        const fa = folderAuths[p];
        if (fa && fa.type !== 'none') return { auth: fa, source: p };
        const i = p.lastIndexOf('/');
        p = i > 0 ? p.slice(0, i) : '';
    }
    return { auth: { type: 'none' }, source: null };
}

/** Resolve auth credentials into config.auth (mutates config in-place). */
function _resolveAuthConfig(config) {
    if (config.auth.type === 'inherit') {
        config.auth = { ...resolveFolderAuth(currentItemFolder).auth };
    }
    if (config.auth.type === 'bearer') {
        config.auth.token = interpolate(config.auth.token ?? els.authToken.value);
    }
    if (config.auth.type === 'basic') {
        config.auth.username = interpolate(config.auth.username ?? els.authUsername.value);
        config.auth.password = interpolate(config.auth.password ?? els.authPassword.value);
    }
    if (config.auth.type === 'api-key') {
        const h = interpolate(config.auth.headerName ?? els.authApikeyHeader.value.trim());
        const v = interpolate(config.auth.headerValue ?? els.authApikeyValue.value.trim());
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
}

/** Set config.body and config.bodyType based on the active body-type radio (mutates in-place). */
function _applyBodyConfig(config, bodyType) {
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
}

function buildRequestConfig() {
    const bodyType = document.querySelector('input[name="bodyType"]:checked').value;
    const config = {
        url:         interpolate(els.url.value.trim()),
        method:      els.method.value,
        queryParams: interpolateObj(paramsListObj.get()),
        headers:     interpolateObj(headersListObj.get()),
        auth:        { type: els.authType.value },
        proxyMode:   els.proxyMode ? els.proxyMode.value : 'auto',
        bodyType,
    };
    _resolveAuthConfig(config);
    _applyBodyConfig(config, bodyType);
    return config;
}

function _readRawAuthConfig(authType) {
    const auth = { type: authType };
    if (authType === 'bearer')   auth.token      = els.authToken.value;
    if (authType === 'basic') {  auth.username   = els.authUsername.value; auth.password = els.authPassword.value; }
    if (authType === 'api-key'){ auth.headerName = els.authApikeyHeader.value.trim(); auth.headerValue = els.authApikeyValue.value.trim(); }
    if (authType === 'oauth2') {
        auth.grantType = els.oauth2Grant.value;
        auth.tokenUrl  = els.oauth2TokenUrl.value.trim();
        auth.clientId  = els.oauth2ClientId.value.trim();
        auth.scope     = els.oauth2Scope.value.trim();
    }
    return auth;
}

// Raw config (pre-interpolation) used for saving/history
function buildRawConfig() {
    const bodyType = document.querySelector('input[name="bodyType"]:checked').value;
    const config = {
        url:         els.url.value.trim(),
        method:      els.method.value,
        queryParams: paramsListObj.getAll(),
        headers:     headersListObj.getAll(),
        auth:        _readRawAuthConfig(els.authType.value),
        proxyMode:   els.proxyMode ? els.proxyMode.value : 'auto',
        bodyType,
    };
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

/** Populate Monaco editor or fallback textarea with the response body. */
function _renderResponseBody(response, bodyText) {
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
}

/** Populate the response headers tab with key/value rows. */
function _renderResponseHeaders(headers) {
    const hContainer = document.getElementById('resp-headers-tab');
    hContainer.innerHTML = '';
    for (const [k, v] of Object.entries(headers || {})) {
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
}

function renderResponse(response) {
    els.respMeta.style.display = 'flex';
    els.respStatus.textContent = `${response.status} ${response.statusText}`;
    els.respStatus.className   = `meta-value ${response.status >= 200 && response.status < 300 ? 'status-ok' : 'status-err'}`;
    els.respTime.textContent   = response.wasProxied ? `${response.timeMs} ms (proxy)` : `${response.timeMs} ms`;
    els.respSize.textContent   = `${(response.sizeBytes / 1024).toFixed(2)} KB`;
    els.respProxyChip.style.display = response.wasProxied ? 'inline-flex' : 'none';
    const proxyBanner = document.getElementById('resp-proxy-banner');
    if (proxyBanner) proxyBanner.style.display = response.wasProxied ? 'flex' : 'none';
    els.respPlaceholder.style.display = 'none';

    const bodyText = (response.body !== undefined && response.body !== null)
        ? JSON.stringify(response.body, null, 2)
        : (response.bodyText || '');
    _renderResponseBody(response, bodyText);
    _renderResponseHeaders(response.headers);

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
        const response = await executeWithJar(config);

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
    if (history.length) {
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
    } else {
        const li = document.createElement('li');
        li.style.cssText = 'padding:1rem; color:var(--text-muted); font-size:0.83rem;';
        li.textContent = 'No history yet';
        list.appendChild(li);
    }
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
        folderAuths  = data.folderAuths || {};
        renderCollections();
    } catch (e) {
        console.warn('Could not load collections', e);
    }
}

function getCsrfToken() {
    return globalThis.DevSuite?.csrfToken?.() ?? '';
}

async function saveCollections() {
    const headers = { 'Content-Type': 'application/json' };
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
    try {
        await fetch('/api/collections', { method: 'POST', headers, body: JSON.stringify({ items: collections, folderAuths }) });
        showToast('Saved to ~/.devsuite/collections.json', 'success');
    } catch {
        showToast('Failed to save collection', 'error');
    }
}

// ─── Collections — Nested Folder Rendering (SPEC §4.7.4) ─────────────────────

/** Build a folder tree from `/`-separated item.folder paths. */
function buildFolderTree() {
    const root = { name: '', path: '', children: new Map(), items: [] };
    collections.forEach((item, idx) => {
        const segments = String(item.folder || '').split('/').map(s => s.trim()).filter(Boolean);
        let node = root;
        let acc = '';
        for (const seg of segments) {
            acc = acc ? `${acc}/${seg}` : seg;
            if (!node.children.has(seg)) {
                node.children.set(seg, { name: seg, path: acc, children: new Map(), items: [] });
            }
            node = node.children.get(seg);
        }
        node.items.push({ item, idx });
    });
    return root;
}

/** Total request count in a folder node, including all nested subfolders. */
function countTreeItems(node) {
    let n = node.items.length;
    node.children.forEach(child => { n += countTreeItems(child); });
    return n;
}

/** Flatten a folder node's requests in sidebar display order (items, then subfolders). */
function collectTreeItems(node, out = []) {
    node.items.forEach(entry => out.push(entry));
    node.children.forEach(child => collectTreeItems(child, out));
    return out;
}

function renderCollections() {
    els.collectionsList.innerHTML = '';
    const count = collections.length;
    if (els.collectionsCount) els.collectionsCount.textContent = `${count} request${count !== 1 ? 's' : ''}`;

    const root = buildFolderTree();
    root.items.forEach(({ item, idx }) => appendCollectionItem(els.collectionsList, item, idx));
    root.children.forEach(node => els.collectionsList.appendChild(createFolderElement(node)));
}

function _makeSvg(attrs, childTag, childAttrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'style') { el.style.cssText = v; } else { el.setAttribute(k, v); }
    }
    if (childTag) {
        const ch = document.createElementNS('http://www.w3.org/2000/svg', childTag);
        Object.entries(childAttrs).forEach(([k, v]) => ch.setAttribute(k, v));
        el.appendChild(ch);
    }
    return el;
}

function _makeKebabSvg() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '12');
    svg.setAttribute('height', '12');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    ['5', '12', '19'].forEach(cy => {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', '12');
        c.setAttribute('cy', cy);
        c.setAttribute('r', '1.8');
        svg.appendChild(c);
    });
    return svg;
}

// ─── Sidebar Context Menu & Request/Folder Management (SPEC §4.7.4) ──────────
let _ctxMenu = null;

function closeContextMenu() {
    if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
}

function openContextMenu(anchor, entries) {
    closeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.setAttribute('role', 'menu');
    entries.forEach(({ label, danger, onClick }) => {
        const btn = document.createElement('button');
        btn.className = 'ctx-menu-item' + (danger ? ' danger' : '');
        btn.setAttribute('role', 'menuitem');
        btn.textContent = label;
        btn.addEventListener('click', () => { closeContextMenu(); onClick(); });
        menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${Math.max(8, Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 8))}px`;
    menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`;
    _ctxMenu = menu;
}

document.addEventListener('click', (e) => {
    if (_ctxMenu && !_ctxMenu.contains(e.target)) closeContextMenu();
});

function renameRequest(idx) {
    const item = collections[idx];
    const name = prompt('Rename request:', item.name || '');
    if (name === null) return; // NOSONAR — guard clause
    item.name = name.trim() || item.name;
    saveCollections();
    renderCollections();
}

function duplicateRequest(idx) {
    const copy = structuredClone(collections[idx]);
    copy.name = `${copy.name || 'request'} (copy)`;
    collections.splice(idx + 1, 0, copy);
    saveCollections();
    renderCollections();
}

function moveRequestToFolder(idx) {
    const item = collections[idx];
    const raw = prompt('Move to folder (use / for nesting, empty = top level):', item.folder || '');
    if (raw === null) return; // NOSONAR — guard clause
    const path = globalThis.CollectionUtils.normalizeFolderPath(raw);
    if (path) { item.folder = path; } else { delete item.folder; }
    saveCollections();
    renderCollections();
}

function deleteRequest(idx) {
    const item = collections[idx];
    if (!confirm(`Delete request "${item.name || item.url}"?`)) return;
    collections.splice(idx, 1);
    saveCollections();
    renderCollections();
}

function renameFolderPrompt(path) {
    const raw = prompt('Rename folder (use / for nesting):', path);
    if (raw === null) return; // NOSONAR — guard clause
    const newPath = globalThis.CollectionUtils.normalizeFolderPath(raw);
    if (!newPath || newPath === path) return;
    const n = globalThis.CollectionUtils.renameFolder(collections, folderAuths, path, newPath);
    saveCollections();
    renderCollections();
    showToast(`Renamed folder — ${n} request${n !== 1 ? 's' : ''} updated`, 'success');
}

function deleteFolderPrompt(path) {
    const count = globalThis.CollectionUtils.countInFolder(collections, path);
    if (!confirm(`Delete folder "${path}" and its ${count} request${count !== 1 ? 's' : ''}?`)) return;
    const res = globalThis.CollectionUtils.deleteFolder(collections, folderAuths, path);
    collections = res.items;
    saveCollections();
    renderCollections();
    showToast(`Deleted folder "${path}" (${res.removed} request${res.removed !== 1 ? 's' : ''} removed)`, 'success');
}

function createFolderElement(node) {
    const li = document.createElement('li');
    li.className = 'collection-folder';

    const header = document.createElement('div');
    header.className = 'folder-header';
    const arrowSvg = _makeSvg({ class: 'folder-arrow', width: '10', height: '10', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'aria-hidden': 'true' }, 'polyline', { points: '6 9 12 15 18 9' });
    const folderSvg = _makeSvg({ width: '12', height: '12', viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none', 'aria-hidden': 'true', style: 'color:var(--vio); opacity:0.7; flex-shrink:0;' }, 'path', { d: 'M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z' });
    const nameSpan = document.createElement('span');
    nameSpan.className = 'folder-name';
    nameSpan.textContent = node.name;
    nameSpan.title = node.path;
    const countSpan = document.createElement('span');
    countSpan.className = 'folder-count';
    countSpan.textContent = countTreeItems(node);

    const runBtn = document.createElement('button');
    runBtn.className = 'btn-icon';
    runBtn.title = 'Run folder';
    runBtn.setAttribute('aria-label', `Run folder ${node.path}`);
    runBtn.style.cssText = 'margin-left:auto; opacity:0.45;';
    runBtn.appendChild(_makeSvg({ width: '10', height: '10', viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'currentColor', 'stroke-width': '1', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, 'polygon', { points: '6 4 20 12 6 20 6 4' }));
    runBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        runCollectionItems(collectTreeItems(node), `folder "${node.path}"`);
    });

    const lockBtn = document.createElement('button');
    lockBtn.className = 'btn-icon';
    lockBtn.title = 'Configure folder auth';
    lockBtn.setAttribute('aria-label', `Configure auth for folder ${node.path}`);
    const hasAuth = folderAuths[node.path] && folderAuths[node.path].type !== 'none';
    lockBtn.style.cssText = `opacity:${hasAuth ? '1' : '0.28'}; color:${hasAuth ? 'var(--vio)' : 'inherit'};`;
    const lockNS = 'http://www.w3.org/2000/svg';
    const lockSvg = document.createElementNS(lockNS, 'svg');
    lockSvg.setAttribute('width', '10'); lockSvg.setAttribute('height', '10');
    lockSvg.setAttribute('viewBox', '0 0 24 24'); lockSvg.setAttribute('fill', 'none');
    lockSvg.setAttribute('stroke', 'currentColor'); lockSvg.setAttribute('stroke-width', '2.5');
    lockSvg.setAttribute('stroke-linecap', 'round'); lockSvg.setAttribute('aria-hidden', 'true');
    const lockRect = document.createElementNS(lockNS, 'rect');
    lockRect.setAttribute('x', '3'); lockRect.setAttribute('y', '11');
    lockRect.setAttribute('width', '18'); lockRect.setAttribute('height', '11'); lockRect.setAttribute('rx', '2');
    const lockPath = document.createElementNS(lockNS, 'path');
    lockPath.setAttribute('d', 'M7 11V7a5 5 0 0 1 10 0v4');
    lockSvg.appendChild(lockRect); lockSvg.appendChild(lockPath);
    lockBtn.appendChild(lockSvg);
    lockBtn.addEventListener('click', (e) => { e.stopPropagation(); openFolderAuthModal(node.path); });

    const moreBtn = document.createElement('button');
    moreBtn.className = 'btn-icon';
    moreBtn.title = 'Folder actions';
    moreBtn.setAttribute('aria-label', `Actions for folder ${node.path}`);
    moreBtn.setAttribute('aria-haspopup', 'menu');
    moreBtn.appendChild(_makeKebabSvg());
    moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openContextMenu(moreBtn, [
            { label: 'Rename folder', onClick: () => renameFolderPrompt(node.path) },
            { label: 'Delete folder', danger: true, onClick: () => deleteFolderPrompt(node.path) },
        ]);
    });

    header.appendChild(arrowSvg);
    header.appendChild(folderSvg);
    header.appendChild(nameSpan);
    header.appendChild(countSpan);
    header.appendChild(runBtn);
    header.appendChild(lockBtn);
    header.appendChild(moreBtn);

    const content = document.createElement('ul');
    content.className = 'folder-content sidebar-content';
    content.style.cssText = 'padding:0.2rem 0 0.2rem 0.75rem; overflow:visible;';
    node.items.forEach(({ item, idx }) => appendCollectionItem(content, item, idx));
    node.children.forEach(child => content.appendChild(createFolderElement(child)));

    let open = true;
    header.addEventListener('click', () => {
        open = !open;
        content.style.display = open ? 'block' : 'none';
        header.classList.toggle('folder-collapsed', !open);
    });

    // Drop a request onto the folder header → append it to this folder (SPEC §4.7.4)
    header.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        header.classList.add('drag-over');
    });
    header.addEventListener('dragleave', () => header.classList.remove('drag-over'));
    header.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        header.classList.remove('drag-over');
        const src = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (Number.isNaN(src)) return;
        globalThis.CollectionUtils.moveItem(collections, src, collections.length, node.path);
        saveCollections();
        renderCollections();
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

    const more = document.createElement('button');
    more.className = 'btn-icon';
    more.title = 'Request actions';
    more.setAttribute('aria-label', `Actions for ${item.name || item.url}`);
    more.setAttribute('aria-haspopup', 'menu');
    more.appendChild(_makeKebabSvg());
    more.onclick = (e) => {
        e.stopPropagation();
        openContextMenu(more, [
            { label: 'Rename', onClick: () => renameRequest(idx) },
            { label: 'Duplicate', onClick: () => duplicateRequest(idx) },
            { label: 'Move to folder…', onClick: () => moveRequestToFolder(idx) },
            { label: 'Delete', danger: true, onClick: () => deleteRequest(idx) },
        ]);
    };

    li.appendChild(badge); li.appendChild(label); li.appendChild(more);
    li.onclick = () => loadItem(item);

    // Drag to reorder / move between folders (SPEC §4.7.4). Indexes are valid
    // because the whole sidebar re-renders after every collection change.
    li.draggable = true;
    li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(idx));
        e.dataTransfer.effectAllowed = 'move';
        li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        li.classList.remove('drag-over');
        const src = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (Number.isNaN(src) || src === idx) return;
        globalThis.CollectionUtils.moveItem(collections, src, idx, item.folder);
        saveCollections();
        renderCollections();
    });

    parent.appendChild(li);
}

// ─── Load Item (restore request) ──────────────────────────────────────────────
function loadItem(item) {
    currentItemFolder = item.folder || null;
    els.method.value = item.method || 'GET';
    updateMethodColor();
    els.url.value    = item.url || '';
    if (els.proxyMode) els.proxyMode.value = item.proxyMode || 'auto';

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
    if (item.preRequestScript) preReqEditor?.setValue(item.preRequestScript);
    if (item.testsScript)       testsEditor?.setValue(item.testsScript);
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
        if (item.graphqlQuery) graphqlQueryEditor?.setValue(item.graphqlQuery);
        if (item.graphqlVars)  graphqlVarsEditor?.setValue(item.graphqlVars);
    }
}

// ─── Save to Collection ───────────────────────────────────────────────────────
els.saveBtn.addEventListener('click', () => {
    const raw = prompt('Name this request:\n(Use "folder/subfolder/Name" to save into a nested folder)');
    if (!raw) return; // NOSONAR — guard clause
    // The LAST slash separates the request name from its folder path (SPEC §4.7.4)
    const slashIdx = raw.lastIndexOf('/');
    let folder, name;
    if (slashIdx > 0 && slashIdx < raw.length - 1) {
        folder = raw.slice(0, slashIdx).split('/').map(s => s.trim()).filter(Boolean).join('/');
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

// Drop on empty sidebar space below the tree → move to top level (SPEC §4.7.4)
els.collectionsList.addEventListener('dragover', (e) => {
    if (e.target === els.collectionsList) e.preventDefault();
});
els.collectionsList.addEventListener('drop', (e) => {
    if (e.target !== els.collectionsList) return; // NOSONAR — guard clause
    e.preventDefault();
    const src = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (Number.isNaN(src)) return;
    globalThis.CollectionUtils.moveItem(collections, src, collections.length, undefined);
    saveCollections();
    renderCollections();
});

// ─── Collection Export ────────────────────────────────────────────────────────
els.btnExportCollections.addEventListener('click', () => {
    if (!collections.length) return showToast('No collections to export', 'info'); // NOSONAR — guard clause
    const blob = new Blob([JSON.stringify({ version: 1, items: collections }, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'devsuite-collections.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${collections.length} request${collections.length !== 1 ? 's' : ''}`, 'success');
});

// ─── Collection Export — git-friendly zip (SPEC §4.7.6) ──────────────────────
function sanitizeFileName(s) {
    const cleaned = String(s || '').replace(/[/\\:*?"<>|\u0000-\u001f]/g, '-').trim();
    return cleaned || 'request';
}

function _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

els.btnExportZip.addEventListener('click', async () => {
    if (!collections.length) return showToast('No collections to export', 'info'); // NOSONAR — guard clause
    if (typeof JSZip === 'undefined') return showToast('JSZip is not loaded — zip export unavailable', 'error');
    const zip = new JSZip();
    zip.file('collection.meta.json', JSON.stringify({
        format: 'devsuite-collection-zip',
        version: 1,
        exportedAt: new Date().toISOString(),
    }, null, 2));
    // Folder auth configs are intentionally NOT exported — they can contain
    // tokens/passwords and this zip is designed to be committed to git (SPEC §4.7.6).
    const used = new Set();
    collections.forEach(item => {
        const dir = String(item.folder || '').split('/').map(sanitizeFileName).filter(Boolean).join('/');
        const base = sanitizeFileName(item.name || `${item.method || 'GET'} request`);
        let path = (dir ? `${dir}/` : '') + `${base}.json`;
        let n = 2;
        while (used.has(path)) path = (dir ? `${dir}/` : '') + `${base} (${n++}).json`;
        used.add(path);
        zip.file(path, JSON.stringify(item, null, 2) + '\n');
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    _downloadBlob(blob, 'devsuite-collection.zip');
    showToast(`Exported ${collections.length} request${collections.length !== 1 ? 's' : ''} as zip`, 'success');
});

async function importCollectionsZip(file) {
    if (typeof JSZip === 'undefined') return showToast('JSZip is not loaded — zip import unavailable', 'error');
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter(f =>
        !f.dir && f.name.toLowerCase().endsWith('.json') && !f.name.endsWith('collection.meta.json'));

    const imported = [];
    let scriptCount = 0;
    for (const entry of entries) {
        let item;
        try { item = JSON.parse(await entry.async('string')); } catch { continue; }
        if (!item || typeof item !== 'object' || Array.isArray(item) || (!item.url && !item.method)) continue;
        const segments = entry.name.split('/');
        const fileName = segments.pop();
        const folder = segments.join('/');
        if (folder) item.folder = folder; else delete item.folder;
        if (!item.name) item.name = fileName.replace(/\.json$/i, '');
        if (item.preRequestScript || item.testsScript) scriptCount++;
        imported.push(item);
    }

    if (!imported.length) return showToast('No requests found in zip', 'error'); // NOSONAR — guard clause
    if (!confirm(`Import ${imported.length} request(s) from "${file.name}"?`)) return;
    if (scriptCount && !confirm(`${scriptCount} request(s) contain pre-request/test scripts.\n\nOK = Keep scripts (they only run inside the sandbox worker — no page or network access)\nCancel = Strip scripts`)) {
        imported.forEach(it => { delete it.preRequestScript; delete it.testsScript; });
    }
    if (collections.length && confirm(`Replace all ${collections.length} existing request(s)?\n\nOK = Replace all\nCancel = Merge (add to existing)`)) {
        collections = imported;
    } else {
        collections = [...collections, ...imported];
    }
    await saveCollections();
    renderCollections();
    showToast(`Imported ${imported.length} request(s) from zip`, 'success');
}

// ─── Collection Import ────────────────────────────────────────────────────────
els.btnImportCollections.addEventListener('click', () => els.importCollectionsFile.click());

els.importCollectionsFile.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        if (file.name.toLowerCase().endsWith('.zip')) {
            await importCollectionsZip(file);
            e.target.value = '';
            return;
        }
        const text = await file.text();
        const data = JSON.parse(text);

        const format = detectImportFormat(data);
        let imported, formatLabel;

        if (format === 'postman') {
            imported = parsePostmanCollection(data);
            formatLabel = `Postman — "${data.info?.name || file.name}"`;
        } else if (format === 'devsuite') {
            const raw = data.items || (Array.isArray(data) ? data : []);
            imported = raw.map(({ preRequestScript: _p, testsScript: _t, ...rest }) => rest);
            formatLabel = 'DevSuite';
        } else {
            return showToast('Unrecognized format — supported: DevSuite JSON, Postman v2.x', 'error');
        }

        if (!imported.length) return showToast('No requests found in file', 'error'); // NOSONAR — guard clause
        if (!confirm(`Import ${imported.length} request(s) from ${formatLabel}?`)) return;

        if (collections.length && confirm(`Replace all ${collections.length} existing request(s)?\n\nOK = Replace all\nCancel = Merge (add to existing)`)) {
            collections = imported;
        } else {
            collections = [...collections, ...imported];
        }
        await saveCollections();
        renderCollections();
        showToast(`Imported ${imported.length} request(s) from ${formatLabel}`, 'success');
    } catch (err) {
        showToast(`Import failed: ${err.message}`, 'error');
    }
    e.target.value = '';
});

// ─── Inherit Info ─────────────────────────────────────────────────────────────
function updateInheritInfo() {
    if (!els.authInheritStatus) return; // NOSONAR — guard clause
    if (currentItemFolder) {
        const { auth: fa, source } = resolveFolderAuth(currentItemFolder);
        if (fa.type !== 'none') {
            const labels = { bearer: 'Bearer Token', basic: 'Basic Auth', 'api-key': 'API Key' };
            els.authInheritStatus.textContent = `Will use ${labels[fa.type] || fa.type} from folder "${source}".`;
        } else {
            els.authInheritStatus.textContent = `No auth configured on "${currentItemFolder}" or any parent folder. Click the lock icon on a folder in the sidebar to set one.`;
        }
    } else {
        els.authInheritStatus.textContent = 'This request has no parent folder — inherited auth has no effect.';
    }
}

// ─── Folder Auth Modal ────────────────────────────────────────────────────────
let editingFolderName = null;

function openFolderAuthModal(folderName) {
    editingFolderName = folderName;
    els.folderAuthModalName.textContent = folderName;
    const fa = folderAuths[folderName] || { type: 'none' };
    els.folderAuthType.value = fa.type || 'none';
    els.folderAuthToken.value         = fa.token      || '';
    els.folderAuthUsername.value      = fa.username   || '';
    els.folderAuthPassword.value      = fa.password   || '';
    els.folderAuthApikeyHeader.value  = fa.headerName || '';
    els.folderAuthApikeyValue.value   = fa.headerValue || '';
    syncFolderAuthPanels(fa.type || 'none');
    els.folderAuthModal.showModal();
}

function syncFolderAuthPanels(type) {
    els.folderAuthBearerConfig.style.display = type === 'bearer'   ? 'block' : 'none';
    els.folderAuthBasicConfig.style.display  = type === 'basic'    ? 'block' : 'none';
    els.folderAuthApikeyConfig.style.display = type === 'api-key'  ? 'block' : 'none';
}

els.folderAuthType.addEventListener('change', (e) => syncFolderAuthPanels(e.target.value));

els.closeFolderAuthModal.addEventListener('click', () => els.folderAuthModal.close());
els.btnCancelFolderAuth.addEventListener('click', () => els.folderAuthModal.close());
els.folderAuthModal.addEventListener('click', (e) => { if (e.target === els.folderAuthModal) els.folderAuthModal.close(); });

els.btnSaveFolderAuth.addEventListener('click', async () => {
    if (!editingFolderName) return; // NOSONAR — guard clause
    const type = els.folderAuthType.value;
    const auth = { type };
    if (type === 'bearer')   auth.token      = els.folderAuthToken.value;
    if (type === 'basic')  { auth.username   = els.folderAuthUsername.value; auth.password = els.folderAuthPassword.value; }
    if (type === 'api-key'){ auth.headerName = els.folderAuthApikeyHeader.value; auth.headerValue = els.folderAuthApikeyValue.value; }
    folderAuths[editingFolderName] = auth;
    await saveCollections();
    renderCollections();
    if (els.authType.value === 'inherit') updateInheritInfo();
    els.folderAuthModal.close();
    showToast(`Auth saved for folder "${editingFolderName}"`, 'success');
});

// ─── Postman / Bruno Import ───────────────────────────────────────────────────
function detectImportFormat(data) {
    const schemaUrl = data.info?.schema;
    if (typeof schemaUrl === 'string') {
        try {
            const host = new URL(schemaUrl).hostname.toLowerCase();
            const allowedPostmanHosts = ['schema.getpostman.com', 'www.getpostman.com'];
            if (allowedPostmanHosts.includes(host)) return 'postman';
        } catch (_) {
            // Ignore invalid URL and continue with other format checks.
        }
    }
    if (Array.isArray(data) || data.items) return 'devsuite';
    return 'unknown';
}

function parsePostmanCollection(data) {
    const items = [];

    function processNodes(nodes, parentFolder) {
        for (const node of (nodes || [])) {
            if (Array.isArray(node.item)) {
                // Folder node — hierarchy preserved as a /-separated path (SPEC §4.7.4).
                // A / inside one Postman folder name would act as a separator, so it is replaced.
                const segment = String(node.name || 'Folder').replaceAll('/', '-');
                processNodes(node.item, parentFolder ? `${parentFolder}/${segment}` : segment);
            } else if (node.request) {
                const parsed = parsePostmanRequest(node.request);
                parsed.name = node.name || 'Unnamed';
                if (parentFolder) parsed.folder = parentFolder;
                items.push(parsed);
            }
        }
    }

    processNodes(data.item, null);
    return items;
}

/** Extract URL string and query params from a Postman request's url field. */
function _parsePostmanUrl(req) {
    if (typeof req.url === 'string') {
        const qi = req.url.indexOf('?');
        const url = qi >= 0 ? req.url.slice(0, qi) : req.url;
        const queryParams = qi >= 0
            ? [...new URLSearchParams(req.url.slice(qi + 1))].map(([key, value]) => ({ key, value, enabled: true }))
            : [];
        return { url, queryParams };
    }
    if (req.url && typeof req.url === 'object') {
        const raw = req.url.raw || '';
        const qi  = raw.indexOf('?');
        const url = qi >= 0 ? raw.slice(0, qi) : raw;
        const queryParams = (req.url.query || [])
            .filter(q => q.key != null && !q.disabled)
            .map(q => ({ key: q.key || '', value: q.value || '', enabled: true }));
        return { url, queryParams };
    }
    return { url: '', queryParams: [] };
}

/** Resolve body type and content from a Postman request body descriptor. */
function _parsePostmanBody(req) {
    if (!req.body) return { bodyType: 'none', body: null }; // NOSONAR — guard clause
    const mode = req.body.mode;
    if (mode === 'raw') {
        const lang = req.body.options?.raw?.language || 'text';
        if (lang === 'json') return { bodyType: 'json', body: req.body.raw || '{}' };
        if (lang === 'graphql') {
            try {
                const gql = JSON.parse(req.body.raw || '{}');
                return { bodyType: 'graphql', body: null, graphqlQuery: gql.query || '', graphqlVars: JSON.stringify(gql.variables || {}, null, 2) };
            } catch { // NOSONAR — fall through to text on invalid JSON
                return { bodyType: 'text', body: req.body.raw || '' };
            }
        }
        return { bodyType: 'text', body: req.body.raw || '' };
    }
    if (mode === 'urlencoded') return {
        bodyType: 'form-data',
        body: (req.body.urlencoded || []).filter(f => !f.disabled).map(f => ({ key: f.key || '', value: f.value || '', enabled: true })),
    };
    if (mode === 'formdata') return {
        bodyType: 'form-data',
        body: (req.body.formdata || []).filter(f => !f.disabled && f.type !== 'file').map(f => ({ key: f.key || '', value: f.value || '', enabled: true })),
    };
    return { bodyType: 'none', body: null };
}

/** Resolve auth config from a Postman request auth descriptor. */
function _parsePostmanAuth(req) {
    if (!req.auth) return { type: 'none' }; // NOSONAR — guard clause
    const lookup = (arr, key) => (arr || []).find(e => e.key === key)?.value || '';
    const t = req.auth.type;
    if (t === 'bearer') return { type: 'bearer', token: lookup(req.auth.bearer, 'token') };
    if (t === 'basic')  return { type: 'basic',  username: lookup(req.auth.basic,  'username'), password: lookup(req.auth.basic, 'password') };
    if (t === 'apikey') return { type: 'api-key', headerName: lookup(req.auth.apikey, 'key'),   headerValue: lookup(req.auth.apikey, 'value') };
    return { type: 'none' };
}

function parsePostmanRequest(req) {
    const { url, queryParams }               = _parsePostmanUrl(req);
    const { bodyType, body, graphqlQuery, graphqlVars } = _parsePostmanBody(req);
    const headers = (req.header || [])
        .filter(h => !h.disabled && h.key)
        .map(h => ({ key: h.key, value: h.value || '', enabled: true }));
    const auth = _parsePostmanAuth(req);

    const result = { method: (req.method || 'GET').toUpperCase(), url, queryParams, headers, auth, bodyType };
    if (body !== null) result.body = body;
    if (graphqlQuery !== undefined) { result.graphqlQuery = graphqlQuery; result.graphqlVars = graphqlVars; }
    return result;
}

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
    if (!imported.length) { // NOSONAR — guard clause
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
    const isSwagger2 = spec.swagger?.startsWith('2');
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
    const isSwagger2 = spec.swagger?.startsWith('2');
    const baseUrl = resolveBaseUrl(spec);
    const items = [];

    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
        for (const method of ['get','post','put','delete','patch','head','options']) {
            const operation = pathItem[method];
            if (!operation) continue; // NOSONAR — guard clause

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
    if (!schema) return '{}'; // NOSONAR — guard clause
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
    return {}; // object or unknown type — default to empty object
}

// ─── Cookie Jar (SPEC §4.7.5) ─────────────────────────────────────────────────
// In-memory only — never persisted to DevDB, localStorage, or disk.
const cookieJar = [];

function updateCookieCount() {
    globalThis.CookieJar.prune(cookieJar);
    if (!els.cookieCount) return; // NOSONAR — guard clause
    els.cookieCount.textContent = cookieJar.length;
    els.cookieCount.style.display = cookieJar.length ? 'inline-flex' : 'none';
}

/** Send via ApiClient with the cookie jar applied (Send button and runner both use this). */
async function executeWithJar(config) {
    const hasManualCookie = Object.keys(config.headers || {}).some(k => k.toLowerCase() === 'cookie');
    const cookieHeader = globalThis.CookieJar.headerFor(cookieJar, config.url);
    if (cookieHeader && !hasManualCookie) config.headers['Cookie'] = cookieHeader;

    const response = await globalThis.ApiClient.execute(config);

    (response.setCookies || []).forEach(sc => {
        const cookie = globalThis.CookieJar.parse(sc, config.url);
        if (cookie) globalThis.CookieJar.upsert(cookieJar, cookie);
    });
    updateCookieCount();
    return response;
}

function renderCookiesModal() {
    globalThis.CookieJar.prune(cookieJar);
    els.cookiesList.innerHTML = '';

    if (!cookieJar.length) {
        const empty = document.createElement('div');
        empty.className = 'cookies-empty';
        empty.textContent = 'No cookies captured yet. Cookies arrive via Set-Cookie headers on proxied responses.';
        els.cookiesList.appendChild(empty);
        return;
    }

    const byDomain = new Map();
    cookieJar.forEach(c => {
        if (!byDomain.has(c.domain)) byDomain.set(c.domain, []);
        byDomain.get(c.domain).push(c);
    });

    byDomain.forEach((cookies, domain) => {
        const head = document.createElement('div');
        head.className = 'cookie-domain';
        head.textContent = domain;
        els.cookiesList.appendChild(head);

        cookies.forEach(c => {
            const row = document.createElement('div');
            row.className = 'cookie-row';

            const nameVal = document.createElement('span');
            nameVal.className = 'cookie-namevalue';
            nameVal.textContent = `${c.name}=${c.value}`;
            nameVal.title = `${c.name}=${c.value}`;

            const meta = document.createElement('span');
            meta.className = 'cookie-meta';
            const expiry = c.expires === null ? 'session' : new Date(c.expires).toLocaleString();
            meta.textContent = `${c.path} · ${expiry}${c.secure ? ' · secure' : ''}`;

            const del = document.createElement('button');
            del.className = 'kv-remove';
            del.textContent = '✕';
            del.title = 'Delete cookie';
            del.setAttribute('aria-label', `Delete cookie ${c.name}`);
            del.onclick = () => {
                const i = cookieJar.indexOf(c);
                if (i >= 0) cookieJar.splice(i, 1);
                updateCookieCount();
                renderCookiesModal();
            };

            row.appendChild(nameVal);
            row.appendChild(meta);
            row.appendChild(del);
            els.cookiesList.appendChild(row);
        });
    });
}

els.btnCookies.addEventListener('click', () => { renderCookiesModal(); els.cookiesModal.showModal(); });
els.closeCookiesModal.addEventListener('click', () => els.cookiesModal.close());
els.cookiesModal.addEventListener('click', (e) => { if (e.target === els.cookiesModal) els.cookiesModal.close(); });
els.btnClearCookies.addEventListener('click', () => {
    cookieJar.length = 0;
    updateCookieCount();
    renderCookiesModal();
});

// ─── Collection Runner (SPEC §4.7.2) ─────────────────────────────────────────
let runnerActive = false;
let runnerStopRequested = false;

/** Entry arrays ([{key,value,enabled}]) or legacy objects → enabled-only plain object. */
function entriesToObj(v) {
    if (Array.isArray(v)) {
        const o = {};
        v.forEach(r => { if (r.key && r.enabled !== false) o[r.key] = r.value ?? ''; });
        return o;
    }
    return { ...(v || {}) };
}

/**
 * Build an execute-config from a saved item without touching the form —
 * mirrors buildRequestConfig/_resolveAuthConfig/_applyBodyConfig semantics.
 */
function buildConfigFromItem(item) {
    const config = {
        url:         interpolate(item.url || ''),
        method:      item.method || 'GET',
        queryParams: interpolateObj(entriesToObj(item.queryParams)),
        headers:     interpolateObj(entriesToObj(item.headers)),
        auth:        { ...(item.auth || { type: 'none' }) },
        proxyMode:   item.proxyMode || 'auto',
        bodyType:    item.bodyType || 'none',
    };
    if (config.auth.type === 'inherit') config.auth = { ...resolveFolderAuth(item.folder).auth };
    if (config.auth.type === 'bearer') config.auth.token = interpolate(config.auth.token || '');
    if (config.auth.type === 'basic') {
        config.auth.username = interpolate(config.auth.username || '');
        config.auth.password = interpolate(config.auth.password || '');
    }
    if (config.auth.type === 'api-key') {
        const h = interpolate(config.auth.headerName || '');
        const v = interpolate(config.auth.headerValue || '');
        if (h && v) config.headers[h] = v;
    }
    if (config.auth.type === 'oauth2') {
        // The runner never opens interactive prompts — reuse a cached token or run without auth.
        config.auth = oauth2Token ? { type: 'bearer', token: oauth2Token } : { type: 'none' };
    }

    if (config.bodyType === 'json') {
        config.body = interpolate(typeof item.body === 'string' ? item.body : JSON.stringify(item.body ?? {}));
    }
    if (config.bodyType === 'form-data') config.body = interpolateObj(entriesToObj(item.body));
    if (config.bodyType === 'text')      config.body = interpolate(item.body || '');
    if (config.bodyType === 'graphql') {
        let vars = {};
        try { vars = JSON.parse(item.graphqlVars || '{}'); } catch { /* ignore — empty vars */ }
        config.body = JSON.stringify({ query: item.graphqlQuery || '', variables: vars });
        config.bodyType = 'json';
        if (!config.headers['Content-Type']) config.headers['Content-Type'] = 'application/json';
    }
    return config;
}

function _createRunnerRow(item) {
    const li = document.createElement('li');
    li.className = 'runner-row';

    const badge = document.createElement('span');
    badge.className = `method-badge ${item.method || 'GET'}`;
    badge.textContent = item.method || 'GET';

    const name = document.createElement('span');
    name.className = 'runner-name';
    name.textContent = item.name || item.url;
    name.title = item.url || '';

    const tests = document.createElement('span');
    tests.className = 'runner-tests';
    tests.textContent = '';

    const status = document.createElement('span');
    status.className = 'runner-status';
    status.textContent = 'pending';

    li.appendChild(badge);
    li.appendChild(name);
    li.appendChild(tests);
    li.appendChild(status);

    return {
        li,
        setRunning() { status.textContent = 'running…'; status.className = 'runner-status running'; },
        setSkipped() { status.textContent = 'skipped'; status.className = 'runner-status skipped'; },
        setError(msg) {
            status.textContent = 'error';
            status.className = 'runner-status err';
            status.title = msg;
        },
        setDone(response, passedCount, failedCount) {
            status.textContent = `${response.status || 'ERR'} · ${response.timeMs} ms`;
            const reqOk = response.status >= 200 && response.status < 400;
            status.className = `runner-status ${reqOk && !failedCount ? 'ok' : 'err'}`;
            if (passedCount + failedCount > 0) {
                tests.textContent = `tests ${passedCount}/${passedCount + failedCount}`;
                tests.className = `runner-tests ${failedCount ? 'err' : 'ok'}`;
            }
        },
    };
}

async function _runOneItem(item, row) {
    row.setRunning();
    const preRun = await runScriptSandboxed('pre', item.preRequestScript || '');
    const preError = preRun.logs.find(l => l.type === 'error');

    const config = buildConfigFromItem(item);
    const response = await executeWithJar(config);

    const testRun = await runScriptSandboxed('test', item.testsScript || '', {
        status: response.status, statusText: response.statusText,
        headers: response.headers, body: response.body,
        bodyText: response.bodyText, timeMs: response.timeMs,
    });
    const passedCount = testRun.results.filter(r => r.passed).length;
    const failedCount = testRun.results.length - passedCount;
    row.setDone(response, passedCount, failedCount);
    // A pre-request script error doesn't cancel the request (matching single
    // Send); surface it as a tooltip without hiding the response status.
    if (preError) row.li.title = preError.text;
    return { passedCount, failedCount, requestOk: response.status > 0 };
}

async function runCollectionItems(entries, scopeLabel) {
    if (runnerActive) return showToast('A run is already in progress', 'info'); // NOSONAR — guard clause
    const runnable = entries.filter(({ item }) => item.url);
    if (!runnable.length) return showToast('No runnable requests in this scope', 'info');

    runnerActive = true;
    runnerStopRequested = false;
    runtimeVars = {}; // fresh run — but vars persist ACROSS requests for chaining (SPEC §4.7.2)

    els.runnerScope.textContent = scopeLabel;
    els.runnerList.innerHTML = '';
    els.runnerSummary.textContent = `0 of ${runnable.length}`;
    els.btnRunnerStop.style.display = '';
    if (!els.runnerModal.open) els.runnerModal.showModal();

    const rows = runnable.map(({ item }) => _createRunnerRow(item));
    rows.forEach(r => els.runnerList.appendChild(r.li));

    const t0 = performance.now();
    let done = 0;
    let testsPassed = 0;
    let testsFailed = 0;
    let requestsFailed = 0;

    for (let i = 0; i < runnable.length; i++) {
        if (runnerStopRequested) {
            rows.slice(i).forEach(r => r.setSkipped());
            break;
        }
        try {
            const r = await _runOneItem(runnable[i].item, rows[i]);
            testsPassed += r.passedCount;
            testsFailed += r.failedCount;
            if (!r.requestOk) requestsFailed++;
        } catch (e) {
            requestsFailed++;
            rows[i].setError(e.message);
        }
        done++;
        els.runnerSummary.textContent = `${done} of ${runnable.length}`;
    }

    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const parts = [`${done} of ${runnable.length} requests in ${secs}s`];
    if (testsPassed + testsFailed > 0) parts.push(`${testsPassed} tests passed${testsFailed ? `, ${testsFailed} failed` : ''}`);
    if (requestsFailed) parts.push(`${requestsFailed} request${requestsFailed !== 1 ? 's' : ''} errored`);
    els.runnerSummary.textContent = parts.join(' · ');
    els.btnRunnerStop.style.display = 'none';
    runnerActive = false;
}

els.btnRunCollection.addEventListener('click', () => {
    runCollectionItems(collectTreeItems(buildFolderTree()), 'all requests');
});
els.btnRunnerStop.addEventListener('click', () => { runnerStopRequested = true; });
els.btnRunnerClose.addEventListener('click', () => { runnerStopRequested = true; els.runnerModal.close(); });
els.closeRunnerModal.addEventListener('click', () => { runnerStopRequested = true; els.runnerModal.close(); });
els.runnerModal.addEventListener('cancel', () => { runnerStopRequested = true; });

// ─── Code Modal — cURL / fetch / HTTPie / import (SPEC §4.7.3) ───────────────
function setActiveCodeTab(kind) {
    document.querySelectorAll('.code-tab').forEach(btn => {
        const active = btn.dataset.codeKind === kind;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', String(active));
    });
    const importing = kind === 'import';
    els.codeImportWrap.style.display = importing ? 'flex' : 'none';
    els.codeOutputWrap.style.display = importing ? 'none' : 'flex';
    if (importing) return; // NOSONAR — guard clause

    let text = '';
    try {
        const config = buildRequestConfig();
        if (kind === 'curl')   text = globalThis.CurlCodegen.buildCurl(config);
        if (kind === 'fetch')  text = globalThis.CurlCodegen.buildFetch(config);
        if (kind === 'httpie') text = globalThis.CurlCodegen.buildHttpie(config);
    } catch (e) {
        text = `Could not generate snippet: ${e.message}`;
    }
    els.codeOutput.textContent = text;
}

document.querySelectorAll('.code-tab').forEach(btn => {
    btn.addEventListener('click', () => setActiveCodeTab(btn.dataset.codeKind));
});

els.btnCode.addEventListener('click', () => {
    els.codeImportStatus.textContent = '';
    setActiveCodeTab(els.url.value.trim() ? 'curl' : 'import');
    els.codeModal.showModal();
});
els.closeCodeModal.addEventListener('click', () => els.codeModal.close());
els.codeModal.addEventListener('click', (e) => { if (e.target === els.codeModal) els.codeModal.close(); });

els.btnCopyCode.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(els.codeOutput.textContent);
        showToast('Copied to clipboard', 'success');
    } catch {
        showToast('Clipboard unavailable — select and copy manually', 'error');
    }
});

els.btnCodeImport.addEventListener('click', () => {
    els.codeImportStatus.textContent = '';
    try {
        const item = globalThis.CurlCodegen.parseCurl(els.codeImportInput.value);
        loadItem(item);
        els.codeModal.close();
        els.codeImportInput.value = '';
        showToast('curl command imported into the editor', 'success');
    } catch (e) {
        els.codeImportStatus.textContent = e.message;
    }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initApp() {
    updateMethodColor();
    const guard = await AuthGuard.init('API Tester');
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
