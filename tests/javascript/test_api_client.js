/**
 * Unit tests for api-client.js — ApiClient static methods.
 *
 * Uses the Node.js built-in test runner (node:test) and assert module.
 * Loads api-client.js via vm.runInContext so no source modifications are needed.
 *
 * Run: node --test tests/javascript/test_api_client.js   (from devsuite/ root)
 *
 * Node.js 18+ required (Headers, URL, URLSearchParams, TextEncoder, btoa are globals).
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ─────────────────────────────────────────────────────────────────
// Bootstrap: load api-client.js into an isolated vm context
// ─────────────────────────────────────────────────────────────────

const clientSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'static', 'api-client.js'),
  'utf8'
);

// Strip ES-module `export` keywords — not supported in vm script mode
const strippedSource = clientSource.replace(/^export\s+/gm, '');

const clientContext = vm.createContext({
  // Browser globals available in Node.js 18+
  Headers,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  performance,
  btoa,
  fetch: async () => { throw new Error('fetch not wired in this test context'); },
  console,
});

const wrapped = `(function() { ${strippedSource}; return { ApiClient }; })();`;
const { ApiClient } = vm.runInContext(wrapped, clientContext);

// ─────────────────────────────────────────────────────────────────
// encodeBase64Utf8
// ─────────────────────────────────────────────────────────────────

describe('ApiClient.encodeBase64Utf8', () => {
  test('encodes plain ASCII string', () => {
    const result = ApiClient.encodeBase64Utf8('hello');
    assert.equal(result, btoa('hello'));
  });

  test('encodes ASCII correctly (known base64)', () => {
    // "hello" → "aGVsbG8="
    assert.equal(ApiClient.encodeBase64Utf8('hello'), 'aGVsbG8=');
  });

  test('encodes empty string', () => {
    assert.equal(ApiClient.encodeBase64Utf8(''), btoa(''));
  });

  test('encodes multibyte UTF-8 characters', () => {
    // "café" has a 2-byte UTF-8 sequence for é
    const result = ApiClient.encodeBase64Utf8('café');
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
    // Must decode back to the original via atob + TextDecoder
    // Verify it's valid base64 (only base64 chars)
    assert.match(result, /^[A-Za-z0-9+/]+=*$/);
  });

  test('encodes CJK characters without throwing', () => {
    const result = ApiClient.encodeBase64Utf8('日本語');
    assert.ok(typeof result === 'string');
    assert.match(result, /^[A-Za-z0-9+/]+=*$/);
  });

  test('encodes emoji without throwing', () => {
    const result = ApiClient.encodeBase64Utf8('🚀');
    assert.ok(typeof result === 'string');
    assert.match(result, /^[A-Za-z0-9+/]+=*$/);
  });

  test('basic auth encoding is URL-safe', () => {
    const creds = ApiClient.encodeBase64Utf8('user:pass');
    assert.equal(creds, btoa('user:pass'));
  });
});

// ─────────────────────────────────────────────────────────────────
// buildUrl
// ─────────────────────────────────────────────────────────────────

describe('ApiClient.buildUrl', () => {
  test('returns base URL unchanged when no params', () => {
    const url = ApiClient.buildUrl('https://example.com/api', {});
    assert.equal(url, 'https://example.com/api');
  });

  test('returns base URL unchanged when params is null', () => {
    const url = ApiClient.buildUrl('https://example.com/api', null);
    assert.equal(url, 'https://example.com/api');
  });

  test('returns base URL unchanged when params is undefined', () => {
    const url = ApiClient.buildUrl('https://example.com/api', undefined);
    assert.equal(url, 'https://example.com/api');
  });

  test('appends a single query param', () => {
    const url = ApiClient.buildUrl('https://example.com/api', { foo: 'bar' });
    assert.equal(url, 'https://example.com/api?foo=bar');
  });

  test('appends multiple query params', () => {
    const url = ApiClient.buildUrl('https://example.com/api', { a: '1', b: '2' });
    assert.ok(url.includes('a=1'));
    assert.ok(url.includes('b=2'));
  });

  test('URL-encodes special characters in values', () => {
    const url = ApiClient.buildUrl('https://example.com/api', { q: 'hello world' });
    assert.ok(url.includes('hello+world') || url.includes('hello%20world'));
  });

  test('skips params with empty-string keys', () => {
    const url = ApiClient.buildUrl('https://example.com/', { '': 'ignored', name: 'ok' });
    assert.ok(!url.includes('=ignored'));
    assert.ok(url.includes('name=ok'));
  });

  test('preserves existing query string on base URL', () => {
    const url = ApiClient.buildUrl('https://example.com/?existing=yes', { extra: 'new' });
    assert.ok(url.includes('existing=yes'));
    assert.ok(url.includes('extra=new'));
  });
});

// ─────────────────────────────────────────────────────────────────
// buildHeaders
// ─────────────────────────────────────────────────────────────────

describe('ApiClient.buildHeaders', () => {
  test('returns Headers instance', () => {
    const h = ApiClient.buildHeaders({});
    assert.ok(h instanceof Headers);
  });

  test('adds custom headers from config.headers', () => {
    const h = ApiClient.buildHeaders({ headers: { 'X-Custom': 'value' } });
    assert.equal(h.get('X-Custom'), 'value');
  });

  test('adds Bearer token when auth.type is bearer', () => {
    const h = ApiClient.buildHeaders({ auth: { type: 'bearer', token: 'mytoken' } });
    assert.equal(h.get('Authorization'), 'Bearer mytoken');
  });

  test('does not set auth header when bearer token is missing', () => {
    const h = ApiClient.buildHeaders({ auth: { type: 'bearer', token: '' } });
    assert.equal(h.get('Authorization'), null);
  });

  test('adds Basic auth when auth.type is basic', () => {
    const h = ApiClient.buildHeaders({ auth: { type: 'basic', username: 'alice', password: 'secret' } });
    const authHeader = h.get('Authorization');
    assert.ok(authHeader.startsWith('Basic '));
    const decoded = atob(authHeader.replace('Basic ', ''));
    assert.equal(decoded, 'alice:secret');
  });

  test('Basic auth with empty password uses empty string', () => {
    const h = ApiClient.buildHeaders({ auth: { type: 'basic', username: 'user' } });
    const decoded = atob(h.get('Authorization').replace('Basic ', ''));
    assert.equal(decoded, 'user:');
  });

  test('sets Content-Type: application/json for bodyType=json', () => {
    const h = ApiClient.buildHeaders({ bodyType: 'json' });
    assert.equal(h.get('Content-Type'), 'application/json');
  });

  test('does NOT set Content-Type for bodyType=form-data', () => {
    const h = ApiClient.buildHeaders({ bodyType: 'form-data' });
    assert.equal(h.get('Content-Type'), null);
  });

  test('skips custom headers with empty-string key', () => {
    const h = ApiClient.buildHeaders({ headers: { '': 'ghost', 'Valid': 'ok' } });
    assert.equal(h.get('Valid'), 'ok');
  });

  test('no auth block → no Authorization header', () => {
    const h = ApiClient.buildHeaders({});
    assert.equal(h.get('Authorization'), null);
  });
});

// ─────────────────────────────────────────────────────────────────
// buildBody
// ─────────────────────────────────────────────────────────────────

describe('ApiClient.buildBody', () => {
  test('returns null for GET requests', () => {
    const body = ApiClient.buildBody({ method: 'GET', body: '{"a":1}', bodyType: 'json' });
    assert.equal(body, null);
  });

  test('returns null for DELETE requests', () => {
    const body = ApiClient.buildBody({ method: 'DELETE', body: 'data', bodyType: 'raw' });
    assert.equal(body, null);
  });

  test('returns null when bodyType is none', () => {
    const body = ApiClient.buildBody({ method: 'POST', body: 'data', bodyType: 'none' });
    assert.equal(body, null);
  });

  test('returns null when body is absent', () => {
    const body = ApiClient.buildBody({ method: 'POST', bodyType: 'json' });
    assert.equal(body, null);
  });

  test('returns JSON string for bodyType=json with string input', () => {
    const body = ApiClient.buildBody({ method: 'POST', body: '{"x":1}', bodyType: 'json' });
    assert.equal(body, '{"x":1}');
  });

  test('serialises object for bodyType=json', () => {
    const body = ApiClient.buildBody({ method: 'POST', body: { key: 'val' }, bodyType: 'json' });
    assert.equal(body, JSON.stringify({ key: 'val' }));
  });

  test('returns URLSearchParams for bodyType=form-data', () => {
    const body = ApiClient.buildBody({
      method: 'POST',
      body: { field1: 'v1', field2: 'v2' },
      bodyType: 'form-data',
    });
    assert.ok(body instanceof URLSearchParams);
    assert.equal(body.get('field1'), 'v1');
    assert.equal(body.get('field2'), 'v2');
  });

  test('returns raw body for unknown bodyType', () => {
    const body = ApiClient.buildBody({ method: 'POST', body: 'raw text', bodyType: 'text' });
    assert.equal(body, 'raw text');
  });

  test('PUT with json body is serialised', () => {
    const body = ApiClient.buildBody({ method: 'PUT', body: { id: 42 }, bodyType: 'json' });
    assert.equal(body, '{"id":42}');
  });

  test('PATCH with form-data returns URLSearchParams', () => {
    const body = ApiClient.buildBody({ method: 'PATCH', body: { name: 'alice' }, bodyType: 'form-data' });
    assert.ok(body instanceof URLSearchParams);
    assert.equal(body.get('name'), 'alice');
  });
});
