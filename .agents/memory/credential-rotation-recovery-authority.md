---
name: Credential rotation recovery authority
description: Safety rule for staged runtime credential replacement, emergency revocation, and overlapping rotations.
---

A staged credential rotation must derive recovery authority from its immutable
rotation record, not from whether the source or replacement registration still
looks healthy. Rollback must be able to close the rotation after emergency
revocation and idempotently revoke whatever replacement authority remains.

One runtime may participate in only one active rotation across both roles. A
runtime cannot be a replacement in one active rotation while acting as the
source in another.

**Why:** Requiring mutable endpoint health for rollback can strand an active
rotation after emergency revocation. Role-specific uniqueness alone can permit
an overlapping chain whose rollback or completion leaves orphaned authority.

**How to apply:** Lock all runtime identities involved before testing active
participation. Bind readiness and terminal transitions to the exact persisted
pair and authority snapshot. Let completion require healthy cutover
preconditions, but let rollback close the record even after either endpoint was
already disabled.