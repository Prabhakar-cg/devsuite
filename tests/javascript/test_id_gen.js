/** Unit tests for static/id-gen.js — ID Generator pure core (feature 019).
 *
 * Covers format conformance for all five types (spec SC-002), batch distinctness
 * for random types (SC-003), the ID_TYPES entropy facts (SC-005), and the
 * uuid7/ulid timestamp-decode round-trip (SC-006). The module's crypto/CryptoJS
 * handles are injected here from Node's webcrypto and the vendored crypto-js
 * bundle, so no browser is needed. */
'use strict';

const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const CryptoJS = require('../../static/crypto-js.min.js');
const IdGen = require('../../static/id-gen.js');

IdGen.configure({ crypto: webcrypto, CryptoJS: CryptoJS });

const UUID4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;               // Crockford base32, 26 chars
const CUID2_RE = /^[a-z][0-9a-z]{23}$/;                    // leading letter + base36, length 24
const NANOID_RE = /^[A-Za-z0-9_-]{21}$/;

// ── Format conformance (SC-002) ──
test('UUID v4 matches the RFC 9562 v4 pattern', () => {
    for (let i = 0; i < 200; i++) { assert.match(IdGen.genUuid4(), UUID4_RE); }
});

test('UUID v7 matches the RFC 9562 v7 pattern', () => {
    for (let i = 0; i < 200; i++) { assert.match(IdGen.genUuid7(), UUID7_RE); }
});

test('ULID is 26 Crockford base32 chars', () => {
    for (let i = 0; i < 200; i++) { assert.match(IdGen.genUlid(), ULID_RE); }
});

test('CUID2 starts with a letter and is 24 base36 chars', () => {
    for (let i = 0; i < 100; i++) { assert.match(IdGen.genCuid2(), CUID2_RE); }
});

test('NanoID is 21 URL-safe chars', () => {
    for (let i = 0; i < 200; i++) { assert.match(IdGen.genNanoid(), NANOID_RE); }
});

// ── generate() dispatch, count, and distinctness (SC-003, FR-006) ──
test('generate returns exactly the requested count of the requested type', () => {
    const batch = IdGen.generate('uuid4', 25);
    assert.equal(batch.typeId, 'uuid4');
    assert.equal(batch.values.length, 25);
    batch.values.forEach((v) => assert.match(v, UUID4_RE));
});

test('generate produces 1000 distinct UUID v4 values (no duplicates)', () => {
    const batch = IdGen.generate('uuid4', 1000);
    assert.equal(new Set(batch.values).size, 1000);
});

test('generate produces 1000 distinct NanoID values', () => {
    const batch = IdGen.generate('nanoid', 1000);
    assert.equal(new Set(batch.values).size, 1000);
});

test('generate rejects an unknown type', () => {
    assert.throws(() => IdGen.generate('nope', 5), /Unknown identifier type/);
});

test('generate rejects a non-positive count', () => {
    assert.throws(() => IdGen.generate('uuid4', 0), /positive integer/);
    assert.throws(() => IdGen.generate('uuid4', -3), /positive integer/);
});

// ── Entropy facts (SC-005) ──
test('ID_TYPES random-bit facts match each spec', () => {
    assert.equal(IdGen.ID_TYPES.uuid4.randomBits, 122);
    assert.equal(IdGen.ID_TYPES.uuid7.randomBits, 74);
    assert.equal(IdGen.ID_TYPES.uuid7.timeBits, 48);
    assert.equal(IdGen.ID_TYPES.ulid.randomBits, 80);
    assert.equal(IdGen.ID_TYPES.ulid.timeBits, 48);
    assert.equal(IdGen.ID_TYPES.nanoid.randomBits, 126);
});

test('only uuid7 and ulid are time-sortable / time-decodable', () => {
    assert.equal(IdGen.ID_TYPES.uuid7.timeSortable, true);
    assert.equal(IdGen.ID_TYPES.ulid.timeSortable, true);
    assert.equal(IdGen.ID_TYPES.uuid4.timeSortable, false);
    assert.equal(IdGen.ID_TYPES.cuid2.decodesTime, false);
    assert.equal(IdGen.ID_TYPES.nanoid.decodesTime, false);
});

// ── Timestamp decode round-trip (SC-006) ──
test('UUID v7 embeds and decodes the generation timestamp to the same ms', () => {
    const ms = 1_726_000_000_000; // fixed known ms
    const value = IdGen.genUuid7(ms);
    const decoded = IdGen.decodeTimestamp('uuid7', value);
    assert.ok(decoded);
    assert.equal(decoded.ms, ms);
    assert.equal(decoded.iso, new Date(ms).toISOString());
});

test('ULID embeds and decodes the generation timestamp to the same ms', () => {
    const ms = 1_726_000_000_000;
    const value = IdGen.genUlid(ms);
    const decoded = IdGen.decodeTimestamp('ulid', value);
    assert.ok(decoded);
    assert.equal(decoded.ms, ms);
});

test('decodeTimestamp returns undefined for non-time types', () => {
    assert.equal(IdGen.decodeTimestamp('uuid4', IdGen.genUuid4()), undefined);
    assert.equal(IdGen.decodeTimestamp('cuid2', IdGen.genCuid2()), undefined);
    assert.equal(IdGen.decodeTimestamp('nanoid', IdGen.genNanoid()), undefined);
});

test('a freshly generated UUID v7 decodes to approximately now', () => {
    const before = Date.now();
    const decoded = IdGen.decodeTimestamp('uuid7', IdGen.genUuid7());
    const after = Date.now();
    assert.ok(decoded.ms >= before - 1 && decoded.ms <= after + 1);
});
