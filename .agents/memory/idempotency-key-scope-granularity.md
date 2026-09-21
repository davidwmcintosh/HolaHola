---
name: Idempotency key scope granularity
description: an idempotency key's dedupe scope is (operation, actor, key) only, not per-call content — reusing one literal key across distinct requests from the same actor collides.
---

An idempotency key's dedupe scope is `(operation-name, actorId, key)`. Two
different requests from the same actor, on the same operation, sharing one
literal key string are not treated as two independent calls — the second one
is compared against the first's stored request and rejected as a mismatch
(surfaces as an error like "idempotency key was reused with a different
request"), never silently treated as new.

**Why:** the guard exists to make retries safe (same key + same request =
return the original result, no duplicate side effect), but that mechanism
can't distinguish "this is a retry of the same logical request" from "this is
a different request that happens to reuse the same key" without help — the
key itself is the only signal it has.

**How to apply:** when a caller issues the same kind of request multiple
times in one run (e.g. a loop creating N distinct documents/rows), derive a
distinct key per iteration from something that varies per request (a target
path, an ID, a slug) — never reuse one constant literal across the loop, even
when each call is conceptually "the same one-off operation." Seen in the
shared-spec live-instruction-document seeding script, where one literal key
reused across two `createDocument()` calls (for two different documents)
collided on the second call.

