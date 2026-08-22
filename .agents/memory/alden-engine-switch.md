---
  name: Alden dual-engine switch
  description: How Alden's Anthropic/Gemini engine toggle works, where the audit log lives, and cache timing.
  ---

  Alden's persona/chat layer (server/services/alden-persona-service.ts) dispatches to either an Anthropic (claude-sonnet-4-5, default) or Gemini tool-use loop, chosen by a DB row in `aldenConfig` (single current engine) with every change recorded in `aldenEngineSwitches` (from/to/initiatedBy/reason/timestamp).

  **Why:** David wanted an explicit, reversible, audited way to put Alden into a Gemini "inside man" mode for planning/implementing code that touches Daniela, without a manual-only toggle that could be forgotten or silently left on.

  **How to apply:** Read/write the engine via `getAldenEngine()`/`setAldenEngine()` in alden-persona-service.ts, or the founder-gated `/api/alden/engine` GET/POST routes in server/routes.ts. There's a 15s in-memory cache (ENGINE_CACHE_TTL_MS) on top of the DB read, so a switch can take up to 15s to take effect — acceptable since this is a session-level toggle, not per-message. ALDEN_TOOLS are already in Anthropic `input_schema` format, so the Anthropic path uses them directly; the Gemini path converts via `toGeminiFunctions()`.
  