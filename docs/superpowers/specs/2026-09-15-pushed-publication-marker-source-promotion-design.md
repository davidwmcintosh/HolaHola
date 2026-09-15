# Pushed Publication Marker Source Promotion

## Context

Coordinator V2 validates a candidate commit before Replit Publish. Replit then
creates a direct child commit with subject `Published your App` and the same
tree. The source-promotion record must continue to name the validated parent as
`promotedCommitSha`; the publication marker is evidence, not promoted source.

The existing recorder accepts a local-only marker when GitHub `main` remains on
the validated parent. Replit now also pushes the marker to GitHub. GitHub branch
protection forbids moving `main` back to the parent, even with an exact
force-with-lease.

## Chosen Design

Permit GitHub `main` to equal the publication marker only through the same
strict marker path already used for a local-only marker.

The recorder will:

1. Require a fresh protected validation manifest for the requested parent.
2. Require clean local state and exact repository identity.
3. Resolve the requested parent through authenticated GitHub commit proof.
4. When either current head differs from the requested parent, require both
   current heads to equal one marker SHA.
5. Resolve that marker locally and through authenticated GitHub commit proof.
6. Require exactly one parent, equal to the validated candidate; an exact tree
   match with the candidate; exact subject `Published your App`; and exact
   reference `replit-publish:<candidate>:<marker>`.
7. Re-read both heads, cleanliness, expiry, and local and remote marker proofs
   immediately before appending authority.

The canonical source-promotion row and digest will continue to use the
validated parent for `promotedCommitSha` and the marker for
`publishTriggerSha`. The immutable receipt will include the complete marker
proof. No runtime, host, task, session, lease, or execution authority is added
by this change.

## Alternatives Rejected

### Temporarily weaken GitHub branch protection

This would create a manual security interval and require restoring repository
rules correctly. GitHub already proved that the protected default blocks the
rewrite, so weakening it is unnecessary.

### Promote the marker

Tree equality does not make the marker the validated and deployed source
candidate. Promoting it would erase the distinction between source authority
and publication evidence.

### Insert a promotion row manually

This would bypass authenticated repository proof, final-state revalidation,
immutable receipts, and canonical conflict checks.

## Failure Handling

The recorder fails closed if:

- local and GitHub heads are neither the candidate nor one identical marker;
- the marker has zero, multiple, or the wrong parent;
- local and authenticated remote marker proofs disagree;
- candidate or marker tree, subject, or publication reference differs;
- validation expires;
- repository identity or worktree state changes;
- either head or either marker proof changes before the append; or
- an existing canonical row differs in any bound field.

No failed attempt writes a source-promotion row.

## Verification

Focused fixtures will cover:

- pushed-marker success with parent retained as promoted source;
- local-only marker regression;
- exact-head regression;
- marker receipt and canonical digest contents;
- local/GitHub marker disagreement;
- malformed parent, merge parent, tree, subject, or reference;
- initial and final local or remote head drift;
- final local or remote marker-proof drift; and
- dirty state or expired validation.

The complete change must then pass the source-control fixture, source-bridge
suite, typecheck, system-health verification, and independent architecture
review before protected promotion preparation.