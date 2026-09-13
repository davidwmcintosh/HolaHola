---
name: PostgreSQL control checks and immutable expiry tests
description: Avoid malformed control-character regexes and preserve immutable authority when proving database-clock expiry.
---

Use PostgreSQL POSIX `[[:cntrl:]]` checks for bounded text fields. Do not
translate JavaScript-style hexadecimal control ranges into doubly escaped SQL
regex character classes.

**Why:** A doubled-backslash `\x00-\x1f` pattern was interpreted as ordinary
character-class content and rejected valid request keys containing normal
letters. The schema looked strict but enforced the wrong alphabet.

**How to apply:** Keep the Drizzle schema, generated migration, and snapshot on
the same POSIX expression, and prove representative valid values on a disposable
PostgreSQL branch.

When an authority row makes its expiry immutable, test expiry by creating a
short-lived authoritative parent or session whose database-clock bound naturally
caps the child. Never rewrite the child expiry to make a test convenient.

**Why:** Directly shortening the reservation expiry contradicted the
immutability trigger and tested a state production can never create.

**How to apply:** Create the short-lived parent immediately before the scenario,
wait past its database-clock bound, then exercise the normal recovery path.