# Specification Quality Checklist: Secure Terminal & SFTP

**Purpose**: Validate specification completeness and quality before treating this retroactive
spec as the source of truth for future changes to this tool
**Created**: 2026-07-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details leak into user-story/requirement language (implementation lives
      in plan.md/data-model.md/contracts/ instead)
- [x] Focused on user value (terminal access, safe host trust, encrypted profiles, file
      transfer) and business needs (offline-first exception documented, not hidden)
- [x] Written so a non-technical stakeholder can follow the User Scenarios section
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No `[NEEDS CLARIFICATION]` markers remain — this is a retroactive spec of shipped
      behavior, so ambiguity was resolved by reading `routes/ssh.py` directly rather than by
      guessing
- [x] Requirements (FR-001…FR-017) are testable and unambiguous
- [x] Success criteria are measurable and technology-agnostic
- [x] All six user stories have acceptance scenarios
- [x] Edge cases identified (origin mismatch, key rejection, keyscan timeout, SFTP 409 loop,
      password rotation, no-WSL Windows, resize-during-output)
- [x] Scope is clearly bounded (terminal + SFTP + local/WSL + dashboard; explicitly not the
      Secret Vault's encryption scheme, which is a separate tool)
- [x] Dependencies and assumptions identified (asyncssh, system `known_hosts`, Linux/macOS-only
      local PTY)

## Feature Readiness

- [x] All functional requirements map to an acceptance scenario in the User Scenarios section
- [x] User scenarios cover primary flows (connect, host trust, persistence, SFTP, local/WSL,
      dashboard)
- [x] Feature meets its own measurable outcomes (SC-001…SC-005) as observed in current source
- [x] No implementation details leak into the specification proper

## Notes

- Validation pass 1 (2026-07-28): all items pass. This spec was authored **after** the feature
  shipped, by reading `routes/ssh.py`, `routes/pages.py`, `static/ssh-manager.{html,js,css}`,
  `static/sftp-browser.{html,js,css}`, and `tests/python/test_ws_auth.py` directly — not by
  paraphrasing SPEC.md §4.8/§5.1/§5.8/§6.4/§7.8. No discrepancy was found between SPEC.md and
  the code for this tool.
- One coverage gap is documented rather than hidden: host-key verification, SFTP transfer, and
  dashboard-metrics parsing have no automated tests (only the SEC-14 WS session gate does, via
  `tests/python/test_ws_auth.py`). This is called out in plan.md's Constitution Check (Art. VI
  marked PARTIAL) and quickstart.md's Coverage note, per CLAUDE.md rule 2 ("verify against
  source... flag the discrepancy explicitly").
- Constitution check: Art. IV (backend never decrypts vault/SSH blobs) and the SEC-14 WebSocket
  gate are this tool's two direct security-load-bearing behaviors; both were verified against
  source, not assumed from SPEC.md prose.
