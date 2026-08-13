# Specification Quality Checklist: Secret Vault

**Purpose**: Validate specification completeness and quality
**Created**: 2026-07-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details leak into user stories/requirements (implementation detail is
      confined to plan.md/research.md/data-model.md, as intended by the template)
- [x] Focused on user value and business needs
- [x] Written so a non-technical stakeholder could follow the user stories
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No `[NEEDS CLARIFICATION]` markers remain — this is a retroactive spec of shipped
      behavior, so ambiguities were resolved by reading the source rather than asking the user
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic where possible (SC-002 necessarily references the
      test file that proves it, since this is a retroactive security spec)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded (six categories, client-side-only crypto, no server changes)
- [x] Dependencies and assumptions identified — including two real discrepancies found against
      `specs/SPEC.md` §4.10 (category list) and one against implied session-hygiene behavior
      (auto-lock v2 gap)

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows (setup, CRUD, reveal/copy, filter/search, crypto
      guarantee, migration)
- [x] Feature meets the measurable outcomes defined in Success Criteria, per existing test
      coverage (`test_vault_v2.py`, `test_auth_session.py`, `test_devdb.py`)
- [x] No implementation details leak into the spec's Requirements section

## Notes

- **Discrepancy 1** (spec.md Assumptions): SPEC.md §4.10 lists categories "Token · Password · SSH
  Key · API Key · Note · Other"; the code (`TYPE_META`, `static/vault.js:36-43`) implements
  Password/Token/SSH Key/API Key/**Env Secret**/Note — no "Other" category exists anywhere in the
  UI, form fields, or type builders. Recommend correcting SPEC.md §4.10, not the code (the code
  is the more specific, more-recently-touched artifact and "Env Secret" is a real, wired-up
  feature).
- **Discrepancy 2** (spec.md Assumptions): the auto-lock visibility handler checks the legacy
  `masterKey` variable, which is never populated on a v2-only unlock path — auto-lock plausibly
  does not fire for v2 sessions. Flagged, not fixed (out of scope for a documentation-only spec);
  recommend a follow-up fix + regression test.
- **Discrepancy 3** (spec.md Assumptions, cross-referenced in `specs/012-db-manager/spec.md`): DB
  Manager's password-change flow writes v1-only challenge fields, silently downgrading an
  existing v2 vault's authentication challenge (though not its ciphertext) when used.
- Verified against source: `routes/auth.py`, `routes/storage.py`, `static/vault.js` (full file),
  `static/components.js`, and cross-checked against `tests/python/test_vault_v2.py`,
  `test_auth_session.py`, `test_devdb.py`.
