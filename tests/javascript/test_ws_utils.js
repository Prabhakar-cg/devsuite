/** Unit tests for static/ws-utils.js — WebSocket Tester pure helpers (feature 020).
 *
 * Covers URL validation (FR-002/SC-003), subprotocol parsing (FR-013),
 * text/JSON formatting (FR-009), log capping (FR-011/SC-004), and recent-endpoint
 * upsert/dedupe/cap (FR-014). Pure module — no browser, no socket. */
'use strict';

const assert = require('node:assert/strict');
const WsUtils = require('../../static/ws-utils.js');

// ── normalizeWsUrl (FR-002, SC-003) ──
test('normalizeWsUrl accepts ws:// and wss://', () => {
    assert.equal(WsUtils.normalizeWsUrl('ws://localhost:8080/socket').ok, true);
    const wss = WsUtils.normalizeWsUrl('wss://echo.websocket.org');
    assert.equal(wss.ok, true);
    assert.equal(wss.secure, true);
});

test('normalizeWsUrl rejects a blank URL', () => {
    assert.equal(WsUtils.normalizeWsUrl('').ok, false);
    assert.equal(WsUtils.normalizeWsUrl('   ').ok, false);
});

test('normalizeWsUrl rejects non-ws/wss schemes', () => {
    assert.equal(WsUtils.normalizeWsUrl('http://example.com').ok, false);
    assert.equal(WsUtils.normalizeWsUrl('https://example.com').ok, false);
    assert.equal(WsUtils.normalizeWsUrl('javascript:alert(1)').ok, false);
});

test('normalizeWsUrl rejects a non-URL string', () => {
    assert.equal(WsUtils.normalizeWsUrl('not a url').ok, false);
});

// ── parseProtocols (FR-013) ──
test('parseProtocols splits, trims, and dedupes', () => {
    assert.deepEqual(WsUtils.parseProtocols(' graphql-ws , mqtt ,graphql-ws'), ['graphql-ws', 'mqtt']);
});

test('parseProtocols returns [] for empty input', () => {
    assert.deepEqual(WsUtils.parseProtocols(''), []);
    assert.deepEqual(WsUtils.parseProtocols(null), []);
});

// ── formatIncoming (FR-009) ──
test('formatIncoming pretty-prints valid JSON objects/arrays', () => {
    const r = WsUtils.formatIncoming('{"a":1,"b":[2,3]}');
    assert.equal(r.type, 'json');
    assert.equal(r.body, '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
});

test('formatIncoming leaves invalid JSON as verbatim text', () => {
    const r = WsUtils.formatIncoming('{not json');
    assert.equal(r.type, 'text');
    assert.equal(r.body, '{not json');
});

test('formatIncoming treats plain text as text (does not force JSON)', () => {
    const r = WsUtils.formatIncoming('hello world');
    assert.equal(r.type, 'text');
    assert.equal(r.body, 'hello world');
});

// ── validateJson ──
test('validateJson accepts valid and rejects invalid JSON', () => {
    assert.equal(WsUtils.validateJson('{"x":1}').ok, true);
    assert.equal(WsUtils.validateJson('{x:1}').ok, false);
});

// ── capLog (FR-011, SC-004) ──
test('capLog keeps only the most recent max entries', () => {
    const entries = [];
    for (let i = 0; i < 1000; i++) { entries.push(i); }
    const capped = WsUtils.capLog(entries, 500);
    assert.equal(capped.length, 500);
    assert.equal(capped[0], 500);          // oldest kept is #500
    assert.equal(capped[capped.length - 1], 999); // newest kept
});

test('capLog returns a copy when under the cap', () => {
    const entries = [1, 2, 3];
    const out = WsUtils.capLog(entries, 500);
    assert.deepEqual(out, [1, 2, 3]);
    assert.notEqual(out, entries); // new array, not the same reference
});

// ── upsertRecent (FR-014) ──
test('upsertRecent inserts at the front and dedupes by url', () => {
    let list = [];
    list = WsUtils.upsertRecent(list, { url: 'wss://a', protocols: [] }, 15);
    list = WsUtils.upsertRecent(list, { url: 'wss://b', protocols: [] }, 15);
    list = WsUtils.upsertRecent(list, { url: 'wss://a', protocols: ['x'] }, 15); // re-use a
    assert.equal(list.length, 2);
    assert.equal(list[0].url, 'wss://a');       // moved to front
    assert.deepEqual(list[0].protocols, ['x']); // updated entry
    assert.equal(list[1].url, 'wss://b');
});

test('upsertRecent caps the list to max, dropping the oldest', () => {
    let list = [];
    for (let i = 0; i < 20; i++) {
        list = WsUtils.upsertRecent(list, { url: 'wss://host/' + i, protocols: [] }, 15);
    }
    assert.equal(list.length, 15);
    assert.equal(list[0].url, 'wss://host/19'); // newest
    assert.equal(list[14].url, 'wss://host/5'); // oldest kept (0..4 dropped)
});
