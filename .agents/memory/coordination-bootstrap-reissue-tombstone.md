`exchangeBootstrapCredential`'s "already consumed" detection works by hashing the
presented bootstrap token and comparing it against a single tombstone value stored
in the *same* `bootstrapHash` column that also holds the live (not-yet-consumed)
bootstrap hash. `reissueCoordinationRuntimeBootstrap` overwrites that same column
with a fresh live hash for the new bootstrap it generates — it does not preserve
or chain the prior tombstone.

**Consequence:** retrying an old bootstrap token that was validly consumed
*before* a subsequent reissue happened no longer matches the tombstone (the
column has since moved on to the new live hash) and falls through to the generic
`invalid_bootstrap` reason instead of `bootstrap_already_consumed`. Only the
single most recent consumption is ever tombstoned at a time.

**Why this is currently acceptable:** every caller that branches on these two
reasons (e.g. the coordination actor-client's operator guidance) treats them
identically — both mean "ask an operator to reissue." No caller needs to
distinguish "was consumed" from "is stale/invalid" more precisely than that.

**How to apply:** if a future change needs a reason code that survives across a
reissue boundary (e.g. per-token consumption history instead of one shared
column), the fix is a dedicated consumed-tokens table or a hash chain, not a
bigger single column — one slot can only ever remember the most recent
transition, no matter how it's encoded.

