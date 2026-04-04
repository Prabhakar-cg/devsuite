/**
 * DevSuite Shared Components  (v1.0)
 * -----------------------------------
 * Shared UI utilities reused across all DevSuite tool pages.
 * Must be loaded AFTER require.js but BEFORE any tool-specific script.
 *
 * Exposes:
 *   DevSuite.toast(msg, type?, ms?)          — show a toast notification
 *   DevSuite.initMonaco(callback)            — configure and load Monaco Editor
 */

window.DevSuite = window.DevSuite || {};

/* ─── Toast notification ──────────────────────────────────────────────────── */
DevSuite.toast = function toast(msg, type = 'info', ms = 3000) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;

    const span = document.createElement('span');
    span.textContent = msg;

    const btn = document.createElement('button');
    btn.className = 'toast-close';
    btn.textContent = '✕';
    btn.onclick = function () {
        this.parentElement.classList.add('hide');
        setTimeout(() => this.parentElement.remove(), 300);
    };

    t.appendChild(span);
    t.appendChild(btn);
    c.appendChild(t);
    setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 300); }, ms);
};

/* ─── Monaco Editor initializer ──────────────────────────────────────────── */
const _MONACO_CDN_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min';
const _MONACO_VS       = _MONACO_CDN_BASE + '/vs';

DevSuite.initMonaco = function initMonaco(callback) {
    if (typeof require === 'undefined') {
        console.error('DevSuite.initMonaco: require.js must be loaded before components.js callback');
        return;
    }
    require.config({ paths: { vs: _MONACO_VS } });
    const proxy = URL.createObjectURL(new Blob([
        `self.MonacoEnvironment = { baseUrl: '${_MONACO_CDN_BASE}/' };` +
        `importScripts('${_MONACO_VS}/base/worker/workerMain.js');`
    ], { type: 'text/javascript' }));
    window.MonacoEnvironment = { getWorkerUrl: () => proxy };
    require(['vs/editor/editor.main'], callback);
};
