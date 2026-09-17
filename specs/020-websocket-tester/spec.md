# Feature Specification: WebSocket Tester

**Feature Branch**: `020-websocket-tester`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "WebSocket Tester (BACKLOG FEAT-16): a client-side tool to connect to `ws://`/`wss://` endpoints, send messages, and watch incoming messages in a live log — for testing realtime APIs. Browsers don't enforce CORS on WebSocket, so the browser connects directly with no backend proxy. DevSuite's 15th tool. gRPC explicitly out of scope. Ungated tier (like Cron/Regex) — connection data isn't sensitive. Vanilla HTML/CSS/JS, no new third-party libs. The one server-side change needed is a per-page CSP override so the browser is allowed to open `ws:`/`wss:` connections (the default document CSP `connect-src 'self'` blocks them)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect to a WebSocket endpoint and see the connection lifecycle (Priority: P1)

A developer enters a `ws://` or `wss://` URL, clicks Connect, and sees the connection move through connecting → open (or → error/closed), with a clear status indicator and a timestamped log entry for each lifecycle event.

**Why this priority**: Establishing and observing a connection is the irreducible core — without it there is no tool. Realtime-API developers most often just need to confirm "can I even reach this socket, and does the handshake succeed?"

**Independent Test**: Enter a reachable `wss://` echo endpoint, click Connect, and confirm the status shows "Open" and the log records the open event with a timestamp — without sending or receiving any application message.

**Acceptance Scenarios**:

1. **Given** a valid `wss://` URL, **When** the user clicks Connect, **Then** the status transitions to "Connecting" then "Open", and each transition is recorded in the log with a timestamp.
2. **Given** an open connection, **When** the user clicks Disconnect, **Then** the socket closes, the status shows "Closed" with the close code/reason, and the log records the close event.
3. **Given** a connection that fails (unreachable host, refused, TLS error), **When** the handshake fails, **Then** the status shows "Error"/"Closed" and the log records the failure without the tab crashing or hanging.
4. **Given** the user is already connected, **When** they click Connect again, **Then** the tool does not open a second overlapping socket without first closing the existing one (no silent connection leak).

---

### User Story 2 - Send messages and watch incoming messages in a live log (Priority: P1)

While connected, the user types a message (plain text or JSON), sends it, and sees both their outbound message and any inbound messages appear in a single time-ordered log, each tagged with direction (sent/received) and a timestamp.

**Why this priority**: A connection with no message exchange is only half a test. Sending a payload and observing the server's response is the actual "test" in "WebSocket tester", and it is inseparable from US1 for a usable MVP — hence also P1.

**Independent Test**: With an open echo connection (per US1), send a text message and confirm both the sent entry and the echoed received entry appear in the log, correctly directioned and ordered.

**Acceptance Scenarios**:

1. **Given** an open connection, **When** the user sends a text message, **Then** an outbound ("sent") log entry appears immediately with the message body and a timestamp.
2. **Given** an open connection, **When** the server pushes a message, **Then** an inbound ("received") log entry appears with the message body and a timestamp, without the user taking any action.
3. **Given** the connection is not open, **When** the user attempts to send, **Then** the send is refused with a clear message and nothing is added to the log as "sent".
4. **Given** a large volume of incoming messages, **When** they arrive, **Then** the log remains responsive and bounded (older entries are capped/trimmed rather than growing without limit and freezing the tab).
5. **Given** a message the user marks as JSON, **When** it is displayed in the log, **Then** it is shown pretty-printed if it is valid JSON, and shown as-is (not silently dropped) if it is not.

---

### User Story 3 - Configure the connection (subprotocols) and reconnect quickly (Priority: P2)

Before connecting, the user can optionally specify one or more WebSocket subprotocols. After a session, the URL (and subprotocols) are remembered so the user can reconnect to a recently-used endpoint without retyping.

**Why this priority**: Subprotocols are needed for real-world sockets (e.g. `graphql-ws`, `mqtt`), and connection recall is a quality-of-life win that makes iterative testing fast — but both sit on top of the P1 connect/send/receive loop rather than being required for it.

**Independent Test**: Connect once with a subprotocol specified, disconnect, reload the page, and confirm the URL and subprotocol are pre-filled or selectable from recent connections.

**Acceptance Scenarios**:

1. **Given** the user enters one or more comma-separated subprotocols, **When** they connect, **Then** those subprotocols are offered in the handshake and the negotiated subprotocol (if any) is shown once open.
2. **Given** the user has connected to an endpoint before, **When** they open the tool later, **Then** that endpoint appears in a recent-connections list and selecting it restores the URL (and subprotocols).
3. **Given** the recent-connections list, **When** the user clears it, **Then** it is emptied and stays empty after a reload.

---

### Edge Cases

- A blank URL, or a URL whose scheme is not `ws://` or `wss://` (e.g. `http://`, `javascript:`), is rejected with a clear inline message and no connection attempt.
- Clicking Send with an empty message body while connected: allowed (WebSocket permits empty frames) but clearly shown as an empty sent frame, OR disallowed with a clear message — the tool must behave consistently, not silently no-op.
- The server closes the connection unexpectedly mid-session: the status updates to "Closed" with the code/reason and the log records it, rather than the UI continuing to look "Open".
- Binary frames received (Blob/ArrayBuffer): shown as a labeled binary entry with size (and, where feasible, a text/hex preview), not crammed as `[object Blob]` or dropped silently.
- Connecting to a `ws://` (insecure) endpoint from the tool: permitted (local testing needs it) but the tool surfaces that it is an unencrypted connection.
- Attempting to connect to an endpoint the browser blocks (e.g. mixed-content or CSP): the failure is surfaced in the log with the browser's reason rather than failing silently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let the user enter a WebSocket URL and initiate a connection to it.
- **FR-002**: System MUST reject a URL whose scheme is not `ws://` or `wss://` (and a blank URL) with a clear message and no connection attempt.
- **FR-003**: System MUST display the current connection state (at minimum: connecting, open, closing/closed, error) with a clear, always-visible indicator.
- **FR-004**: System MUST record every connection lifecycle event (open, close with code/reason, error) as a timestamped entry in a message/event log.
- **FR-005**: Users MUST be able to close/disconnect an open connection, and the tool MUST reflect the resulting closed state.
- **FR-006**: System MUST NOT hold more than one live connection for the tool at a time; initiating a new connection MUST first close any existing one.
- **FR-007**: Users MUST be able to send a message on an open connection; the tool MUST refuse to send when the connection is not open and say why.
- **FR-008**: System MUST record each sent message and each received message as a direction-tagged, timestamped entry in a single time-ordered log.
- **FR-009**: System MUST render received text messages as text; when a message is (or is marked as) JSON and is valid JSON, it MUST be shown pretty-printed, and when invalid it MUST be shown verbatim rather than dropped.
- **FR-010**: System MUST handle received binary frames by showing a labeled entry with the byte size (and a best-effort preview), never `[object Blob]` or a silent drop.
- **FR-011**: System MUST bound the on-screen log so a high message rate cannot grow it without limit; older entries are trimmed once a cap is reached.
- **FR-012**: Users MUST be able to clear the log.
- **FR-013**: Users MUST be able to optionally specify one or more subprotocols to offer during the handshake, and the tool MUST display the negotiated subprotocol once the connection is open.
- **FR-014**: System MUST remember recently-used connection endpoints (URL and subprotocols) across page reloads and let the user restore one, and MUST let the user clear that recent list.
- **FR-015**: System MUST operate entirely client-side for the WebSocket connection itself — the browser connects directly to the target `ws`/`wss` endpoint with no DevSuite backend proxy in the data path.
- **FR-016**: System MUST be reachable without unlocking the suite's master password, consistent with other non-sensitive tools (Cron Visualizer, Regex Tester).
- **FR-017**: System MUST be discoverable from the suite's tool listing and homepage, alongside the other tools.
- **FR-018**: System MUST render all message bodies and event text as text (never via `innerHTML` with connection-derived content), consistent with the suite's DOM-hardening rule.
- **FR-019**: The application MUST serve the WebSocket Tester page with a Content-Security-Policy whose `connect-src` permits `ws:` and `wss:` origins so the browser is allowed to open the connection, while every other page keeps the stricter default `connect-src 'self'`.
- **FR-020**: System MUST clearly label the tool as not-strictly-offline (it makes user-initiated outbound network connections), consistent with how SSH/SFTP and the CORS proxy are labeled.

### Key Entities *(include if feature involves data)*

- **Connection**: A single live or past WebSocket session. Has a target URL, requested subprotocols, negotiated subprotocol, current state (connecting/open/closing/closed/error), and open/close timestamps. Only one may be live at a time; not persisted beyond the recent-endpoints record.
- **Log Entry**: One time-ordered record in the message/event log. Has a timestamp, a kind (sent / received / event), a body or event description, and a payload type (text / json / binary / lifecycle). Held in memory, bounded by a cap; not persisted.
- **Recent Endpoint**: A lightweight record of a previously-used connection — URL plus subprotocols — persisted client-side (browser storage) so it can be restored. No message bodies are stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can connect to a reachable `wss://` endpoint and confirm the handshake succeeded within 5 seconds of opening the tool, with no configuration beyond the URL.
- **SC-002**: With an echo endpoint, a sent text message and its echoed reply both appear, correctly directioned and time-ordered, in under 1 second of round-trip in manual testing.
- **SC-003**: 100% of non-`ws`/`wss` or blank URLs are rejected with a clear message and produce no connection attempt.
- **SC-004**: Receiving 1000 messages in rapid succession keeps the tab responsive and the on-screen log bounded (no unbounded DOM growth), in manual/stress testing.
- **SC-005**: Every connection lifecycle event (open, close-with-code, error) appears in the log in 100% of manual test connections, including failed handshakes.
- **SC-006**: The `/ws-tester` page response carries a CSP whose `connect-src` includes `ws:` and `wss:`, while `GET /` and other tool pages still carry `connect-src 'self'` — verified by an automated test.
- **SC-007**: A new user can find the WebSocket Tester from the suite's main tool listing without being told where to look.

## Assumptions

- Single-user, local-first usage matches the rest of the suite. The WebSocket connection is user-initiated outbound network I/O (like SSH/SFTP and the CORS proxy), so the tool is labeled not-strictly-offline; it is not part of the strictly-offline guarantee (constitution Art. II).
- Because browsers do **not** apply the same-origin/CORS restriction to `WebSocket` the way they do to `fetch`/`XHR`, the connection can be made directly from the browser with no backend proxy — the only server-side requirement is relaxing the page's CSP `connect-src` (FR-019). This avoids adding any new backend network path.
- Connection endpoints and subprotocols are the only persisted data, stored in browser `localStorage` (like the API Tester's request history), so the tool needs no DevDB store, no master-password gate, and no new entry in the allowed-store whitelist. Message bodies are never persisted.
- gRPC (including gRPC-Web) is explicitly out of scope. Socket.IO's proprietary framing is out of scope for v1 (a raw WebSocket to a Socket.IO endpoint speaks the transport, not the Socket.IO protocol); only standard RFC 6455 WebSocket is supported.
- No new third-party JavaScript library is introduced — the native browser `WebSocket` API provides everything needed; JSON pretty-printing uses `JSON.parse`/`JSON.stringify`.
- Auto-reconnect, scheduled/interval message sending, and saved message templates are out of scope for v1; the recent-endpoints recall (US3) is the only persistence convenience shipped.
- STOMP/MQTT-over-WebSocket higher-level protocol decoding is out of scope; the tool tests the raw WebSocket transport and can offer those as subprotocol strings only.
