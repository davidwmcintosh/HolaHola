---
name: Immutable challenge attempt IDs
description: How retry idempotency must distinguish stable request identity from a new intentional attempt.
---

For immutable authorization challenges, do not use the stable payload digest as
the entire idempotency key. Include an explicit non-secret attempt generation.
Retries reuse the same attempt ID; a new intentional attempt uses a new ID.

**Why:** A bundle-only key made an expired immutable founder challenge occupy
the only key forever, so the same approved bundle could never receive fresh
authority.

**How to apply:** Keep the signed or approved payload unchanged, require a
bounded public attempt ID at the creation boundary, and compose both into the
idempotency key. Test same-attempt convergence and new-attempt freshness after
expiry while proving old evidence is unchanged.