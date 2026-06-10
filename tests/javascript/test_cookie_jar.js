/** Unit tests for static/cookie-jar.js (SPEC §4.7.5). */
'use strict';

const assert = require('node:assert/strict');
const Jar = require('../../static/cookie-jar.js');

const URL_API = 'https://api.example.com/v1/users';

// ─── parse ────────────────────────────────────────────────────────────────────

test('parses a minimal cookie with host + default path from the request URL', () => {
    const c = Jar.parse('sid=abc123', URL_API);
    assert.equal(c.name, 'sid');
    assert.equal(c.value, 'abc123');
    assert.equal(c.domain, 'api.example.com');
    assert.equal(c.hostOnly, true);
    assert.equal(c.path, '/v1'); // request path up to the last slash (RFC 6265 §5.1.4)
    assert.equal(c.expires, null); // session cookie
    assert.equal(c.secure, false);
});

test('parses Path, Domain, Secure, and Max-Age attributes', () => {
    const c = Jar.parse('sid=abc; Path=/; Domain=.example.com; Secure; Max-Age=3600', URL_API);
    assert.equal(c.path, '/');
    assert.equal(c.domain, 'example.com');
    assert.equal(c.hostOnly, false);
    assert.equal(c.secure, true);
    assert.ok(c.expires > Date.now() + 3500 * 1000);
});

test('rejects a Domain that is not a suffix of the request host', () => {
    const c = Jar.parse('sid=abc; Domain=evil.com', URL_API);
    assert.equal(c.domain, 'api.example.com'); // attribute ignored
    assert.equal(c.hostOnly, true);
});

test('Max-Age wins over Expires in either order', () => {
    const past = 'Wed, 01 Jan 2020 00:00:00 GMT';
    const a = Jar.parse(`sid=a; Expires=${past}; Max-Age=600`, URL_API);
    assert.ok(a.expires > Date.now());
    const b = Jar.parse(`sid=b; Max-Age=600; Expires=${past}`, URL_API);
    assert.ok(b.expires > Date.now());
});

test('returns null for malformed input', () => {
    assert.equal(Jar.parse('', URL_API), null);
    assert.equal(Jar.parse('=value-without-name', URL_API), null);
    assert.equal(Jar.parse('sid=abc', 'not a url'), null);
});

// ─── matching ─────────────────────────────────────────────────────────────────

test('domainMatch: hostOnly requires exact host; otherwise suffix match', () => {
    assert.equal(Jar.domainMatch('api.example.com', 'api.example.com', true), true);
    assert.equal(Jar.domainMatch('api.example.com', 'example.com', true), false);
    assert.equal(Jar.domainMatch('api.example.com', 'example.com', false), true);
    assert.equal(Jar.domainMatch('badexample.com', 'example.com', false), false);
});

test('pathMatch follows RFC 6265 §5.1.4 boundaries', () => {
    assert.equal(Jar.pathMatch('/api', '/api'), true);
    assert.equal(Jar.pathMatch('/api/users', '/api'), true);
    assert.equal(Jar.pathMatch('/api2', '/api'), false);
    assert.equal(Jar.pathMatch('/anything', '/'), true);
});

// ─── jar operations ───────────────────────────────────────────────────────────

test('upsert replaces a cookie with the same name+domain+path', () => {
    const jar = [];
    Jar.upsert(jar, Jar.parse('sid=old; Path=/', URL_API));
    Jar.upsert(jar, Jar.parse('sid=new; Path=/', URL_API));
    assert.equal(jar.length, 1);
    assert.equal(jar[0].value, 'new');
});

test('an expired upsert deletes the cookie (server-initiated removal)', () => {
    const jar = [];
    Jar.upsert(jar, Jar.parse('sid=abc; Path=/', URL_API));
    Jar.upsert(jar, Jar.parse('sid=abc; Path=/; Max-Age=0', URL_API));
    assert.equal(jar.length, 0);
});

test('cookiesFor filters by domain, path, expiry, and Secure', () => {
    const jar = [];
    Jar.upsert(jar, Jar.parse('a=1; Path=/; Domain=example.com', URL_API));
    Jar.upsert(jar, Jar.parse('b=2; Path=/v1', URL_API));
    Jar.upsert(jar, Jar.parse('c=3; Path=/; Secure', URL_API));
    Jar.upsert(jar, Jar.parse('d=4; Path=/other', URL_API));

    const httpsNames = Jar.cookiesFor(jar, 'https://api.example.com/v1/items').map(c => c.name);
    assert.deepEqual([...httpsNames].sort(), ['a', 'b', 'c']);
    // most-specific path first
    assert.equal(httpsNames[0], 'b');

    const httpNames = Jar.cookiesFor(jar, 'http://api.example.com/v1/items').map(c => c.name);
    assert.equal(httpNames.includes('c'), false); // Secure cookie withheld over http

    const otherHost = Jar.cookiesFor(jar, 'https://web.example.com/v1/');
    assert.deepEqual(otherHost.map(c => c.name), ['a']); // only the Domain=example.com cookie
});

test('headerFor builds a Cookie header and prune drops expired cookies', () => {
    const jar = [];
    Jar.upsert(jar, Jar.parse('sid=abc; Path=/', URL_API));
    Jar.upsert(jar, Jar.parse('theme=dark; Path=/', URL_API));
    assert.equal(Jar.headerFor(jar, 'https://api.example.com/'), 'sid=abc; theme=dark');
    assert.equal(Jar.headerFor(jar, 'https://unrelated.io/'), '');

    jar[0].expires = Date.now() - 1000;
    Jar.prune(jar);
    assert.equal(jar.length, 1);
    assert.equal(jar[0].name, 'theme');
});
