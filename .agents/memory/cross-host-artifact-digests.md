---
name: Cross-host artifact digests
description: Why immutable task artifacts must be hashed using the exact bytes the target host will execute.
---

Cross-host execution authority must define one canonical byte representation
before approval instead of trusting repository blobs or target-host checkout
bytes. Normalize every permitted transport representation, apply every
deterministic substitution, encode once, and use those exact canonical bytes
for hashing, writing, persistence, and replay.

**Why:** One Windows Gate 3 run failed because the producer substituted a
starting-commit placeholder while the server hashed the raw template. A second
failed because Windows materialized CRLF and Replit materialized LF. Both hosts
were internally consistent, but target-specific bytes could not represent one
portable authority artifact.

**How to apply:** Specify accepted input encodings and line endings, reject
ambiguous forms, normalize to one canonical format, enforce substitution
cardinality and size bounds, then bind all authority records to the resulting
bytes. Treat Git attributes only as defense-in-depth. Integration tests need a
separately authored canonical oracle with fixed bytes and digest; deriving the
expected value from the live input can let producer and oracle drift together.