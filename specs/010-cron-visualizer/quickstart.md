# Quickstart & Validation: Cron Visualizer

Manual validation steps — no automated test suite covers `static/cron.js` today (see Coverage
note).

## Setup

Start the app per the repo's normal `start.sh`/`start.ps1` (not run here — CLAUDE.md: don't
start the server without being asked), then open `/cron` in a browser.

## Functional validation (maps to spec user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | Valid expression | Type `*/15 9-17 * * 1-5` (default Unix dialect) | Green valid pill; description reads "Every 15 minutes, between 9:00 AM and 5:00 PM, Monday–Friday"; per-field chips render |
| US1 | Invalid expression | Type a 4-field expression in Unix mode | Red invalid pill; error names the expected 5-field count |
| US1 | Dialect-exclusive token misuse | Type `? * * * *` in Unix mode | Error names `?` as unsupported in the Unix dialect |
| US2 | Switch dialects | Click the Quartz dialect button | Field builder shows 7 fields incl. Second/Year; `?`/`L`/`W`/`#` accepted; preset list changes to Quartz presets |
| US3 | Visual builder → text | Toggle a few Minute cells | Raw expression's minute field updates to match |
| US3 | Text → visual builder | Type a valid expression directly | Field builder grids re-render with matching cells toggled |
| US4 | Next run times | Enter a valid expression | Exactly 10 future run times listed, ascending, with locale date/time + relative countdown |
| US4 | Heatmap | Same expression | 28-day heatmap renders with shaded intensity + hover tooltips |
| US5 | Preset load | Click a preset in the library | Expression loads and re-validates immediately |
| US5 | Export | Use the YAML / EventBridge JSON / raw-copy export actions | Output matches the expected format for each target |

## Deterministic validation (automated)

None exists. `tests/javascript/run.js` currently covers only `curl-codegen.js` and
`cookie-jar.js` (SPEC.md §10.1) — `cron.js` is not in that suite.

## Coverage note

This tool has **zero automated test coverage**. All validation is manual, per the table above.
This is stated explicitly rather than implied, per CLAUDE.md rule 2 ("verify against source...
flag the discrepancy explicitly") — SPEC.md does not claim test coverage for this tool either.

## Acceptance gates

- Each of the four dialects' documented `example` expression (in `DIALECTS`) parses as valid.
- Every preset in `PRESETS` parses as valid in its own dialect (SC-004).
- The manual golden-path table above passes before claiming a change to this tool "verified."
