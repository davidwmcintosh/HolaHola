# Runtime timestamp canonicalization and historical replay repair

## Status and authorization

Prepared for independent architectural review and founder approval. No implementation, production-record repair, publication, or Windows operation is authorized by this document alone.

## Problem and evidence

The runtime issue POST returned HTTP 422 with `V2_RUNTIME_EVIDENCE_INVALID`. The replay branch reconstructs a manifest and requires its canonical SHA-256 digest to equal the issue's immutable `manifest_digest`.

The existing `dateValue` helper calls `new Date(String(value))`. For a fresh JavaScript Date, `String(value)` loses milliseconds before manifest construction. Database timestamp strings retain them on replay. For example, a creation manifest contains `03:20:13.000Z`, while the database preserves `03:20:13.191`.

Read-only reconstruction of eight historical host issues reproduced every stored digest using whole-second creation timestamps. None matched reconstruction with the database milliseconds. No records were changed. The exact Windows request key has not been independently correlated to one of those eight rows; the HTTP error and server replay branch identify the failure class.

## Alternatives

1. **Preserve future precision plus bounded historical compatibility — recommended.** Preserve Date milliseconds on new manifests. During replay, accept only the complete canonical payload whose digest matches the original stored digest.
2. **Keep whole-second timestamps forever.** Smaller behavioral change, but retains inconsistent precision between persisted timestamps and signed evidence.
3. **Rewrite historical digests or bypass their comparison — rejected.** This changes historical evidence or weakens the integrity boundary.

## Proposed server-only repair

### Consistent future timestamps

Change Date handling so a Date input retains its epoch milliseconds instead of passing through its human-readable String representation. Preserve current invalid-input rejection. Check the helper's existing callers; do not silently refactor unrelated datetime logic or add a timezone-policy change.

Fresh manifest creation and replay through the actual database driver must produce byte-identical canonical payloads, including nonzero milliseconds.

### Exact-digest historical replay

Reconstruct the manifest from the existing issue, release, host, and artifact records.

1. Compute its full canonical digest using precision-preserving timestamps.
2. If that digest equals the stored `manifest_digest`, use that exact payload.
3. Otherwise construct exactly one legacy candidate. Change only `issuedAt` and `expiresAt` to whole seconds using Date operations followed by `toISOString()`. This MUST produce `.000Z`, not `Z`.
4. Accept the legacy candidate only if its entire canonical digest equals the immutable stored digest.
5. If neither candidate matches, retain `V2_RUNTIME_EVIDENCE_INVALID`.

Sign and return the selected payload, not the full-precision payload when the legacy candidate matched. The returned canonical digest must remain the original stored digest.

Do not alter any other field, search arbitrary variants, rewrite timestamps or digests, issue a new request key, or update historical records. Existing host/release/artifact bindings remain mandatory.

### Expiry and scope boundaries

Do not renew historical issue lifetimes. Artifact access and acknowledgement must continue checking the original database expiry. Compatibility restores original signed bytes; it does not authorize installation from expired evidence.

The Windows initializer can have an empty saved `issueId` although the server already issued an expired manifest for its request key. It rejects an expired response before saving that ID. Therefore this server repair alone may expose a separate expired-response block; it is NOT a promise that Windows initialization completes afterward.

Client handling of that state requires a separately approved design. This repair does not change the launcher, clear DPAPI state, rotate keys, create a session, or broaden execution policy, ACLs, trust, or credentials.

## Regression tests to implement after approval

### Pure canonicalization tests

- Date versus equivalent database string retains identical nonzero milliseconds and canonical digest.
- Whole-second inputs remain byte-identical.
- Invalid dates retain the existing error contract.
- Cover the eight observed fractional-millisecond patterns using entirely synthetic manifests and IDs, not production records or credentials.
- Each historical fixture first fails the exact candidate, then matches only the `.000Z` legacy candidate; assert the returned payload and digest, not merely a boolean.
- A new full-precision fixture selects the exact candidate and never substitutes its legacy variant.
- Altered issue ID, host fingerprint, release digest, artifact content/membership, or source-member hashes remain rejected under both candidates.
- A mismatch unrelated to precision fails closed.

### Disposable PostgreSQL tests

Extend the established runtime-bootstrap PostgreSQL test and its existing disposable-target gate.

- Create and replay a fresh fractional-second issue through the actual application transaction/driver path; verify identical digest and signature verification.
- Insert a synthetic historical issue with a whole-second signed digest but fractional database timestamps; verify exact historical replay.
- Assert issue count, request key, stored digest, and timestamps are unchanged after replay, including repeated replay.
- Verify tampered evidence still rejects rather than creating another issue.
- Verify expired historical evidence remains expired for artifact access and acknowledgement.
- Preserve signature verification: a wrong key or modified signature is rejected by the existing verification path.

No DB-writing test may run against the shared application/production database. Skipping PostgreSQL coverage outside the disposable gate must be reported as skipped, never as a passing DB test.

### Mutation checks and validation

Prove tests fail if Date-to-String truncation returns, the legacy fallback is removed, legacy timestamps use `Z` rather than `.000Z`, or either digest comparison is bypassed.

Register focused coverage through the existing CI registry. Run focused tests, typecheck, and the established disposable-database validation path before claiming implementation verified. No schema migration is expected.

## Review and release stops

Independent review must cover the exact revision and hash. Founder approves the written design before implementation. Application code and executable tests are not yet prepared or run.

After implementation review and validation, any publication must use fresh exact-source GitHub-to-Render evidence and the founder-only publication stop. Reassess runtime publication requirements from the actual changed files. Do not reuse an earlier publication receipt for changed source, initialize Windows during publication, or create a coordinator session.
