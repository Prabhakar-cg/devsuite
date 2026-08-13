# Specification Quality Checklist: Local API Tester

**Purpose**: Validate specification completeness and quality before treating this as the
authoritative retroactive record for `specs/008-api-tester/`
**Created**: 2026-07-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details leak into user-facing requirement language (FRs describe
      observable behavior; implementation specifics are confined to plan.md/research.md/contracts/)
- [x] Focused on user value and business needs (each user story states a real developer workflow)
- [x] Written for non-technical stakeholders where possible — though this tool's security-relevant
      discrepancy (script sandbox) required naming specific files/functions to be actionable; traded
      strict template purity for honesty per CLAUDE.md rule 2
- [x] All mandatory sections completed (User Scenarios, Requirements, Success Criteria, Assumptions)

## Requirement Completeness

- [x] No unresolved `[NEEDS CLARIFICATION]` markers — every ambiguity found during source
      inspection was either resolved by reading the code directly or documented as a known gap
      (script sandbox, undocumented OAuth2/GraphQL/History) rather than left open
- [x] Requirements are testable and unambiguous (each FR ties to a specific function/file)
- [x] Success criteria are measurable, including SC-006 (script sandbox), which was found failing
      during the initial pass and fixed the same day (2026-07-28) rather than described as passing
      without verification
- [x] Success criteria are technology-agnostic in the criteria themselves (implementation is cited
      as evidence, not as the requirement)
- [x] All acceptance scenarios are defined, including US6 (script sandbox), verified working after
      the 2026-07-28 fix
- [x] Edge cases identified (CSP `connect-src` interaction, duplicate Set-Cookie, Postman `/` in
      folder names, environment/collection storage split, OAuth2 cache invalidation)
- [x] Scope is clearly bounded — spec.md explicitly states what was fixed by this pass (the sandbox
      execution stub, 2026-07-28) vs. what remains a documentation-only gap (SPEC.md §4.7's
      undocumented-capability gap for OAuth2/GraphQL/History)
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows (send, organize, import/export, automate, environments,
      script, cookies, git-friendly export)
- [x] Feature meets all measurable outcomes defined in Success Criteria (SC-001–SC-006)
- [x] No implementation details leak into the specification's *requirements* (FR-level) though
      plan.md/research.md are implementation-facing by design

## Notes

- **Validation pass (2026-07-28, initial)**: all items passed with one deliberate exception —
  SC-006 was marked failing, and US6's acceptance scenarios were marked "as designed" with an
  explicit "current actual behavior" callout, per CLAUDE.md rule 2 ("Verify against source... flag
  the discrepancy explicitly — never silently pick one") rather than an oversight.
- **Fix pass (2026-07-28, same day)**: the script-sandbox execution gap was fixed in
  `static/script-sandbox-worker.js` and `static/api-tester.js` (signed-execution handshake + real
  `new Function()` execution restored). This spec, plan.md, tasks.md, data-model.md, research.md,
  and quickstart.md were updated to describe the now-working behavior; SC-006 and US6 no longer
  carry an exception.
- **Source-verification method**: every FR and acceptance scenario was checked against
  `routes/proxy.py`, `routes/storage.py`, `static/api-tester.js`, `static/api-client.js`,
  `static/script-sandbox-worker.js`, `static/curl-codegen.js`, `static/cookie-jar.js`, and
  `static/collection-utils.js` directly — not derived solely from `specs/SPEC.md` prose, which
  predates several shipped capabilities (OAuth2, GraphQL, History).
- **Known follow-up work this checklist does NOT block on**: (1) fold OAuth2/GraphQL/History
  documentation back into `specs/SPEC.md` §4.7 itself, (2) add a regression test asserting a
  validly-signed script actually executes (no test covers this yet), (3) consider extracting
  Postman/OpenAPI parsing into a pure, test-covered module alongside the existing three.
