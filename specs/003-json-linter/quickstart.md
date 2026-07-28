# Quickstart & Validation: JSON Linter & Formatter

Open `http://localhost:8000/json` with DevSuite running.

## Manual validation (maps to spec.md user stories)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| US1 | live validation | type invalid JSON, wait ~1s | status pill shows "Invalid JSON"; error panel shows the parse error |
| US1 | validate action | paste valid JSON, click Validate (or `Ctrl/Cmd+Enter`) | output pane shows pretty-printed preview; success toast |
| US2 | format | paste minified JSON, click Format | output pane shows 2-space indented JSON; input unchanged |
| US2 | minify | paste indented JSON, click Minify | output pane shows single-line JSON; input unchanged |
| US2 | sort keys | paste JSON with out-of-order keys, click Sort Keys | output pane shows recursively sorted keys; input unchanged |
| US2 | invalid guard | paste invalid JSON, click any transform button | error panel + error toast; no output change |
| US3 | convert to YAML | paste valid JSON, click Convert to YAML | output pane shows YAML with `yaml` syntax highlighting |
| US4 | clear | with content in both panes, click Clear | both panes empty; copy button disabled |
| US4 | paste | click Paste with clipboard containing JSON | input editor populates from clipboard |
| US4 | copy output | with output present, click the copy button | clipboard contains the output text |

## Automated coverage

None. No `tests/python/` or `tests/javascript/` test touches this tool's parse/transform
logic — see spec.md Assumptions.

## Acceptance gates

- SC-002 from spec.md: running Format/Minify/Sort/Convert twice on the same input produces
  identical output both times.
- SC-003: the input editor's value is byte-identical before and after every transform
  action (confirms the two-pane, non-mutating design).
