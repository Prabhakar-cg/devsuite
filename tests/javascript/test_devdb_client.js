/**
 * Unit tests for devdb-client.js — DevDB fetch wrapper.
 *
 * Uses the Node.js built-in test runner (node:test) and assert module.
 * Loads devdb-client.js via vm.runInContext with a mocked `fetch` and
 * `sessionStorage` so no live server is required.
 *
 * Run: node --test tests/javascript/test_devdb_client.js   (from devsuite/ root)
 */

'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ─────────────────────────────────────────────────────────────────
// Helpers for building a controlled vm context
// ─────────────────────────────────────────────────────────────────

function makeContext({ sessionToken = '', fetchImpl = null } = {}) {
  const storage = { _data: {}, getItem: (k) => storage._data[k] ?? null };
  if (sessionToken) storage._data['devsuite_server_token'] = sessionToken;

  const domElements = [];
  const ctx = vm.createContext({
    console,
    sessionStorage: storage,
    fetch: fetchImpl ?? defaultFetch,
    document: {
      createElement: (tag) => {
        const el = { tag, href: '', download: '', click: () => {}, style: {} };
        domElements.push(el);
        return el;
      },
    },
    URL: {
      createObjectURL: () => 'blob:mock-url',
      revokeObjectURL: () => {},
    },
    setTimeout: (fn) => fn(), // run immediately for tests
    _domElements: domElements,
  });
  return ctx;
}

function defaultFetch() {
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) });
}

function loadDevDB(ctx) {
  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'static', 'devdb-client.js'),
    'utf8'
  );
  // Strip ES-module export statements — not supported in vm script mode
  const stripped = src
    .replace(/^export default DevDB;$/m, '')
    .replace(/^export \{ DevDB \};$/m, '');
  const wrapped = `(function() { 'use strict'; ${stripped}; return DevDB; })();`;
  return vm.runInContext(wrapped, ctx);
}

// ─────────────────────────────────────────────────────────────────
// getStore
// ─────────────────────────────────────────────────────────────────

describe('DevDB.getStore', () => {
  test('calls GET /api/db/store/<name>', async () => {
    const calls = [];
    const ctx = makeContext({
      fetchImpl: (url, opts) => {
        calls.push({ url, opts });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) });
      },
    });
    const DevDB = loadDevDB(ctx);

    const result = await DevDB.getStore('collections');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith('/api/db/store/collections'));
    assert.deepEqual(result, { items: [] });
  });

  test('encodes store name in URL', async () => {
    const calls = [];
    const ctx = makeContext({
      fetchImpl: (url) => {
        calls.push(url);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      },
    });
    const DevDB = loadDevDB(ctx);
    await DevDB.getStore('my store');
    assert.ok(calls[0].includes('my%20store'));
  });

  test('includes X-Session-Token header when token present', async () => {
    const calls = [];
    const ctx = makeContext({
      sessionToken: 'tok123',
      fetchImpl: (url, opts) => {
        calls.push(opts);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      },
    });
    const DevDB = loadDevDB(ctx);
    await DevDB.getStore('vault');
    assert.equal(calls[0].headers['X-Session-Token'], 'tok123');
  });

  test('omits X-Session-Token when no token in storage', async () => {
    const calls = [];
    const ctx = makeContext({
      fetchImpl: (url, opts) => {
        calls.push(opts);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      },
    });
    const DevDB = loadDevDB(ctx);
    await DevDB.getStore('vault');
    assert.ok(!calls[0].headers['X-Session-Token']);
  });

  test('throws on non-ok HTTP response', async () => {
    const ctx = makeContext({
      fetchImpl: () =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ detail: 'Not Found' }),
        }),
    });
    const DevDB = loadDevDB(ctx);
    await assert.rejects(
      () => DevDB.getStore('missing'),
      (err) => {
        assert.ok(err.message.includes('Not Found'));
        return true;
      }
    );
  });

  test('falls back to HTTP status in error when no detail field', async () => {
    const ctx = makeContext({
      fetchImpl: () =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error('not json')),
        }),
    });
    const DevDB = loadDevDB(ctx);
    await assert.rejects(
      () => DevDB.getStore('vault'),
      (err) => {
        assert.ok(err.message.includes('HTTP 500') || err.message.includes('DevDB'));
        return true;
      }
    );
  });
});

// ─────────────────────────────────────────────────────────────────
// setStore
// ─────────────────────────────────────────────────────────────────

describe('DevDB.setStore', () => {
  test('calls POST /api/db/store/<name> with JSON body', async () => {
    const calls = [];
    const ctx = makeContext({
      fetchImpl: (url, opts) => {
        calls.push({ url, opts });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'saved', store: 'collections' }) });
      },
    });
    const DevDB = loadDevDB(ctx);
    const data = { items: [{ id: 1 }] };
    const result = await DevDB.setStore('collections', data);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.method, 'POST');
    assert.equal(calls[0].opts.body, JSON.stringify(data));
    assert.deepEqual(result, { status: 'saved', store: 'collections' });
  });

  test('sends Content-Type: application/json', async () => {
    const calls = [];
    const ctx = makeContext({
      fetchImpl: (url, opts) => {
        calls.push(opts);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      },
    });
    const DevDB = loadDevDB(ctx);
    await DevDB.setStore('ssh_profiles', {});
    assert.equal(calls[0].headers['Content-Type'], 'application/json');
  });

  test('throws on non-ok response', async () => {
    const ctx = makeContext({
      fetchImpl: () =>
        Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ detail: 'Forbidden' }),
        }),
    });
    const DevDB = loadDevDB(ctx);
    await assert.rejects(() => DevDB.setStore('vault', {}), /Forbidden/);
  });

  test('encodes special characters in store name', async () => {
    const calls = [];
    const ctx = makeContext({
      fetchImpl: (url) => {
        calls.push(url);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      },
    });
    const DevDB = loadDevDB(ctx);
    await DevDB.setStore('my/store', {});
    assert.ok(calls[0].includes('my%2Fstore'));
  });
});

// ─────────────────────────────────────────────────────────────────
// getMeta
// ─────────────────────────────────────────────────────────────────

describe('DevDB.getMeta', () => {
  test('calls GET /api/db/meta', async () => {
    const calls = [];
    const mockMeta = { path: '~/.devsuite/devdb.dsb', size: 1024, stores: ['vault', 'collections'] };
    const ctx = makeContext({
      fetchImpl: (url) => {
        calls.push(url);
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMeta) });
      },
    });
    const DevDB = loadDevDB(ctx);
    const result = await DevDB.getMeta();

    assert.ok(calls[0].endsWith('/api/db/meta'));
    assert.deepEqual(result, mockMeta);
  });

  test('propagates error on failure', async () => {
    const ctx = makeContext({
      fetchImpl: () =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: 'Unauthorized' }),
        }),
    });
    const DevDB = loadDevDB(ctx);
    await assert.rejects(() => DevDB.getMeta(), /Unauthorized/);
  });
});

// ─────────────────────────────────────────────────────────────────
// exportDatabase
// ─────────────────────────────────────────────────────────────────

describe('DevDB.exportDatabase', () => {
  test('fetches /api/db/export and triggers download', async () => {
    const calls = [];
    const ctx = makeContext({
      fetchImpl: (url) => {
        calls.push(url);
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Uint8Array([1, 2, 3])),
        });
      },
    });
    const DevDB = loadDevDB(ctx);
    await DevDB.exportDatabase();

    assert.ok(calls[0].endsWith('/api/db/export'));
  });

  test('includes session token header when present', async () => {
    const calls = [];
    const ctx = makeContext({
      sessionToken: 'export-token',
      fetchImpl: (url, opts) => {
        calls.push(opts);
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Uint8Array()),
        });
      },
    });
    const DevDB = loadDevDB(ctx);
    await DevDB.exportDatabase();
    assert.equal(calls[0].headers['X-Session-Token'], 'export-token');
  });

  test('throws on non-ok export response', async () => {
    const ctx = makeContext({
      fetchImpl: () =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ detail: 'Export failed' }),
        }),
    });
    const DevDB = loadDevDB(ctx);
    await assert.rejects(() => DevDB.exportDatabase(), /Export failed/);
  });
});

// ─────────────────────────────────────────────────────────────────
// importDatabase
// ─────────────────────────────────────────────────────────────────

describe('DevDB.importDatabase', () => {
  test('posts to /api/db/import', async () => {
    const calls = [];
    const ctx = makeContext({
      fetchImpl: (url, opts) => {
        calls.push({ url, opts });
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'imported', imported_stores: ['vault'] }),
        });
      },
    });
    // Polyfill FormData for vm context
    const { FormData } = require('node:buffer') ?? {};
    ctx.FormData = globalThis.FormData ?? class FakeFormData {
      constructor() { this._entries = []; }
      append(k, v) { this._entries.push([k, v]); }
    };

    const DevDB = loadDevDB(ctx);
    const fakeFile = { name: 'backup.dsb', type: 'application/octet-stream' };
    const result = await DevDB.importDatabase(fakeFile);

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith('/api/db/import'));
    assert.equal(calls[0].opts.method, 'POST');
    assert.deepEqual(result, { status: 'imported', imported_stores: ['vault'] });
  });

  test('throws on non-ok import response', async () => {
    const ctx = makeContext({
      fetchImpl: () =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ detail: 'Invalid file format' }),
        }),
    });
    ctx.FormData = class FakeFormData {
      constructor() {}
      append() {}
    };
    const DevDB = loadDevDB(ctx);
    await assert.rejects(
      () => DevDB.importDatabase({ name: 'bad.txt' }),
      /Invalid file format/
    );
  });
});
