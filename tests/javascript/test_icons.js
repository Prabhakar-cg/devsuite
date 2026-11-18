/** Unit tests for static/icons.js — the shared stroke-icon set (BACKLOG DX-9). */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Icons = require('../../static/icons.js');
const STATIC = path.join(__dirname, '../../static');

test('every icon has at least one path and valid-looking path data', () => {
    for (const [name, paths] of Object.entries(Icons.ICONS)) {
        assert.ok(Array.isArray(paths) && paths.length >= 1, name);
        for (const d of paths) assert.match(d, /^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/, name + ': ' + d);
    }
});

test('markup() is a decorative stroke-based svg and unknown names throw', () => {
    const m = Icons.markup('lock', 16);
    assert.match(m, /^<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"/);
    assert.ok(m.includes('aria-hidden="true"') && m.endsWith('</svg>'));
    assert.throws(() => Icons.markup('nope'));
});

test('vault type icons and SFTP file icons only reference icons that exist', () => {
    const vault = fs.readFileSync(path.join(STATIC, 'vault.js'), 'utf8');
    for (const m of vault.matchAll(/icon: '([a-z-]+)'/g)) assert.ok(Icons.ICONS[m[1]], 'vault.js: ' + m[1]);
    const sftp = fs.readFileSync(path.join(STATIC, 'sftp-browser.js'), 'utf8');
    const fn = sftp.slice(sftp.indexOf('function getFileIcon'));
    for (const m of fn.matchAll(/: '([a-z-]+)'/g)) assert.ok(Icons.ICONS[m[1]], 'sftp-browser.js: ' + m[1]);
    assert.ok(Icons.ICONS.folder && Icons.ICONS.file);
});

test('element() builds namespaced svg nodes without innerHTML (fake document)', () => {
    const mk = (ns, tag) => ({ ns, tag, attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); } });
    global.document = { createElementNS: mk };
    try {
        const el = Icons.element('clipboard', 12);
        assert.equal(el.attrs.class, 'ico'); assert.equal(el.attrs.width, '12'); assert.equal(el.children.length, Icons.ICONS.clipboard.length);
        assert.equal(Icons.element('does-not-exist').children.length, Icons.ICONS.file.length, 'unknown names fall back to the file icon');
    } finally { delete global.document; }
});

test('icons.js uses no innerHTML or network', () => {
    const src = fs.readFileSync(path.join(STATIC, 'icons.js'), 'utf8');
    for (const bad of ['innerHTML', 'fetch(', 'eval(']) assert.ok(!src.includes(bad), bad);
});
