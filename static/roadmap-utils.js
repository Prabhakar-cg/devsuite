/**
 * DevSuite — Learning Roadmap pure completion-computation helpers
 *
 * Mirrors roadmap_utils.py's compute_completion rules exactly (specs/018-learning-
 * roadmap/data-model.md, "Completion Computation") so the client's optimistic
 * percentages always match the server's authoritative ones, including at exact
 * .5 midpoints. Rounding policy is documented there: half-up (`Math.round`'s
 * native behavior), which is why roadmap_utils.py rounds via a round-half-up
 * helper instead of Python's builtin round() (round-half-to-even).
 *
 * Pure module: no DOM access. Loaded in the browser as globalThis.RoadmapUtils;
 * require()-able in node for tests/javascript/test_roadmap_utils.js.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    else { root.RoadmapUtils = api; }
})(globalThis, function () {
    'use strict';

    function computeStepPct(checklist) {
        const items = checklist || [];
        const total = items.length;
        if (total === 0) return 0;
        const done = items.filter(function (item) { return !!item.done; }).length;
        return Math.round((100 * done) / total);
    }

    function computeRoadmapPct(steps) {
        const list = steps || [];
        if (list.length === 0) return 0;
        const sum = list.reduce(function (acc, step) { return acc + computeStepPct(step.checklist); }, 0);
        return Math.round(sum / list.length);
    }

    const DEFAULT_BASE_URL = (typeof window !== 'undefined' && window.location)
        ? window.location.origin
        : 'http://localhost';

    /** Only http:/https: URLs are safe to render as a clickable link — course_links/
     * documents are user-supplied and persisted, so a `javascript:` URL here would be a
     * stored-XSS vector (clicking the rendered <a> would execute it in the page). */
    function isSafeHttpUrl(url) {
        if (!url) return false;
        try {
            const parsed = new URL(url, DEFAULT_BASE_URL);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    return { computeStepPct, computeRoadmapPct, isSafeHttpUrl };
});
