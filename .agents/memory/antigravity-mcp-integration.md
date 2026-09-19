---
name: Antigravity MCP integration surface
description: What Google Antigravity actually supports for remote MCP servers, and the real HolaHola implementation status behind the design-doc pile.
---

**External capability (confirmed via Antigravity's own docs, Sep 2026):**
Antigravity IDE/CLI/SDK share one MCP config (`~/.gemini/config/mcp_config.json`
as of the 2.x line — one entry, every surface picks it up). It supports remote
MCP servers reached over HTTP, authenticated via a plain bearer token in the
`headers` block (`"Authorization": "Bearer <token>"`). It does **not** support
the MCP OAuth spec — bearer-token-in-headers is the only remote-auth path, not
a fallback.

**Implication for HolaHola:** exposing the coordination API to Antigravity
means writing an actual MCP-server adapter (tools/list + tools/call over the
MCP protocol, e.g. via `@modelcontextprotocol/sdk`) that internally calls the
existing `server/services/coordination-v2-*.ts` logic — pointing Antigravity's
config at a raw REST endpoint does not work, MCP is its own protocol layer.
The adapter itself is thin (reuses existing auth/validation); the new work is
the protocol shim, not the underlying operations.

**Codebase reality check (verified via explore subagent, not just doc titles):**
the `docs/superpowers/specs/*antigravity*`, `*gate3*`, and `*coordinator-v2*`
design docs are not vaporware — `server/routes.ts` really registers Gate3 and
Coordinator V2 routes, `server/scripts/coordination-runtime-antigravity.ts` is
a real driver (not test scaffolding) with an executable `main()`, and services/
repositories exist for both. The genuine gaps are narrower than the doc pile
suggests: Windows credential handling (DPAPI) is explicitly marked
design-approved-but-unimplemented in its own spec, and no persistent live
Antigravity connection exists yet — the driver is real but nothing has
actually invoked it against a running Antigravity host. Don't infer
implementation status from the number or names of design docs in
`docs/superpowers/specs/` — many are legitimately still proposals; check the
route registration and service files directly.
