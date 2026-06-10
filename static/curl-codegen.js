/**
 * DevSuite API Tester — cURL import & code generation (SPEC §4.7.3)
 *
 * Pure module: no DOM access, no state.
 *  - parseCurl(cmd)  → request item shape used by loadItem() in api-tester.js
 *                      ({method, url, queryParams/headers as entry arrays,
 *                        auth, bodyType, body}).
 *  - buildCurl / buildFetch / buildHttpie(config)
 *                    → snippets from the *resolved* execute-config shape
 *                      ({url, method, queryParams/headers as objects, auth,
 *                        bodyType, body}) produced by buildRequestConfig().
 *
 * Loaded in the browser as globalThis.CurlCodegen; require()-able in node for
 * the unit suite in tests/javascript/.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.CurlCodegen = api; }
})(globalThis, function () {
    'use strict';

    // ─── Tokenizer ────────────────────────────────────────────────────────────

    const ANSI_C_ESCAPES = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"' };

    /**
     * Shell-style tokenizer: handles '…' (no escapes, POSIX), "…" (with \" \\
     * \$ \` escapes), $'…' (ANSI-C escapes), and \ / ` / ^ line continuations.
     */
    function tokenize(cmd) {
        const text = String(cmd || '')
            .replace(/\\\r?\n/g, ' ')   // POSIX line continuations
            .replace(/`\r?\n/g, ' ')    // PowerShell backtick continuations
            .replace(/\^\r?\n/g, ' ');  // cmd.exe caret continuations
        const tokens = [];
        let i = 0;
        const n = text.length;
        while (i < n) {
            while (i < n && /\s/.test(text[i])) i++;
            if (i >= n) break;
            let tok = '';
            while (i < n && !/\s/.test(text[i])) {
                const ch = text[i];
                if (ch === "'") {
                    const ansiC = tok.endsWith('$');
                    if (ansiC) tok = tok.slice(0, -1);
                    i++;
                    while (i < n && text[i] !== "'") {
                        if (ansiC && text[i] === '\\' && i + 1 < n) {
                            tok += ANSI_C_ESCAPES[text[i + 1]] ?? text[i + 1];
                            i += 2;
                        } else {
                            tok += text[i];
                            i++;
                        }
                    }
                    i++; // closing quote
                } else if (ch === '"') {
                    i++;
                    while (i < n && text[i] !== '"') {
                        if (text[i] === '\\' && i + 1 < n && '"\\$`'.includes(text[i + 1])) {
                            tok += text[i + 1];
                            i += 2;
                        } else {
                            tok += text[i];
                            i++;
                        }
                    }
                    i++; // closing quote
                } else if (ch === '\\' && i + 1 < n) {
                    tok += text[i + 1];
                    i += 2;
                } else {
                    tok += ch;
                    i++;
                }
            }
            tokens.push(tok);
        }
        return tokens;
    }

    // ─── cURL → request item ──────────────────────────────────────────────────

    const HEADER_FLAGS = new Set(['-H', '--header']);
    const DATA_FLAGS = new Set(['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode']);
    // Flags that consume a value we deliberately ignore.
    const IGNORED_VALUE_FLAGS = new Set([
        '-o', '--output', '-m', '--max-time', '--connect-timeout', '--retry',
        '-w', '--write-out', '--cacert', '--capath', '--cert', '--key',
        '-c', '--cookie-jar', '-x', '--proxy', '--ciphers', '--limit-rate',
        '--max-redirs', '--resolve', '--dns-servers',
    ]);

    function looksLikeJson(s) {
        const t = String(s).trim();
        return t.startsWith('{') || t.startsWith('[');
    }

    function _applyDataParts(cfg, dataParts, useGet) {
        if (!dataParts.length) return;
        const joined = dataParts.join('&');
        if (useGet) {
            for (const [k, v] of new URLSearchParams(joined)) {
                cfg.queryParams.push({ key: k, value: v, enabled: true });
            }
            cfg.method = cfg.method || 'GET';
            return;
        }
        const ct = cfg.headers.find(h => h.key.toLowerCase() === 'content-type');
        const isJson = ct ? ct.value.toLowerCase().includes('json') : looksLikeJson(joined);
        cfg.bodyType = isJson ? 'json' : 'text';
        cfg.body = dataParts.length === 1 ? dataParts[0] : joined;
        cfg.method = cfg.method || 'POST';
    }

    /**
     * Parse a curl command line into the request-item shape consumed by
     * loadItem(). Unsupported flags are ignored. Throws on no URL / not curl.
     */
    function parseCurl(cmd) {
        const tokens = tokenize(cmd);
        if (!tokens.length || !/^curl(\.exe)?$/i.test(tokens[0])) {
            throw new Error('Not a curl command — it should start with "curl"');
        }
        const cfg = {
            method: null, url: '', queryParams: [], headers: [],
            auth: { type: 'none' }, bodyType: 'none', body: null,
        };
        const dataParts = [];
        const formEntries = [];
        let useGet = false;

        for (let i = 1; i < tokens.length; i++) {
            const t = tokens[i];
            const next = () => tokens[++i] ?? '';
            if (t === '-X' || t === '--request') {
                cfg.method = next().toUpperCase();
            } else if (HEADER_FLAGS.has(t)) {
                const h = next();
                const ci = h.indexOf(':');
                if (ci > 0) cfg.headers.push({ key: h.slice(0, ci).trim(), value: h.slice(ci + 1).trim(), enabled: true });
            } else if (DATA_FLAGS.has(t)) {
                dataParts.push(next());
            } else if (t === '-F' || t === '--form') {
                const f = next();
                const eq = f.indexOf('=');
                if (eq > 0) formEntries.push({ key: f.slice(0, eq), value: f.slice(eq + 1).replace(/^[@<]/, ''), enabled: true });
            } else if (t === '-u' || t === '--user') {
                const u = next();
                const ci = u.indexOf(':');
                cfg.auth = {
                    type: 'basic',
                    username: ci >= 0 ? u.slice(0, ci) : u,
                    password: ci >= 0 ? u.slice(ci + 1) : '',
                };
            } else if (t === '-b' || t === '--cookie') {
                const v = next();
                // -b with a k=v string is an inline cookie; -b file.txt (no '=') is a cookie file — ignored.
                if (v.includes('=')) cfg.headers.push({ key: 'Cookie', value: v, enabled: true });
            } else if (t === '-A' || t === '--user-agent') {
                cfg.headers.push({ key: 'User-Agent', value: next(), enabled: true });
            } else if (t === '-e' || t === '--referer') {
                cfg.headers.push({ key: 'Referer', value: next(), enabled: true });
            } else if (t === '--url') {
                cfg.url = next();
            } else if (t === '-G' || t === '--get') {
                useGet = true;
            } else if (t === '-I' || t === '--head') {
                cfg.method = 'HEAD';
            } else if (IGNORED_VALUE_FLAGS.has(t)) {
                i++; // skip the flag's value
            } else if (t.startsWith('-') && t !== '-') {
                // unknown / boolean flag (-L, -s, -k, --compressed, --flag=value, …) — ignored
            } else if (!cfg.url) {
                cfg.url = t;
            }
        }

        if (formEntries.length) {
            cfg.bodyType = 'form-data';
            cfg.body = formEntries;
            cfg.method = cfg.method || 'POST';
        } else {
            _applyDataParts(cfg, dataParts, useGet);
        }
        cfg.method = cfg.method || 'GET';

        const qi = cfg.url.indexOf('?');
        if (qi >= 0) {
            for (const [k, v] of new URLSearchParams(cfg.url.slice(qi + 1))) {
                cfg.queryParams.push({ key: k, value: v, enabled: true });
            }
            cfg.url = cfg.url.slice(0, qi);
        }
        if (!cfg.url) throw new Error('No URL found in curl command');
        return cfg;
    }

    // ─── Resolved config → snippets ───────────────────────────────────────────

    function _hasHeader(headers, name) {
        return Object.keys(headers).some(k => k.toLowerCase() === name.toLowerCase());
    }

    function _b64(str) {
        const bytes = new TextEncoder().encode(str);
        let bin = '';
        for (const b of bytes) bin += String.fromCodePoint(b);
        return btoa(bin);
    }

    /**
     * Mirror ApiClient: merge auth into headers, append query params, derive
     * the body string. Body is omitted for GET/DELETE/HEAD and bodyType none,
     * exactly like ApiClient.buildBody.
     */
    function finalize(config) {
        const method = (config.method || 'GET').toUpperCase();
        const headers = { ...(config.headers || {}) };
        const auth = config.auth || { type: 'none' };
        if (auth.type === 'bearer' && auth.token) {
            headers['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth.type === 'basic' && auth.username) {
            headers['Authorization'] = `Basic ${_b64(`${auth.username}:${auth.password || ''}`)}`;
        }

        let url = config.url || '';
        const params = Object.entries(config.queryParams || {}).filter(([k]) => k);
        if (params.length) {
            const qs = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
            url += (url.includes('?') ? '&' : '?') + qs;
        }

        let body = null;
        const skipBody = !config.body || config.bodyType === 'none'
            || method === 'GET' || method === 'DELETE' || method === 'HEAD';
        if (!skipBody) {
            if (config.bodyType === 'form-data') {
                body = Object.entries(config.body)
                    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
                if (!_hasHeader(headers, 'content-type')) headers['Content-Type'] = 'application/x-www-form-urlencoded';
            } else {
                body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
                if (config.bodyType === 'json' && !_hasHeader(headers, 'content-type')) headers['Content-Type'] = 'application/json';
            }
        }
        return { url, method, headers, body };
    }

    function shellQuote(s) {
        return `'${String(s).replaceAll("'", "'\\''")}'`;
    }

    function buildCurl(config) {
        const { url, method, headers, body } = finalize(config);
        const lines = [`curl -X ${method} ${shellQuote(url)}`];
        for (const [k, v] of Object.entries(headers)) lines.push(`  -H ${shellQuote(`${k}: ${v}`)}`);
        if (body !== null) lines.push(`  -d ${shellQuote(body)}`);
        return lines.join(' \\\n');
    }

    function buildFetch(config) {
        const { url, method, headers, body } = finalize(config);
        const opts = { method };
        if (Object.keys(headers).length) opts.headers = headers;
        if (body !== null) opts.body = body;
        return `fetch(${JSON.stringify(url)}, ${JSON.stringify(opts, null, 2)});`;
    }

    function buildHttpie(config) {
        const { url, method, headers, body } = finalize(config);
        const parts = ['http', method, shellQuote(url)];
        for (const [k, v] of Object.entries(headers)) parts.push(shellQuote(`${k}:${v}`));
        const cmd = parts.join(' ');
        // HTTPie sends raw bodies via stdin — the only form that keeps any content-type.
        return body !== null ? `echo ${shellQuote(body)} | ${cmd}` : cmd;
    }

    return { tokenize, parseCurl, finalize, buildCurl, buildFetch, buildHttpie, shellQuote };
});
