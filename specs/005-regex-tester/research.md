# Phase 0 Research: Regex Tester

Retroactive research notes — decisions already made in the shipped code, documented from source.

## R1: Direct RequireJS bootstrap instead of `DevSuite.initMonaco()`

**Decision**: `regex.html` calls `require.config(...)` and `require(['vs/editor/editor.main'], ...)`
directly, and defines its own `toast()` helper, rather than loading `static/components.js` and
using `DevSuite.initMonaco()`/`DevSuite.toast` as `yaml.html`/`json.html` do.

**Rationale**: Not stated in code comments; functionally equivalent to the shared helper for this
tool's needs (a single editor pane, not the dual input/output pair `components.js`'s helper
assumes). Documented here as an observed inconsistency rather than an intentional documented
decision — worth normalizing in a future refactor, out of scope for this retroactive spec pass.

**Alternative**: Load `components.js` and use the shared helper, as the other linter tools do —
would reduce duplicate `toast()`/Monaco-bootstrap code across the tool family.

## R2: Native `RegExp` engine, no PCRE/third-party regex library

**Decision**: Matching uses the browser's built-in `RegExp` exclusively.

**Rationale**: Zero dependency footprint, consistent with the "no CDN, self-hosted only" mission
(SPEC.md §2) and avoids shipping a second regex engine when the browser already has one. Trade-off
(not currently surfaced in the UI): JS `RegExp` semantics differ from PCRE/POSIX in edge cases
(e.g. lookbehind support varies by engine version, possessive quantifiers unsupported) — users
testing patterns destined for another language's regex engine may see different behavior.

## R3: 180ms debounce, tighter than the YAML linter's 600ms

**Decision**: Re-matching runs 180ms after the last edit to pattern or test string.

**Rationale**: Regex matching is computationally cheap for typical test strings, and users
iterate on a pattern character-by-character expecting near-live feedback — a longer debounce (like
YAML's 600ms parse) would feel laggy for this specific interaction style.

## R4: Manual `lastIndex` advance on zero-width matches

**Decision**: When the `g` flag is set and a match has zero length, `re.lastIndex` is manually
incremented before the next `exec()` call.

**Rationale**: Without this guard, a pattern that can match an empty string (e.g. `a*`) with the
global flag would loop forever, since `RegExp.exec` does not auto-advance past a zero-length
match. This is a well-known JS `RegExp` gotcha; the guard is a one-line, standard fix.
