/**
 * DevSuite API Tester — script sandbox worker (SPEC §4.7.1)
 *
 * Executes user-authored pre-request and test scripts in an isolated context:
 * no DOM, no cookies, no network. This file's HTTP response carries its own
 * scoped CSP (`default-src 'none'; script-src 'self' 'unsafe-eval';
 * connect-src 'none'`) — eval is legal here and nowhere else; document
 * responses carry no `unsafe-eval` (SPEC §5.10, SEC-6).
 *
 * Protocol (postMessage):
 *   in:  { kind: 'init', token }                    — sent once per worker instance
 *   in:  { id, kind: 'pre'|'test', code, codeSig, authToken, runtimeVars, envVars, response }
 *   out: { id, logs: [{type, text}], results: [{name, passed, error?}],
 *          mutations: { runtime: {…}, env: {…} } }
 *
 * `codeSig` is an HMAC-SHA256(code) under `token`, freshly signed per call by the
 * main thread (see `_signScript` in api-tester.js); `authToken` must equal the
 * token this worker instance was initialized with. Both checks exist so that a
 * co-loaded/compromised third-party script — which cannot read this worker's
 * closed-over token — cannot inject work into an already-running sandbox.
 *
 * Variable writes are recorded as mutations and applied by the main thread
 * after the script completes — the worker never touches page state directly.
 */
'use strict';

const MAX_SCRIPT_LENGTH = 50_000;
const BLOCKED_SCRIPT_PATTERNS = [
    /\bimportScripts\b/,
    /\bself\.postMessage\b/,
    /\bself\.onmessage\b/,
    /\beval\s*\(/,
    /\bFunction\s*\(/,
    /\bnew\s+Function\b/,
    /\bWebAssembly\b/,
];

function _base64ToUint8Array(base64) {
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
}

async function _importHmacKey(secret) {
    const enc = new TextEncoder();
    return crypto.subtle.importKey(
        'raw',
        enc.encode(String(secret)),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
    );
}

async function verifySignedScript(code, codeSig, secret) {
    if (typeof code !== 'string' || typeof codeSig !== 'string' || !secret) return false;
    try {
        const key = await _importHmacKey(secret);
        const enc = new TextEncoder();
        return crypto.subtle.verify(
            'HMAC',
            key,
            _base64ToUint8Array(codeSig),
            enc.encode(code),
        );
    } catch {
        return false;
    }
}

function assertSafeScriptCode(code) {
    if (typeof code !== 'string') {
        throw new Error('Script must be a string.');
    }
    if (code.length > MAX_SCRIPT_LENGTH) {
        throw new Error(`Script is too large (max ${MAX_SCRIPT_LENGTH} chars).`);
    }
    for (const pattern of BLOCKED_SCRIPT_PATTERNS) {
        if (pattern.test(code)) {
            throw new Error('Script contains disallowed constructs.');
        }
    }
    return code;
}

function buildAsyncScriptBody(code) {
    const safeCode = assertSafeScriptCode(code);
    return `return (async()=>{\n${safeCode}\n})()`;
}

function jsonSafe(v) {
    try { return JSON.stringify(v); } catch { return String(v); }
}

function makeCapturedConsole(logs) {
    const fmt = (...args) => args.map(a => (typeof a === 'object' ? jsonSafe(a) : String(a))).join(' ');
    return {
        log:   (...args) => logs.push({ type: 'log',   text: fmt(...args) }),
        warn:  (...args) => logs.push({ type: 'warn',  text: fmt(...args) }),
        error: (...args) => logs.push({ type: 'error', text: fmt(...args) }),
        info:  (...args) => logs.push({ type: 'info',  text: fmt(...args) }),
    };
}

function expect(val) {
    const assert = (pass, msg) => { if (!pass) throw new Error(msg); };
    const handlers = {
        equal:    (exp)  => assert(val === exp,                         `Expected ${jsonSafe(val)} to equal ${jsonSafe(exp)}`),
        include:  (str)  => assert(String(val).includes(String(str)),   `Expected "${val}" to include "${str}"`),
        property: (key)  => assert(val != null && key in Object(val),   `Expected object to have property "${key}"`),
        status:   (code) => assert(val?.status === code,                `Expected status ${val?.status} to equal ${code}`),
        ok:       ()     => assert(Boolean(val),                        `Expected ${jsonSafe(val)} to be truthy`),
        above:    (n)    => assert(val > n,                             `Expected ${val} to be above ${n}`),
        below:    (n)    => assert(val < n,                             `Expected ${val} to be below ${n}`),
        a:        (t)    => assert(typeof val === t,                    `Expected typeof ${typeof val} to be ${t}`),
    };
    const chain = new Proxy({}, {
        get(_, prop) { return handlers[prop] ?? chain; },
    });
    return chain;
}

function _runTestCase(results, logs, name, fn) {
    try {
        fn();
        results.push({ name, passed: true });
        logs.push({ type: 'pass', text: `✓  ${name}` });
    } catch (e) {
        results.push({ name, passed: false, error: e.message });
        logs.push({ type: 'fail', text: `✗  ${name}: ${e.message}` });
    }
}

function makeDs(runtimeVars, envVars, mutations, extra = {}) {
    return {
        setVar:    (k, v) => { runtimeVars[k] = v; mutations.runtime[k] = v; },
        getVar:    (k)    => (runtimeVars[k] !== undefined ? runtimeVars[k] : envVars[k]),
        setEnvVar: (k, v) => { envVars[k] = v; mutations.env[k] = v; },
        getEnvVar: (k)    => envVars[k],
        ...extra,
    };
}

self.onmessage = async (e) => {
    const { id, kind, code, codeSig, runtimeVars = {}, envVars = {}, response = null, authToken, token } = e.data || {};

    if (kind === 'init') {
        // One-time per-worker-instance secret (SPEC §4.7.1): scripts must be
        // HMAC-signed with this token to run, so a co-loaded/compromised
        // third-party script without the token cannot inject work here.
        self.__DS_WORKER_TOKEN = token;
        return;
    }

    const logs = [];
    const results = [];
    const mutations = { runtime: {}, env: {} };
    const consoleObj = makeCapturedConsole(logs);
    const expectedToken = self.__DS_WORKER_TOKEN;

    const isSigned = await verifySignedScript(code, codeSig, expectedToken);
    if (!isSigned) {
        logs.push({ type: 'error', text: 'Rejected unsigned or invalidly signed script.' });
        self.postMessage({ id, logs, results, mutations });
        return;
    }

    if (!expectedToken || authToken !== expectedToken) {
        logs.push({ type: 'error', text: 'Unauthorized script execution request.' });
        self.postMessage({ id, logs, results, mutations });
        return;
    }

    try {
        if (kind === 'test') {
            const ds = makeDs(runtimeVars, envVars, mutations, { response });
            const test = (name, fn) => _runTestCase(results, logs, name, fn);
            const run = new Function('ds', 'test', 'expect', 'console', buildAsyncScriptBody(code));
            await run(ds, test, expect, consoleObj);
        } else {
            const ds = makeDs(runtimeVars, envVars, mutations);
            const run = new Function('ds', 'expect', 'console', buildAsyncScriptBody(code));
            await run(ds, expect, consoleObj);
        }
    } catch (err) {
        const label = kind === 'test' ? 'Test script error' : 'Pre-request error';
        logs.push({ type: 'error', text: `${label}: ${err.message}` });
    }

    self.postMessage({ id, logs, results, mutations });
};
