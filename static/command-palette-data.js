/**
 * DevSuite — Command Palette pure data module (feature 022).
 *
 * DOM-free, dual-export module: the static DESTINATIONS list (15 tools + Home +
 * Tools Hub) and the matchDestinations(query, list) filter used by the palette's
 * search input. Loaded in the browser as globalThis.CommandPaletteData and
 * require()-able in node for tests/javascript/test_command_palette_data.js.
 *
 * This file is injected on every page by deps.py::_serve_html() — it is never
 * referenced directly in any static/*.html file. See specs/022-command-palette/.
 *
 * DESTINATIONS is authored by hand from routes/pages.py + static/tools.html's own
 * card list (verified directly, not guessed — specs/022-command-palette/research.md
 * §6), not scraped at runtime. /base64 is intentionally excluded: it is a legacy
 * route no longer surfaced as its own Tools Hub card (folded into Crypto Suite).
 * Icon markup is copied verbatim from each tool's existing tools.html card icon.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.CommandPaletteData = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DESTINATIONS = [
        {
            id: 'diff', name: 'Text Diff', route: '/diff', category: 'dev',
            keywords: ['compare', 'difference', 'patch'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
        },
        {
            id: 'folder-diff', name: 'Folder Diff', route: '/diff?tab=folder-diff', category: 'dev',
            keywords: ['compare', 'directory', 'folder compare'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
        },
        {
            id: 'data-linter', name: 'Data Format Linter', route: '/data-linter', category: 'data',
            keywords: ['json', 'yaml', 'xml', 'toon', 'validate', 'format', 'lint'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H7a2 2 0 00-2 2v5a2 2 0 01-2 2 2 2 0 012 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 002-2v-5c0-1.1.9-2 2-2a2 2 0 01-2-2V5a2 2 0 00-2-2h-1"/></svg>',
        },
        {
            id: 'regex', name: 'Regex Tester', route: '/regex', category: 'data',
            keywords: ['regexp', 'pattern', 'match'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
        },
        {
            id: 'crypto', name: 'Crypto Suite', route: '/crypto', category: 'security',
            keywords: ['jwt', 'hash', 'aes', 'rsa', 'hmac', 'base64', 'encrypt', 'decrypt', 'md5', 'sha'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        },
        {
            id: 'api-tester', name: 'Local API Tester', route: '/api-tester', category: 'dev',
            keywords: ['rest', 'http', 'postman', 'curl', 'request'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
        },
        {
            id: 'ssh', name: 'Secure Terminal & SFTP', route: '/ssh', category: 'network',
            keywords: ['ssh', 'terminal', 'sftp', 'shell', 'console'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
        },
        {
            id: 'cron', name: 'Cron Visualizer', route: '/cron', category: 'time',
            keywords: ['crontab', 'schedule', 'cron expression'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        },
        {
            id: 'vault', name: 'Secret Vault', route: '/vault', category: 'security',
            keywords: ['password', 'keepass', 'secrets', 'credentials'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        },
        {
            id: 'db-manager', name: 'DevDB Manager', route: '/db-manager', category: 'security',
            keywords: ['database', 'devdb', 'backup', 'export', 'import'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
        },
        {
            id: 'file-converter', name: 'File Converter', route: '/file-converter', category: 'data',
            keywords: ['csv', 'xlsx', 'pdf', 'markdown', 'html', 'convert'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>',
        },
        {
            id: 'notes', name: 'Notes Workspace', route: '/notes', category: 'dev',
            keywords: ['markdown', 'notebook', 'wiki', 'docs'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
        },
        {
            id: 'roadmap', name: 'Learning Roadmap', route: '/roadmap', category: 'dev',
            keywords: ['roadmap', 'learning plan', 'checklist', 'course'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
        },
        {
            id: 'id-generator', name: 'ID Generator', route: '/id-generator', category: 'dev',
            keywords: ['uuid', 'ulid', 'cuid', 'cuid2', 'nanoid', 'identifier', 'guid'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="7" y2="15"/><line x1="11" y1="9" x2="11" y2="15"/><line x1="15" y1="12" x2="17" y2="12"/></svg>',
        },
        {
            id: 'ws-tester', name: 'WebSocket Tester', route: '/ws-tester', category: 'network',
            keywords: ['websocket', 'ws', 'wss', 'socket', 'realtime'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l3 8 4-16 3 8h4"/></svg>',
        },
        {
            id: 'home', name: 'Home', route: '/', category: 'nav',
            keywords: ['homepage', 'landing'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
        },
        {
            id: 'tools', name: 'All Tools', route: '/tools', category: 'nav',
            keywords: ['tools hub', 'browse', 'all tools'],
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
        },
    ];

    /**
     * Filter DESTINATIONS (or any Destination[] list) by a case-insensitive
     * substring match against name, category, or any keyword. Empty/whitespace
     * query returns the list unchanged. Pure — no DOM, no side effects.
     */
    function matchDestinations(query, list) {
        const source = list || DESTINATIONS;
        const q = (query == null ? '' : String(query)).trim().toLowerCase();
        if (!q) { return source.slice(); }
        return source.filter(function (d) {
            if (d.name.toLowerCase().includes(q)) { return true; }
            if (d.category.toLowerCase().includes(q)) { return true; }
            return (d.keywords || []).some(function (k) { return k.toLowerCase().includes(q); });
        });
    }

    return {
        DESTINATIONS: DESTINATIONS,
        matchDestinations: matchDestinations,
    };
});
