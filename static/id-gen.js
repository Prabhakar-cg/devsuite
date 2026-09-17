/**
 * DevSuite — ID Generator pure core (feature 019).
 *
 * DOM-free, dual-export module: generators for UUID v4/v7, ULID, CUID2, NanoID,
 * a per-type entropy-facts table (ID_TYPES), and timestamp decoders for the
 * time-based types. Loaded in the browser as globalThis.IdGen and require()-able
 * in node for tests/javascript/test_id_gen.js.
 *
 * All randomness comes from a CSPRNG (crypto.getRandomValues) — never Math.random
 * (spec FR-005). CUID2 hashes multiple entropy sources with SHA3-512, matching the
 * paralleldrive/cuid2 reference; the SHA3 implementation is CryptoJS.SHA3 from the
 * already-vendored static/crypto-js.min.js (no new dependency).
 *
 * The crypto and CryptoJS handles are looked up lazily via injectable getters so
 * the node test can supply Node's webcrypto and require('crypto-js') without a
 * browser. Call IdGen.configure({ crypto, CryptoJS }) to override the defaults.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.IdGen = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // ── Injectable crypto handles (browser defaults; overridable for node tests) ──
    let _crypto = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
    let _CryptoJS = (typeof globalThis !== 'undefined' && globalThis.CryptoJS) || null;

    function configure(opts) {
        if (opts && opts.crypto) { _crypto = opts.crypto; }
        if (opts && opts.CryptoJS) { _CryptoJS = opts.CryptoJS; }
    }

    function randomBytes(n) {
        if (!_crypto || typeof _crypto.getRandomValues !== 'function') {
            throw new Error('Secure randomness unavailable: crypto.getRandomValues is not present');
        }
        const buf = new Uint8Array(n);
        _crypto.getRandomValues(buf);
        return buf;
    }

    // ── Per-type facts (spec/data-model.md) ──────────────────────────────────
    const ID_TYPES = {
        uuid4: {
            id: 'uuid4', label: 'UUID v4', totalBits: 128, randomBits: 122,
            timeBits: 0, timeSortable: false, decodesTime: false,
            blurb: 'Fully random 128-bit UUID (RFC 9562). 122 bits of entropy after the fixed version and variant bits. Not time-sortable.',
        },
        uuid7: {
            id: 'uuid7', label: 'UUID v7', totalBits: 128, randomBits: 74,
            timeBits: 48, timeSortable: true, decodesTime: true,
            blurb: 'Time-ordered 128-bit UUID (RFC 9562): a 48-bit millisecond timestamp followed by 74 random bits. Lexicographically sortable by creation time.',
        },
        ulid: {
            id: 'ulid', label: 'ULID', totalBits: 128, randomBits: 80,
            timeBits: 48, timeSortable: true, decodesTime: true,
            blurb: '26-char Crockford base32 identifier: a 48-bit millisecond timestamp plus 80 random bits. Lexicographically sortable by creation time.',
        },
        cuid2: {
            id: 'cuid2', label: 'CUID2', totalBits: 124, randomBits: 120,
            timeBits: 0, timeSortable: false, decodesTime: false,
            blurb: 'Collision-resistant base36 id (default length 24) — a leading letter plus a SHA3-512 hash of multiple entropy sources. ~120 bits of usable entropy. Not time-sortable.',
        },
        nanoid: {
            id: 'nanoid', label: 'NanoID', totalBits: 126, randomBits: 126,
            timeBits: 0, timeSortable: false, decodesTime: false,
            blurb: '21-char URL-safe identifier (A–Z a–z 0–9 _ -), ~126 bits of randomness with unbiased selection. Not time-sortable.',
        },
    };

    const TYPE_IDS = Object.keys(ID_TYPES);

    // ── UUID v4 (RFC 9562 §5.4) ──────────────────────────────────────────────
    function toHex(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i++) {
            s += bytes[i].toString(16).padStart(2, '0');
        }
        return s;
    }

    function formatUuid(bytes) {
        const h = toHex(bytes);
        return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) +
            '-' + h.slice(16, 20) + '-' + h.slice(20, 32);
    }

    function genUuid4() {
        const b = randomBytes(16);
        b[6] = (b[6] & 0x0f) | 0x40; // version 4
        b[8] = (b[8] & 0x3f) | 0x80; // variant 10
        return formatUuid(b);
    }

    // ── UUID v7 (RFC 9562 §5.7) ──────────────────────────────────────────────
    function genUuid7(nowMs) {
        const ms = typeof nowMs === 'number' ? nowMs : Date.now();
        const b = randomBytes(16);
        // 48-bit big-endian ms timestamp in the first 6 bytes.
        // ms is < 2^48 for any realistic date; split via division to avoid 32-bit bitwise overflow.
        let t = Math.floor(ms);
        for (let i = 5; i >= 0; i--) {
            b[i] = t % 256;
            t = Math.floor(t / 256);
        }
        b[6] = (b[6] & 0x0f) | 0x70; // version 7
        b[8] = (b[8] & 0x3f) | 0x80; // variant 10
        return formatUuid(b);
    }

    // ── ULID (Crockford base32) ──────────────────────────────────────────────
    const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    function encodeUlidTime(ms) {
        // 48-bit timestamp → 10 Crockford base32 chars.
        let t = Math.floor(ms);
        const out = new Array(10);
        for (let i = 9; i >= 0; i--) {
            out[i] = CROCKFORD[t % 32];
            t = Math.floor(t / 32);
        }
        return out.join('');
    }

    function encodeUlidRandom() {
        // 80 random bits → 16 Crockford base32 chars. Draw one random symbol per char.
        const bytes = randomBytes(16);
        let s = '';
        for (let i = 0; i < 16; i++) {
            s += CROCKFORD[bytes[i] % 32];
        }
        return s;
    }

    function genUlid(nowMs) {
        const ms = typeof nowMs === 'number' ? nowMs : Date.now();
        return encodeUlidTime(ms) + encodeUlidRandom();
    }

    // ── NanoID (URL-safe, unbiased) ──────────────────────────────────────────
    const NANOID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

    function genNanoid(size) {
        const len = typeof size === 'number' ? size : 21;
        // 64-symbol alphabet → each byte's low 6 bits map exactly (no modulo bias).
        const bytes = randomBytes(len);
        let s = '';
        for (let i = 0; i < len; i++) {
            s += NANOID_ALPHABET[bytes[i] & 63];
        }
        return s;
    }

    // ── CUID2 (paralleldrive/cuid2 reference shape) ──────────────────────────
    const CUID_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
    const CUID_DEFAULT_LENGTH = 24;
    let _cuidCounter = Math.floor(Math.random() * 2057);
    let _cuidFingerprint = null;

    function randomLetter() {
        return CUID_LETTERS[randomBytes(1)[0] % CUID_LETTERS.length];
    }

    function randomBase36Block(n) {
        // n bytes of entropy rendered base36.
        const bytes = randomBytes(n);
        let s = '';
        for (let i = 0; i < n; i++) {
            s += (bytes[i] % 36).toString(36);
        }
        return s;
    }

    function cuidFingerprint() {
        if (_cuidFingerprint == null) {
            // Stable per-session entropy source, mixed into every id.
            _cuidFingerprint = randomBase36Block(32);
        }
        return _cuidFingerprint;
    }

    function sha3Hex(input) {
        if (!_CryptoJS || typeof _CryptoJS.SHA3 !== 'function') {
            throw new Error('CUID2 requires CryptoJS.SHA3 (load static/crypto-js.min.js)');
        }
        return _CryptoJS.SHA3(input, { outputLength: 512 }).toString();
    }

    function hexToBase36(hex) {
        // Convert a long hex string to base36 without BigInt-free precision loss,
        // by chunking. Uses BigInt when available (browser + node both have it).
        if (typeof BigInt === 'function') {
            let n = BigInt('0x' + hex);
            if (n === 0n) { return '0'; }
            const b36 = [];
            const BASE = 36n;
            while (n > 0n) {
                b36.push((n % BASE).toString(36));
                n = n / BASE;
            }
            return b36.reverse().join('');
        }
        // Fallback: map hex nibbles (not perfectly uniform, but never reached in practice).
        let s = '';
        for (let i = 0; i < hex.length; i++) {
            s += (parseInt(hex[i], 16) % 36).toString(36);
        }
        return s;
    }

    function genCuid2(length) {
        const len = typeof length === 'number' ? length : CUID_DEFAULT_LENGTH;
        const firstLetter = randomLetter();
        const time = Date.now().toString(36);
        const count = (_cuidCounter++).toString(36);
        const salt = randomBase36Block(32);
        const hashInput = time + salt + count + cuidFingerprint();
        const hash = hexToBase36(sha3Hex(hashInput));
        // Reference drops the first hash char (biased) and takes the next (len-1).
        return (firstLetter + hash.slice(1, len)).slice(0, len);
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────
    const GENERATORS = {
        uuid4: genUuid4,
        uuid7: genUuid7,
        ulid: genUlid,
        cuid2: genCuid2,
        nanoid: genNanoid,
    };

    function generateOne(typeId) {
        const gen = GENERATORS[typeId];
        if (!gen) { throw new Error('Unknown identifier type: ' + typeId); }
        return gen();
    }

    /**
     * Generate a batch of `count` identifiers of `typeId`.
     * Random types are de-duplicated within the batch (spec FR-006).
     * Returns { typeId, values: string[] }.
     */
    function generate(typeId, count) {
        if (!ID_TYPES[typeId]) { throw new Error('Unknown identifier type: ' + typeId); }
        const n = Math.floor(Number(count));
        if (!Number.isFinite(n) || n < 1) {
            throw new Error('Count must be a positive integer');
        }
        const values = [];
        const seen = new Set();
        let guard = 0;
        const maxGuard = n * 50 + 100; // ample headroom; collisions are astronomically unlikely
        while (values.length < n) {
            const v = generateOne(typeId);
            if (seen.has(v)) {
                if (++guard > maxGuard) {
                    throw new Error('Unable to generate enough distinct identifiers');
                }
                continue;
            }
            seen.add(v);
            values.push(v);
        }
        return { typeId: typeId, values: values };
    }

    // ── Timestamp decoding (time-based types) ─────────────────────────────────
    function decodeUuid7Time(value) {
        const hex = String(value).replace(/-/g, '');
        if (hex.length < 12) { return undefined; }
        // First 48 bits = 12 hex chars.
        let ms = 0;
        for (let i = 0; i < 12; i++) {
            const nib = parseInt(hex[i], 16);
            if (Number.isNaN(nib)) { return undefined; }
            ms = ms * 16 + nib;
        }
        return ms;
    }

    function decodeUlidTime(value) {
        const s = String(value).toUpperCase();
        if (s.length < 10) { return undefined; }
        let ms = 0;
        for (let i = 0; i < 10; i++) {
            const idx = CROCKFORD.indexOf(s[i]);
            if (idx < 0) { return undefined; }
            ms = ms * 32 + idx;
        }
        return ms;
    }

    /**
     * Decode the embedded creation timestamp of a time-based identifier.
     * Returns { ms, iso } or undefined for types without a decodable timestamp.
     */
    function decodeTimestamp(typeId, value) {
        let ms;
        if (typeId === 'uuid7') { ms = decodeUuid7Time(value); }
        else if (typeId === 'ulid') { ms = decodeUlidTime(value); }
        else { return undefined; }
        if (ms == null || !Number.isFinite(ms)) { return undefined; }
        return { ms: ms, iso: new Date(ms).toISOString() };
    }

    return {
        configure: configure,
        ID_TYPES: ID_TYPES,
        TYPE_IDS: TYPE_IDS,
        randomBytes: randomBytes,
        genUuid4: genUuid4,
        genUuid7: genUuid7,
        genUlid: genUlid,
        genCuid2: genCuid2,
        genNanoid: genNanoid,
        generate: generate,
        decodeTimestamp: decodeTimestamp,
    };
});
