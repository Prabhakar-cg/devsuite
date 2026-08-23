/** Unit tests for static/roadmap-utils.js — Learning Roadmap completion math.
 * Mirrors tests/python/test_roadmap_utils.py; see data-model.md "Completion
 * Computation" for the documented round-half-up policy these must agree with. */
'use strict';

const assert = require('node:assert/strict');
const RoadmapUtils = require('../../static/roadmap-utils.js');

function item(done) {
    return { done: done };
}

test('computeStepPct is 0 for a step with zero checklist items', () => {
    assert.equal(RoadmapUtils.computeStepPct([]), 0);
});

test('computeRoadmapPct is 0 for a roadmap with zero steps', () => {
    assert.equal(RoadmapUtils.computeRoadmapPct([]), 0);
});

test('computeStepPct rounds a non-exact fraction (1/3 -> 33)', () => {
    assert.equal(RoadmapUtils.computeStepPct([item(true), item(false), item(false)]), 33);
});

test('computeStepPct rounds an exact .5 midpoint up (1/8 -> 13, matching roadmap_utils.py)', () => {
    const checklist = [item(true)].concat(Array(7).fill(item(false)));
    assert.equal(RoadmapUtils.computeStepPct(checklist), 13);
});

test('computeRoadmapPct rounds an exact .5 midpoint up (avg of 25% and 50% -> 38)', () => {
    const steps = [
        { checklist: [item(true)].concat(Array(3).fill(item(false))) }, // 25%
        { checklist: [item(true), item(false)] },                       // 50%
    ];
    assert.equal(RoadmapUtils.computeRoadmapPct(steps), 38);
});

test('computeRoadmapPct is the unweighted average of step percentages', () => {
    const steps = [
        { checklist: [] },                                  // 0%
        { checklist: [item(true), item(false)] },            // 50%
        { checklist: [item(true), item(true)] },              // 100%
    ];
    assert.equal(RoadmapUtils.computeRoadmapPct(steps), 50);
});

// ─── isSafeHttpUrl (stored-XSS guard for course_links/documents) ──────────────

test('isSafeHttpUrl allows http and https URLs', () => {
    assert.equal(RoadmapUtils.isSafeHttpUrl('https://example.com/course'), true);
    assert.equal(RoadmapUtils.isSafeHttpUrl('http://example.com'), true);
});

test('isSafeHttpUrl rejects a javascript: URL', () => {
    assert.equal(RoadmapUtils.isSafeHttpUrl('javascript:alert(1)'), false);
});

test('isSafeHttpUrl rejects a data: URL', () => {
    assert.equal(RoadmapUtils.isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
});

test('isSafeHttpUrl rejects an empty or malformed value', () => {
    assert.equal(RoadmapUtils.isSafeHttpUrl(''), false);
});
