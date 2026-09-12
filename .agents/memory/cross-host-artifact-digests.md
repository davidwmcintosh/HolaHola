---
name: Cross-host artifact digests
description: Why immutable task artifacts must be hashed using the exact bytes the target host will execute.
---

An approved source artifact can have different bytes after checkout on another
host because Git line-ending conversion may turn LF into CRLF. Bind execution
authority to the exact target-host bytes, not an assumed repository blob
representation. Template substitution is another byte transformation: producer
and consumer must materialize the same placeholders before either side hashes.

**Why:** A Windows Gate 3 artifact matched its approved SHA-256 only when hashed
with CRLF bytes. The immutable Git blob used LF, so hashing the blob would have
rejected the exact script Windows was assigned to execute.

**How to apply:** Before issuing cross-host execution authority, obtain or
reconstruct the target checkout's exact bytes, verify its line-ending policy,
apply every deterministic template substitution, and hash that representation.
Record the public digest and byte provenance; do not normalize or rematerialize
after approval. A fixture that hashes an unmaterialized template can mask a
producer/consumer mismatch even while all tests pass.