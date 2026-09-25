---
name: MCP SSE response framing
description: MCP Streamable HTTP transport's Accept-header and response-framing requirements, discovered building the coordination MCP adapter.
---

The MCP SDK's `StreamableHTTPServerTransport` (used for any MCP server
exposed over plain HTTP, not just HolaHola's coordination adapter) has two
behaviors that are transport requirements of the SDK/spec, not something a
server-side route can relax:

- A request must send `Accept: application/json, text/event-stream` — both
  values. Sending `application/json` alone gets a `406`, even for a
  completely valid single JSON-RPC call.
- A successful response is SSE-framed (`content-type: text/event-stream`,
  body shaped as `event: message\ndata: {...}`) even for a one-shot,
  non-streaming call in stateless mode. There is no "plain JSON" response
  path once the client declares SSE support in `Accept`.

**Why:** every official MCP client SDK already sends the right `Accept`
header and parses SSE framing internally, so real clients (Antigravity,
Claude, OpenAI's MCP tooling) never notice this. It only bites a hand-rolled
test or debug client that does a raw `fetch`/`curl` and expects a plain JSON
body — that client must extract the JSON payload from the last `data:` line
itself, or a naive "parse as JSON, else treat as a raw string" fallback
turns a framing mismatch into a silently missing/undefined field instead of
a loud parse error.

**How to apply:** when writing a script or test that talks to any MCP
Streamable HTTP endpoint directly (not through an MCP client SDK), always
send both `Accept` values, and parse the response by checking whether the
body starts with `{`/`[` (plain JSON) or otherwise splitting on `\n` and
`JSON.parse`-ing the last `data:` line (SSE-framed). Document the same
requirement for any external integrator of your own MCP endpoint — they
will hit the identical 406/parsing surprise the first time they try a raw
HTTP client before switching to a real MCP SDK.

