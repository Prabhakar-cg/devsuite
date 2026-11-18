/**
 * Secret Scanner page controller (feature 021).
 * Renders findings with createElement + textContent ONLY — the scanned text is untrusted
 * (Constitution V). No network, no storage: the pasted text lives in the textarea and nowhere else.
 */
(function () {
    'use strict';

    const SS = globalThis.SecretScanner;
    const $ = (id) => document.getElementById(id);
    const input = $('ss-input'), list = $('ss-list'), summary = $('ss-summary');
    const empty = $('ss-empty'), emptyText = $('ss-empty-text');
    const fixTile = $('ss-fix'), fixOutput = $('ss-fix-output');
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const CONF_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

    function el(tag, className, text) {
        const e = document.createElement(tag);
        if (className) e.className = className;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function confIcon(level) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4',
            'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
        const paths = level === 'high' ? ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M12 8v5M12 16h.01']
            : level === 'medium' ? ['M12 3l9 16H3z', 'M12 10v4M12 17h.01'] : ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 8v4M12 16h.01'];
        for (const d of paths) { const p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', d); svg.appendChild(p); }
        return svg;
    }

    function renderFinding(f) {
        const li = el('li', 'ss-finding');
        const head = el('div', 'ss-f-head');
        head.appendChild(el('span', 'ss-chip', f.label));
        const conf = el('span', 'ss-conf ss-conf-' + f.confidence);
        conf.appendChild(confIcon(f.confidence));
        conf.appendChild(document.createTextNode(CONF_LABEL[f.confidence] + ' confidence'));
        head.appendChild(conf);
        if (f.server) head.appendChild(el('span', 'ss-owner', f.server + ' · ' + f.envName));
        head.appendChild(el('span', 'ss-loc', f.mcp && !f.located ? 'in manifest' : 'Line ' + f.line + ', col ' + f.col));
        li.appendChild(head);

        const value = el('code', 'ss-value', f.preview);
        value.setAttribute('aria-label', 'Redacted value');
        li.appendChild(value);

        const actions = el('div', 'ss-f-actions');
        const reveal = el('button', 'btn btn-ghost', 'Reveal');
        reveal.type = 'button';
        reveal.setAttribute('aria-pressed', 'false');
        reveal.addEventListener('click', () => {
            const shown = reveal.getAttribute('aria-pressed') === 'true';
            reveal.setAttribute('aria-pressed', String(!shown));
            reveal.textContent = shown ? 'Reveal' : 'Hide';
            value.textContent = shown ? f.preview : f.value;
            value.setAttribute('aria-label', shown ? 'Redacted value' : 'Revealed value');
        });
        const copy = el('button', 'btn btn-ghost', 'Copy value');
        copy.type = 'button';
        copy.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(f.value); globalThis.DevSuite?.toast('Value copied', 'success', 1800); }
            catch { globalThis.DevSuite?.toast('Clipboard access denied', 'warning'); }
        });
        actions.append(reveal, copy);
        li.appendChild(actions);
        return li;
    }

    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

    function render() {
        const text = input.value;
        const result = SS.scan(text);
        list.replaceChildren();
        fixTile.hidden = true;

        if (!result.scannedChars) {
            summary.textContent = 'Paste text to scan.';
            emptyText.textContent = 'Nothing to scan yet.';
            empty.hidden = false;
            return;
        }
        const { findings } = result;
        if (!findings.length) {
            summary.textContent = 'No secrets found in ' + plural(result.scannedChars, 'character') + '.';
            emptyText.textContent = 'No secrets found. This is a pattern and entropy check, not a guarantee.';
            empty.hidden = false;
        } else {
            empty.hidden = true;
            const by = (c) => findings.filter((f) => f.confidence === c).length;
            summary.textContent = plural(findings.length, 'finding') + ' — ' + by('high') + ' high, ' + by('medium') + ' medium, ' + by('low') + ' low' +
                (result.manifest ? ' · MCP config detected' : '') + '.';
            findings.forEach((f) => list.appendChild(renderFinding(f)));
        }
        if (result.truncated) summary.textContent += ' Input was longer than ' + SS.MAX_SCAN_CHARS + ' characters; only the start was scanned.';
        if (result.manifest && findings.some((f) => f.mcp && f.located)) {
            fixOutput.value = SS.correctedManifest(text, findings);
            fixTile.hidden = false;
        }
    }

    let timer = null;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 250); });
    $('ss-clear').addEventListener('click', () => { input.value = ''; render(); input.focus(); });
    $('ss-sample-log').addEventListener('click', () => { input.value = SS.SAMPLE; render(); });
    $('ss-sample-mcp').addEventListener('click', () => { input.value = SS.SAMPLE_MCP; render(); });
    $('ss-copy-fix').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(fixOutput.value); globalThis.DevSuite?.toast('Corrected manifest copied', 'success', 1800); }
        catch { globalThis.DevSuite?.toast('Clipboard access denied', 'warning'); }
    });
    render();
}());
