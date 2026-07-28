# Quickstart & Validation: Regex Tester

Manual validation steps — there is currently no automated test coverage for this tool (verified:
`grep -rn "regex" tests/python/ tests/javascript/` returns no matches referencing `regex.html`,
`/regex`, or regex-matching logic; the 41-test Python suite covers only SPEC §10.2
security-critical paths, which this stateless client-side tool does not touch).

## Setup

```bash
open http://localhost:8000/regex   # or curl -s http://localhost:8000/regex | head
```

## Functional validation (maps to spec user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | Empty pattern | Clear the pattern field | Match pane: "Enter a pattern above"; status "Ready" |
| US1 | Invalid pattern | Type `(unclosed` | Pattern input turns red (`invalid` class); match pane shows the `RegExp` error message; status "Invalid pattern" |
| US1 | Valid pattern, matches | Pattern `\d+`, test string `Hello World 42\nFoo Bar 100` (page default), default flags | 2 matches highlighted in the editor + listed with position/length |
| US1 | Valid pattern, no matches | Pattern `zzz` against the default text | Match pane: "No matches found"; status "0 matches" |
| US2 | Flag defaults | Load the page fresh | `g` button shows `active`/`aria-pressed="true"`; `i`/`m`/`s` inactive |
| US2 | Toggle `g` off | Pattern `\d+`, click `g` to deactivate | Only the first match (`42`) is reported, not `100` |
| US2 | Toggle `i` | Pattern `hello`, test string containing `Hello`, toggle `i` on | Match appears only once `i` is active |
| US2 | Zero-width + `g` | Pattern `a*` against `bbb`, `g` on | Completes without hanging (multiple zero-length matches reported, no infinite loop) |
| US3 | Capture groups | Pattern `([A-Za-z]+)\s+(\d+)` (placeholder default) against `Foo 100` | Match shows two group chips: `$1: Foo`, `$2: 100` |
| US3 | No groups | Pattern `\d+` (no parens) | No group-chips row rendered under the match |
| — | Copy Matches | With matches present, click Copy | Clipboard receives newline-separated match values |
| — | Clear | Click Clear | Pattern, test string, decorations, and match pane all reset to empty state |

## No automated gate today

There is no `pytest`/`node tests/javascript/run.js` coverage to run for this tool. If added later
(v1.0.0 Playwright milestone, SPEC.md §13), it should assert at minimum: flag-toggle → match-count
changes, zero-width-match non-hanging behavior, invalid-pattern error surfacing, and that no
`fetch`/`XMLHttpRequest` is ever issued (SC-003).

## Acceptance gates

- Every functional-validation row above passes manually.
- `pytest tests/python/` and `node tests/javascript/run.js` continue to pass unaffected (this
  documentation pass changes no code).
