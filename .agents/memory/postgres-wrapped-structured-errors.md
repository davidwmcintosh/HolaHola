---
name: PostgreSQL wrapped structured errors
description: Conflict handling must inspect a bounded cause chain for SQLSTATE and constraint identity instead of trusting only the outer error.
---

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