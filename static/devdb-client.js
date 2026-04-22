/**
 * devdb-client.js — DevSuite Unified DB Client
 * ─────────────────────────────────────────────
 * Thin fetch wrapper around the /api/db/* endpoints.
 * Any DevSuite tool can use this to read/write named stores.
 *
 * Usage:
 *   import DevDB from '/static/devdb-client.js';
 *   const store = await DevDB.getStore('collections');
 *   await DevDB.setStore('collections', updatedStore);
 */

'use strict';

const DevDB = (() => {

    // ── CSRF token (readable ds_csrf cookie set by server after unlock) ───────
    function _csrfToken() {
        const m = document.cookie.match(/(?:^|;\s*)ds_csrf=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : '';
    }

    // ── Internal fetch helper ────────────────────────────────────────────────
    async function _apiFetch(url, opts = {}) {
        const csrf = _csrfToken();
        const res = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
                ...opts.headers,
            },
            ...opts,
        });
        if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try { const j = await res.json(); detail = j.detail || detail; } catch (_) {} // NOSONAR — intentional: JSON body is optional, HTTP status is the authoritative error
            throw new Error(`DevDB: ${detail}`);
        }
        return res.json();
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Read the named store from DevDB.
     * @param {string} name  Store name (vault | collections | ssh_profiles | url_db | app_prefs)
     * @returns {Promise<object>}
     */
    async function getStore(name) {
        return _apiFetch(`/api/db/store/${encodeURIComponent(name)}`);
    }

    /**
     * Write (replace) the named store in DevDB.
     * @param {string} name   Store name
     * @param {object} data   JSON-serialisable object
     * @returns {Promise<{status: string, store: string}>}
     */
    async function setStore(name, data) {
        return _apiFetch(`/api/db/store/${encodeURIComponent(name)}`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Fetch database metadata (path, size, stores, encryption status).
     * @returns {Promise<object>}
     */
    async function getMeta() {
        return _apiFetch('/api/db/meta');
    }

    /**
     * Trigger a .dsb file download (browser saves the export).
     */
    async function exportDatabase() {
        const csrf = _csrfToken();
        const res = await fetch('/api/db/export', {
            headers: csrf ? { 'X-CSRF-Token': csrf } : {},
        });
        if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try { const j = await res.json(); detail = j.detail || detail; } catch (err) { console.error(err); }
            throw new Error(`DevDB export: ${detail}`);
        }
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = `devdb-${new Date().toISOString().slice(0,10)}.dsb`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    }

    /**
     * Import a .dsb file by posting it to the server.
     * @param {File} file   A File object from an <input type="file">
     * @returns {Promise<{status: string, imported_stores: string[]}>}
     */
    async function importDatabase(file) {
        const form = new FormData();
        form.append('file', file);
        const csrf = _csrfToken();
        const res = await fetch('/api/db/import', {
            method: 'POST',
            body: form,
            headers: csrf ? { 'X-CSRF-Token': csrf } : {},
        });
        if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try { const j = await res.json(); detail = j.detail || detail; } catch (_) {} // NOSONAR — intentional: JSON body is optional, HTTP status is the authoritative error
            throw new Error(`DevDB import: ${detail}`);
        }
        return res.json();
    }

    return { getStore, setStore, getMeta, exportDatabase, importDatabase };
})();

export default DevDB;
export { DevDB };
