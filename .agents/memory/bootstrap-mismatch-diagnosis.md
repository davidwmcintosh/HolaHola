During luca-claude-code-cloud-2026-09 provisioning, roughly a dozen `invalid_bootstrap`
exchange failures across 4 reissues (spanning two different runtime IDs) were all traced
to a mismatched `COORDINATION_RUNTIME_BOOTSTRAP_TOKEN` value in the *client's* environment
-- never a server-side bug. The broker's own audit log and error codes cannot distinguish
"wrong secret" from "bad transcription of the right secret"; both read as `invalid_bootstrap`.

What actually resolved it: running `echo -n "$COORDINATION_RUNTIME_BOOTSTRAP_TOKEN" | wc -c`
in the client environment and comparing against the token's known length (46 chars for the
`cb_`-prefixed format `generateCoordinationSecret` produces) BEFORE attempting another
exchange. The very first attempt after a length-verified-correct value succeeded.

Ask an operator to run that check first, before requesting another reissue. Each reissue
permanently burns the previous bootstrap and does not, by itself, diagnose anything --
it only gives you another chance to make the same transcription mistake.


## This manual check is now partially automated

**Update:** the manual `wc -c` check described above is now partially automated for one call path. `CoordinationActorClient.exchangeBootstrap()` (`server/services/coordination-actor-client.ts`) calls `coordinationBootstrapTokenShapeIssue()` to validate the `cb_` prefix and 46-character length locally, before any HTTP call, and throws a message naming exactly what looks wrong (wrong prefix, wrong length, or a right-length-but-invalid-character value) instead of reaching the server. This is the check any `coordination-cli.ts`-based exchange already runs for you.

The manual byte-count diagnostic is still the right move for anything outside that path: `server/scripts/prepare-antigravity-provisioning.ts` independently encodes the identical shape check rather than importing this one (see that file and `coordination-actor-client.ts`'s comment above `BOOTSTRAP_TOKEN_PATTERN` for why — a hermetic-import constraint, not an oversight), and a human eyeballing or hand-copying a value outside either code path has no automated check at all.


## A second cause: server-side tombstone-column reuse (not a client mistake)

## A second cause: server-side tombstone-column reuse (not a client mistake)

The client-side transcription error above is not the only way `invalid_bootstrap`
can appear after a reissue. `exchangeBootstrapCredential`'s "already consumed"
detection works by hashing the presented bootstrap token and comparing it
against a single tombstone value stored in the *same* `bootstrapHash` column
that also holds the live (not-yet-consumed) bootstrap hash.
`reissueCoordinationRuntimeBootstrap` overwrites that same column with a fresh
live hash for the new bootstrap it generates -- it does not preserve or chain
the prior tombstone.

**Consequence:** retrying an old bootstrap token that was validly consumed
*before* a subsequent reissue happened no longer matches the tombstone (the
column has since moved on to the new live hash) and falls through to the
generic `invalid_bootstrap` reason instead of `bootstrap_already_consumed`.
Only the single most recent consumption is ever tombstoned at a time.

**Why this is currently acceptable:** every caller that branches on these two
reasons (e.g. the coordination actor-client's operator guidance) treats them
identically -- both mean "ask an operator to reissue." No caller needs to
distinguish "was consumed" from "is stale/invalid" more precisely than that.

**How to apply:** if a future change needs a reason code that survives across
a reissue boundary (e.g. per-token consumption history instead of one shared
column), the fix is a dedicated consumed-tokens table or a hash chain, not a
bigger single column -- one slot can only ever remember the most recent
transition, no matter how it's encoded.

