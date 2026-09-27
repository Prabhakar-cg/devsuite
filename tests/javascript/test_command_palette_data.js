/** Unit tests for static/command-palette-data.js — Command Palette pure data (feature 022).
 *
 * Covers the DESTINATIONS list shape (FR-011) and matchDestinations() filtering
 * against name/category/keyword (FR-005/FR-006/SC-006). Pure module — no DOM. */
'use strict';

const assert = require('node:assert/strict');
const CommandPaletteData = require('../../static/command-palette-data.js');

// ── DESTINATIONS shape (FR-011) ──
test('DESTINATIONS has 17 entries (15 tools + Home + Tools Hub)', () => {
    assert.equal(CommandPaletteData.DESTINATIONS.length, 17);
});

test('DESTINATIONS entries all have unique ids', () => {
    const ids = CommandPaletteData.DESTINATIONS.map((d) => d.id);
    assert.equal(new Set(ids).size, ids.length);
});

test('DESTINATIONS entries all have a non-empty name, route, and category', () => {
    for (const d of CommandPaletteData.DESTINATIONS) {
        assert.ok(d.name && d.name.length > 0, `missing name for ${d.id}`);
        assert.ok(d.route && d.route.startsWith('/'), `route not a relative path for ${d.id}`);
        assert.ok(d.category && d.category.length > 0, `missing category for ${d.id}`);
    }
});

test('DESTINATIONS does not include /base64 (legacy route, not a Tools Hub card)', () => {
    const routes = CommandPaletteData.DESTINATIONS.map((d) => d.route);
    assert.ok(!routes.includes('/base64'));
});

// ── matchDestinations (FR-005, FR-006, SC-006) ──
test('matchDestinations with an empty/whitespace query returns all entries unchanged', () => {
    const all = CommandPaletteData.DESTINATIONS;
    assert.equal(CommandPaletteData.matchDestinations('', all).length, all.length);
    assert.equal(CommandPaletteData.matchDestinations('   ', all).length, all.length);
});

test('matchDestinations matches by name substring, case-insensitively', () => {
    const all = CommandPaletteData.DESTINATIONS;
    const byName = CommandPaletteData.matchDestinations('secret vault', all);
    assert.equal(byName.length, 1);
    assert.equal(byName[0].id, 'vault');

    const mixedCase = CommandPaletteData.matchDestinations('ReGeX', all);
    assert.equal(mixedCase.length, 1);
    assert.equal(mixedCase[0].id, 'regex');
});

test('matchDestinations matches by category', () => {
    const all = CommandPaletteData.DESTINATIONS;
    const security = CommandPaletteData.matchDestinations('security', all);
    const ids = security.map((d) => d.id).sort();
    assert.deepEqual(ids, ['crypto', 'db-manager', 'vault']);
});

test('matchDestinations matches "uuid" to ID Generator via keywords (SC-006)', () => {
    const all = CommandPaletteData.DESTINATIONS;
    const result = CommandPaletteData.matchDestinations('uuid', all);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'id-generator');
});

test('matchDestinations matches "jwt" to Crypto Suite via keywords (SC-006)', () => {
    const all = CommandPaletteData.DESTINATIONS;
    const result = CommandPaletteData.matchDestinations('jwt', all);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'crypto');
});

test('matchDestinations returns an empty array when nothing matches (FR-006)', () => {
    const all = CommandPaletteData.DESTINATIONS;
    const result = CommandPaletteData.matchDestinations('zzzznomatchzzzz', all);
    assert.deepEqual(result, []);
});

test('matchDestinations operates on a caller-supplied list, not just DESTINATIONS', () => {
    const subset = [
        { id: 'a', name: 'Alpha', route: '/a', category: 'dev', keywords: [] },
        { id: 'b', name: 'Beta', route: '/b', category: 'dev', keywords: ['gamma'] },
    ];
    assert.equal(CommandPaletteData.matchDestinations('alpha', subset).length, 1);
    assert.equal(CommandPaletteData.matchDestinations('gamma', subset)[0].id, 'b');
});
