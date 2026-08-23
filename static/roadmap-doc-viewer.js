/**
 * DevSuite — Roadmap Doc Viewer (static/roadmap-doc-viewer.js)
 *
 * Fetches a markdown file from /static/roadmap-docs/<doc>.md (doc id passed
 * via ?doc=) and renders it read-only, reusing the same marked + DOMPurify
 * sanitization pipeline as Notes Workspace (NotesLinks.sanitizeMarkdownBody —
 * Constitution Art. V, never insert unsanitized HTML). Pure display: no
 * DevDB access, no editing, no auth gate (roadmap content is unauthenticated
 * per specs/018-learning-roadmap/spec.md).
 */
(function () {
    'use strict';

    const DOC_ID_RE = /^[a-z0-9-]+$/;

    const articleEl = document.getElementById('doc-article');
    const tocEl = document.getElementById('doc-toc');
    const printBtn = document.getElementById('print-btn');

    function showError(message) {
        articleEl.textContent = '';
        const wrap = document.createElement('div');
        wrap.className = 'doc-error';
        wrap.textContent = message;
        articleEl.appendChild(wrap);
    }

    function slugifyHeading(text, seen) {
        let slug = text.toLowerCase().trim().replaceAll(/[^a-z0-9\s-]/g, '').replaceAll(/\s+/g, '-');
        if (!slug) slug = 'section';
        let unique = slug;
        let n = 2;
        while (seen.has(unique)) {
            unique = slug + '-' + n;
            n += 1;
        }
        seen.add(unique);
        return unique;
    }

    /** Assign ids to h2/h3 headings and build a simple nested TOC from them. */
    function buildToc() {
        const seen = new Set();
        const headings = articleEl.querySelectorAll('h2, h3');
        if (headings.length === 0) {
            tocEl.style.display = 'none';
            return;
        }
        const list = document.createElement('ul');
        headings.forEach(function (h) {
            const id = slugifyHeading(h.textContent || '', seen);
            h.id = id;
            const li = document.createElement('li');
            li.className = 'doc-toc-' + h.tagName.toLowerCase();
            const a = document.createElement('a');
            a.href = '#' + id;
            a.textContent = h.textContent;
            li.appendChild(a);
            list.appendChild(li);
        });
        const label = document.createElement('div');
        label.className = 'doc-toc-label';
        label.textContent = 'On this page';
        tocEl.appendChild(label);
        tocEl.appendChild(list);
    }

    async function load() {
        const params = new URLSearchParams(window.location.search);
        const docId = params.get('doc') || '';
        const titleParam = params.get('title') || '';

        if (!DOC_ID_RE.test(docId)) {
            showError('No document specified.');
            return;
        }

        let response;
        try {
            response = await fetch('/static/roadmap-docs/' + docId + '.md');
        } catch (e) {
            showError('Could not load this document (network error).');
            return;
        }
        if (!response.ok) {
            showError('This document could not be found.');
            return;
        }
        const text = await response.text();

        articleEl.textContent = '';
        articleEl.innerHTML = NotesLinks.sanitizeMarkdownBody(text, marked, DOMPurify); // NOSONAR — sanitized via DOMPurify inside sanitizeMarkdownBody

        const firstH1 = articleEl.querySelector('h1');
        const pageTitle = (firstH1 && firstH1.textContent) || titleParam || 'Roadmap Doc';
        document.title = pageTitle + ' — DevSuite';

        buildToc();
    }

    printBtn.addEventListener('click', function () {
        window.print();
    });

    load();
})();
