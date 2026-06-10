/** Unit tests for static/collection-utils.js (SPEC §4.7.4). */
'use strict';

const assert = require('node:assert/strict');
const CU = require('../../static/collection-utils.js');

// ─── normalizeFolderPath ──────────────────────────────────────────────────────

test('normalizeFolderPath trims, collapses, and returns undefined for empty', () => {
    assert.equal(CU.normalizeFolderPath(' a / b //c '), 'a/b/c');
    assert.equal(CU.normalizeFolderPath('plain'), 'plain');
    assert.equal(CU.normalizeFolderPath('  '), undefined);
    assert.equal(CU.normalizeFolderPath('///'), undefined);
    assert.equal(CU.normalizeFolderPath(null), undefined);
});

// ─── isInFolder / countInFolder ───────────────────────────────────────────────

test('isInFolder matches the folder itself and descendants only', () => {
    assert.equal(CU.isInFolder('api', 'api'), true);
    assert.equal(CU.isInFolder('api/v1', 'api'), true);
    assert.equal(CU.isInFolder('api2', 'api'), false);
    assert.equal(CU.isInFolder(undefined, 'api'), false);
});

test('countInFolder counts nested requests', () => {
    const items = [
        { folder: 'api' }, { folder: 'api/v1' }, { folder: 'api/v1/users' },
        { folder: 'web' }, { name: 'root-level' },
    ];
    assert.equal(CU.countInFolder(items, 'api'), 3);
    assert.equal(CU.countInFolder(items, 'api/v1'), 2);
    assert.equal(CU.countInFolder(items, 'missing'), 0);
});

// ─── renameFolder ─────────────────────────────────────────────────────────────

test('renameFolder cascades to descendants and folderAuths keys', () => {
    const items = [
        { name: 'a', folder: 'api' },
        { name: 'b', folder: 'api/v1' },
        { name: 'c', folder: 'apiX' },     // sibling with shared prefix — untouched
        { name: 'd' },                      // root — untouched
    ];
    const auths = {
        'api':    { type: 'bearer', token: 't1' },
        'api/v1': { type: 'basic', username: 'u' },
        'apiX':   { type: 'bearer', token: 'keep' },
    };
    const n = CU.renameFolder(items, auths, 'api', 'platform/core');
    assert.equal(n, 2);
    assert.equal(items[0].folder, 'platform/core');
    assert.equal(items[1].folder, 'platform/core/v1');
    assert.equal(items[2].folder, 'apiX');
    assert.equal(items[3].folder, undefined);
    assert.deepEqual(Object.keys(auths).sort(), ['apiX', 'platform/core', 'platform/core/v1']);
    assert.equal(auths['platform/core'].token, 't1');
});

test('renameFolder onto an existing path merges', () => {
    const items = [{ folder: 'old' }, { folder: 'target' }];
    const auths = { old: { type: 'bearer', token: 'moved' }, target: { type: 'basic' } };
    CU.renameFolder(items, auths, 'old', 'target');
    assert.equal(items[0].folder, 'target');
    assert.equal(auths.target.token, 'moved'); // moved auth wins on merge
});

// ─── deleteFolder ─────────────────────────────────────────────────────────────

test('deleteFolder removes nested requests and auth entries', () => {
    const items = [
        { name: 'a', folder: 'api' },
        { name: 'b', folder: 'api/v1' },
        { name: 'c', folder: 'web' },
        { name: 'd' },
    ];
    const auths = { 'api': { type: 'bearer' }, 'api/v1': { type: 'basic' }, 'web': { type: 'bearer' } };
    const res = CU.deleteFolder(items, auths, 'api');
    assert.equal(res.removed, 2);
    assert.deepEqual(res.items.map(i => i.name), ['c', 'd']);
    assert.deepEqual(Object.keys(auths), ['web']);
});

// ─── moveItem ─────────────────────────────────────────────────────────────────

const mk = () => [
    { name: 'a' }, { name: 'b' }, { name: 'c', folder: 'f' }, { name: 'd', folder: 'f' },
];

test('moveItem reorders downward (insert before target)', () => {
    const items = mk();
    CU.moveItem(items, 0, 3, 'f'); // move a before d, into folder f
    assert.deepEqual(items.map(i => i.name), ['b', 'c', 'a', 'd']);
    assert.equal(items[2].folder, 'f');
});

test('moveItem reorders upward', () => {
    const items = mk();
    CU.moveItem(items, 3, 1, undefined); // move d before b, to top level
    assert.deepEqual(items.map(i => i.name), ['a', 'd', 'b', 'c']);
    assert.equal(items[1].folder, undefined);
});

test('moveItem to items.length appends at the end', () => {
    const items = mk();
    CU.moveItem(items, 0, items.length, 'f');
    assert.deepEqual(items.map(i => i.name), ['b', 'c', 'd', 'a']);
    assert.equal(items[3].folder, 'f');
});

test('moveItem clears folder when newFolder is undefined and rejects bad indexes', () => {
    const items = mk();
    CU.moveItem(items, 2, 0, undefined);
    assert.equal(items[0].name, 'c');
    assert.equal('folder' in items[0], false);
    assert.equal(CU.moveItem(items, 99, 0, undefined), false);
    assert.equal(CU.moveItem(items, -1, 0, undefined), false);
});
