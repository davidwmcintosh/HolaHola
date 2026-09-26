---
name: CLI-to-service extraction must drop process.exit()
description: Extracting a script's logic for reuse by an in-process tool/service must convert every process.exit() into a return value or throw; the extracted code runs inside the long-lived server, not a one-shot subprocess.
---

When extracting logic out of a `server/scripts/*.ts` CLI script so an in-process service or an Alden/Daniela tool can call it too, the extracted function must never call `process.exit()` (directly or via a helper that does). The original script can exit freely — it's a one-shot subprocess. The extracted version runs inside the long-lived server process via the tool-dispatch path, so a `process.exit()` there kills the whole server, not just the current tool call.

**Why:** Found while extracting `set-rolling-episode.ts`'s atomic promote transaction into `episode-lifecycle-service.ts` for reuse by an Alden tool (Sep 26 2026). The original script used `process.exit(1)`/`process.exit(0)` for its not-found and already-done paths. The extracted service function returns a discriminated-union result (`{ ok: false, reason: ... }` / `{ ok: true, ... }`) instead, and the thin CLI wrapper left behind translates that result back into the same `process.exit()` calls and exact stdout/stderr strings the script always had — so existing CLI regression tests that spawn the script as a subprocess and assert on exact output keep passing unmodified.

**How to apply:** Before reusing any script's logic from a tool or service, grep it for `process.exit`. Convert every exit path to a return value or thrown error, then keep the original script as a thin wrapper that maps those returns back to the same exit codes/messages it always produced (verify with the script's existing regression test, not just typecheck).

