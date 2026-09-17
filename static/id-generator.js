/**
 * DevSuite — ID Generator DOM controller (feature 019).
 *
 * Thin glue: wires the type selector, count input, Generate button, entropy
 * panel, and copy controls to the pure IdGen module (static/id-gen.js). All
 * generated values are inserted via createElement + textContent — never
 * innerHTML with a generated string (SPEC §5, constitution Art. V).
 */
(function () {
    'use strict';

    const IdGen = globalThis.IdGen;
    const MAX_COUNT = 1000;

    // ── Toast (shared component markup; see toast.css) ──
    function toast(msg, type, ms) {
        type = type || 'info';
        ms = ms || 2500;
        const c = document.getElementById('toast-container');
        if (!c) { return; }
        const t = document.createElement('div');
        t.className = 'toast ' + type;
        const span = document.createElement('span');
        span.textContent = msg;
        const btn = document.createElement('button');
        btn.className = 'toast-close';
        btn.setAttribute('aria-label', 'Dismiss notification');
        btn.textContent = '\u2715';
        btn.onclick = function () {
            this.parentElement.classList.add('hide');
            setTimeout(() => this.parentElement.remove(), 300);
        };
        t.appendChild(span);
        t.appendChild(btn);
        c.appendChild(t);
        setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 300); }, ms);
    }

    function svg(paths, size) {
        const s = size || 13;
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        el.setAttribute('width', String(s));
        el.setAttribute('height', String(s));
        el.setAttribute('viewBox', '0 0 24 24');
        el.setAttribute('fill', 'none');
        el.setAttribute('stroke', 'currentColor');
        el.setAttribute('stroke-width', '2');
        el.setAttribute('stroke-linecap', 'round');
        el.setAttribute('stroke-linejoin', 'round');
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = paths; // static, developer-authored SVG path markup — no user data
        return el;
    }

    const COPY_PATHS = '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>';

    // ── State ──
    let selectedType = 'uuid4';
    let currentBatch = null; // { typeId, values }

    // ── Elements ──
    const typesEl = document.getElementById('idg-types');
    const countEl = document.getElementById('idg-count');
    const countErrEl = document.getElementById('idg-count-error');
    const generateBtn = document.getElementById('idg-generate');
    const blurbEl = document.getElementById('idg-entropy-blurb');
    const factsEl = document.getElementById('idg-facts');
    const sortableEl = document.getElementById('idg-sortable');
    const listEl = document.getElementById('idg-results-list');
    const emptyEl = document.getElementById('idg-empty');
    const titleEl = document.getElementById('idg-results-title');
    const copyAllBtn = document.getElementById('idg-copy-all');
    const statusPill = document.getElementById('idg-status');
    const statusText = document.getElementById('idg-status-text');

    function setStatus(kind, text) {
        statusPill.className = 'status-pill ' + kind;
        statusText.textContent = text;
    }

    // ── Type selector ──
    function buildTypeButtons() {
        IdGen.TYPE_IDS.forEach(function (id) {
            const t = IdGen.ID_TYPES[id];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'idg-type';
            btn.dataset.type = id;
            btn.setAttribute('aria-pressed', id === selectedType ? 'true' : 'false');
            const dot = document.createElement('span');
            dot.className = 'idg-type-dot';
            dot.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.textContent = t.label;
            btn.appendChild(dot);
            btn.appendChild(label);
            btn.addEventListener('click', function () { selectType(id); });
            typesEl.appendChild(btn);
        });
    }

    function selectType(id) {
        selectedType = id;
        Array.prototype.forEach.call(typesEl.querySelectorAll('.idg-type'), function (b) {
            b.setAttribute('aria-pressed', b.dataset.type === id ? 'true' : 'false');
        });
        renderEntropy();
    }

    // ── Entropy panel ──
    function addFact(key, val) {
        const k = document.createElement('span');
        k.className = 'idg-fact-key';
        k.textContent = key;
        const v = document.createElement('span');
        v.className = 'idg-fact-val';
        v.textContent = val;
        factsEl.appendChild(k);
        factsEl.appendChild(v);
    }

    function renderEntropy() {
        const t = IdGen.ID_TYPES[selectedType];
        blurbEl.textContent = t.blurb;
        factsEl.textContent = '';
        addFact('Total bits', String(t.totalBits));
        addFact('Random bits', t.id === 'cuid2' ? '~' + t.randomBits : String(t.randomBits));
        if (t.timeBits > 0) {
            addFact('Timestamp', t.timeBits + '-bit ms (Unix epoch)');
        }
        sortableEl.hidden = !t.timeSortable;
    }

    // ── Count validation ──
    function showCountError(msg) {
        countErrEl.textContent = msg;
        countErrEl.classList.add('visible');
    }
    function clearCountError() {
        countErrEl.textContent = '';
        countErrEl.classList.remove('visible');
    }

    function readCount() {
        const raw = countEl.value.trim();
        if (raw === '') { return { error: 'Enter a count between 1 and ' + MAX_COUNT + '.' }; }
        if (!/^\d+$/.test(raw)) { return { error: 'Count must be a whole number.' }; }
        const n = parseInt(raw, 10);
        if (n < 1) { return { error: 'Count must be at least 1.' }; }
        if (n > MAX_COUNT) { return { error: 'Count is capped at ' + MAX_COUNT + ' per batch.' }; }
        return { value: n };
    }

    // ── Rendering results ──
    function copyText(text, okMsg) {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
            toast('Copy failed — clipboard unavailable in this context', 'error');
            return;
        }
        navigator.clipboard.writeText(text).then(
            function () { toast(okMsg, 'success', 1500); },
            function () { toast('Copy failed — clipboard permission denied', 'error'); }
        );
    }

    function renderBatch(batch) {
        currentBatch = batch;
        const t = IdGen.ID_TYPES[batch.typeId];
        listEl.textContent = '';
        if (emptyEl) { emptyEl.remove(); }

        batch.values.forEach(function (value, i) {
            const row = document.createElement('div');
            row.className = 'idg-row';

            const idx = document.createElement('span');
            idx.className = 'idg-row-index';
            idx.textContent = String(i + 1);

            const val = document.createElement('span');
            val.className = 'idg-row-value';
            val.textContent = value;

            row.appendChild(idx);
            row.appendChild(val);

            if (t.decodesTime) {
                const decoded = IdGen.decodeTimestamp(batch.typeId, value);
                if (decoded) {
                    const time = document.createElement('span');
                    time.className = 'idg-row-time';
                    time.textContent = decoded.iso;
                    time.title = 'Embedded creation timestamp';
                    row.appendChild(time);
                }
            }

            const copyBtn = document.createElement('button');
            copyBtn.className = 'idg-icon-btn';
            copyBtn.setAttribute('aria-label', 'Copy identifier ' + (i + 1));
            copyBtn.title = 'Copy';
            copyBtn.appendChild(svg(COPY_PATHS, 13));
            copyBtn.addEventListener('click', function () {
                copyText(value, 'Copied identifier');
            });
            row.appendChild(copyBtn);

            listEl.appendChild(row);
        });

        titleEl.textContent = batch.values.length + ' \u00d7 ' + t.label;
        copyAllBtn.disabled = batch.values.length === 0;
    }

    // ── Generate ──
    function doGenerate() {
        const parsed = readCount();
        if (parsed.error) {
            showCountError(parsed.error);
            setStatus('invalid', 'Invalid count');
            return; // leave prior batch untouched (FR-012)
        }
        clearCountError();
        try {
            const batch = IdGen.generate(selectedType, parsed.value);
            renderBatch(batch);
            setStatus('valid', 'Generated');
        } catch (e) {
            setStatus('invalid', 'Error');
            toast((e && e.message) || 'Generation failed', 'error');
        }
    }

    // ── Wire up ──
    generateBtn.addEventListener('click', doGenerate);
    countEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { doGenerate(); }
    });
    countEl.addEventListener('input', clearCountError);

    copyAllBtn.addEventListener('click', function () {
        if (!currentBatch || currentBatch.values.length === 0) { return; }
        copyText(currentBatch.values.join('\n'), 'Copied ' + currentBatch.values.length + ' identifiers');
    });

    buildTypeButtons();
    renderEntropy();
})();
