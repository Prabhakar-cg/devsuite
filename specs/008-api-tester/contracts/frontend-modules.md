# Contract: Pure Frontend Modules

Three modules ship as dependency-free, DOM-free logic, dual-exported (`module.exports` for Node,
`globalThis.X` for the browser) so the same file is both production code and the thing
`tests/javascript/run.js` imports directly — no build step, no mocking layer. This is the *only*
part of the API Tester with automated test coverage (see quickstart.md).

## `curl-codegen.js` → `globalThis.CurlCodegen`

```js
CurlCodegen.tokenize(cmd: string): string[]
// Shell-style tokenizer: '…' (no escapes), "…" (\" \\ \$ \` escapes), $'…' (ANSI-C escapes),
// \ / ` / ^ line continuations normalized to spaces before tokenizing.

CurlCodegen.parseCurl(cmd: string): RequestItemShape
// Throws if the command doesn't start with "curl"/"curl.exe" or has no URL.
// Recognizes: -X/--request, -H/--header, -d/--data*/-F/--form, -u/--user (basic auth),
// -b/--cookie (inline k=v only — cookie *files* are ignored), -A/--user-agent, -e/--referer,
// --url, -G/--get (data → query params), -I/--head. Unknown flags are silently ignored.
// Returns the loadItem()-consumable shape: {method, url, queryParams, headers, auth, bodyType, body}
// (queryParams/headers as {key,value,enabled}[] entry arrays).

CurlCodegen.finalize(config: ResolvedConfig): {url, method, headers, body}
// Mirrors ApiClient's auth-merge + query-append + body-derivation exactly (same skip-body rule:
// GET/DELETE/HEAD or bodyType 'none' → body omitted).

CurlCodegen.buildCurl(config) / .buildFetch(config) / .buildHttpie(config): string
// Snippet generators from the *resolved* (interpolated, auth-applied) execute-config shape
// (queryParams/headers as plain objects, not entry arrays — the "config" passed to
// buildRequestConfig() in api-tester.js, not the raw saved-item shape).

CurlCodegen.shellQuote(s): string
// POSIX single-quote escaping ('\'' pattern) used by buildCurl/buildHttpie.
```

**Contract note**: `parseCurl`'s output shape and `finalize`'s input shape are **not the same
shape** — `parseCurl` produces the *raw/saved* item shape (entry arrays), `finalize` consumes the
*resolved* config shape (plain objects). Callers must not feed one function's output directly into
the other without going through `api-tester.js`'s `buildRequestConfig()`/`loadItem()` translation.

## `cookie-jar.js` → `globalThis.CookieJar`

```js
CookieJar.parse(setCookieStr: string, requestUrl: string): CookieEntry | null
// RFC 6265 §5.1.3/§5.1.4-ish: Max-Age wins over Expires regardless of attribute order (§4.1.2.2).
// A server may only widen Domain scope to a suffix of its own request host — a Domain attribute
// that doesn't satisfy domainMatch(reqHost, dom, false) is silently ignored, not rejected.

CookieJar.upsert(jar: CookieEntry[], cookie: CookieEntry | null): CookieEntry[]
// Same name+domain+path replaces in place. An already-expired incoming cookie (Max-Age=0 / past
// Expires) is a server-initiated delete: removes the matching entry instead of inserting one.

CookieJar.cookiesFor(jar, url, nowMs?): CookieEntry[]
// Unexpired + domain/path/secure-matching entries for a URL, most-specific path first.

CookieJar.headerFor(jar, url, nowMs?): string
// "name=value; name2=value2" Cookie header value, '' if nothing matches.

CookieJar.prune(jar, nowMs?): CookieEntry[]
// Removes expired entries in place; called before every jar render/count update.

CookieJar.domainMatch(host, cookieDomain, hostOnly): boolean
CookieJar.pathMatch(reqPath, cookiePath): boolean
CookieJar.isExpired(cookie, nowMs?): boolean
```

**Contract note**: the module has **zero internal state** — the jar is always an array owned and
passed in by the caller (`api-tester.js`'s module-scope `const cookieJar = []`). This is what
makes "never persisted" a property of the *caller*, not something this module could violate even
if asked to.

## `collection-utils.js` → `globalThis.CollectionUtils`

```js
CollectionUtils.normalizeFolderPath(raw: string): string | undefined
// 'a / b //c ' -> 'a/b/c'; empty/whitespace-only -> undefined (means "top level").

CollectionUtils.isInFolder(itemFolder: string|undefined, path: string): boolean
// True if itemFolder === path or itemFolder starts with `${path}/`.

CollectionUtils.countInFolder(items, path): number
CollectionUtils.renameFolder(items, folderAuths, oldPath, newPath): number
// Mutates items[].folder and folderAuths keys in place; returns count of requests updated.
// Renaming onto an existing path merges (target folderAuths entries are overwritten by moved ones).

CollectionUtils.deleteFolder(items, folderAuths, path): { items: Array, removed: number }
// Does NOT mutate the items array in place (returns a new filtered array) but DOES mutate
// folderAuths in place — asymmetric by design; callers must reassign their items reference
// (api-tester.js does: `collections = res.items`).

CollectionUtils.moveItem(items, fromIdx, toIdx, newFolder): boolean
// Mutates items in place (splice out, splice in before adjusting for the removal shift).
// newFolder === undefined clears the item's folder (moves to top level).
// Returns false (no-op) for an out-of-range fromIdx.
```

**Contract note on mutation asymmetry**: `renameFolder` and `moveItem` mutate their `items`
argument in place; `deleteFolder` returns a new array for `items` (while still mutating
`folderAuths` in place). Callers in `api-tester.js` handle this correctly today
(`collections = res.items` only after `deleteFolder`), but this is a footgun for any future caller
that assumes uniform mutation semantics across the module — worth normalizing if this module is
ever revised, though no bug exists in the current call sites (verified by reading every call site
in `api-tester.js`).

## Non-contracts (explicitly NOT covered by a pure module)

- Postman collection/environment parsing (`parsePostmanCollection`, `parsePostmanRequest`,
  `parseEnvImport`) and OpenAPI parsing (`parseOpenApiSpec`, `buildSchemaExample`) are logically
  pure (no DOM access) but live inline in `api-tester.js`, not factored out — they have no
  dedicated test file and no `globalThis`/Node dual-export. A future refactor extracting these
  into `import-parsers.js` would let `tests/javascript/` cover them the same way; not done as part
  of this retroactive documentation pass.
