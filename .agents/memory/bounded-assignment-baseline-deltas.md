---
name: Bounded assignment baseline deltas
description: How to prevent already-green source from turning a valid bounded coding assignment into a consumed zero-patch generation.
---

A bounded coding assignment must identify the exact missing behavior relative to
the promoted starting commit. If the focused test is already green, the artifact
must say so and explain why baseline success is not completion.

**Why:** A one-time, founder-approved generation can correctly run a green test
and stop without editing when the assignment broadly describes coverage that
mostly already exists. The coordinator should still refuse to attest an empty
patch, but the credential and approval cycle have then been consumed without
proving execution.

**How to apply:** Before provisioning, compare the assignment against the exact
promoted target. Name the missing operation, principal relationship, expected
result, and assertions that must remain. Add a static artifact guard for those
behavioral needles. Never force success with a formatting-only patch.