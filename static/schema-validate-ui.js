/**
 * Data Linter — "Schema" dialog controller (BACKLOG AI-4).
 * Validates the current JSON/YAML input against a user-supplied JSON Schema using
 * JsonSchemaLite. Everything stays in the page; results are rendered with textContent only.
 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const dialog = $('schema-dialog');
    if (!dialog || !globalThis.JsonSchemaLite) return;

    const SAMPLE = JSON.stringify({
        type: 'object', required: ['city', 'unit'], additionalProperties: false,
        properties: {
            city: { type: 'string', minLength: 1 },
            unit: { enum: ['celsius', 'fahrenheit'] },
            days: { type: 'integer', minimum: 1, maximum: 14 },
        },
    }, null, 2);

    function activeTab() { return document.querySelector('.tab-btn.active')?.dataset.tab || 'json'; }

    function inputText() {
        const eds = globalThis.monaco?.editor?.getEditors?.() || [];
        const ed = eds.find((e) => e.getContainerDomNode?.().id === 'input-editor');
        return ed ? ed.getValue() : '';
    }

    function setSummary(text, kind) {
        const s = $('schema-summary');
        s.textContent = text;
        s.className = 'schema-summary' + (kind ? ' ' + kind : '');
    }

    function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

    function run() {
        const list = $('schema-errors');
        list.replaceChildren();
        const tab = activeTab();
        let data;
        try {
            const text = inputText();
            if (!text.trim()) { setSummary('The input editor is empty — paste the JSON or YAML to validate first.', 'fail'); return; }
            data = tab === 'yaml' ? globalThis.jsyaml.load(text) : JSON.parse(text);
        } catch (e) {
            setSummary('The input is not valid ' + tab.toUpperCase() + ': ' + e.message, 'fail');
            return;
        }
        let schema;
        try { schema = JSON.parse($('schema-input').value); }
        catch (e) { setSummary('The schema is not valid JSON: ' + e.message, 'fail'); return; }
        const problem = globalThis.JsonSchemaLite.checkSchema(schema);
        if (problem) { setSummary(problem, 'fail'); return; }

        const result = globalThis.JsonSchemaLite.validate(data, schema);
        if (result.valid) setSummary('Valid — the input conforms to the schema.', 'ok');
        else setSummary(result.errors.length + (result.errors.length === 1 ? ' error' : ' errors') + ' — the input does not conform.', 'fail');
        for (const err of result.errors) {
            const li = el('li');
            li.appendChild(el('code', '', err.path === '' ? '(root)' : err.path));
            li.appendChild(el('span', 'kw', err.keyword));
            li.appendChild(el('span', '', err.message));
            list.appendChild(li);
        }
        if (result.ignored.length) {
            list.appendChild(el('li', 'schema-ignored', 'Not checked (unsupported keywords): ' + result.ignored.join(', ')));
        }
    }

    $('btn-schema').addEventListener('click', () => {
        $('schema-tab-label').textContent = activeTab().toUpperCase();
        setSummary('', '');
        $('schema-errors').replaceChildren();
        dialog.showModal();
        $('schema-input').focus();
    });
    $('schema-run').addEventListener('click', run);
    $('schema-sample').addEventListener('click', () => { $('schema-input').value = SAMPLE; });
    $('schema-close').addEventListener('click', () => dialog.close());
}());
