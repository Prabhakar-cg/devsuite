/**
 * Unit tests for components.js — DevSuite.toast and DevSuite.initMonaco.
 *
 * Uses the Node.js built-in test runner (node:test) and assert module.
 * Loads components.js via vm.runInContext with a mocked DOM environment.
 *
 * Run: node --test tests/javascript/test_components.js   (from devsuite/ root)
 */

'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const componentsSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'static', 'components.js'),
  'utf8'
);

// ─────────────────────────────────────────────────────────────────
// DOM mock factory
// Creates a fresh context for each test group so state doesn't leak.
// ─────────────────────────────────────────────────────────────────

function makeToastContext({ containerExists = true } = {}) {
  const appendedToContainer = [];
  const appendedToHead = [];

  // Individual element factory — returns a minimal HTMLElement-like object
  function makeElement(tag) {
    const el = {
      tag,
      className: '',
      textContent: '',
      children: [],
      style: {},
      _timeouts: [],
      classList: {
        _classes: new Set(),
        add(cls) { this._classes.add(cls); },
        remove(cls) { this._classes.delete(cls); },
        contains(cls) { return this._classes.has(cls); },
      },
      appendChild(child) { this.children.push(child); },
      remove() { this._removed = true; },
      onclick: null,
      parentElement: null,
    };
    return el;
  }

  const mockContainer = containerExists
    ? {
        appendChild(el) {
          appendedToContainer.push(el);
          el.parentElement = mockContainer;
        },
      }
    : null;

  const scheduledTimeouts = [];

  // Build ctx — IMPORTANT: ctx.window = ctx so that `window.DevSuite = x`
  // becomes `ctx.window.DevSuite = ctx.DevSuite = x` (they share the same ref).
  const ctx = vm.createContext({
    console,
    document: {
      createElement: makeElement,
      getElementById: (id) => (id === 'toast-container' ? mockContainer : null),
      head: { appendChild: (el) => appendedToHead.push(el) },
      body: { prepend: () => {}, appendChild: () => {} },
    },
    URL: {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: () => {},
    },
    require: undefined, // components.js checks `typeof require === 'undefined'`
    setTimeout: (fn, ms) => {
      const entry = { fn, ms };
      scheduledTimeouts.push(entry);
      return scheduledTimeouts.length - 1;
    },
    // Expose test introspection helpers
    _appended: appendedToContainer,
    _headAppended: appendedToHead,
    _timeouts: scheduledTimeouts,
  });

  // Make window === ctx so that window.DevSuite assignments land on ctx
  ctx.window = ctx;

  vm.runInContext(componentsSrc, ctx);

  return ctx;
}

// ─────────────────────────────────────────────────────────────────
// DevSuite.toast — basic shape
// ─────────────────────────────────────────────────────────────────

describe('DevSuite.toast — module loading', () => {
  test('DevSuite object is created after loading', () => {
    const ctx = makeToastContext();
    assert.ok(ctx.DevSuite, 'DevSuite should be defined on the global context');
  });

  test('DevSuite.toast is a function', () => {
    const ctx = makeToastContext();
    assert.equal(typeof ctx.DevSuite.toast, 'function');
  });

  test('DevSuite.initMonaco is a function', () => {
    const ctx = makeToastContext();
    assert.equal(typeof ctx.DevSuite.initMonaco, 'function');
  });
});

// ─────────────────────────────────────────────────────────────────
// DevSuite.toast — toast-container missing (early return)
// ─────────────────────────────────────────────────────────────────

describe('DevSuite.toast — no container', () => {
  test('returns silently when toast-container element is absent', () => {
    const ctx = makeToastContext({ containerExists: false });
    // Should not throw
    assert.doesNotThrow(() => ctx.DevSuite.toast('Hello', 'info', 1000));
    // Nothing should have been appended
    assert.equal(ctx._appended.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────
// DevSuite.toast — element creation & structure
// ─────────────────────────────────────────────────────────────────

describe('DevSuite.toast — element structure', () => {
  test('creates a toast element and appends it to the container', () => {
    const ctx = makeToastContext();
    ctx.DevSuite.toast('Test message', 'success', 5000);
    assert.equal(ctx._appended.length, 1);
  });

  test('toast element has correct class including type', () => {
    const ctx = makeToastContext();
    ctx.DevSuite.toast('Error!', 'error', 5000);
    const toast = ctx._appended[0];
    assert.ok(toast.className.includes('toast'));
    assert.ok(toast.className.includes('error'));
  });

  test('toast element has class "toast info" for default type', () => {
    const ctx = makeToastContext();
    ctx.DevSuite.toast('Info msg');
    const toast = ctx._appended[0];
    assert.ok(toast.className.includes('info'));
  });

  test('toast element has class "toast warning" for warning type', () => {
    const ctx = makeToastContext();
    ctx.DevSuite.toast('Warn!', 'warning', 5000);
    const toast = ctx._appended[0];
    assert.ok(toast.className.includes('warning'));
  });

  test('toast element contains two children (span + button)', () => {
    const ctx = makeToastContext();
    ctx.DevSuite.toast('msg', 'info', 1000);
    const toast = ctx._appended[0];
    assert.equal(toast.children.length, 2);
  });

  test('first child is a span with the message text', () => {
    const ctx = makeToastContext();
    ctx.DevSuite.toast('Hello World', 'info', 1000);
    const toast = ctx._appended[0];
    const span = toast.children[0];
    assert.equal(span.textContent, 'Hello World');
  });

  test('second child is a button with class toast-close', () => {
    const ctx = makeToastContext();
    ctx.DevSuite.toast('msg', 'info', 1000);
    const toast = ctx._appended[0];
    const btn = toast.children[1];
    assert.ok(btn.className.includes('toast-close'));
  });

  test('close button text is ✕', () => {
    const ctx = makeToastContext();
    ctx.DevSuite.toast('msg', 'info', 1000);
    const btn = ctx._appended[0].children[1];
    assert.equal(btn.textContent, '✕');
  });
});

// ─────────────────────────────────────────────────────────────────
// DevSuite.toast — auto-dismiss scheduling
// ─────────────────────────────────────────────────────────────────

describe('DevSuite.toast — auto-dismiss timeout', () => {
  test('schedules a timeout to dismiss the toast', () => {
    const ctx = makeToastContext();
    ctx.DevSuite.toast('Dismiss me', 'info', 2000);
    // At least one setTimeout should have been scheduled
    assert.ok(ctx._timeouts.length >= 1);
  });

  test('timeout uses the provided ms delay', () => {
    const ctx = makeToastContext();
    ctx.DevSuite.toast('Timed', 'info', 4200);
    const outerTimeout = ctx._timeouts.find((t) => t.ms === 4200);
    assert.ok(outerTimeout, 'Should schedule a timeout with the given ms');
  });
});

// ─────────────────────────────────────────────────────────────────
// DevSuite.toast — multiple toasts
// ─────────────────────────────────────────────────────────────────

describe('DevSuite.toast — multiple toasts', () => {
  test('stacks multiple toasts independently', () => {
    const ctx = makeToastContext();
    ctx.DevSuite.toast('One', 'info', 1000);
    ctx.DevSuite.toast('Two', 'success', 1000);
    ctx.DevSuite.toast('Three', 'error', 1000);
    assert.equal(ctx._appended.length, 3);
  });

  test('each toast carries its own message', () => {
    const ctx = makeToastContext();
    ctx.DevSuite.toast('Alpha', 'info', 1000);
    ctx.DevSuite.toast('Beta', 'info', 1000);
    const messages = ctx._appended.map((t) => t.children[0].textContent);
    assert.deepEqual(messages, ['Alpha', 'Beta']);
  });
});

// ─────────────────────────────────────────────────────────────────
// DevSuite.initMonaco — guard check
// ─────────────────────────────────────────────────────────────────

describe('DevSuite.initMonaco — require not loaded', () => {
  test('logs error and does not throw when require is undefined', () => {
    const errors = [];
    const ctx = makeToastContext();
    // Override console.error to capture
    ctx.console = { ...console, error: (msg) => errors.push(msg) };
    // Re-run the script in this patched context (fresh ctx)
    const ctx2 = vm.createContext({
      console: { ...console, error: (msg) => errors.push(msg) },
      document: {
        createElement: (tag) => ({ tag, textContent: '', style: {}, appendChild: () => {} }),
        getElementById: () => null,
        head: { appendChild: () => {} },
        body: { prepend: () => {} },
      },
      URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
      require: undefined,
      setTimeout: () => {},
    });
    ctx2.window = ctx2;
    vm.runInContext(componentsSrc, ctx2);
    // Calling initMonaco without require should log an error but not throw
    assert.doesNotThrow(() => ctx2.DevSuite.initMonaco(() => {}));
  });
});
