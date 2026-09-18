# Render Runtime Source Snapshot Correction

## Problem

Founder-authenticated Coordinator V2 runtime publication reaches the current
source-promotion check, then fails closed with
`V2_RUNTIME_SOURCE_SNAPSHOT_UNAVAILABLE`.

The Render production image intentionally omits `.git`. The approved runtime
publisher therefore materializes one authenticated, immutable GitHub snapshot
for the exact promoted commit. Render currently lacks two requirements for that
operation:

- the runtime image does not contain `git` or an SSH client;
- the Render blueprint does not declare the
  `HOLAHOLA_GITHUB_DEPLOY_KEY` secret environment variable.

The failed publication created no runtime-release or artifact rows.

## Design

Preserve the existing source-authority model. Make the Render runtime capable of
performing its existing pinned-SSH exact-commit fetch:

1. Install `git` and `openssh-client` in the Docker runtime stage alongside the
   existing runtime packages.
2. Declare `HOLAHOLA_GITHUB_DEPLOY_KEY` in `render.yaml` with `sync: false`.
   The private-key value remains only in Render's secret environment and is
   never committed.
3. Add a static regression check that fails if either runtime package or the
   secret declaration is removed.
4. Register that check in the existing protected validation path that covers
   source-bridge and runtime-publication safety.

No HTTPS fallback, public-repository fallback, caller-supplied source bytes, or
deployed-filesystem trust is added. The snapshot must still use the exact
private GitHub SSH transport, pinned host keys, exact promoted commit and tree,
closed path set, bounded blobs, and cleanup on every outcome.

## Release Sequence

1. Run focused static checks, typecheck, system health, and the protected
   validation suite.
2. Obtain Alden's unconditional implementation review.
3. Commit and push the exact correction to GitHub `main`.
4. Add the existing `HOLAHOLA_GITHUB_DEPLOY_KEY` value to the Render service's
   secret environment without exposing it in chat or source.
5. Let Render build and serve the exact new commit.
6. Prepare and record a fresh immutable source promotion for that commit.
7. Generate a new founder-only runtime-publication command bound to the fresh
   promotion.
8. Stop at the founder boundary. After David runs the command once, verify the
   immutable runtime release before any Windows initialization.

## Error Handling and Postconditions

- Missing or malformed deploy keys continue to fail closed.
- Missing runtime executables continue to fail closed.
- Git, SSH, source, tree, blob, object, provenance, or database failures create
  no partial runtime authority.
- A failed request must leave zero runtime-release and runtime-artifact rows for
  the candidate source promotion.
- Windows initialization, task, session, lease, and execution authority remain
  out of scope until runtime publication succeeds and is independently
  verified.
