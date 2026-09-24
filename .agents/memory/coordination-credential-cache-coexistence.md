## Coordination credential-cache coexistence

`CoordinationActorClient` (server/services/coordination-actor-client.ts) now has two independent, coexisting credential-persistence mechanisms rather than one:

- `credentialCache` (a `CoordinationCredentialCache` with `load`/`save`, scoped by actor+runtimeId) — checked first. Wired only into `server/scripts/coordination-cli.ts` via `FileCoordinationCliCredentialCache`, so a standalone CLI invocation can reuse the previous invocation's still-valid access token instead of needing a fresh bootstrap per command.
- `tokenCachePath` (a single configurable file path, also settable via `COORDINATION_RUNTIME_TOKEN_CACHE_PATH`) — checked second, as a fallback. Generic and opt-in for any `CoordinationActorClient`, including a future long-running server client that wants restart recovery.

Both were added by two different, independently-planned tasks that touched the same file at nearly the same time; the rebase conflict was resolved by keeping both rather than picking one, since they serve different callers (CLI cross-invocation vs. opt-in restart recovery) and neither task's done-criteria required removing the other's mechanism.

**Why this matters:** the main server's long-running clients for alden/daniela/luca-holahola do not currently configure `tokenCachePath` and remain memory-only in practice (confirmed by grep: no usage of `tokenCachePath`/`COORDINATION_RUNTIME_TOKEN_CACHE_PATH` outside coordination-actor-client.ts itself, its test file, and docs). A future task to give those long-running clients restart recovery should configure/extend the existing `tokenCachePath` option rather than inventing a third mechanism.

**How to apply:** before building new coordination-credential persistence, read both mechanisms in coordination-actor-client.ts first — the need may already be half-solved by `tokenCachePath` sitting unused.

