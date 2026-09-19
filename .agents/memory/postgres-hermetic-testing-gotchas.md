---
name: PostgreSQL hermetic testing gotchas
description: Five recurring pitfalls writing real-database tests against disposable PostgreSQL — POSIX regex vs JS escapes, immutable expiry, wrapped driver errors, lease clocks, CLI termination, and composite-FK negative fixtures.
---

## PostgreSQL lease clocks


Use an advancing PostgreSQL wall clock for lease issue, renewal, expiry, and
takeover decisions. Do not use a transaction-start timestamp for elapsed-time
authority.

**Why:** PostgreSQL transaction timestamps are fixed at transaction start.
Concurrent setup or test operations can therefore make “now” older than a
recently persisted lease boundary, producing contradictory expiry behavior
even though every value came from the database.

**How to apply:** Any database-authoritative timeout or lease transition that
depends on elapsed time should obtain the advancing clock inside the locked
transaction and derive expiry from that same value.

## PostgreSQL control checks and immutable expiry tests


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

## PostgreSQL wrapped structured errors


PostgreSQL conflict handling must inspect structured errors through a bounded
`cause` chain. SQLSTATE and constraint identity may be present on an inner
driver error rather than the outer exception.

**Why:** Database and ORM layers can wrap PostgreSQL errors. Checking only the
outer object can miss a real `23505`, while treating every wrapped error as a
conflict can hide unrelated failures and weaken authority guarantees.

**How to apply:** Walk only a small fixed number of structured `cause` links,
accept the expected SQLSTATE only with an exact allowlisted constraint name,
and rethrow everything else. Do not classify by message text or broad substring
matching.

## Database CLI termination


One-shot database administration commands must flush their final output and
terminate explicitly after success or failure when they import application
database infrastructure.

**Why:** A successful command can leave a shared connection pool holding the
Node.js event loop open. Gates then appear stalled even though the operation
and verification completed.

**How to apply:** For CLI entry points that reuse long-lived application
database modules, write the final result through a completion callback and
exit with the intended status; preserve import-safe behavior for library use.

## Composite-FK negative fixtures


For each intended composite foreign-key mismatch, create a fresh valid parent
lineage and fresh uniqueness dimensions, then alter exactly one child lineage
field. Do not reuse a host/request or host/release pair already consumed by a
successful child row.

**Why:** PostgreSQL may enforce a unique index before the composite foreign key.
A test expecting `23503` can instead receive a correct `23505`, which proves
only that the fixture collided with an earlier row.

**How to apply:** In negative database tests for lineage-bound evidence, keep
host fingerprints, requests, releases, manifests, and successful child pairs
distinct across cases. Assert the exact SQLSTATE only after those preempting
constraints are isolated.
