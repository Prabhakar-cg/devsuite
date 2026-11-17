/** Unit tests for static/master-verify.js — client-side master-password challenge verification.
 *
 * Security-critical path (Constitution VI): builds a real v2 challenge with WebCrypto exactly the
 * way the vault does (PBKDF2-SHA256 -> 512 bits, Kauth = bits[32:64], AES-GCM verify blob) and
 * checks correct / wrong / malformed inputs. A low iteration count keeps the suite fast. */
'use strict';

const assert = require('node:assert/strict');
const MV = require('../../static/master-verify.js');

const subtle = globalThis.crypto.subtle;
const ITER = 1000;

async function makeV2Challenge(password, saltHex = '00112233445566778899aabbccddeeff') {
    const kauth = await MV.deriveKauthV2(password, saltHex, subtle, ITER);
    const nonce = new Uint8Array(12).fill(7);
    const key = await subtle.importKey('raw', kauth, { name: 'AES-GCM' }, false, ['encrypt']);
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, new TextEncoder().encode(MV.VERIFY_PLAINTEXT));
    return {
        salt: saltHex, challenge_version: 2,
        verify_nonce: MV.bytesToHex(nonce), verify_blob: MV.bytesToHex(new Uint8Array(ct)), verify_iv: '',
        kauthHex: MV.bytesToHex(kauth),
    };
}

test('v2: correct password verifies and returns Kauth (not the encryption half)', async () => {
    const ch = await makeV2Challenge('correct horse battery 1');
    const r = await MV.verifyMasterPassword('correct horse battery 1', ch, { subtle, iterations: ITER });
    assert.equal(r.ok, true);
    assert.equal(r.keyHex, ch.kauthHex);
    assert.equal(r.keyHex.length, 64);
});

test('v2: wrong password is rejected with no key material', async () => {
    const ch = await makeV2Challenge('correct horse battery 1');
    const r = await MV.verifyMasterPassword('wrong password', ch, { subtle, iterations: ITER });
    assert.deepEqual({ ...r }, { ok: false, keyHex: null });
});

test('v2: a different salt cannot verify the same password', async () => {
    const ch = await makeV2Challenge('pw-one');
    const other = { ...ch, salt: 'ffeeddccbbaa99887766554433221100' };
    assert.equal((await MV.verifyMasterPassword('pw-one', other, { subtle, iterations: ITER })).ok, false);
});

test('v2: tampered ciphertext fails the GCM tag check', async () => {
    const ch = await makeV2Challenge('pw');
    const flipped = ch.verify_blob.slice(0, -2) + (ch.verify_blob.endsWith('00') ? '01' : '00');
    assert.equal((await MV.verifyMasterPassword('pw', { ...ch, verify_blob: flipped }, { subtle, iterations: ITER })).ok, false);
});

test('v2: malformed or missing challenge fields fail closed instead of throwing', async () => {
    const ch = await makeV2Challenge('pw');
    for (const bad of [
        { ...ch, verify_nonce: 'zz' }, { ...ch, verify_nonce: '' }, { ...ch, salt: 'abc' },
        { ...ch, verify_blob: '' }, null, undefined, {},
    ]) {
        const r = await MV.verifyMasterPassword('pw', bad, { subtle, iterations: ITER });
        assert.equal(r.ok, false);
        assert.equal(r.keyHex, null);
    }
});

test('an empty password never verifies', async () => {
    const ch = await makeV2Challenge('');
    assert.equal((await MV.verifyMasterPassword('', ch, { subtle, iterations: ITER })).ok, false);
});

test('v1 (legacy) uses the injected CryptoJS and fails closed on a wrong key', async () => {
    const calls = [];
    const fakeCJS = {
        enc: { Hex: { parse: (h) => h }, Utf8: 'utf8' },
        PBKDF2: (pw) => { calls.push(pw); return { toString: () => `key-${pw}` }; },
        AES: { decrypt: (_blob, key) => ({ toString: () => {
            if (key.toString() !== 'key-right') throw new Error('Malformed UTF-8 data');
            return MV.VERIFY_PLAINTEXT;
        } }) },
    };
    const ch = { salt: 'aa', verify_blob: 'bb', verify_iv: 'cc' };
    const ok = await MV.verifyMasterPassword('right', ch, { CryptoJS: fakeCJS });
    assert.deepEqual({ ...ok }, { ok: true, keyHex: 'key-right' });
    const bad = await MV.verifyMasterPassword('wrong', ch, { CryptoJS: fakeCJS });
    assert.deepEqual({ ...bad }, { ok: false, keyHex: null });
    assert.deepEqual(calls, ['right', 'wrong']);
});

test('v1 without CryptoJS or verify_iv fails closed', async () => {
    assert.equal((await MV.verifyMasterPassword('p', { salt: 'aa', verify_blob: 'bb', verify_iv: 'cc' }, { CryptoJS: null })).ok, false);
    assert.equal((await MV.verifyMasterPassword('p', { salt: 'aa', verify_blob: 'bb' }, { CryptoJS: {} })).ok, false);
});

test('hex helpers round-trip and reject malformed hex', () => {
    assert.equal(MV.bytesToHex(MV.hexToBytes('00ff10ab')), '00ff10ab');
    assert.throws(() => MV.hexToBytes('abc'));
    assert.throws(() => MV.hexToBytes('zz'));
});
