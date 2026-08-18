/** Unit tests for static/notes-links.js — Notes Workspace wiki-link/tag/search logic
 * (specs/017-notes-workspace/data-model.md, FR-007–FR-017). */
'use strict';

const assert = require('node:assert/strict');
const NotesLinks = require('../../static/notes-links.js');

function makeTree(pages) {
    return { version: 1, notebooks: {}, sections: {}, pages };
}

// ─── Title normalization / uniqueness (FR-013) ────────────────────────────────

test('normalizeTitle trims, lowercases, and collapses whitespace', () => {
    assert.equal(NotesLinks.normalizeTitle('  Design   Doc  '), 'design doc');
});

test('isTitleAvailable rejects a title already used by another page', () => {
    const tree = makeTree({ p1: { id: 'p1', title: 'Kickoff', body: '' } });
    assert.equal(NotesLinks.isTitleAvailable(tree, 'kickoff', null), false);
});

test('isTitleAvailable allows a page to keep its own title on rename', () => {
    const tree = makeTree({ p1: { id: 'p1', title: 'Kickoff', body: '' } });
    assert.equal(NotesLinks.isTitleAvailable(tree, 'Kickoff', 'p1'), true);
});

test('isTitleAvailable rejects an empty title', () => {
    const tree = makeTree({});
    assert.equal(NotesLinks.isTitleAvailable(tree, '   ', null), false);
});

test('isTitleAvailable allows a genuinely free title', () => {
    const tree = makeTree({ p1: { id: 'p1', title: 'Kickoff', body: '' } });
    assert.equal(NotesLinks.isTitleAvailable(tree, 'Design Doc', null), true);
});

// ─── Wiki-link parsing / resolution (FR-007, FR-008, FR-013) ──────────────────

test('parseWikiLinks finds every [[Title]] occurrence with position', () => {
    const links = NotesLinks.parseWikiLinks('See [[Page A]] and also [[Page B]].');
    assert.equal(links.length, 2);
    assert.equal(links[0].title, 'Page A');
    assert.equal(links[1].title, 'Page B');
    assert.equal(links[0].index, 4);
});

test('parseWikiLinks returns empty array for no links or empty body', () => {
    assert.deepEqual(NotesLinks.parseWikiLinks('no links here'), []);
    assert.deepEqual(NotesLinks.parseWikiLinks(''), []);
    assert.deepEqual(NotesLinks.parseWikiLinks(undefined), []);
});

test('resolveLink matches case-insensitively and trims whitespace', () => {
    const tree = makeTree({ p1: { id: 'p1', title: 'Design Doc', body: '' } });
    const idx = NotesLinks.buildTitleIndex(tree);
    assert.equal(NotesLinks.resolveLink('  design DOC  ', idx), 'p1');
});

test('resolveLink returns null for a title that does not exist (unresolved link)', () => {
    const tree = makeTree({ p1: { id: 'p1', title: 'Design Doc', body: '' } });
    const idx = NotesLinks.buildTitleIndex(tree);
    assert.equal(NotesLinks.resolveLink('Nonexistent Page', idx), null);
});

// ─── Backlinks (FR-010, FR-011, FR-012) ────────────────────────────────────────

test('buildBacklinksIndex lists every page linking to a resolved target with a snippet', () => {
    const tree = makeTree({
        p1: { id: 'p1', title: 'Kickoff', body: 'Reference the [[Design Doc]] here.' },
        p2: { id: 'p2', title: 'Design Doc', body: 'No outgoing links.' },
    });
    const backlinks = NotesLinks.buildBacklinksIndex(tree);
    assert.equal(backlinks.get('p2').length, 1);
    assert.equal(backlinks.get('p2')[0].fromPageId, 'p1');
    assert.match(backlinks.get('p2')[0].snippet, /Design Doc/);
});

test('buildBacklinksIndex omits unresolved links (target page does not exist)', () => {
    const tree = makeTree({
        p1: { id: 'p1', title: 'Kickoff', body: 'Links to [[Nowhere]].' },
    });
    const backlinks = NotesLinks.buildBacklinksIndex(tree);
    assert.equal(backlinks.size, 0);
});

test('buildBacklinksIndex ignores self-links', () => {
    const tree = makeTree({
        p1: { id: 'p1', title: 'Kickoff', body: 'Refers to itself: [[Kickoff]].' },
    });
    const backlinks = NotesLinks.buildBacklinksIndex(tree);
    assert.equal(backlinks.size, 0);
});

test('deleting the referenced page leaves the referencing body untouched (link becomes unresolved)', () => {
    // Simulates FR-012: page p2 ("Design Doc") is removed from the tree entirely;
    // p1's body is never mutated, so the link simply stops resolving.
    const treeBefore = makeTree({
        p1: { id: 'p1', title: 'Kickoff', body: 'See [[Design Doc]].' },
        p2: { id: 'p2', title: 'Design Doc', body: '' },
    });
    const bodyBefore = treeBefore.pages.p1.body;
    const treeAfter = makeTree({ p1: { id: 'p1', title: 'Kickoff', body: bodyBefore } });
    assert.equal(treeAfter.pages.p1.body, bodyBefore);
    assert.equal(NotesLinks.buildBacklinksIndex(treeAfter).size, 0);
});

test('renameLinksInBody rewrites matching links and leaves others untouched', () => {
    const body = 'See [[Design Doc]] and also [[Other Page]].';
    const renamed = NotesLinks.renameLinksInBody(body, 'Design Doc', 'Design Document');
    assert.equal(renamed, 'See [[Design Document]] and also [[Other Page]].');
});

test('renameLinksInBody matches case-insensitively', () => {
    const renamed = NotesLinks.renameLinksInBody('[[design doc]]', 'Design Doc', 'New Title');
    assert.equal(renamed, '[[New Title]]');
});

// ─── Tags (FR-014, FR-015) ──────────────────────────────────────────────────────

test('extractTags finds #tag tokens but not Markdown headings', () => {
    const tags = NotesLinks.extractTags('# Heading\n## Subheading\nBody text #todo #idea-two');
    assert.deepEqual([...tags].sort(), ['idea-two', 'todo']);
});

test('extractTags de-duplicates repeated tags', () => {
    const tags = NotesLinks.extractTags('#todo something #todo again');
    assert.deepEqual([...tags], ['todo']);
});

test('buildTagIndex maps each tag to every page that carries it', () => {
    const tree = makeTree({
        p1: { id: 'p1', title: 'A', body: '#todo' },
        p2: { id: 'p2', title: 'B', body: '#todo #idea' },
    });
    const tagIndex = NotesLinks.buildTagIndex(tree);
    assert.deepEqual([...tagIndex.get('todo')].sort(), ['p1', 'p2']);
    assert.deepEqual([...tagIndex.get('idea')], ['p2']);
});

// ─── Search (FR-016) ─────────────────────────────────────────────────────────

test('searchNotes matches on title and returns it ranked first', () => {
    const tree = makeTree({
        p1: { id: 'p1', title: 'Random', body: 'mentions kickoff in passing' },
        p2: { id: 'p2', title: 'Kickoff', body: 'unrelated content' },
    });
    const results = NotesLinks.searchNotes(tree, 'kickoff');
    assert.equal(results.length, 2);
    assert.equal(results[0].pageId, 'p2');
});

test('searchNotes returns a context snippet for body matches', () => {
    const tree = makeTree({
        p1: { id: 'p1', title: 'Notes', body: 'a long line of text with the word unicorn inside it' },
    });
    const results = NotesLinks.searchNotes(tree, 'unicorn');
    assert.equal(results.length, 1);
    assert.match(results[0].snippets[0], /unicorn/);
});

test('searchNotes returns empty array for an empty or whitespace-only query', () => {
    const tree = makeTree({ p1: { id: 'p1', title: 'A', body: 'text' } });
    assert.deepEqual(NotesLinks.searchNotes(tree, ''), []);
    assert.deepEqual(NotesLinks.searchNotes(tree, '   '), []);
});

test('searchNotes returns empty array when nothing matches', () => {
    const tree = makeTree({ p1: { id: 'p1', title: 'A', body: 'text' } });
    assert.deepEqual(NotesLinks.searchNotes(tree, 'xyznomatch'), []);
});

// ─── Aggregate ───────────────────────────────────────────────────────────────

test('buildIndexes returns titleIndex, backlinks, and tagIndex together', () => {
    const tree = makeTree({
        p1: { id: 'p1', title: 'A', body: 'See [[B]] #todo' },
        p2: { id: 'p2', title: 'B', body: '' },
    });
    const { titleIndex, backlinks, tagIndex } = NotesLinks.buildIndexes(tree);
    assert.equal(titleIndex.get('b'), 'p2');
    assert.equal(backlinks.get('p2').length, 1);
    assert.deepEqual([...tagIndex.get('todo')], ['p1']);
});
