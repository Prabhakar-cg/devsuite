/**
 * DevSuite — WebSocket Tester DOM controller (feature 020).
 *
 * Owns the live native WebSocket, connect/disconnect/send wiring, the bounded
 * message log, and localStorage recent-endpoints. Connection-independent logic
 * (URL validation, protocol parsing, JSON formatting, log/recent management)
 * lives in the pure WsUtils module (static/ws-utils.js).
 *
 * All message bodies and event text are inserted via createElement + textContent
 * — never innerHTML with connection-derived content (constitution Art. V, FR-018).
 */
(function () {
    'use strict';

    const WsUtils = globalThis.WsUtils;
    const toast = (globalThis.DevSuite && globalThis.DevSuite.toast)
        ? globalThis.DevSuite.toast
        : function () {};

    const LOG_CAP = WsUtils.LOG_CAP;
    const RECENT_KEY = WsUtils.RECENT_KEY;
    const PREVIEW_BYTES = 32;

    // ── State ──
    let ws = null;
    let logEntries = [];

    // ── Elements ──
    const urlEl = document.getElementById('wst-url');
    const protoEl = document.getElementById('wst-proto');
    const connectBtn = document.getElementById('wst-connect');
    const disconnectBtn = document.getElementById('wst-disconnect');
    const urlErrEl = document.getElementById('wst-url-error');
    const statusPill = document.getElementById('wst-status');
    const statusText = document.getElementById('wst-status-text');
    const negoEl = document.getElementById('wst-nego');
    const listEl = document.getElementById('wst-log-list');
    let emptyEl = document.getElementById('wst-empty');
    const clearLogBtn = document.getElementById('wst-clear-log');
    const msgEl = document.getElementById('wst-msg');
    const jsonModeEl = document.getElementById('wst-jsonmode');
    const sendBtn = document.getElementById('wst-send');
    const recentWrap = document.getElementById('wst-recent');
    const recentListEl = document.getElementById('wst-recent-list');
    const recentClearBtn = document.getElementById('wst-recent-clear');
    const insecureWarnEl = document.getElementById('wst-insecure-warning');

    // ── Status ──
    function setStatus(kind, text) {
        // map connection states to the shared status-pill visual classes
        const cls = { open: 'valid', connecting: 'loading', closing: 'loading',
                      closed: 'idle', error: 'invalid', idle: 'idle' }[kind] || 'idle';
        statusPill.className = 'status-pill ' + cls;
        statusText.textContent = text;
    }

    function setConnectedUi(connected) {
        connectBtn.disabled = connected;
        disconnectBtn.disabled = !connected;
        sendBtn.disabled = !connected;
    }

    // ── URL validation feedback ──
    function showUrlError(msg) { urlErrEl.textContent = msg; urlErrEl.classList.add('visible'); }
    function clearUrlError() { urlErrEl.textContent = ''; urlErrEl.classList.remove('visible'); }

    // ── Log rendering ──
    function timeLabel(ts) {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour12: false }) + '.' +
            String(d.getMilliseconds()).padStart(3, '0');
    }

    function pushEntry(entry) {
        logEntries.push(entry);
        if (logEntries.length > LOG_CAP) {
            logEntries = WsUtils.capLog(logEntries, LOG_CAP);
        }
        renderEntry(entry);
        // drop the oldest rendered node(s) to match, after the new row is appended
        while (listEl.children.length > LOG_CAP) {
            listEl.removeChild(listEl.firstChild);
        }
    }

    function renderEntry(entry) {
        if (emptyEl) { emptyEl.remove(); emptyEl = null; }

        const row = document.createElement('div');
        row.className = 'wst-entry';

        const ts = document.createElement('span');
        ts.className = 'wst-entry-ts';
        ts.textContent = timeLabel(entry.ts);

        const dir = document.createElement('span');
        const dirClass = entry.kind === 'sent' ? 'wst-dir-sent'
            : entry.kind === 'received' ? 'wst-dir-received'
            : entry.payload === 'error' ? 'wst-dir-error' : 'wst-dir-event';
        dir.className = 'wst-entry-dir ' + dirClass;
        dir.textContent = entry.kind === 'sent' ? 'sent'
            : entry.kind === 'received' ? 'recv' : 'evt';

        const body = document.createElement('pre');
        body.className = 'wst-entry-body';
        body.textContent = entry.body;

        // capture BEFORE appending — appending grows scrollHeight and would
        // otherwise make a user who was at the bottom look "not near bottom"
        const nearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 60;

        row.appendChild(ts);
        row.appendChild(dir);
        row.appendChild(body);
        listEl.appendChild(row);

        // auto-scroll to newest unless the user has scrolled up
        if (nearBottom) { listEl.scrollTop = listEl.scrollHeight; }
    }

    function logEvent(text, isError) {
        pushEntry({ ts: Date.now(), kind: 'event', payload: isError ? 'error' : 'lifecycle', body: text });
    }

    // ── Binary rendering ──
    function describeBinary(buf) {
        const bytes = new Uint8Array(buf);
        const n = bytes.length;
        const slice = bytes.subarray(0, PREVIEW_BYTES);
        let hex = '';
        for (let i = 0; i < slice.length; i++) {
            hex += slice[i].toString(16).padStart(2, '0') + ' ';
        }
        let text = '';
        try {
            text = new TextDecoder('utf-8', { fatal: false }).decode(slice);
        } catch (e) { text = ''; }
        const more = n > PREVIEW_BYTES ? ' …' : '';
        return 'binary (' + n + ' bytes)\nhex: ' + hex.trim() + more +
            (text ? '\ntext: ' + text + more : '');
    }

    // ── Connect / disconnect ──
    function connect() {
        const parsed = WsUtils.normalizeWsUrl(urlEl.value);
        if (!parsed.ok) {
            showUrlError(parsed.error);
            return;
        }
        clearUrlError();
        if (insecureWarnEl) insecureWarnEl.classList.toggle('visible', !parsed.secure);

        // FR-006: never hold two live sockets. Detach the old socket's handlers
        // before closing it so a late event from it can't mutate shared state
        // out from under the socket we're about to open.
        if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
            ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
            try { ws.close(1000, 'reconnecting'); } catch (e) { /* ignore */ }
            ws = null;
        }

        const protocols = WsUtils.parseProtocols(protoEl.value);
        negoEl.hidden = true;

        let socket;
        try {
            socket = protocols.length ? new WebSocket(parsed.url, protocols) : new WebSocket(parsed.url);
        } catch (e) {
            showUrlError((e && e.message) || 'Failed to open connection.');
            return;
        }
        ws = socket;
        socket.binaryType = 'arraybuffer';

        setStatus('connecting', 'Connecting');
        setConnectedUi(true); // disable connect while attempting; disconnect enabled to allow abort
        logEvent('Connecting to ' + parsed.url +
            (protocols.length ? ' [' + protocols.join(', ') + ']' : ''));

        // Each handler checks `ws === socket` — belt-and-suspenders against a stale
        // event from a socket that a newer connect() has already superseded.
        socket.onopen = function () {
            if (ws !== socket) return;
            setStatus('open', 'Open');
            logEvent('Connection open');
            if (socket.protocol) {
                negoEl.hidden = false;
                negoEl.textContent = 'Negotiated subprotocol: ' + socket.protocol;
            }
            saveRecent(parsed.url, protocols);
        };

        socket.onmessage = function (ev) {
            if (ws !== socket) return;
            if (typeof ev.data === 'string') {
                const f = WsUtils.formatIncoming(ev.data);
                pushEntry({ ts: Date.now(), kind: 'received', payload: f.type, body: f.body });
            } else if (ev.data instanceof ArrayBuffer) {
                pushEntry({ ts: Date.now(), kind: 'received', payload: 'binary', body: describeBinary(ev.data) });
            } else {
                // Blob fallback (binaryType should be arraybuffer, but be safe)
                pushEntry({ ts: Date.now(), kind: 'received', payload: 'binary', body: 'binary frame received' });
            }
        };

        socket.onerror = function () {
            if (ws !== socket) return;
            // The WebSocket error event carries no detail by spec; the close event
            // that follows usually has the code/reason. Log a generic error entry.
            logEvent('Connection error (see the following close event / browser console for detail)', true);
        };

        socket.onclose = function (ev) {
            if (ws !== socket) return;
            const reason = ev.reason ? (' — ' + ev.reason) : '';
            logEvent('Connection closed (code ' + ev.code + (ev.wasClean ? ', clean' : ', unclean') + ')' + reason,
                !ev.wasClean);
            setStatus('closed', 'Closed');
            setConnectedUi(false);
            ws = null;
        };
    }

    function disconnect() {
        if (ws) {
            setStatus('closing', 'Closing');
            try { ws.close(1000, 'client disconnect'); } catch (e) { /* ignore */ }
        }
    }

    // ── Send ──
    function send() {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            toast('Not connected — open a connection before sending.', 'warning');
            return;
        }
        const payload = msgEl.value;
        let logBody = payload;
        let type = 'text';
        if (jsonModeEl.checked) {
            const v = WsUtils.validateJson(payload);
            if (!v.ok) { toast(v.error, 'error'); return; }
            logBody = v.pretty; // pretty-print for the log only — the wire payload stays verbatim
            type = 'json';
        }
        try {
            ws.send(payload);
        } catch (e) {
            toast('Send failed: ' + ((e && e.message) || 'unknown error'), 'error');
            return;
        }
        pushEntry({ ts: Date.now(), kind: 'sent', payload: type, body: logBody });
    }

    // ── Clear log ──
    function clearLog() {
        logEntries = [];
        listEl.textContent = '';
        emptyEl = document.createElement('div');
        emptyEl.className = 'wst-empty';
        emptyEl.id = 'wst-empty';
        const span = document.createElement('span');
        span.textContent = 'Log cleared. Send or receive a message to populate it again.';
        emptyEl.appendChild(span);
        listEl.appendChild(emptyEl);
    }

    // ── Recent endpoints (localStorage) ──
    function loadRecent() {
        try {
            const raw = localStorage.getItem(RECENT_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function saveRecent(url, protocols) {
        const list = WsUtils.upsertRecent(loadRecent(),
            { url: url, protocols: protocols, lastUsedAt: Date.now() }, WsUtils.RECENT_CAP);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
        renderRecent();
    }

    function renderRecent() {
        const list = loadRecent();
        recentListEl.textContent = '';
        if (!list.length) { recentWrap.hidden = true; return; }
        recentWrap.hidden = false;
        list.forEach(function (item) {
            const chip = document.createElement('button');
            chip.className = 'wst-recent-chip';
            chip.type = 'button';
            const label = item.url + (item.protocols && item.protocols.length ? ' [' + item.protocols.join(', ') + ']' : '');
            chip.textContent = label;
            chip.title = label;
            chip.addEventListener('click', function () {
                urlEl.value = item.url;
                protoEl.value = (item.protocols || []).join(', ');
                clearUrlError();
            });
            recentListEl.appendChild(chip);
        });
    }

    function clearRecent() {
        try { localStorage.removeItem(RECENT_KEY); } catch (e) { /* ignore */ }
        renderRecent();
    }

    // ── Wire up ──
    connectBtn.addEventListener('click', connect);
    disconnectBtn.addEventListener('click', disconnect);
    sendBtn.addEventListener('click', send);
    clearLogBtn.addEventListener('click', clearLog);
    recentClearBtn.addEventListener('click', clearRecent);
    urlEl.addEventListener('input', clearUrlError);
    urlEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { connect(); } });
    msgEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
    });

    setStatus('idle', 'Disconnected');
    renderRecent();
})();
