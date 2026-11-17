/** Unit tests for static/bento-art.js — generated SVG artwork data (feature 026). */
'use strict';

const assert = require('node:assert/strict');
const BentoArt = require('../../static/bento-art.js');

const NAMES = Object.keys(BentoArt.ART);

test('every picture produces shapes', () => {
    assert.deepEqual(NAMES.sort(), ['api', 'convert', 'cron', 'diff', 'doc', 'encode', 'ids', 'image', 'lint', 'pattern', 'pulse', 'regex', 'scan', 'sheet', 'terminal', 'vault']);
    for (const n of NAMES) assert.ok(BentoArt.buildShapes(n).length >= 5, n);
});

test('unknown pictures render nothing', () => {
    assert.deepEqual(BentoArt.buildShapes('nope'), []);
});

test('every shape has a known type and a valid colour class key', () => {
    for (const n of NAMES) {
        for (const sh of BentoArt.buildShapes(n)) {
            assert.ok(['rect', 'circle', 'line', 'path'].includes(sh.t), `${n}: ${sh.t}`);
            assert.match(sh.k, BentoArt.KEY_RE, `${n}: ${sh.k}`);
        }
    }
});

test('strokes carry a width, fills do not need one', () => {
    for (const n of NAMES) {
        for (const sh of BentoArt.buildShapes(n)) {
            if (sh.k[0] === 's') assert.ok(sh.w > 0, `${n}: stroke without width`);
        }
    }
});

test('coordinates are finite numbers and stay (roughly) inside the 200x200 view box', () => {
    const lim = (v) => Number.isFinite(v) && v >= -30 && v <= BentoArt.VIEW + 30;
    for (const n of NAMES.filter((x) => x !== 'pattern')) {
        for (const sh of BentoArt.buildShapes(n)) {
            for (const f of ['x', 'y', 'cx', 'cy', 'x1', 'y1', 'x2', 'y2']) {
                if (sh[f] !== undefined) assert.ok(lim(sh[f]), `${n}.${f}=${sh[f]}`);
            }
            if (sh.rw !== undefined) assert.ok(sh.x + sh.rw <= BentoArt.VIEW, `${n} rect overflows`);
            if (sh.o !== undefined) assert.ok(sh.o > 0 && sh.o <= 1, `${n} opacity`);
        }
    }
});

test('pictures are deterministic (same data every call)', () => {
    for (const n of NAMES) assert.deepEqual(BentoArt.buildShapes(n), BentoArt.buildShapes(n));
});

test('the cron dial has 12 ticks plus two hands', () => {
    const lines = BentoArt.buildShapes('cron').filter((s) => s.t === 'line');
    assert.equal(lines.length, 14);
});

test('DOM rendering builds namespaced SVG elements without innerHTML (fake document)', () => {
    const made = [];
    const mk = (tag, ns) => {
        const el = { tag, ns, attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = v; },
            getAttribute(k) { return this.attrs[k] ?? null; }, appendChild(c) { this.children.push(c); } };
        made.push(el);
        return el;
    };
    const doc = { createElementNS: (ns, tag) => mk(tag, ns) };
    const svg = mk('svg', null);
    svg.ownerDocument = doc;
    svg.setAttribute('data-art', 'diff');
    assert.equal(BentoArt.render(svg), true);
    assert.equal(svg.attrs['aria-hidden'], 'true');
    assert.equal(svg.attrs.viewBox, '0 0 200 200');
    assert.ok(svg.children.length >= 10);
    assert.ok(svg.children.every((c) => c.ns === 'http://www.w3.org/2000/svg' && /^art-[fs][1-4]$/.test(c.attrs.class)));
    assert.equal(BentoArt.render(svg), false, 'second render is a no-op');
});
