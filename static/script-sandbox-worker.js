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
 *   in:  { id, kind: 'pre'|'test', code, runtimeVars, envVars, response }
 *   out: { id, logs: [{type, text}], results: [{name, passed, error?}],
 *          mutations: { runtime: {…}, env: {…} } }
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
    const { id, kind, code, runtimeVars = {}, envVars = {}, response = null, authToken } = e.data || {};
    const logs = [];
    const results = [];
    const mutations = { runtime: {}, env: {} };
    const consoleObj = makeCapturedConsole(logs);
    const expectedToken = self.__DS_WORKER_TOKEN;

    if (!expectedToken || authToken !== expectedToken) {
        logs.push({ type: 'error', text: 'Unauthorized script execution request.' });
        self.postMessage({ id, logs, results, mutations });
        return;
    }

    try {
        if (kind === 'test') {
            const ds = makeDs(runtimeVars, envVars, mutations, { response });
            const test = (name, fn) => _runTestCase(results, logs, name, fn);
            const scriptBody = buildAsyncScriptBody(code);
            // eslint-disable-next-line no-new-func
            const fn = new Function('ds', 'test', 'expect', 'console', scriptBody); // NOSONAR — the scripting sandbox itself; isolated worker, scoped CSP
            await fn(ds, test, expect, consoleObj); // NOSONAR
        } else {
            const ds = makeDs(runtimeVars, envVars, mutations);
            const scriptBody = buildAsyncScriptBody(code);
            // eslint-disable-next-line no-new-func
            const fn = new Function('ds', 'console', scriptBody); // NOSONAR — the scripting sandbox itself; isolated worker, scoped CSP
            await fn(ds, consoleObj); // NOSONAR
        }
    } catch (err) {
        const label = kind === 'test' ? 'Test script error' : 'Pre-request error';
        logs.push({ type: 'error', text: `${label}: ${err.message}` });
    }

    self.postMessage({ id, logs, results, mutations });
};
