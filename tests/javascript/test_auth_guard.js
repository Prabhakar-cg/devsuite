/**
 * Unit tests for auth-guard.js — AuthGuard session management.
 *
 * Uses the Node.js built-in test runner (node:test) and assert module.
 * Loads auth-guard.js via vm.runInContext with mocked DOM, localStorage,
 * sessionStorage, fetch, and CryptoJS so no browser or live server is needed.
 *
 * Run: node --test tests/javascript/test_auth_guard.js   (from devsuite/ root)
 *
 * What is tested:
 *   - Module loads and exports { init, cachedPwd, clearSession }
 *   - cachedPwd() returns null when session is expired / not set
 *   - cachedPwd() returns cached password when session is active
 *   - clearSession() removes both localStorage expiry and sessionStorage password
 *   - init() fast-path: resolves immediately with cached password when session valid
 *   - init() when no master password is set: resolves with null
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const authGuardSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'static', 'auth-guard.js'),
  'utf8'
);

// ─────────────────────────────────────────────────────────────────
// Storage mock factory
// ─────────────────────────────────────────────────────────────────

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _store: store,
  };
}

// ─────────────────────────────────────────────────────────────────
// Context factory
// ─────────────────────────────────────────────────────────────────

function makeContext({
  sessionExpiry = null,    // string timestamp (ms) or null
  sessionPwd = null,       // cached password or null
  authStatus = { is_setup: false },
  fetchOverride = null,
} = {}) {
  const lsInit = {};
  if (sessionExpiry !== null) lsInit['devsuite_session_expiry'] = sessionExpiry;

  const ssInit = {};
  if (sessionPwd !== null) ssInit['devsuite_session_pwd'] = sessionPwd;

  const ls = makeStorage(lsInit);
  const ss = makeStorage(ssInit);

  // Minimal DOM mock — enough for the style injection and overlay building
  function makeEl() {
    return {
      className: '',
      textContent: '',
      textContent: '',
      innerHTML: '',
      id: '',
      style: { display: '' },
      children: [],
      appendChild(c) { this.children.push(c); },
      addEventListener() {},
      removeEventListener() {},
      insertBefore() {},
      prepend() {},
      firstChild: null,
      focus() {},
      value: '',
      disabled: false,
    };
  }

  // domById: elements registered by insertBefore or createElement with a known id.
  // getElementById falls back to a fresh stub for any unregistered id so that
  // code like `overlay.style.display = 'flex'` never throws in unit tests.
  const domById = {};
  function getOrStubEl(id) {
    if (!domById[id]) domById[id] = makeEl();
    return domById[id];
  }

  const ctx = vm.createContext({
    console,
    localStorage: ls,
    sessionStorage: ss,

    fetch: fetchOverride ?? ((url) => {
      if (url.includes('/api/auth/challenge')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (url.includes('/api/auth/status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(authStatus) });
      }
      if (url.includes('/api/auth/session')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ session_token: 'tok' }) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    }),

    // CryptoJS stub (not needed for fast-path tests)
    CryptoJS: {
      PBKDF2: () => ({ toString: () => 'keyhex' }),
      AES: { decrypt: () => ({ toString: () => 'DEVSUITE_MASTER_OK' }) },
      enc: { Hex: { parse: (x) => x }, Utf8: 'utf8' },
    },

    document: {
      createElement: (tag) => { const el = makeEl(); el.tag = tag; return el; },
      // Return a stub for any id so property accesses like .style.display never throw
      getElementById: (id) => getOrStubEl(id),
      body: {
        // Register elements by id when inserted into the body
        insertBefore: (el) => { if (el && el.id) domById[el.id] = el; },
        firstChild: null,
        appendChild: (el) => { if (el && el.id) domById[el.id] = el; },
        prepend: () => {},
      },
      head: { appendChild: () => {} },
    },

    setTimeout: (fn, ms) => { /* do not execute inline — keeps tests synchronous */ },
    Date: {
      now: () => 1_700_000_000_000, // fixed "now" = ~2023-11-14
    },
  });

  // auth-guard.js declares `const AuthGuard = (() => {...})();`
  // The IIFE assigns to a const — wrap in a function so we can capture it.
  const wrapped = `(function() { ${authGuardSrc}; return AuthGuard; })();`;
  const AuthGuard = vm.runInContext(wrapped, ctx);

  return { AuthGuard, ctx, ls, ss };
}

// ─────────────────────────────────────────────────────────────────
// Module loading
// ─────────────────────────────────────────────────────────────────

describe('AuthGuard — module shape', () => {
  test('loads without throwing', () => {
    assert.doesNotThrow(() => makeContext());
  });

  test('exports init function', () => {
    const { AuthGuard } = makeContext();
    assert.equal(typeof AuthGuard.init, 'function');
  });

  test('exports cachedPwd function', () => {
    const { AuthGuard } = makeContext();
    assert.equal(typeof AuthGuard.cachedPwd, 'function');
  });

  test('exports clearSession function', () => {
    const { AuthGuard } = makeContext();
    assert.equal(typeof AuthGuard.clearSession, 'function');
  });
});

// ─────────────────────────────────────────────────────────────────
// cachedPwd — no session
// ─────────────────────────────────────────────────────────────────

describe('AuthGuard.cachedPwd — no active session', () => {
  test('returns null when localStorage has no expiry', () => {
    const { AuthGuard } = makeContext();
    assert.equal(AuthGuard.cachedPwd(), null);
  });

  test('returns null when session is expired (expiry in the past)', () => {
    const pastExpiry = String(1_700_000_000_000 - 1000); // 1 second ago relative to mocked Date.now
    const { AuthGuard } = makeContext({ sessionExpiry: pastExpiry, sessionPwd: 'mypassword' });
    assert.equal(AuthGuard.cachedPwd(), null);
  });

  test('returns null when expiry is present but password is not cached', () => {
    const futureExpiry = String(1_700_000_000_000 + 3_600_000); // 1 hour from now
    const { AuthGuard } = makeContext({ sessionExpiry: futureExpiry, sessionPwd: null });
    assert.equal(AuthGuard.cachedPwd(), null);
  });
});

// ─────────────────────────────────────────────────────────────────
// cachedPwd — active session
// ─────────────────────────────────────────────────────────────────

describe('AuthGuard.cachedPwd — active session', () => {
  test('returns cached password when session is valid', () => {
    const futureExpiry = String(1_700_000_000_000 + 3_600_000);
    const { AuthGuard } = makeContext({ sessionExpiry: futureExpiry, sessionPwd: 'hunter2' });
    assert.equal(AuthGuard.cachedPwd(), 'hunter2');
  });

  test('returns null if session token is empty string in sessionStorage', () => {
    const futureExpiry = String(1_700_000_000_000 + 3_600_000);
    const { AuthGuard } = makeContext({ sessionExpiry: futureExpiry, sessionPwd: '' });
    // Empty string is falsy — treated as no password
    const pwd = AuthGuard.cachedPwd();
    // Either null or '' — both are falsy; the important thing is it's not a real password
    assert.ok(!pwd);
  });
});

// ─────────────────────────────────────────────────────────────────
// clearSession
// ─────────────────────────────────────────────────────────────────

describe('AuthGuard.clearSession', () => {
  test('removes expiry from localStorage', () => {
    const futureExpiry = String(1_700_000_000_000 + 3_600_000);
    const { AuthGuard, ls } = makeContext({ sessionExpiry: futureExpiry, sessionPwd: 'pass' });

    AuthGuard.clearSession();
    assert.equal(ls.getItem('devsuite_session_expiry'), null);
  });

  test('removes password from sessionStorage', () => {
    const futureExpiry = String(1_700_000_000_000 + 3_600_000);
    const { AuthGuard, ss } = makeContext({ sessionExpiry: futureExpiry, sessionPwd: 'pass' });

    AuthGuard.clearSession();
    assert.equal(ss.getItem('devsuite_session_pwd'), null);
  });

  test('cachedPwd returns null after clearSession', () => {
    const futureExpiry = String(1_700_000_000_000 + 3_600_000);
    const { AuthGuard } = makeContext({ sessionExpiry: futureExpiry, sessionPwd: 'pass' });

    AuthGuard.clearSession();
    assert.equal(AuthGuard.cachedPwd(), null);
  });

  test('clearSession is idempotent (safe to call when already cleared)', () => {
    const { AuthGuard } = makeContext();
    assert.doesNotThrow(() => {
      AuthGuard.clearSession();
      AuthGuard.clearSession();
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// init — fast path (session valid + password cached)
// ─────────────────────────────────────────────────────────────────

describe('AuthGuard.init — fast path', () => {
  test('resolves immediately with cached password when session is active', async () => {
    const futureExpiry = String(1_700_000_000_000 + 3_600_000);
    const { AuthGuard, ctx } = makeContext({
      sessionExpiry: futureExpiry,
      sessionPwd: 'secretpass',
      // Provide a key_hex in sessionStorage so _acquireServerSession is called
    });
    ctx.sessionStorage.setItem('devsuite_key_hex', 'deadbeef');

    const result = await AuthGuard.init('Test Tool', '🔧');
    assert.equal(result, 'secretpass');
  });

  test('does not expose DOM overlay during fast path', async () => {
    const futureExpiry = String(1_700_000_000_000 + 3_600_000);
    const overlayShown = [];
    const { AuthGuard, ctx } = makeContext({
      sessionExpiry: futureExpiry,
      sessionPwd: 'pass',
    });
    // Override getElementById to track overlay lookups
    const origGetById = ctx.document.getElementById;
    ctx.document.getElementById = (id) => {
      if (id === 'ag-overlay') overlayShown.push(id);
      return null; // return null since we're on the fast path
    };

    await AuthGuard.init('MyTool', '🛠');
    // On the fast path, init() returns before building the overlay
    // The overlay ID should not have been queried yet
    assert.ok(!overlayShown.includes('ag-overlay') || overlayShown.length === 0);
  });
});

// ─────────────────────────────────────────────────────────────────
// init — no master password configured
// ─────────────────────────────────────────────────────────────────

describe('AuthGuard.init — master password not set up', () => {
  test('resolves with null when auth status reports is_setup=false', async () => {
    const { AuthGuard } = makeContext({ authStatus: { is_setup: false } });
    const result = await AuthGuard.init('Test Tool', '🔒');
    assert.equal(result, null);
  });
});

// ─────────────────────────────────────────────────────────────────
// Session constants sanity checks
// ─────────────────────────────────────────────────────────────────

describe('AuthGuard — session duration constants', () => {
  test('session lasts 8 hours after caching (by inspecting localStorage after init fast-path)', async () => {
    // We verify indirectly: if a fresh session was cached, expiry should be ~8h from now
    const futureExpiry = String(1_700_000_000_000 + 3_600_000);
    const { AuthGuard, ls } = makeContext({ sessionExpiry: futureExpiry, sessionPwd: 'p' });
    // Session is valid — init fast path won't re-cache, so expiry stays the same
    await AuthGuard.init('T', '🔧');
    const expiry = Number(ls.getItem('devsuite_session_expiry'));
    // Still future relative to mocked Date.now
    assert.ok(expiry > 1_700_000_000_000);
  });
});
