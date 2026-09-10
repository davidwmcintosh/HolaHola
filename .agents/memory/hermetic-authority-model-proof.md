---
name: Hermetic authority-model proof
description: Requirements for trustworthy in-memory protocol gates before persistent coordination implementation.
---

A hermetic protocol gate must make its fake repository the authority for identity, frozen inputs, execution envelopes, idempotency, claims, evidence, and verification. Caller-provided structures may identify stored records, but cannot define what is authorized.

**Why:** Repeated implementations produced passing tests while allowing fabricated evidence, cross-runtime authority transfer, caller-widened execution envelopes, non-atomic claim/idempotency transitions, or false-positive assertions. Green tests were not sufficient evidence because several test names claimed behavior their assertions never reached.

**How to apply:** Before accepting a coordination protocol core, require transaction-shaped repository operations, server-owned envelopes, authenticated principals, immutable stored chains, exact replay tests for every mutation family, and adversarial tests that assert both the error and the resulting lifecycle/evidence state. Review test bodies against their names.