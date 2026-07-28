# Quickstart & Validation: Diff Checker

How to exercise the `/diff` tool end-to-end. Run DevSuite (`python main.py` or
`start.sh`/`start.ps1`) and open `http://localhost:8000/diff`.

## Manual validation (maps to spec.md user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | basic compare | paste different text into both panels, press `Ctrl/Cmd+Enter` | diff renders, stats bar populates, `Escape` returns to edit mode |
| US2 | view toggle | with a diff active, click "Inline View" | editor switches to unified rendering; button relabels to "Side‑by‑Side" |
| US3 | merge hunk | click a merge glyph on a change hunk | target panel updates; success toast shown |
| US4 | export patch | open Export menu → "Download as .patch" | `diff.patch` downloads with unified-diff content |
| US4 | export clipboard | open Export menu → clipboard copy option | clipboard contains the unified diff text |
| US5 | upload valid file | use a panel's file picker with a small `.txt` file | panel populates with file content |
| US5 | upload oversized file | upload a file > 50 MB | HTTP 413, panel unchanged |
| US5 | upload binary file | upload a `.png` | HTTP 400, panel unchanged |
| US6 | folder diff | go to `/diff?tab=folder-diff`, pick two folders | merged tree renders with per-file status |
| US6 | folder filter | click each filter chip | list narrows to matching status only |

## Automated coverage

None currently. `pytest tests/python/` and `node tests/javascript/run.js` do not exercise
`/upload`, the merge logic, or folder-diff filtering — see spec.md Assumptions. Any future
change to `/upload`'s size/binary-content checks should add a test under `tests/python/`
per CLAUDE.md rule 4 if it touches a security-relevant path (it currently is not classified
as one, per plan.md's Constitution Check).

## Acceptance gates

- Compare renders correctly for both a trivial one-line change and a multi-hunk diff.
- Both merge directions work for all three hunk types (insertion/deletion/edit).
- `/upload` boundary behavior matches SC-003 in spec.md (50 MB exactly succeeds, 50 MB + 1
  byte fails with 413).
- Folder-diff filter counts match the number of nodes actually carrying that status.
