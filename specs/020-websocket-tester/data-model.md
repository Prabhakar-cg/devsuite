# Data Model — WebSocket Tester (020)

No DevDB store, no server-side schema. The only persisted data is a small list of recent endpoints in
browser `localStorage`. Everything else is transient in-memory state. These shapes exist so the pure
module (`ws-utils.js`) and the DOM controller (`ws-tester.js`) agree on contracts.

## Entity: Connection (transient, at most one live)

| field         | type    | notes                                                        |
|---------------|---------|--------------------------------------------------------------|
| `url`         | string  | The `ws://`/`wss://` target (validated by `normalizeWsUrl`)  |
| `protocols`   | string[]| Requested subprotocols (from `parseProtocols`)               |
| `negotiated`  | string  | `ws.protocol` after open; empty string if none               |
| `state`       | string  | `connecting \| open \| closing \| closed \| error`           |
| `openedAt`    | number? | ms epoch when `onopen` fired                                 |
| `closedAt`    | number? | ms epoch when `onclose` fired                                |
| `closeCode`   | number? | `CloseEvent.code`                                            |
| `closeReason` | string? | `CloseEvent.reason`                                          |

Held in the controller as a single `ws` reference + state vars. FR-006: opening a new connection
closes any existing one first. Not persisted.

## Entity: Log Entry (transient, bounded)

| field       | type    | notes                                                              |
|-------------|---------|--------------------------------------------------------------------|
| `ts`        | number  | ms epoch when the entry was recorded                               |
| `kind`      | string  | `sent \| received \| event`                                        |
| `payload`   | string  | `text \| json \| binary \| lifecycle`                              |
| `body`      | string  | Text/JSON body, binary preview string, or lifecycle description    |
| `bytes`     | number? | Byte size for `binary` payloads                                    |

Kept in an in-memory array capped at `LOG_CAP` (e.g. 500) with FIFO trimming (`capLog`, FR-011). The
DOM list mirrors it node-for-node. Not persisted (message bodies are never stored — Assumptions).

## Entity: Recent Endpoint (persisted, client-side only)

| field        | type     | notes                                              |
|--------------|----------|----------------------------------------------------|
| `url`        | string   | The endpoint URL                                   |
| `protocols`  | string[] | Subprotocols used                                  |
| `lastUsedAt` | number   | ms epoch of last connect, for most-recent ordering |

Stored as a JSON array under `localStorage['devsuite-ws-recent']`, most-recent-first, capped to
`RECENT_CAP` (e.g. 15) via `upsertRecent`. Restoring one repopulates the URL + subprotocol inputs.
"Clear recent" removes the key (`clearRecent`). No DevDB store, no `_ALLOWED_STORES` entry, no auth.

## Pure-module contracts (`ws-utils.js`)

- `normalizeWsUrl(raw)` → `{ ok: true, url }` when `raw` trims to a non-empty `ws://`/`wss://` URL;
  `{ ok: false, error }` for blank or non-`ws`/`wss` scheme (FR-002).
- `parseProtocols(raw)` → `string[]` — comma-split, trimmed, empties dropped, deduped (FR-013).
- `formatIncoming(data)` → `{ type: 'json'|'text', body }` — `JSON.parse`→pretty-print on success,
  raw text tagged `text` on failure (FR-009). (Binary is handled in the controller from `ArrayBuffer`.)
- `capLog(entries, max)` → array trimmed to the last `max` entries (FR-011).
- `upsertRecent(list, entry, max)` → new list with `entry` moved/added to front, deduped by `url`,
  capped to `max` (FR-014).

## Validation rules (enforced before connecting)

- URL must be non-blank and `ws://` or `wss://` (FR-002) — else inline error, no connection attempt.
- Send is allowed only when `state === 'open'` (FR-007) — else refused with a message.
- Log never exceeds `LOG_CAP` entries on screen (FR-011).
