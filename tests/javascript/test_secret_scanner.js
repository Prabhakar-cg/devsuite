/** Unit tests for static/secret-scanner.js — detection engine (feature 021, SC-001…SC-006, SC-008). */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SS = require('../../static/secret-scanner.js');

// Secret-shaped fixtures are assembled at runtime from fragments so that no complete credential-looking
// literal exists in the repository (GitHub push protection flags them even when they are fake).
const j = (...parts) => parts.join('');

const find = (text, type) => SS.scan(text).findings.filter((f) => !type || f.type === type);

// ── SC-002: every supported shape is detected ──
const CORPUS = {
    'aws-access-key': j('aws_access_key_id = ', 'AKI', 'AJ3Q7XK2LMN5PRT4V'),
    'github-token': j('token ', 'gh', 'p_9aB3dE5fG7hJ2kL4mN6pQ8rS0tU1vW3xY5zA', ' done'),
    'openai': j('OPENAI = ', 's', 'k-proj-9fK2LmQ7xW3vB8nT5yH1cR6dZ0aS4eU'),
    'anthropic': j('key: ', 's', 'k-ant-api03-Zk4mQ8rS0tU1vW3xY5zAbC7dE9fG'),
    'jwt': j('Authorization: Bearer ', 'ey', 'JhbGciOiJIUzI1NiJ9.', 'ey', 'JzdWIiOiIxMjM0NTYifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'),
    'private-key': j('-----BEGIN ', 'OPENSSH ', 'PRIVATE KEY-----', '\nb3BlbnNzaC1rZXk'),
    'slack-token': j('xo', 'xb-1234567890-abcdefghijkl'),
    'stripe-key': j('s', 'k_li', 've_', '4eC39HqLyjWDarjtT1zdp7dc'),
    'google-api-key': j('AI', 'zaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY'),
};
for (const [type, text] of Object.entries(CORPUS)) {
    test(`detects ${type} with type, location and a redacted preview`, () => {
        const f = find(text, type);
        assert.equal(f.length, 1, `${type}: ${JSON.stringify(SS.scan(text).findings.map((x) => x.type))}`);
        assert.equal(f[0].confidence, 'high');
        assert.ok(f[0].line >= 1 && f[0].col >= 1);
        if (type !== 'private-key') assert.ok(!f[0].preview.includes(f[0].value), 'preview must be redacted');
    });
}

test('openai and anthropic keys are not confused', () => {
    assert.equal(find(CORPUS.anthropic, 'openai').length, 0);
    assert.equal(find(CORPUS.openai, 'anthropic').length, 0);
});

// ── SC-003: look-alikes are not reported at high confidence ──
test('UUIDs, hashes, base64 blobs and ordinary prose produce no high-confidence findings', () => {
    const text = [
        'id: 550e8400-e29b-41d4-a716-446655440000',
        'sha256: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        'image: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'The quick brown fox jumps over the lazy dog and says nothing secret.',
    ].join('\n');
    const r = SS.scan(text);
    assert.equal(r.findings.filter((f) => f.confidence === 'high').length, 0);
    assert.equal(r.findings.length, 0);
});

// ── generic key-like assignments ──
test('flags a high-entropy value assigned to a credential-like name', () => {
    const f = find('DB_PASSWORD="Zk4mQ8rS0tU1vW3xY5zA9bC"');
    assert.equal(f.length, 1);
    assert.equal(f[0].type, 'generic-secret');
    assert.ok(['medium', 'low'].includes(f[0].confidence));
});

test('does not flag references, placeholders or low-entropy values', () => {
    for (const t of ['API_KEY=${MY_API_KEY}', 'API_KEY=$MY_API_KEY', 'API_KEY=your_api_key_here', 'TOKEN=xxxxxxxxxxxxxxxx',
        'PASSWORD=aaaaaaaaaaaaaaaa', 'SECRET=<insert-secret-here>', 'AUTH_HEADER=changemechangeme']) {
        assert.equal(SS.scan(t).findings.length, 0, t);
    }
});

test('documentation placeholders that match a known shape are demoted to low confidence', () => {
    const f = find(j('AWS_KEY=', 'AKI', 'AIOSFODNN7EXAMPLE'), 'aws-access-key');
    assert.equal(f.length, 1);
    assert.equal(f[0].confidence, 'low');
});

// ── locations ──
test('reports 1-based line and column for each finding', () => {
    const f = find('line one\nline two\n' + j('  token=', 'gh', 'p_9aB3dE5fG7hJ2kL4mN6pQ8rS0tU1vW3xY5zA'), 'github-token')[0];
    assert.equal(f.line, 3);
    assert.equal(f.col, 9);
});

test('redaction never exposes the middle of a value and short values are fully masked', () => {
    const v = j('s', 'k-proj-9fK2LmQ7xW3vB8nT5yH1cR6dZ0aS4eU');
    const p = SS.redact(v);
    assert.ok(p.startsWith('sk-p') && p.endsWith('eU') && !p.includes('9fK2'));
    assert.equal(SS.redact('abc'), '••••');
});

// ── empty / no-findings states ──
test('empty input is distinguishable from a clean scan', () => {
    assert.equal(SS.scan('   \n ').scannedChars, 0);
    assert.equal(SS.scan('hello world, nothing here').scannedChars, 'hello world, nothing here'.length);
    assert.equal(SS.scan('hello world, nothing here').findings.length, 0);
});

test('results always reflect the current text (no stale findings)', () => {
    assert.equal(find(CORPUS.openai).length, 1);
    assert.equal(find('now it is harmless').length, 0);
});

// ── US2: MCP manifests ──
const MCP = JSON.stringify({
    mcpServers: {
        search: { command: 'npx', env: { API_KEY: j('s', 'k-proj-9fK2LmQ7xW3vB8nT5yH1cR6dZ0aS4eU'), REGION: 'eu-west-1' } },
        files: { command: 'npx', env: { TOKEN: '${FILES_TOKEN}', EMPTY: '', HOME_DIR: '$HOME/.config' } },
        other: { command: 'node', env: { API_KEY: j('s', 'k-ant-api03-Zk4mQ8rS0tU1vW3xY5zAbC7dE9fG') } },
    },
}, null, 2);

test('manifest mode flags only literal secrets and attributes them to server + variable', () => {
    const r = SS.scan(MCP);
    assert.equal(r.manifest, true);
    const m = r.findings.filter((f) => f.mcp);
    assert.deepEqual(m.map((f) => `${f.server}.${f.envName}`).sort(), ['other.API_KEY', 'search.API_KEY']);
    assert.ok(m.every((f) => f.confidence === 'high'));
});

test('the same variable name in two servers stays attributable (no merging)', () => {
    const m = SS.scan(MCP).findings.filter((f) => f.mcp && f.envName === 'API_KEY');
    assert.equal(m.length, 2);
    assert.notEqual(m[0].server, m[1].server);
    assert.notEqual(m[0].line, m[1].line);
});

test('references, empty values and path expansions are never flagged (SC-004)', () => {
    const flagged = SS.scan(MCP).findings.map((f) => f.envName);
    for (const n of ['TOKEN', 'EMPTY', 'HOME_DIR', 'REGION']) assert.ok(!flagged.includes(n), n);
});

test('manifest findings replace the overlapping generic ones (reported once)', () => {
    const keys = SS.scan(MCP).findings.filter((f) => f.value.startsWith('sk-'));
    assert.equal(keys.length, 2);
});

test('invalid or non-manifest JSON falls back to generic scanning without throwing', () => {
    assert.equal(SS.scan(j('{ not json ', 's', 'k-proj-9fK2LmQ7xW3vB8nT5yH1cR6dZ0aS4eU')).manifest, false);
    assert.equal(find(j('{ not json ', 's', 'k-proj-9fK2LmQ7xW3vB8nT5yH1cR6dZ0aS4eU'), 'openai').length, 1);
    assert.equal(SS.scan('{"mcpServers": {"a": {"env": "oops"}}}').manifest, true);
    assert.equal(SS.scan('{"mcpServers": []}').manifest, false);
    assert.equal(SS.scan('[1,2,3]').manifest, false);
});

test('a non-object env block degrades gracefully', () => {
    const r = SS.scan(JSON.stringify({ mcpServers: { a: { env: ['x'] }, b: { env: null }, c: 5 } }));
    assert.equal(r.manifest, true);
    assert.equal(r.findings.length, 0);
});

// ── FR-013: remediation never rewrites the input ──
test('correctedManifest replaces literals with ${VAR} references and leaves the input untouched', () => {
    const before = MCP;
    const findings = SS.scan(MCP).findings;
    const fixed = SS.correctedManifest(MCP, findings);
    assert.equal(MCP, before);
    assert.ok(!fixed.includes('sk-proj-') && !fixed.includes('sk-ant-'));
    const doc = JSON.parse(fixed);
    assert.equal(doc.mcpServers.search.env.API_KEY, '${API_KEY}');
    assert.equal(doc.mcpServers.other.env.API_KEY, '${API_KEY}');
    assert.equal(doc.mcpServers.files.env.TOKEN, '${FILES_TOKEN}');
    assert.equal(doc.mcpServers.search.env.REGION, 'eu-west-1');
});

test('correctedManifest on a clean manifest is the identical text', () => {
    const clean = JSON.stringify({ mcpServers: { a: { env: { K: '${K}' } } } });
    assert.equal(SS.correctedManifest(clean, SS.scan(clean).findings), clean);
});

// ── SC-008: 1 MB stays fast ──
test('a 1 MB paste scans in well under a second or two', () => {
    const chunk = 'The quick brown fox jumps over the lazy dog. id=550e8400-e29b-41d4-a716-446655440000\n';
    let text = '';
    while (text.length < 1024 * 1024) text += chunk;
    text += j('secret ', 'gh', 'p_9aB3dE5fG7hJ2kL4mN6pQ8rS0tU1vW3xY5zA', '\n');
    const t0 = Date.now();
    const r = SS.scan(text);
    const ms = Date.now() - t0;
    assert.equal(r.findings.filter((f) => f.type === 'github-token').length, 1);
    assert.ok(ms < 3000, `scan took ${ms}ms`);
});

test('oversized input is truncated with a flag instead of freezing', () => {
    const r = SS.scan('a'.repeat(SS.MAX_SCAN_CHARS + 10));
    assert.equal(r.truncated, true);
    assert.equal(r.scannedChars, SS.MAX_SCAN_CHARS);
});

// ── entropy ──
test('shannonEntropy behaves sensibly', () => {
    assert.equal(SS.shannonEntropy(''), 0);
    assert.equal(SS.shannonEntropy('aaaa'), 0);
    assert.ok(SS.shannonEntropy('Zk4mQ8rS0tU1vW3xY5zA') > 4);
});

// ── SC-006 / FR-014 / FR-015: no network, no storage, no markup sinks in the engine ──
test('the engine contains no network, storage or HTML sinks', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../static/secret-scanner.js'), 'utf8');
    for (const bad of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'localStorage', 'sessionStorage',
        'indexedDB', 'innerHTML', 'document.', 'eval(', 'new Function']) {
        assert.ok(!src.includes(bad), `engine must not use ${bad}`);
    }
});

test('the bundled sample exercises both modes', () => {
    const r = SS.scan(SS.SAMPLE);
    assert.equal(r.manifest, false, 'sample has comment lines so it is generic mode, the manifest part is scanned as text');
    assert.ok(r.findings.some((f) => f.type === 'openai') && r.findings.some((f) => f.type === 'github-token'));
});
