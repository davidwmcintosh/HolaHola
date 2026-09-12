---
name: Canonical projection race
description: Why projections must validate the persisted canonical record after idempotent ledger creation.
---

Any service that turns a canonical ledger event into a second projection must
validate the complete persisted thread, event, and payload after the ledger
create call and before writing the projection. A precheck is not sufficient.

**Why:** An independent writer that does not share the service's advisory lock
can insert the same idempotency key between the precheck and create call. An
idempotent helper may then return that incompatible existing record. Projecting
from it without full validation turns a race winner into unintended authority.

**How to apply:** Treat the persisted ledger result as untrusted until every
fixed and input-derived binding is checked. Build the projection from that
validated persisted result, not from a parallel local payload, and test the
between-precheck-and-create race explicitly.