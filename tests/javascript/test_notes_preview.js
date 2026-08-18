/** Unit tests for NotesLinks.sanitizeMarkdownBody (static/notes-links.js) —
 * the Markdown-preview sanitization wiring used by static/notes.js
 * renderPreview() (Constitution Art. V, research.md item 5).
 *
 * The real DOMPurify bundle (static/libs/dompurify.min.js) needs a live DOM
 * to construct (`createDOMPurify(window)`), which the zero-dependency Node
 * test runner doesn't provide (CLAUDE.md: "JS unit suite ... zero
 * dependencies"). So these tests use the real `marked` parser (pure JS, runs
 * fine in Node) plus an injected sanitizer stub that mirrors DOMPurify's
 * documented behavior for this payload (strip `on*` handler attributes,
 * keep the element) to assert two things our code is responsible for:
 * the sanitizer is always in the path, and it always receives marked's
 * *raw*, unsanitized output. Actual attribute/script stripping is
 * DOMPurify's own tested responsibility upstream. */
'use strict';

const assert = require('node:assert/strict');
const NotesLinks = require('../../static/notes-links.js');
const marked = require('../../static/libs/marked.min.js');

const XSS_PAYLOAD = '<img src=x onerror=alert(1)>';

// Strips on* handler attributes but keeps the element — the same contract
// DOMPurify documents for this payload (quickstart.md's "no onerror
// attribute, element still renders" expectation).
function fakePurify() {
    return {
        sanitize(html) {
            let out = html;
            let previous;
            do {
                previous = out;
                out = out.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi, '');
            } while (out !== previous);
            return out;
        },
    };
}

test('sanitizeMarkdownBody strips a script-injection payload before it reaches the caller', () => {
    const purify = fakePurify();
    const out = NotesLinks.sanitizeMarkdownBody(XSS_PAYLOAD, marked, purify);
    assert.ok(!/onerror/i.test(out), `expected onerror to be stripped, got: ${out}`);
    assert.ok(/<img/i.test(out), 'expected the sanitized element to still render');
});

test('sanitizeMarkdownBody never returns marked output unsanitized', () => {
    let sawRawPayload = false;
    const spyPurify = {
        sanitize(html) {
            sawRawPayload = html.includes('onerror');
            return '<img src="x">'; // simulate DOMPurify's stripped result
        },
    };
    const out = NotesLinks.sanitizeMarkdownBody(XSS_PAYLOAD, marked, spyPurify);
    assert.equal(sawRawPayload, true, 'sanitizer should receive the raw marked output, onerror included');
    assert.equal(out, '<img src="x">', 'the function must return the sanitizer\'s output, not the raw HTML');
});

test('sanitizeMarkdownBody handles an empty body without invoking marked on undefined', () => {
    const purify = fakePurify();
    assert.equal(NotesLinks.sanitizeMarkdownBody('', marked, purify), '');
    assert.equal(NotesLinks.sanitizeMarkdownBody(undefined, marked, purify), '');
});
