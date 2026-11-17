/**
 * DevSuite master-password challenge verification (SPEC §7.1 / §7.5).
 *
 * Verifies a password against the server's stored challenge entirely in the browser and,
 * on success, returns the key hex that `POST /api/auth/session` expects. The password is
 * never transmitted, stored, or logged here.
 *
 *   v1 (legacy): CryptoJS PBKDF2-SHA1/50k  -> AES-CBC verify_blob (needs the CryptoJS global)
 *   v2 (current): WebCrypto PBKDF2-SHA256/310k -> 512 bits; Kauth = bits[32:64] decrypts an
 *                 AES-GCM verify_blob and is the value sent as key_hex. Kenc (bits[0:32],
 *                 the vault-encryption key) is never exposed by this module.
 *
 * Added because DevDB Manager only implemented v1, so every vault created with the v2
 * scheme (all new installs) was reported as "Incorrect master password" there.
 * auth-guard.js carries its own copy of this logic for SSH/API Tester.
 *
 * Browser global: MasterVerify. require()-able in node for the unit suite.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.MasterVerify = api; }
})(globalThis, function () {
    'use strict';

    const VERIFY_PLAINTEXT = 'DEVSUITE_MASTER_OK';
    const V2_ITERATIONS = 310000;
    const V1_ITERATIONS = 50000;
    const FAIL = Object.freeze({ ok: false, keyHex: null });

    function hexToBytes(hex) {
        const clean = String(hex || '');
        if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) throw new Error('bad hex');
        const out = new Uint8Array(clean.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
        return out;
    }

    function bytesToHex(bytes) {
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }

    /** Derive Kauth (second 256 bits of PBKDF2-SHA256/310k -> 512 bits) as bytes. */
    async function deriveKauthV2(password, saltHex, subtle, iterations) {
        const km = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await subtle.deriveBits(
            { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations: iterations || V2_ITERATIONS },
            km, 512,
        );
        return new Uint8Array(bits).slice(32, 64);
    }

    async function verifyV2(password, ch, opts) {
        if (!ch.verify_nonce) return FAIL;
        const subtle = opts.subtle || globalThis.crypto.subtle;
        try {
            const kauth = await deriveKauthV2(password, ch.salt, subtle, opts.iterations);
            const aesKey = await subtle.importKey('raw', kauth, { name: 'AES-GCM' }, false, ['decrypt']);
            const plain = await subtle.decrypt(
                { name: 'AES-GCM', iv: hexToBytes(ch.verify_nonce) }, aesKey, hexToBytes(ch.verify_blob),
            );
            const ok = new TextDecoder().decode(plain) === VERIFY_PLAINTEXT;
            return ok ? { ok: true, keyHex: bytesToHex(kauth) } : FAIL;
        } catch {
            return FAIL; // wrong password => AES-GCM auth-tag failure; malformed challenge => bad hex
        }
    }

    function verifyV1(password, ch, opts) {
        const CJS = opts.CryptoJS || globalThis.CryptoJS;
        if (!CJS || !ch.verify_iv) return FAIL;
        try {
            const key = CJS.PBKDF2(password, CJS.enc.Hex.parse(ch.salt), { keySize: 256 / 32, iterations: V1_ITERATIONS });
            const dec = CJS.AES.decrypt(ch.verify_blob, key, { iv: CJS.enc.Hex.parse(ch.verify_iv) });
            const ok = dec.toString(CJS.enc.Utf8) === VERIFY_PLAINTEXT; // throws "Malformed UTF-8" on a wrong key
            return ok ? { ok: true, keyHex: key.toString() } : FAIL;
        } catch {
            return FAIL;
        }
    }

    /**
     * @param {string} password
     * @param {object} challenge  body of GET /api/auth/challenge
     * @param {object} [opts]     test seams: { subtle, CryptoJS, iterations }
     * @returns {Promise<{ok: boolean, keyHex: string|null}>}
     */
    async function verifyMasterPassword(password, challenge, opts) {
        const options = opts || {};
        const ch = challenge || {};
        if (!password || !ch.salt || !ch.verify_blob) return FAIL;
        return (ch.challenge_version || 1) === 2 ? verifyV2(password, ch, options) : verifyV1(password, ch, options);
    }

    return { verifyMasterPassword, hexToBytes, bytesToHex, deriveKauthV2, VERIFY_PLAINTEXT };
});
