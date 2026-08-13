# Phase 0 Research: Cron Visualizer

Retroactive research notes — technical decisions as found in the shipped code
(`static/cron.js`), with rationale reconstructed from the code's structure and comments.

## R1 — Fully client-side, no backend cron library

The tool implements its own `CronParser`/`CronDescriber` rather than shelling out to a backend
cron-parsing library. This keeps the tool usable with zero network latency and zero server load
per keystroke, and fits DevSuite's offline-first mission (SPEC.md §1.1) more directly than any
other tool in the suite — there is no "network notice" exception here at all, unlike SSH/API
Tester.

## R2 — Dialect-as-data, not dialect-as-code-branch

`DIALECTS` is a single object keyed by dialect id, each entry declaring its field list, per-field
ranges, and boolean capability flags (`supportsQuestion`, `supportsL`, `supportsW`,
`supportsHash`, `supportsYear`). `CronParser` and the field-builder rendering read these flags
generically instead of branching on "if dialect === 'quartz'" throughout the codebase — adding a
fifth dialect (a plausible future request) means adding one data entry, not touching parser
logic in multiple places.

## R3 — Brute-force minute iteration for "next run" search

Rather than a closed-form next-fire-time solver, the next-10-runs feature iterates forward
minute-by-minute, checking each candidate against the parsed expression, until 10 matches are
found. This is simple to implement correctly across four different dialects' semantics
(including Quartz's `L`/`W`/`#` tokens, which are notoriously fiddly to solve for in closed
form) at the cost of being asymptotically worse for expressions that fire very rarely (e.g. "Feb
29 only"). Given the tool's target horizon (human-scale "when does this run next"), this
trade-off favors correctness-across-dialects over raw performance.

## R4 — Bidirectional sync between the Visual Field Builder and raw text

The Field Builder grids and the raw expression text field are kept in sync in both directions:
toggling a grid cell rewrites the corresponding field in the text expression, and typing a valid
expression re-renders the grids from its parsed field values. This lets users move fluidly
between "I know cron syntax" and "I want to click values" without the two views ever disagreeing
— a UX requirement that shapes `CronParser`'s output format (structured per-field parsed values,
not just a pass/fail boolean) more than a performance or security concern.

## R5 — DOM safety: `createElement`/`textContent` only

The file's own header comment states the security intent directly: "Security: all DOM mutations
use createElement + textContent, never innerHTML with user data." Since every rendered value
here (dialect labels, descriptions, preset labels, heatmap tooltips) is either a static string
or derived from user-typed cron syntax, this guards against a user pasting an expression crafted
to break out of an `innerHTML` render path — consistent with the suite-wide DOM XSS hardening
rule (SPEC.md §7.7).

## R6 — No persistence by design

Unlike most other DevSuite tools with any state, the Cron Visualizer keeps nothing across
reloads — no DevDB store, no `localStorage`. This matches the tool's nature (a scratch-pad for
understanding one expression at a time) more than it reflects a deliberate privacy stance; there
is no sensitive data here to protect, unlike Vault/SSH profiles.
