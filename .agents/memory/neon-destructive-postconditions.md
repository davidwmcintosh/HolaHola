---
name: Neon destructive postconditions
description: Safety rule for interpreting destructive statements issued through Neon’s HTTP driver.
---

For approved destructive cleanup through Neon HTTP, use explicit allowlists and verify the committed database state independently after the statement. Success means every allowlisted row is absent and unrelated-row counts or fingerprints are preserved; a returned data-modifying CTE counter is not sufficient proof by itself.

**Why:** An exact, guarded cleanup removed precisely the approved rows while the statement response reported a no-op. Independent before/after totals and exact-ID queries proved the committed result. Treating the response counter as authoritative would have misreported the database state and risked an unsafe retry.

**How to apply:** Export the exact IDs before mutation, validate their shape and expected count, make deletion idempotent and allowlist-bound, then query the exact IDs and unrelated cohort immediately afterward. Preserve both preflight evidence and a postcondition receipt.