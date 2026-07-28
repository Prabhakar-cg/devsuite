# Quickstart & Validation: YAML Linter & Validator

Manual validation steps — there is currently no automated test coverage for this tool (verified:
`grep -rn "yaml" tests/python/ tests/javascript/` returns no matches referencing `yaml.html`,
`/yaml`, or YAML-parsing logic; the 41-test Python suite covers only SPEC §10.2 security-critical
paths, which this stateless client-side tool does not touch).

## Setup

```bash
# from repo root, with the DevSuite server already running per README.md
open http://localhost:8000/yaml   # or curl -s http://localhost:8000/yaml | head
```

## Functional validation (maps to spec user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | Live validation, invalid input | Paste `foo:\n  - bar\n baz` (bad indent), wait 600ms | Status pill → "Invalid YAML"; error panel shows the `js-yaml` message + hint |
| US1 | Live validation, valid input | Paste `foo: bar\nbaz: [1, 2, 3]`, wait 600ms | Status pill → "Ready"/no change to invalid; click Validate → "Valid YAML ✓", success toast, preview shown |
| US1 | Multi-document | Paste two `---`-separated docs, click Validate | Parses without error (array internally); preview re-dump succeeds |
| US2 | Format | Paste unquoted/inconsistently-indented YAML, click Format | Output pane shows 2-space-indented, double-quoted YAML labeled "Formatted YAML" |
| US2 | Format on invalid input | Break the YAML, click Format | Error panel shown, error toast "Cannot format invalid YAML"; no output produced |
| US3 | → JSON | Valid YAML, click **→ JSON** | Output pane shows pretty JSON (2-space indent), language switches to `json` |
| US3 | → JSON (min) | Valid YAML, click **→ JSON (min)** | Output pane shows single-line minified JSON |
| — | Empty input | Clear editor, click any action button | Warning toast ("Editor is empty" / "Nothing to format" / "Nothing to convert"); no crash |
| — | Clipboard | Click Paste / Copy Output | Content moves via `navigator.clipboard`; permission denial shows a graceful warning toast, not an error |
| — | Keyboard shortcut | Focus anywhere on the page, press `Ctrl/Cmd+Enter` | Triggers the same action as clicking Validate |

## No automated gate today

There is no `pytest`/`node tests/javascript/run.js` coverage to run for this tool. If automated
coverage is added later (v1.0.0 Playwright e2e milestone per SPEC.md §13), it should assert at
minimum: the four action buttons' happy/error paths, the multi-document `loadAll` behavior, and
that no `fetch`/`XMLHttpRequest` is ever issued from `yaml.html` (privacy invariant, SC-003).

## Acceptance gates

- Every functional-validation row above passes manually.
- `pytest tests/python/` and `node tests/javascript/run.js` continue to pass unaffected (this
  documentation pass changes no code).
