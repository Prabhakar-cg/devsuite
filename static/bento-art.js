/**
 * DevSuite Bento art (feature 026, SPEC §9.14)
 * ---------------------------------------------
 * Generated, code-owned SVG artwork for the Home / Tools bento showcase. Every picture is
 * plain data (shape descriptors) turned into SVG with createElementNS — no images, no
 * network, no HTML-string injection, no third-party assets. Colours come from CSS classes
 * (`art-f1..f4` fills, `art-s1..s4` strokes) whose values each tile sets from the active
 * theme's tokens, so all six themes work with no per-theme tables.
 *
 * Shape descriptor: { t: 'rect'|'circle'|'line'|'path', k: 'f1'|'s2'|…, o?: opacity,
 *                     w?: stroke-width, + geometry (x,y,w,h,r | cx,cy,r | x1,y1,x2,y2 | d) }
 * Note: for rect the width is `rw`/`rh` to avoid clashing with stroke-width `w`.
 *
 * Browser: renders every <svg data-art="name"> on DOMContentLoaded. Node: pure data API.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else {
        root.BentoArt = api;
        const go = () => api.renderAll(root.document);
        if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', go);
        else go();
    }
})(globalThis, function () {
    'use strict';

    const VIEW = 200;
    const KEY_RE = /^[fs][1-4]$/;

    const rect = (x, y, rw, rh, r, k, o) => ({ t: 'rect', x, y, rw, rh, r, k, o });
    const circle = (cx, cy, r, k, o, w) => ({ t: 'circle', cx, cy, r, k, o, w });
    const line = (x1, y1, x2, y2, k, w, o) => ({ t: 'line', x1, y1, x2, y2, k, w, o });
    const path = (d, k, w, o) => ({ t: 'path', d, k, w, o });

    // ── Text Diff: two panes of rows; removed rows left (f3), added rows right (f1) ──
    function diff() {
        const s = [rect(14, 22, 84, 156, 10, 'f4', 0.18), rect(102, 22, 84, 156, 10, 'f4', 0.18)];
        const widths = [58, 44, 66, 38, 60, 50, 64, 42];
        const kind = ['same', 'rm', 'same', 'same', 'rm', 'same', 'same', 'rm'];
        widths.forEach((w, i) => {
            const y = 34 + i * 17;
            s.push(rect(24, y, w, 9, 4.5, kind[i] === 'rm' ? 'f3' : 'f2', kind[i] === 'rm' ? 0.95 : 0.55));
            const added = kind[i] === 'rm';
            s.push(rect(112, y, added ? w + 8 : w, 9, 4.5, added ? 'f1' : 'f2', added ? 0.95 : 0.55));
        });
        return s;
    }

    // ── Data Linter: braces around key/value rows with a valid tick ──
    function lint() {
        return [
            path('M62 40 C46 40 50 62 50 82 C50 94 44 100 36 100 C44 100 50 106 50 118 C50 138 46 160 62 160', 's1', 7),
            path('M138 40 C154 40 150 62 150 82 C150 94 156 100 164 100 C156 100 150 106 150 118 C150 138 154 160 138 160', 's1', 7),
            rect(74, 66, 22, 9, 4.5, 'f2', 0.9), rect(100, 66, 26, 9, 4.5, 'f1'),
            rect(74, 88, 34, 9, 4.5, 'f2', 0.9), rect(112, 88, 14, 9, 4.5, 'f3'),
            rect(74, 110, 18, 9, 4.5, 'f2', 0.9), rect(96, 110, 30, 9, 4.5, 'f1'),
            path('M82 138 L94 149 L118 126', 's3', 6),
        ];
    }

    // ── Secret Vault: padlock over a dot lattice ──
    function vault() {
        const s = [];
        for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) s.push(circle(18 + c * 27, 18 + r * 27, 3.4, 'f2', 0.35));
        s.push(path('M74 92 V72 a26 26 0 0 1 52 0 V92', 's2', 10));
        s.push(rect(58, 88, 84, 68, 16, 'f1'));
        s.push(circle(100, 116, 9, 'f4'));
        s.push(rect(96, 120, 8, 18, 4, 'f4'));
        return s;
    }

    // ── API Tester: request → / ← response ──
    function api() {
        return [
            rect(20, 38, 160, 44, 12, 'f2', 0.2), rect(20, 118, 160, 44, 12, 'f2', 0.2),
            rect(34, 54, 54, 10, 5, 'f2', 0.85), rect(34, 68, 36, 7, 3.5, 'f2', 0.45),
            path('M112 60 H156 M142 48 L156 60 L142 72', 's1', 8),
            rect(112, 134, 54, 10, 5, 'f2', 0.85), rect(130, 148, 36, 7, 3.5, 'f2', 0.45),
            path('M88 140 H44 M58 128 L44 140 L58 152', 's3', 8),
        ];
    }

    // ── Secure Terminal: window with prompt, output and cursor ──
    function terminal() {
        return [
            rect(16, 30, 168, 140, 14, 'f4', 0.2),
            circle(34, 48, 4.5, 'f3'), circle(50, 48, 4.5, 'f2'), circle(66, 48, 4.5, 'f1'),
            path('M34 82 L52 96 L34 110', 's1', 7),
            rect(62, 92, 54, 9, 4.5, 'f2', 0.9),
            rect(34, 122, 92, 8, 4, 'f2', 0.45), rect(34, 138, 64, 8, 4, 'f2', 0.45),
            rect(122, 90, 12, 22, 3, 'f1'),
        ];
    }

    // ── Cron Visualizer: dial with ticks, two hands, and run markers ──
    function cron() {
        const s = [circle(100, 100, 78, 's2', 0.9, 5), circle(100, 100, 54, 's4', 0.35, 3)];
        for (let i = 0; i < 12; i++) {
            const a = (i * Math.PI) / 6;
            const major = i % 3 === 0;
            const r1 = major ? 62 : 68;
            s.push(line(+(100 + r1 * Math.sin(a)).toFixed(2), +(100 - r1 * Math.cos(a)).toFixed(2),
                +(100 + 74 * Math.sin(a)).toFixed(2), +(100 - 74 * Math.cos(a)).toFixed(2), 's2', major ? 6 : 3.5));
        }
        s.push(line(100, 100, 100, 54, 's1', 7), line(100, 100, 132, 118, 's3', 7), circle(100, 100, 8, 'f1'));
        s.push(circle(164, 54, 7, 'f3'), circle(40, 140, 7, 'f3', 0.6));
        return s;
    }

    // ── Pattern tile: tessellated arches (purely decorative) ──
    function pattern() {
        const s = [];
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 4; col++) {
                const x = col * 50 - (row % 2 ? 25 : 0);
                const y = row * 40;
                s.push(path(`M${x} ${y + 40} a25 25 0 0 1 50 0`, row % 2 ? 's1' : 's2', 4, 0.9));
                s.push(path(`M${x + 10} ${y + 40} a15 15 0 0 1 30 0`, 's3', 3, 0.7));
            }
        }
        return s;
    }

    // ── File Converter pictures (feature 027) ──
    // A sheet becoming another sheet: left has plain lines, right has coloured blocks.
    function convert() {
        return [
            rect(14, 36, 66, 88, 10, 'f4', 0.2), rect(24, 50, 40, 8, 4, 'f2', 0.8), rect(24, 66, 46, 8, 4, 'f2', 0.5),
            rect(24, 82, 34, 8, 4, 'f2', 0.5), rect(24, 98, 44, 8, 4, 'f2', 0.5),
            path('M92 80 H116 M108 70 L118 80 L108 90', 's1', 7),
            rect(130, 36, 66, 88, 10, 'f4', 0.2), rect(140, 50, 20, 20, 6, 'f1'), rect(166, 50, 20, 20, 6, 'f3'),
            rect(140, 78, 20, 20, 6, 'f3'), rect(166, 78, 20, 20, 6, 'f1', 0.7), rect(140, 104, 46, 8, 4, 'f2', 0.5),
            circle(47, 150, 5, 'f1'), circle(100, 150, 5, 'f2', 0.5), circle(163, 150, 5, 'f3'),
        ];
    }

    function sheet() {
        const s = [rect(30, 34, 140, 132, 12, 'f4', 0.18), rect(30, 34, 140, 28, 12, 'f1', 0.9)];
        for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
            const hot = (r + c) % 4 === 1;
            s.push(rect(40 + c * 43, 74 + r * 22, 36, 14, 4, hot ? 'f3' : 'f2', hot ? 0.95 : 0.4));
        }
        return s;
    }

    function doc() {
        return [
            path('M52 28 H112 L148 64 V168 a8 8 0 0 1 -8 8 H60 a8 8 0 0 1 -8 -8 Z', 's2', 6, 0.9),
            path('M112 28 V64 H148', 's1', 6),
            rect(70, 88, 62, 9, 4.5, 'f1'), rect(70, 108, 62, 8, 4, 'f2', 0.5),
            rect(70, 124, 48, 8, 4, 'f2', 0.5), rect(70, 140, 56, 8, 4, 'f2', 0.5),
        ];
    }

    function image() {
        return [
            rect(26, 42, 148, 116, 14, 'f4', 0.18),
            circle(64, 82, 14, 'f3'),
            path('M26 140 L78 100 L112 126 L138 104 L174 138 V144 a14 14 0 0 1 -14 14 H40 a14 14 0 0 1 -14 -14 Z', 'f1'),
            circle(150, 66, 4, 'f2', 0.6), circle(126, 58, 3, 'f2', 0.4), circle(160, 84, 3, 'f2', 0.4),
        ];
    }

    // ── Tool-page empty states (feature 028) ──
    function regex() {
        const s = [];
        const rows = [[28, 70], [42, 56], [20, 80], [36, 62]];
        rows.forEach((r, i) => {
            const y = 34 + i * 26;
            s.push(rect(20, y, 160, 14, 7, 'f4', 0.14));
            s.push(rect(20 + r[0], y, r[1], 14, 7, 'f1', 0.9));
            s.push(rect(26, y + 3, 14 + (i % 2) * 10, 8, 4, 'f2', 0.55));
        });
        s.push(line(152, 150, 152, 178, 's3', 6), line(138, 158, 166, 170, 's3', 6), line(166, 158, 138, 170, 's3', 6));
        s.push(path('M24 152 H36 M24 152 V176 H36', 's2', 5), path('M70 152 H58 M70 152 V176 H58', 's2', 5));
        return s;
    }

    function encode() {
        const s = [];
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) s.push(rect(18 + c * 17, 54 + r * 17, 12, 12, 3, (r * 3 + c) % 3 === 0 ? 'f1' : 'f2', (r * 3 + c) % 3 === 0 ? 0.95 : 0.4));
        s.push(path('M96 100 H128 M116 88 L128 100 L116 112', 's1', 7));
        [60, 82, 104, 126].forEach((y, i) => s.push(rect(138, y - 10, 44 - (i % 2) * 12, 9, 4.5, i % 2 ? 'f3' : 'f2', i % 2 ? 0.9 : 0.6)));
        return s;
    }

    function ids() {
        const s = [];
        [18, 30, 42, 54, 66].forEach((r, i) => s.push(path(`M${100 - r} 104 a${r} ${r} 0 0 1 ${r * 2} 0`, i % 2 ? 's3' : 's1', 5, 1 - i * 0.12)));
        s.push(circle(100, 104, 6, 'f1'));
        [[22, 40], [70, 22], [100, 22], [130, 22], [158, 28]].forEach((g, i) => s.push(rect(g[0] - (i ? 4 : 0), 142, g[1], 9, 4.5, i % 2 ? 'f3' : 'f2', 0.7)));
        return s;
    }

    function pulse() {
        return [
            circle(30, 100, 10, 'f1'), circle(170, 100, 10, 'f3'),
            path('M44 100 H70 L82 70 L100 134 L116 78 L126 100 H156', 's1', 7),
            line(30, 130, 30, 160, 's2', 4, 0.5), line(170, 130, 170, 160, 's2', 4, 0.5),
            rect(18, 160, 24, 8, 4, 'f2', 0.5), rect(158, 160, 24, 8, 4, 'f2', 0.5),
        ];
    }

    // ── Secret Scanner (feature 021) ──
    function scan() {
        const s = [];
        [[24, 90], [24, 60], [24, 104], [24, 48], [24, 80]].forEach((r, i) => {
            s.push(rect(r[0], 34 + i * 22, r[1], 9, 4.5, 'f2', 0.45));
            if (i === 1) s.push(rect(r[0] + 64, 34 + i * 22, 44, 9, 4.5, 'f3', 0.95));
            if (i === 3) s.push(rect(r[0] + 54, 34 + i * 22, 50, 9, 4.5, 'f3', 0.95));
        });
        s.push(circle(128, 108, 34, 's1', 0.95, 8), line(152, 132, 176, 158, 's1', 10));
        s.push(circle(128, 108, 14, 'f1', 0.35));
        return s;
    }

    const ART = { diff, lint, vault, api, terminal, cron, pattern, convert, sheet, doc, image, regex, encode, ids, pulse, scan };

    /** Shape descriptors for a named picture ([] for unknown names). */
    function buildShapes(name) {
        return ART[name] ? ART[name]() : [];
    }

    const SVG_NS = 'http://www.w3.org/2000/svg';

    function setAttrs(el, attrs) {
        for (const key of Object.keys(attrs)) {
            if (attrs[key] !== undefined && attrs[key] !== null) el.setAttribute(key, String(attrs[key]));
        }
    }

    function shapeToElement(doc, sh) {
        const el = doc.createElementNS(SVG_NS, sh.t);
        const cls = `art-${sh.k}`;
        if (sh.t === 'rect') setAttrs(el, { x: sh.x, y: sh.y, width: sh.rw, height: sh.rh, rx: sh.r });
        else if (sh.t === 'circle') setAttrs(el, { cx: sh.cx, cy: sh.cy, r: sh.r });
        else if (sh.t === 'line') setAttrs(el, { x1: sh.x1, y1: sh.y1, x2: sh.x2, y2: sh.y2 });
        else setAttrs(el, { d: sh.d });
        setAttrs(el, { class: cls, 'stroke-width': sh.k[0] === 's' ? sh.w : undefined, opacity: sh.o });
        if (sh.k[0] === 's') setAttrs(el, { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' });
        return el;
    }

    /** Fill an <svg data-art="…"> element with its picture. Safe to call twice. */
    function render(svg) {
        const name = svg.getAttribute('data-art');
        const shapes = buildShapes(name);
        if (!shapes.length || svg.getAttribute('data-art-ready')) return false;
        const doc = svg.ownerDocument;
        setAttrs(svg, { viewBox: `0 0 ${VIEW} ${VIEW}`, 'aria-hidden': 'true', focusable: 'false',
            preserveAspectRatio: name === 'pattern' ? 'xMidYMid slice' : 'xMidYMid meet', 'data-art-ready': '1' });
        shapes.forEach((sh) => svg.appendChild(shapeToElement(doc, sh)));
        return true;
    }

    function renderAll(doc) {
        let n = 0;
        doc.querySelectorAll('svg[data-art]').forEach((svg) => { if (render(svg)) n++; });
        return n;
    }

    return { ART, VIEW, KEY_RE, buildShapes, shapeToElement, render, renderAll };
});
