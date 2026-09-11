---
name: Cross-host artifact digests
description: Why immutable task artifacts must be hashed using the exact bytes the target host will execute.
---

An approved source artifact can have different bytes after checkout on another
host because Git line-ending conversion may turn LF into CRLF. Bind execution
authority to the exact target-host bytes, not an assumed repository blob
representation.

**Why:** A Windows Gate 3 artifact matched its approved SHA-256 only when hashed
with CRLF bytes. The immutable Git blob used LF, so hashing the blob would have
rejected the exact script Windows was assigned to execute.

**How to apply:** Before issuing cross-host execution authority, obtain or
reconstruct the target checkout's exact bytes, verify its line-ending policy,
and hash that representation. Record the public digest and byte provenance; do
not normalize after approval.