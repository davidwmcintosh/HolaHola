# Render Source-Promotion Evidence

## Purpose

Coordinator V2 source promotion must bind the validated GitHub commit to the
actual published runtime. The existing implementation described only Replit
Publish markers, while production now runs on Render.

## Contract

- Keep the existing protected validation manifest, clean-worktree check,
  authenticated GitHub commit/tree proof, immutable receipt, and append-only
  source-promotion record.
- Upgrade the protected validation manifest so its identity includes the
  source-context digest and file count derived from the exact candidate Git
  commit tree. Caller input and Render's self-report are not source authority.
- Promotable release manifests use the same shared source-selection policy as
  protected Git-tree validation. Render's Docker context has no `.git`, so it
  hashes the exact filesystem build context supplied for the build; promotion
  remains blocked unless that digest matches the independently Git-derived
  protected validation digest. If Git metadata is visible, its commit must
  match the build-supplied commit.
- Accept Render evidence only through
  `render-release:<commit-sha>:<source-context-sha256>`.
- Resolve one operator-pinned HTTPS `/health/release` endpoint with redirects
  disabled and a bounded timeout.
- Require HTTP 200 and the existing release-identity schema.
- Require `authority=build`, `promotable=true`, the exact candidate commit, and
  the exact source-context digest already bound into protected validation.
- Verify the same release identity again after final Git/source checks and
  before the authority append.
- Store only sanitized release identity in the immutable operation receipt and
  canonical record digest. Never store headers, credentials, raw response
  bodies, or unbounded errors.
- Preserve the existing exact Replit publication-marker path unchanged.
- Reject arbitrary exact-head publication references that have neither Render
  release proof nor a valid Replit marker.

## Operator API

For Render, the record request supplies `sha` and `sourceContextSha256`; the
service constructs the canonical publication reference. For Replit, the
existing protected `publicationReference` remains available. The two inputs
are mutually exclusive.

## Failure behavior

Missing or malformed configuration, non-HTTPS URLs, redirects, timeout,
non-200 responses, malformed release identity, development authority,
non-promotable releases, and commit or digest mismatches all fail before any
source-promotion authority is appended.