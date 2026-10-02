## Synthetic fixture ID collision

---
name: Synthetic fixture collisions and isolation
description: Guessed-unused identifiers are unsafe in shared data; stable fixture names require both private storage and private files.
---

## Rule

Never assume a fixture identifier or episode title cannot overlap real content. Upserting by a random row ID does not protect against a separate unique title constraint.

**Why:** genuine episode content eventually reached a title a test had assumed would remain unused. The resulting collision was deterministic, not a transient race. Deleting the genuine record would have destroyed content to accommodate the test.

**How to apply:** isolate every writable destination before running the test. Use a fake database or a fresh, invocation-owned database plus an invocation-owned temporary filesystem workspace. Do not treat an episode filter, random identifier, cleanup step, or temporary filesystem alone as database isolation.

## Stable names inside disposable fixtures

A fixed filename and title are acceptable only when both the database and filesystem namespace are private to the invocation. Keep record IDs unique, and reject unsafe execution before application imports or writes. A migrated database shared with other CI tests is not a private namespace; create a separate owned database or equivalent isolation.

**Why:** fail-closed source-write scanners cannot necessarily resolve dynamically generated template-expression filenames. Literal fixture paths can preserve scanner coverage without granting an exemption, while the disposable database and workspace prevent real-content collisions.

**How to apply:** prefer literal fixture filenames inside verified disposable namespaces instead of weakening the scanner. Never copy this convention into tests that still target shared application data.
