/**
 * DevSuite icon set (SPEC §9.8 — stroke-based inline SVG, no emoji).
 * Small, dependency-free: `DevSuiteIcons.element(name, size?)` returns an <svg class="ico"> built with
 * createElementNS (no HTML-string injection). Paths are 24×24, stroke 2, round caps — Lucide-style, hand-authored.
 * Browser global: DevSuiteIcons. require()-able in node (used by tests and by the one-off HTML migration).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.DevSuiteIcons = api; }
})(globalThis, function () {
    'use strict';

    const ICONS = {
        clipboard: ['M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z', 'M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2'],
        lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
        unlock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 7.5-2'],
        key: ['M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8z', 'M15.5 7.5l3 3L22 7l-3-3'],
        'key-round': ['M2.6 18.4a2 2 0 0 0 0 2.8 2 2 0 0 0 2.8 0l7.2-7.2a5 5 0 1 0-2.8-2.8z', 'M17 6.5h.01'],
        cog: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
        pen: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
        shuffle: ['M16 3h5v5', 'M4 20L21 3', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5'],
        folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
        file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'],
        'file-text': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h6'],
        'file-code': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M10 13l-2 2 2 2', 'M14 13l2 2-2 2'],
        'file-data': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h8'],
        image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M21 15l-5-5L5 21'],
        archive: ['M21 8v13H3V8', 'M1 3h22v5H1z', 'M10 12h4'],
        music: ['M9 18V5l12-2v13', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
        film: ['M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M7 4v16', 'M17 4v16', 'M3 9h4', 'M3 15h4', 'M17 9h4', 'M17 15h4'],
        terminal: ['M4 17l6-6-6-6', 'M12 19h8'],
        warning: ['M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
        zap: ['M13 2L3 14h9l-1 8 10-12h-9z'],
        coins: ['M8 8a5 5 0 1 0 0 .01', 'M16.5 9.5a5 5 0 1 1-6.9 6.9', 'M7 6h2v4'],
        package: ['M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z', 'M3.3 7L12 12l8.7-5', 'M12 22V12'],
        note: ['M5 3h14a2 2 0 0 1 2 2v14l-4-4H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8 8h8', 'M8 12h5'],
        globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18', 'M12 3a14 14 0 0 0 0 18'],
        database: ['M12 8c4.4 0 8-1.1 8-2.5S16.4 3 12 3 4 4.1 4 5.5 7.6 8 12 8z', 'M4 5.5v13C4 19.9 7.6 21 12 21s8-1.1 8-2.5v-13', 'M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5'],
        download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
        copy: ['M9 9h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z', 'M5 15H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1'],
    };

    const SVG_NS = 'http://www.w3.org/2000/svg';

    /** Markup string for static HTML (used by the one-off migration and tests; same data as element()). */
    function markup(name, size) {
        const d = ICONS[name];
        if (!d) throw new Error('unknown icon ' + name);
        const px = size || 14;
        return '<svg class="ico" width="' + px + '" height="' + px + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d.map((p) => '<path d="' + p + '"/>').join('') + '</svg>';
    }

    /** DOM element built with createElementNS (no HTML-string injection). */
    function element(name, size) {
        const d = ICONS[name] || ICONS.file;
        const px = String(size || 14);
        const svg = document.createElementNS(SVG_NS, 'svg');
        for (const [k, v] of Object.entries({ class: 'ico', width: px, height: px, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
            'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
        for (const p of d) { const path = document.createElementNS(SVG_NS, 'path'); path.setAttribute('d', p); svg.appendChild(path); }
        return svg;
    }

    return { ICONS, markup, element };
});
