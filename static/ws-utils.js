/**
 * DevSuite — WebSocket Tester pure helpers (feature 020).
 *
 * DOM-free, dual-export module: URL validation, subprotocol parsing, incoming
 * text/JSON formatting, log capping, and recent-endpoint list management. Loaded
 * in the browser as globalThis.WsUtils and require()-able in node for
 * tests/javascript/test_ws_utils.js.
 *
 * The live WebSocket wiring, binary-frame handling, and DOM rendering live in the
 * controller (static/ws-tester.js) — everything here is connection-independent and
 * unit-testable without a browser or a socket.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.WsUtils = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const RECENT_KEY = 'devsuite-ws-recent';
    const RECENT_CAP = 15;
    const LOG_CAP = 500;

    /**
     * Validate and normalize a WebSocket URL. Accepts only ws:// and wss://.
     * Returns { ok: true, url, secure } or { ok: false, error }.
     */
    function normalizeWsUrl(raw) {
        const value = (raw == null ? '' : String(raw)).trim();
        if (!value) {
            return { ok: false, error: 'Enter a WebSocket URL (ws:// or wss://).' };
        }
        let parsed;
        try {
            parsed = new URL(value);
        } catch (e) {
            return { ok: false, error: 'That is not a valid URL.' };
        }
        const scheme = parsed.protocol.toLowerCase();
        if (scheme !== 'ws:' && scheme !== 'wss:') {
            return { ok: false, error: 'URL must start with ws:// or wss:// (got ' + parsed.protocol + ').' };
        }
        return { ok: true, url: parsed.toString(), secure: scheme === 'wss:' };
    }

    /**
     * Parse a comma-separated subprotocol string into a clean, deduped array.
     */
    function parseProtocols(raw) {
        if (!raw) { return []; }
        const seen = new Set();
        const out = [];
        String(raw).split(',').forEach(function (p) {
            const t = p.trim();
            if (t && !seen.has(t)) { seen.add(t); out.push(t); }
        });
        return out;
    }

    /**
     * Format an incoming (or outgoing) TEXT frame. If the body parses as JSON,
     * return it pretty-printed and typed 'json'; otherwise return it verbatim
     * typed 'text'. Never throws.
     */
    function formatIncoming(data) {
        const body = data == null ? '' : String(data);
        const trimmed = body.trim();
        // Only attempt JSON when it looks like an object/array/quoted-value, to
        // avoid mis-tagging bare numbers/true as "json" noise.
        if (trimmed && /^[[{]/.test(trimmed)) {
            try {
                const parsed = JSON.parse(trimmed);
                return { type: 'json', body: JSON.stringify(parsed, null, 2) };
            } catch (e) {
                // fall through to text
            }
        }
        return { type: 'text', body: body };
    }

    /**
     * Validate a would-be JSON message for JSON-mode send. Returns
     * { ok: true, pretty } or { ok: false, error }.
     */
    function validateJson(raw) {
        try {
            const parsed = JSON.parse(String(raw));
            return { ok: true, pretty: JSON.stringify(parsed, null, 2) };
        } catch (e) {
            return { ok: false, error: 'Not valid JSON: ' + ((e && e.message) || 'parse error') };
        }
    }

    /**
     * Trim a log array to the most recent `max` entries (FIFO). Returns a new array.
     */
    function capLog(entries, max) {
        const cap = typeof max === 'number' ? max : LOG_CAP;
        const list = entries || [];
        if (list.length <= cap) { return list.slice(); }
        return list.slice(list.length - cap);
    }

    /**
     * Insert/move an endpoint to the front of the recent list, dedup by url,
     * cap to `max`. Returns a new array (most-recent-first). `entry` is
     * { url, protocols, lastUsedAt }.
     */
    function upsertRecent(list, entry, max) {
        const cap = typeof max === 'number' ? max : RECENT_CAP;
        const url = entry && entry.url;
        const rest = (list || []).filter(function (e) { return e && e.url !== url; });
        return [entry].concat(rest).slice(0, cap);
    }

    return {
        RECENT_KEY: RECENT_KEY,
        RECENT_CAP: RECENT_CAP,
        LOG_CAP: LOG_CAP,
        normalizeWsUrl: normalizeWsUrl,
        parseProtocols: parseProtocols,
        formatIncoming: formatIncoming,
        validateJson: validateJson,
        capLog: capLog,
        upsertRecent: upsertRecent,
    };
});
