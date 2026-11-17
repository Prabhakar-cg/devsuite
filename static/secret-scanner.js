/**
 * DevSuite Secret Scanner — detection engine (feature 021, SPEC §4 index)
 * -----------------------------------------------------------------------
 * Pure, dependency-free module: regex shapes + Shannon entropy + MCP-manifest awareness.
 * No DOM, no network, no storage — everything stays in memory in the caller's page
 * (Constitution II). Loaded in the browser as globalThis.SecretScanner; require()-able
 * in node for the unit suite in tests/javascript/.
 *
 * Finding: { type, label, confidence: 'high'|'medium'|'low', line, col, start, end, length,
 *            preview (redacted), value (full, kept in memory for an explicit "reveal"),
 *            server?, envName? }       line/col are 1-based.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.SecretScanner = api; }
})(globalThis, function () {
    'use strict';

    const MAX_SCAN_CHARS = 5 * 1024 * 1024;   // hard cap so a pathological paste can't freeze the tab

    // ── Known secret shapes (high confidence) ────────────────────────────────
    // Order matters only for overlap resolution: earlier = more specific.
    const SHAPES = [
        { type: 'anthropic', label: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
        { type: 'openai', label: 'OpenAI API key', re: /\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g },
        { type: 'aws-access-key', label: 'AWS access key ID', re: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA|ANVA|AIPA)[A-Z0-9]{16}\b/g },
        { type: 'github-token', label: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255})/g },
        { type: 'slack-token', label: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
        { type: 'stripe-key', label: 'Stripe secret key', re: /\b[sr]k_live_[A-Za-z0-9]{16,}/g },
        { type: 'google-api-key', label: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
        { type: 'jwt', label: 'JSON Web Token', re: /\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g },
        {
            type: 'private-key', label: 'Private key (PEM header)',
            re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g,
        },
    ];

    // KEY=VALUE / key: "value" where the NAME looks credential-ish.
    const KEYLIKE = '[A-Za-z0-9_.-]*(?:SECRET|TOKEN|PASSWORD|PASSWD|PWD|API[_-]?KEY|APIKEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|AUTH|CREDENTIAL)[A-Za-z0-9_.-]*';
    const ASSIGNMENT_RE = new RegExp('(?<![A-Za-z0-9_.-])(' + KEYLIKE + ')["\']?\\s*[:=]\\s*["\']?([^\\s"\'#,;`<>]{12,})', 'gi');
    const KEYLIKE_NAME_RE = new RegExp('^' + KEYLIKE + '$', 'i');

    const REFERENCE_RE = /^(?:\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*|%[A-Za-z_][A-Za-z0-9_]*%|\{\{[^}]*\}\})$/;
    const PLACEHOLDER_RE = /(?:x{6,}|\*{4,}|\.{3,}|your[_-]|<[^>]+>|changeme|example|placeholder|dummy|sample|todo|redacted|insert[_-]?here)/i;

    /** Shannon entropy in bits per character. */
    function shannonEntropy(s) {
        if (!s) return 0;
        const freq = new Map();
        for (const ch of s) freq.set(ch, (freq.get(ch) || 0) + 1);
        let h = 0;
        const n = [...s].length;
        for (const c of freq.values()) { const p = c / n; h -= p * Math.log2(p); }
        return h;
    }

    function isReference(v) { return v === '' || REFERENCE_RE.test(String(v).trim()); }
    function looksLikePlaceholder(v) { return PLACEHOLDER_RE.test(v); }

    /** Redacted preview — never the full value. */
    function redact(value) {
        const v = String(value);
        if (v.length <= 8) return '•'.repeat(Math.max(4, v.length));
        return v.slice(0, 4) + '…' + '•'.repeat(4) + v.slice(-2);
    }

    // ── Position helpers ─────────────────────────────────────────────────────
    function lineStarts(text) {
        const starts = [0];
        for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
        return starts;
    }

    function locate(starts, offset) {
        let lo = 0, hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
        }
        return { line: lo + 1, col: offset - starts[lo] + 1 };
    }

    function makeFinding(starts, type, label, confidence, start, value, extra) {
        const pos = locate(starts, start);
        return Object.assign({
            type, label, confidence, start, end: start + value.length, length: value.length,
            line: pos.line, col: pos.col, preview: type === 'private-key' ? '-----BEGIN … PRIVATE KEY-----' : redact(value), value,
        }, extra || {});
    }

    // ── Generic text scan ────────────────────────────────────────────────────
    function scanGeneric(text) {
        const starts = lineStarts(text);
        const out = [];
        for (const shape of SHAPES) {
            shape.re.lastIndex = 0;
            let m;
            while ((m = shape.re.exec(text)) !== null) {
                const v = m[0];
                const conf = looksLikePlaceholder(v) ? 'low' : 'high';
                out.push(makeFinding(starts, shape.type, shape.label, conf, m.index, v));
            }
        }
        ASSIGNMENT_RE.lastIndex = 0;
        let m;
        while ((m = ASSIGNMENT_RE.exec(text)) !== null) {
            const value = m[2];
            if (isReference(value) || value.startsWith('$')) continue;
            const valueStart = m.index + m[0].length - value.length;
            const h = shannonEntropy(value);
            if (looksLikePlaceholder(value) || h < 3.0) continue;
            out.push(makeFinding(starts, 'generic-secret', 'High-entropy value for "' + m[1] + '"',
                h >= 4.0 ? 'medium' : 'low', valueStart, value, { envName: m[1] }));
        }
        return resolveOverlaps(out);
    }

    /** Keep the most specific finding when ranges overlap (high > medium > low, then longer). */
    function resolveOverlaps(findings) {
        const rank = { high: 3, medium: 2, low: 1 };
        const sorted = findings.slice().sort((a, b) => a.start - b.start || rank[b.confidence] - rank[a.confidence] || b.length - a.length);
        const kept = [];
        for (const f of sorted) {
            const prev = kept[kept.length - 1];
            if (prev && f.start < prev.end) {
                if (rank[f.confidence] > rank[prev.confidence] || (f.type !== 'generic-secret' && prev.type === 'generic-secret')) kept[kept.length - 1] = f;
                continue;
            }
            kept.push(f);
        }
        return kept;
    }

    // ── MCP manifest awareness ───────────────────────────────────────────────
    /** Parse text as an MCP server manifest. Returns { servers } or null (never throws). */
    function parseMcpManifest(text) {
        let doc;
        try { doc = JSON.parse(text); } catch { return null; }
        if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
        const servers = doc.mcpServers;
        if (!servers || typeof servers !== 'object' || Array.isArray(servers)) return null;
        return { servers };
    }

    function shapeOf(value) {
        for (const s of SHAPES) { s.re.lastIndex = 0; if (s.re.test(value)) { s.re.lastIndex = 0; return s; } }
        return null;
    }

    /** Offset of the JSON string literal for `value` inside the env block of `server`/`envName`, or -1. */
    function findEnvValueOffset(text, server, envName, value) {
        const serverKey = JSON.stringify(server);
        let from = text.indexOf(serverKey);
        if (from < 0) return -1;
        const envKeyIdx = text.indexOf(JSON.stringify(envName), from);
        if (envKeyIdx < 0) return -1;
        const lit = JSON.stringify(value);
        const at = text.indexOf(lit, envKeyIdx);
        return at < 0 ? -1 : at + 1;   // +1: skip the opening quote so ranges cover only the raw value
    }

    function scanMcpManifest(text) {
        const manifest = parseMcpManifest(text);
        if (!manifest) return null;
        const starts = lineStarts(text);
        const findings = [];
        for (const [server, def] of Object.entries(manifest.servers)) {
            const env = def && typeof def === 'object' ? def.env : null;
            if (!env || typeof env !== 'object' || Array.isArray(env)) continue;
            for (const [envName, raw] of Object.entries(env)) {
                if (typeof raw !== 'string' || isReference(raw)) continue;
                const shape = shapeOf(raw);
                let type, label, conf;
                if (shape) { type = shape.type; label = shape.label; conf = looksLikePlaceholder(raw) ? 'low' : 'high'; }
                else if (KEYLIKE_NAME_RE.test(envName) && raw.length >= 8 && !looksLikePlaceholder(raw) && shannonEntropy(raw) >= 3.0) {
                    type = 'generic-secret'; label = 'Literal value for "' + envName + '"'; conf = shannonEntropy(raw) >= 4.0 ? 'medium' : 'low';
                } else continue;
                const off = findEnvValueOffset(text, server, envName, raw);
                const start = off < 0 ? 0 : off;
                findings.push(makeFinding(starts, type, label, conf, start, raw, { server, envName, mcp: true, located: off >= 0 }));
            }
        }
        return findings;
    }

    /**
     * Scan text. Returns { findings, manifest, truncated, scannedChars }.
     * In manifest mode, env findings (with server/envName) replace overlapping generic ones.
     */
    function scan(text) {
        const input = typeof text === 'string' ? text : '';
        const truncated = input.length > MAX_SCAN_CHARS;
        const body = truncated ? input.slice(0, MAX_SCAN_CHARS) : input;
        if (!body.trim()) return { findings: [], manifest: false, truncated: false, scannedChars: 0 };
        let findings = scanGeneric(body);
        const mcp = truncated ? null : scanMcpManifest(body);
        if (mcp) {
            const mcpRanges = mcp.filter((f) => f.located);
            findings = findings.filter((g) => !mcpRanges.some((f) => g.start < f.end && f.start < g.end)).concat(mcp);
            findings.sort((a, b) => a.start - b.start);
        }
        return { findings, manifest: Boolean(mcp), truncated, scannedChars: body.length };
    }

    /**
     * Suggested corrected manifest: literal MCP env secrets replaced by ${ENV_NAME} references.
     * Returns a NEW string; the input is never modified (FR-013).
     */
    function correctedManifest(text, findings) {
        const fixes = (findings || []).filter((f) => f.mcp && f.located).sort((a, b) => b.start - a.start);
        let out = text;
        for (const f of fixes) out = out.slice(0, f.start) + '${' + f.envName + '}' + out.slice(f.end);
        return out;
    }

    // Sample secrets are assembled from fragments so no complete credential-shaped literal sits in source
    // (GitHub push protection flags them even when fake).
    const FAKE_OPENAI = ['s', 'k-proj-9fK2LmQ7xW3vB8nT5yH1cR6dZ0aS4eU'].join('');
    const FAKE_GITHUB = ['gh', 'p_9aB3dE5fG7hJ2kL4mN6pQ8rS0tU1vW3xY5zA'].join('');

    const SAMPLE = [
        '# Example: an MCP config that leaked a key, plus a .env fragment',
        '{',
        '  "mcpServers": {',
        '    "search": { "command": "npx", "args": ["-y", "search-mcp"], "env": { "API_KEY": "' + FAKE_OPENAI + '" } },',
        '    "files":  { "command": "npx", "args": ["-y", "files-mcp"],  "env": { "TOKEN": "${FILES_TOKEN}" } }',
        '  }',
        '}',
        '',
        'GITHUB_TOKEN=' + FAKE_GITHUB,
        'DATABASE_URL=postgres://app:notasecret@localhost/db',
    ].join('\n');

    const SAMPLE_MCP = JSON.stringify({
        mcpServers: {
            search: { command: 'npx', args: ['-y', 'search-mcp'], env: { API_KEY: FAKE_OPENAI } },
            files: { command: 'npx', args: ['-y', 'files-mcp'], env: { TOKEN: '${FILES_TOKEN}', ROOT: '$HOME/projects' } },
            github: { command: 'npx', args: ['-y', 'github-mcp'], env: { GITHUB_TOKEN: FAKE_GITHUB } },
        },
    }, null, 2);

    return {
        scan, scanGeneric, scanMcpManifest, parseMcpManifest, correctedManifest,
        shannonEntropy, redact, isReference, SHAPES, SAMPLE, SAMPLE_MCP, MAX_SCAN_CHARS,
    };
});
