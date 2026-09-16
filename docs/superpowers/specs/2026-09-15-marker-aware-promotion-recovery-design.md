# Marker-aware source-promotion recovery

## Goal

Prevent an explicit Replit Publish from invalidating the protected preparation
that is required to record the published source candidate.

## Invariant

The validated parent commit remains the source candidate. A Replit
`Published your App` child is only publication evidence. It never becomes the
validated or promoted source merely because it has the same tree.

## Design

When synchronization sees equal local and authenticated GitHub heads, it may
recover `ready_to_promote` from an earlier status only if all of these remain
true:

1. The preserved candidate is a lowercase 40-character SHA.
2. Its complete validation manifest is valid for that exact candidate.
3. Its original preparation and expiry timestamps are present and the expiry
   has not passed.
4. The current local head is a single `Published your App` child whose parent
   is the candidate and whose tree equals the candidate tree.
5. The authenticated GitHub proofs for both candidate and marker match the
   exact SHAs, parent, and tree.
6. The source heads and tracked worktree remain unchanged before status is
   written.

Recovery preserves the original preparation time, expiry, candidate, and
validation manifest. It does not rerun validation, extend authority, append a
promotion, or grant any Coordinator V2 execution authority.

The existing record path remains responsible for the composite publication
reference, final source stability, immutable operation receipt, and atomic
database append.

## Failure behavior

Any missing, malformed, expired, unauthenticated, or changed evidence leaves
the ordinary synchronized state in place. Recovery fails closed and does not
partially restore readiness.

A failed record attempt may change the operational state, but it must retain
the original candidate evidence so a later marker-aware synchronization can
recover only under the same exact checks.

## Verification

Focused tests will cover:

- scheduler synchronization immediately after a valid Publish marker;
- recovery after a safe record refusal changed the mutable state;
- original preparation and expiry timestamps are not extended;
- wrong subject, parent, tree, remote proof, expired validation, invalid
  manifest, dirty worktree, and changing heads all fail closed;
- the publication marker is never selected as the promoted candidate;
- existing preparation, synchronization, and recording behavior remains
  unchanged outside the marker-backed case.

After focused tests, run typecheck and system-health verification. Dual-engine
Alden review must return an unconditional approval before the fix is used for
the release.