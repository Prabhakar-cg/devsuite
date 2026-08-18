/**
 * DevSuite — Notes Workspace pure logic
 *
 * Wiki-link parsing/resolution, backlinks, inline tags, and full-text
 * search over a decrypted NotesTree (specs/017-notes-workspace/data-model.md
 * §4). Pure module: no DOM access, no network, no crypto — operates
 * entirely on the in-memory tree handed to it by static/notes.js after
 * unlock/decrypt. Loaded in the browser as globalThis.NotesLinks;
 * require()-able in node for tests/javascript/test_notes_links.js.
 *
 * NotesTree shape: { version, notebooks: {id: Notebook}, sections: {id: Section},
 * pages: {id: Page} }. Page: { id, sectionId, title, body, createdAt, updatedAt }.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.NotesLinks = api; }
})(globalThis, function () {
    'use strict';

    const WIKI_LINK_RE = /\[\[([^[\]]+)\]\]/g;
    const TAG_RE = /#([A-Za-z0-9_-]+)/g;
    const SNIPPET_CONTEXT = 40;

    /* ── Titles ──────────────────────────────────────────────────────── */

    /** Case-insensitive, whitespace-trimmed normalization — the matching key for all title lookups. */
    function normalizeTitle(title) {
        return (title || '').trim().toLowerCase().replaceAll(/\s+/g, ' ');
    }

    /** True if no *other* page in the tree already has this (normalized) title. */
    function isTitleAvailable(tree, title, excludePageId) {
        const norm = normalizeTitle(title);
        if (!norm) return false;
        for (const page of Object.values(tree.pages || {})) {
            if (page.id === excludePageId) continue;
            if (normalizeTitle(page.title) === norm) return false;
        }
        return true;
    }

    /* ── Wiki-links ──────────────────────────────────────────────────── */

    /** Every [[Title]] occurrence in a page body, with its match position for snippet extraction. */
    function parseWikiLinks(body) {
        const links = [];
        if (!body) return links;
        WIKI_LINK_RE.lastIndex = 0;
        let m;
        while ((m = WIKI_LINK_RE.exec(body)) !== null) {
            links.push({ raw: m[0], title: m[1].trim(), index: m.index, length: m[0].length });
        }
        return links;
    }

    /** normalizedTitle -> pageId, across every page in the tree. */
    function buildTitleIndex(tree) {
        const index = new Map();
        for (const page of Object.values(tree.pages || {})) {
            index.set(normalizeTitle(page.title), page.id);
        }
        return index;
    }

    /** Resolve a [[Title]] reference to a pageId, or null if unresolved. */
    function resolveLink(title, titleIndex) {
        return titleIndex.get(normalizeTitle(title)) || null;
    }

    function _extractSnippet(text, matchIndex, matchLength) {
        const start = Math.max(0, matchIndex - SNIPPET_CONTEXT);
        const end = Math.min(text.length, matchIndex + matchLength + SNIPPET_CONTEXT);
        const prefix = start > 0 ? '…' : '';
        const suffix = end < text.length ? '…' : '';
        return prefix + text.slice(start, end).replaceAll(/\s+/g, ' ').trim() + suffix;
    }

    /** pageId -> [{ fromPageId, snippet }], the inverse view of every resolved wiki-link in the tree. */
    function buildBacklinksIndex(tree) {
        const titleIndex = buildTitleIndex(tree);
        const backlinks = new Map();
        for (const page of Object.values(tree.pages || {})) {
            for (const link of parseWikiLinks(page.body)) {
                const targetId = resolveLink(link.title, titleIndex);
                if (!targetId || targetId === page.id) continue; // unresolved, or self-link
                if (!backlinks.has(targetId)) backlinks.set(targetId, []);
                backlinks.get(targetId).push({
                    fromPageId: page.id,
                    snippet: _extractSnippet(page.body, link.index, link.length),
                });
            }
        }
        return backlinks;
    }

    /** Rewrite every `[[oldTitle]]` occurrence (any page) to `[[newTitle]]` — used on page rename. */
    function renameLinksInBody(body, oldTitle, newTitle) {
        if (!body) return body;
        const oldNorm = normalizeTitle(oldTitle);
        return body.replaceAll(WIKI_LINK_RE, (raw, inner) =>
            normalizeTitle(inner) === oldNorm ? `[[${newTitle}]]` : raw
        );
    }

    /* ── Tags ────────────────────────────────────────────────────────── */

    /** Every #tag token in a page body (no space after '#', so Markdown headings never match). */
    function extractTags(body) {
        const tags = new Set();
        if (!body) return tags;
        TAG_RE.lastIndex = 0;
        let m;
        while ((m = TAG_RE.exec(body)) !== null) tags.add(m[1].toLowerCase());
        return tags;
    }

    /** tagName -> Set<pageId>, across every page in the tree. */
    function buildTagIndex(tree) {
        const index = new Map();
        for (const page of Object.values(tree.pages || {})) {
            for (const tag of extractTags(page.body)) {
                if (!index.has(tag)) index.set(tag, new Set());
                index.get(tag).add(page.id);
            }
        }
        return index;
    }

    /* ── Search ──────────────────────────────────────────────────────── */

    /**
     * Case-insensitive substring search over every page's title + body.
     * Returns [{ pageId, title, snippets: [string] }], title matches first.
     * Empty/whitespace-only query returns [].
     */
    function searchNotes(tree, query) {
        const q = (query || '').trim().toLowerCase();
        if (!q) return [];
        const results = [];
        for (const page of Object.values(tree.pages || {})) {
            const titleMatch = (page.title || '').toLowerCase().includes(q);
            const body = page.body || '';
            const bodyLower = body.toLowerCase();
            const snippets = [];
            let searchFrom = 0;
            while (snippets.length < 3) {
                const idx = bodyLower.indexOf(q, searchFrom);
                if (idx === -1) break;
                snippets.push(_extractSnippet(body, idx, q.length));
                searchFrom = idx + q.length;
            }
            if (titleMatch || snippets.length) {
                results.push({ pageId: page.id, title: page.title, snippets });
            }
        }
        // Title matches first, then by snippet count (more matches ranks higher), stable otherwise.
        results.sort((a, b) => {
            const aTitle = (a.title || '').toLowerCase().includes(q);
            const bTitle = (b.title || '').toLowerCase().includes(q);
            if (aTitle !== bTitle) return aTitle ? -1 : 1;
            return b.snippets.length - a.snippets.length;
        });
        return results;
    }

    /* ── Preview rendering ──────────────────────────────────────────── */

    /**
     * Markdown -> sanitized HTML for the preview pane. Pure wiring: `markedLib`
     * and `purifyLib` are injected by the caller (globals `marked`/`DOMPurify`
     * in the browser) so this never reaches a DOM API itself, and so tests can
     * assert the sanitize step is never skipped without depending on a real
     * DOM (Constitution Art. V — no unsanitized HTML ever reaches the page).
     */
    function sanitizeMarkdownBody(body, markedLib, purifyLib) {
        const rawHtml = markedLib.parse(body || '');
        return purifyLib.sanitize(rawHtml);
    }

    /* ── Aggregate ───────────────────────────────────────────────────── */

    /** Convenience: every derived index a caller needs after a tree mutation, built in one pass. */
    function buildIndexes(tree) {
        return {
            titleIndex: buildTitleIndex(tree),
            backlinks: buildBacklinksIndex(tree),
            tagIndex: buildTagIndex(tree),
        };
    }

    return {
        normalizeTitle,
        isTitleAvailable,
        parseWikiLinks,
        buildTitleIndex,
        resolveLink,
        buildBacklinksIndex,
        renameLinksInBody,
        extractTags,
        buildTagIndex,
        searchNotes,
        buildIndexes,
        sanitizeMarkdownBody,
    };
});
