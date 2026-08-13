/** Unit tests for static/toon.js — TOON (Token-Oriented Object Notation) codec
 * (specs/016-data-linter §FR-011, specs/013-file-converter TOON conversion targets). */
'use strict';

const assert = require('node:assert/strict');
const Toon = require('../../static/toon.js');

function roundtrip(name, value) {
    test(name, () => {
        const encoded = Toon.encode(value);
        const decoded = Toon.decode(encoded);
        assert.deepEqual(decoded, value);
    });
}

// ─── Round-trip: encode then decode reproduces the original value ────────────

roundtrip('simple object round-trips', { id: 123, name: 'Ada', active: true });
roundtrip('nested object round-trips', { user: { id: 123, name: 'Ada' } });
roundtrip('uniform tabular array round-trips', {
    items: [{ sku: 'A1', qty: 2, price: 9.99 }, { sku: 'B2', qty: 1, price: 14.5 }],
});
roundtrip('inline primitive array round-trips', { tags: ['red', 'green', 'blue'] });
roundtrip('empty array round-trips', { items: [] });
roundtrip('empty object round-trips', { a: {} });
roundtrip('non-uniform list array round-trips', { items: [1, { a: 1 }, 'text'] });
roundtrip('list of objects round-trips', { items: [{ id: 1, name: 'First' }, { id: 2, name: 'Second' }] });
roundtrip('array of primitive arrays round-trips', { pairs: [[1, 2], [3, 4]] });
roundtrip('strings needing quotes round-trip', {
    empty: '', spaced: '  s  ', literalTrue: 'true', numericLooking: '42',
    comma: 'a,b', colon: 'a:b', dash: '-x', quote: 'q"h', backslash: 'b\\s', newline: 'm\nl',
});
roundtrip('numbers and null round-trip', { a: null, b: 0, d: 1.5, e: -3.25, f: 1000000 });
roundtrip('root array of objects round-trips', [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
roundtrip('deeply nested structure round-trips', { a: { b: { c: [1, 2, 3], d: 'x' } } });
roundtrip('nested object inside list items round-trips', {
    items: [{ id: 1, meta: { x: 1 } }, { id: 2, meta: { x: 2 } }],
});
roundtrip('quoted key round-trips', { 'weird key!': 1 });
roundtrip('root primitive number round-trips', 42);
roundtrip('root primitive string round-trips', 'hello');
roundtrip('empty object root round-trips', {});

// ─── -0 normalization (matches JSON.stringify(-0) === "0", spec-mandated) ────

test('encodes -0 as 0, not -0', () => {
    assert.equal(Toon.encode({ n: -0 }), 'n: 0');
});

// ─── Canonical output shape (spec's own example, verbatim) ───────────────────

test('matches the published spec\'s canonical tabular example', () => {
    const value = { items: [{ sku: 'A1', qty: 2, price: 9.99 }, { sku: 'B2', qty: 1, price: 14.5 }] };
    assert.equal(Toon.encode(value), 'items[2]{sku,qty,price}:\n  A1,2,9.99\n  B2,1,14.5');
});

test('matches the published spec\'s nested-object example', () => {
    assert.equal(Toon.encode({ user: { id: 123, name: 'Ada' } }), 'user:\n  id: 123\n  name: Ada');
});

// ─── Decoder accepts hand-written TOON, not just this encoder's own output ───

test('decodes a hand-written simple object', () => {
    assert.deepEqual(Toon.decode('id: 123\nname: Ada\nactive: true'), { id: 123, name: 'Ada', active: true });
});

test('decodes a hand-written tabular array', () => {
    assert.deepEqual(
        Toon.decode('items[2]{sku,qty,price}:\n  A1,2,9.99\n  B2,1,14.5'),
        { items: [{ sku: 'A1', qty: 2, price: 9.99 }, { sku: 'B2', qty: 1, price: 14.5 }] },
    );
});

test('decoder rejects a tabular header whose declared length exceeds available rows', () => {
    assert.throws(() => Toon.decode('items[2]{sku,qty}:\n  A1,2'), /Declared 2 tabular row/);
});

test('decoder rejects a list header whose declared length exceeds available items', () => {
    assert.throws(() => Toon.decode('items[2]:\n  - 1'), /Declared 2 list item/);
});

test('decoder rejects an unparseable line rather than guessing', () => {
    assert.throws(() => Toon.decode('valid: 1\n***not a key line***'), /Malformed line/);
});

// ─── looksLikeToonHeader (shared with data-linter.html's auto-detect) ────────

test('looksLikeToonHeader detects a keyed bracket header', () => {
    assert.equal(Toon.looksLikeToonHeader('items[2]{sku,qty}:\n  A1,2\n  B2,1'), true);
});

test('looksLikeToonHeader detects a bare root array header', () => {
    assert.equal(Toon.looksLikeToonHeader('[2]: 1,2'), true);
});

test('looksLikeToonHeader is false for plain key:value (ambiguous with YAML)', () => {
    assert.equal(Toon.looksLikeToonHeader('id: 123\nname: Ada'), false);
});

// ─── inferScalarFromText (shared with the XML<->value bridge) ────────────────

test('inferScalarFromText infers null/true/false/number, else string', () => {
    assert.equal(Toon.inferScalarFromText('null'), null);
    assert.equal(Toon.inferScalarFromText('true'), true);
    assert.equal(Toon.inferScalarFromText('false'), false);
    assert.equal(Toon.inferScalarFromText('42'), 42);
    assert.equal(Toon.inferScalarFromText('-3.25'), -3.25);
    assert.equal(Toon.inferScalarFromText('007'), '007'); // leading zero -> not a number
    assert.equal(Toon.inferScalarFromText('hello'), 'hello');
});
