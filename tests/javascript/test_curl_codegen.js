/** Unit tests for static/curl-codegen.js (SPEC §4.7.3). */
'use strict';

const assert = require('node:assert/strict');
const Curl = require('../../static/curl-codegen.js');

// ─── parseCurl ────────────────────────────────────────────────────────────────

test('parses a bare GET', () => {
    const cfg = Curl.parseCurl('curl https://api.example.com/users');
    assert.equal(cfg.method, 'GET');
    assert.equal(cfg.url, 'https://api.example.com/users');
    assert.deepEqual(cfg.headers, []);
    assert.equal(cfg.bodyType, 'none');
});

test('splits the URL query string into queryParams', () => {
    const cfg = Curl.parseCurl('curl "https://api.example.com/search?q=hello world&page=2"');
    assert.equal(cfg.url, 'https://api.example.com/search');
    assert.deepEqual(cfg.queryParams, [
        { key: 'q', value: 'hello world', enabled: true },
        { key: 'page', value: '2', enabled: true },
    ]);
});

test('parses -X, -H, and a JSON -d body', () => {
    const cfg = Curl.parseCurl(
        `curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -H 'Authorization: Bearer tok123' -d '{"name":"Ada"}'`);
    assert.equal(cfg.method, 'POST');
    assert.deepEqual(cfg.headers, [
        { key: 'Content-Type', value: 'application/json', enabled: true },
        { key: 'Authorization', value: 'Bearer tok123', enabled: true },
    ]);
    assert.equal(cfg.bodyType, 'json');
    assert.equal(cfg.body, '{"name":"Ada"}');
});

test('-d without -X implies POST; JSON detected from body shape', () => {
    const cfg = Curl.parseCurl(`curl https://x.io/a -d '{"a":1}'`);
    assert.equal(cfg.method, 'POST');
    assert.equal(cfg.bodyType, 'json');
});

test('multiple -d parts join with & as a text body', () => {
    const cfg = Curl.parseCurl('curl https://x.io/form -d a=1 -d b=2');
    assert.equal(cfg.bodyType, 'text');
    assert.equal(cfg.body, 'a=1&b=2');
});

test('-G moves -d data into queryParams', () => {
    const cfg = Curl.parseCurl('curl -G https://x.io/search -d q=test -d lang=en');
    assert.equal(cfg.method, 'GET');
    assert.equal(cfg.bodyType, 'none');
    assert.deepEqual(cfg.queryParams, [
        { key: 'q', value: 'test', enabled: true },
        { key: 'lang', value: 'en', enabled: true },
    ]);
});

test('parses -u basic auth', () => {
    const cfg = Curl.parseCurl('curl -u alice:s3cret https://x.io/');
    assert.deepEqual(cfg.auth, { type: 'basic', username: 'alice', password: 's3cret' });
});

test('parses -F form fields', () => {
    const cfg = Curl.parseCurl('curl -F name=Ada -F role=admin https://x.io/upload');
    assert.equal(cfg.bodyType, 'form-data');
    assert.equal(cfg.method, 'POST');
    assert.deepEqual(cfg.body, [
        { key: 'name', value: 'Ada', enabled: true },
        { key: 'role', value: 'admin', enabled: true },
    ]);
});

test('inline -b cookie becomes a Cookie header; -b cookie-file is ignored', () => {
    const withCookie = Curl.parseCurl('curl -b "sid=abc; theme=dark" https://x.io/');
    assert.deepEqual(withCookie.headers, [{ key: 'Cookie', value: 'sid=abc; theme=dark', enabled: true }]);
    const withFile = Curl.parseCurl('curl -b cookies.txt https://x.io/');
    assert.deepEqual(withFile.headers, []);
});

test('handles backslash line continuations and escaped single quotes', () => {
    const cmd = "curl -X PUT \\\n  https://x.io/v1 \\\n  -d 'it'\\''s fine'";
    const cfg = Curl.parseCurl(cmd);
    assert.equal(cfg.method, 'PUT');
    assert.equal(cfg.body, "it's fine");
});

test('handles double-quoted strings with escapes and $\'…\' ANSI-C quoting', () => {
    assert.deepEqual(Curl.tokenize('curl "a \\"b\\" c"'), ['curl', 'a "b" c']);
    assert.deepEqual(Curl.tokenize("curl $'line1\\nline2'"), ['curl', 'line1\nline2']);
});

test('-I sets HEAD; ignored value-flags do not eat the URL', () => {
    const cfg = Curl.parseCurl('curl -I -o /dev/null --max-time 5 https://x.io/ping');
    assert.equal(cfg.method, 'HEAD');
    assert.equal(cfg.url, 'https://x.io/ping');
});

test('rejects non-curl input and missing URLs', () => {
    assert.throws(() => Curl.parseCurl('wget https://x.io/'), /curl/);
    assert.throws(() => Curl.parseCurl('curl -s -L'), /URL/);
});

// ─── code generation ──────────────────────────────────────────────────────────

const resolvedConfig = {
    url: 'https://api.example.com/users',
    method: 'POST',
    queryParams: { page: '2' },
    headers: { 'X-Trace': 'abc' },
    auth: { type: 'bearer', token: 'tok123' },
    bodyType: 'json',
    body: '{"name":"Ada"}',
};

test('finalize merges auth, query params, and default Content-Type', () => {
    const fin = Curl.finalize(resolvedConfig);
    assert.equal(fin.url, 'https://api.example.com/users?page=2');
    assert.equal(fin.headers['Authorization'], 'Bearer tok123');
    assert.equal(fin.headers['Content-Type'], 'application/json');
    assert.equal(fin.body, '{"name":"Ada"}');
});

test('finalize encodes basic auth and skips bodies on GET', () => {
    const fin = Curl.finalize({
        url: 'https://x.io/', method: 'GET',
        auth: { type: 'basic', username: 'alice', password: 's3cret' },
        bodyType: 'json', body: '{"ignored":true}',
    });
    assert.equal(fin.headers['Authorization'], `Basic ${Buffer.from('alice:s3cret').toString('base64')}`);
    assert.equal(fin.body, null);
});

test('buildCurl emits a multi-line quoted command', () => {
    const cmd = Curl.buildCurl(resolvedConfig);
    assert.match(cmd, /^curl -X POST 'https:\/\/api\.example\.com\/users\?page=2' \\\n/);
    assert.match(cmd, /-H 'Authorization: Bearer tok123'/);
    assert.match(cmd, /-d '\{"name":"Ada"\}'/);
});

test('buildCurl escapes single quotes shell-safely', () => {
    const cmd = Curl.buildCurl({ url: "https://x.io/it's", method: 'GET' });
    assert.ok(cmd.includes("'https://x.io/it'\\''s'"));
});

test('buildFetch emits method, headers, and body', () => {
    const js = Curl.buildFetch(resolvedConfig);
    assert.match(js, /^fetch\("https:\/\/api\.example\.com\/users\?page=2", \{/);
    assert.match(js, /"method": "POST"/);
    assert.match(js, /"Authorization": "Bearer tok123"/);
    assert.match(js, /"body": "\{\\"name\\":\\"Ada\\"\}"/);
});

test('buildHttpie pipes raw bodies via stdin and uses k:v headers', () => {
    const cmd = Curl.buildHttpie(resolvedConfig);
    assert.match(cmd, /^echo '\{"name":"Ada"\}' \| http POST/);
    assert.match(cmd, /'Authorization:Bearer tok123'/);
    const bare = Curl.buildHttpie({ url: 'https://x.io/', method: 'GET' });
    assert.equal(bare, "http GET 'https://x.io/'");
});

test('parseCurl → buildCurl round-trips the essentials', () => {
    const item = Curl.parseCurl(
        `curl -X PATCH 'https://x.io/v1/items/9?dry=1' -H 'Content-Type: application/json' -d '{"q":true}'`);
    // adapt item (entry arrays) to the resolved shape (objects) like the page does
    const toObj = (rows) => Object.fromEntries(rows.map(r => [r.key, r.value]));
    const cmd = Curl.buildCurl({
        url: item.url, method: item.method,
        queryParams: toObj(item.queryParams), headers: toObj(item.headers),
        auth: item.auth, bodyType: item.bodyType, body: item.body,
    });
    assert.match(cmd, /-X PATCH/);
    assert.match(cmd, /dry=1/);
    assert.match(cmd, /-d '\{"q":true\}'/);
});
