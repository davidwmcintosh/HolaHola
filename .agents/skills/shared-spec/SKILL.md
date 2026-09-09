---
name: shared-spec
description: Use the shared-spec workspace for documents authored or reviewed by more than one agent. Covers immutable revisions, independent review, approval, GitHub publication, and reconciliation.
---

# Shared-spec collaboration

Shared-spec is the default workspace for joint document creation and independent
review. Use it for designs, plans, procedures, architecture records, and other
Markdown that more than one actor will author or approve.

Do not start this work in Git and later treat a commit or pull request as the
review record. Shared-spec is the collaboration authority. GitHub is an optional
publication destination after an exact revision has been approved.

## Non-negotiable boundaries

- Authenticate as yourself. Actor identity comes from the credential, never
  request JSON.
- Never impersonate a requested reviewer, reuse their credential, claim for
  them, or record a decision in their name.
- An author cannot review their own revision. The requested independent actor
  must claim and decide the review under that actor's own credential.
- Revisions are immutable. Changes create a new revision with the current
  revision as `baseRevisionId`; they never overwrite reviewed bytes.
- Reuse an idempotency key only for an exact retry of the same mutation.
- Publish only the document ID, revision ID, and review ID that form the exact
  approved record. Never substitute the latest draft.

## Client setup

The portable API is normally mounted at `/api/shared-spec`. The bundled CLI
covers drafting, review, approval, and export:

```bash
export SHARED_SPEC_API_URL="https://getholahola.com/api/shared-spec"
# Supply only your own actor credential through the runtime secret store.

npx tsx server/scripts/shared-spec-cli.ts list \
  --url "$SHARED_SPEC_API_URL" \
  --token "$SHARED_SPEC_TOKEN"
```

Do not put tokens in repository files or literal command-line history.
Mutations require a stable, caller-generated `--idempotency-key`.

## Canonical lifecycle

### 1. Create the document

Create the first immutable revision in the intended repository namespace:

```bash
npx tsx server/scripts/shared-spec-cli.ts create \
  --url "$SHARED_SPEC_API_URL" --token "$SHARED_SPEC_TOKEN" \
  --title "Document title" --kind design \
  --repository owner/repository \
  --path docs/superpowers/specs/document-name.md \
  --markdown "$(cat /tmp/document.md)" \
  --idempotency-key "create-document-name-v1"
```

Save the returned document and revision IDs. The service records the author
from the authenticated actor.

### 2. Add revisions without overwriting

Read the document immediately before editing so the base is current:

```bash
npx tsx server/scripts/shared-spec-cli.ts show \
  --url "$SHARED_SPEC_API_URL" --token "$SHARED_SPEC_TOKEN" \
  --id "<document-id>"

npx tsx server/scripts/shared-spec-cli.ts revision \
  --url "$SHARED_SPEC_API_URL" --token "$SHARED_SPEC_TOKEN" \
  --id "<document-id>" --base "<current-revision-id>" \
  --markdown "$(cat /tmp/revised-document.md)" \
  --idempotency-key "revise-document-name-v2"
```

A `409 CONFLICT` means another revision became current. Do not force or
overwrite it. Read the current document, compare the two revisions through
`GET /revisions/compare?left=...&right=...`, reconcile the content deliberately,
and append a new revision from the now-current base.

### 3. Request an independent review

Only the current draft revision can be marked ready. Name the intended reviewer
when a particular actor was requested:

```bash
npx tsx server/scripts/shared-spec-cli.ts ready \
  --url "$SHARED_SPEC_API_URL" --token "$SHARED_SPEC_TOKEN" \
  --id "<document-id>" --revision "<revision-id>" \
  --reviewer "<reviewer-actor-id>" \
  --idempotency-key "ready-document-name-v2"
```

Stop here as the author. Send the returned review ID to the named reviewer.
Do not claim or decide their review yourself.

### 4. Reviewer claims and decides independently

The named reviewer switches to their own runtime and credential, reads the
exact revision and content hash, then claims the review:

```bash
npx tsx server/scripts/shared-spec-cli.ts claim \
  --url "$SHARED_SPEC_API_URL" --token "$SHARED_SPEC_TOKEN" \
  --id "<review-id>" \
  --idempotency-key "claim-document-name-v2"
```

Only that claiming reviewer may approve or reject:

```bash
npx tsx server/scripts/shared-spec-cli.ts approve \
  --url "$SHARED_SPEC_API_URL" --token "$SHARED_SPEC_TOKEN" \
  --id "<review-id>" --rationale "Reviewed against the landed contract." \
  --evidence '["server/services/example.ts"]' \
  --idempotency-key "approve-document-name-v2"
```

Use `reject` instead of `approve` when changes are required. Rejection returns
the document to draft; the author must append a new revision and request a new
review. Approval remains bound to the reviewed revision hash and the reviewer
policy version in force at decision time.

### 5. Export or publish only the approved bytes

The CLI can export the approved record:

```bash
npx tsx server/scripts/shared-spec-cli.ts export \
  --url "$SHARED_SPEC_API_URL" --token "$SHARED_SPEC_TOKEN" \
  --id "<document-id>"
```

GitHub publication is a separate, post-approval operation and may not be
configured on every host. The bundled CLI does not currently expose publication
commands. When publication is configured, use the authenticated API:

1. `POST /publications` with the exact `documentId`, `revisionId`, and
   `reviewId`, plus an `idempotency-key`.
2. `POST /publications/<publication-id>/publish`.
3. Record the returned pull request URL. The provider creates a deterministic
   `shared-spec/...` branch and pull request; it never pushes to the base branch.

Publication re-exports and verifies the approved immutable bytes before opening
the pull request. A publication conflict is not permission to replace remote
content or bypass review.

### 6. Reconcile publication state

Call `POST /publications/<publication-id>/reconcile` to refresh the durable
publication record from the provider. Reconciliation reports states such as
`open`, `merged`, `closed`, or `conflict`; it does not merge, rewrite, or create
a second review workflow.

If publication reports drift or conflict, preserve the approved shared-spec
record. Resolve the destination conflict explicitly, then create a new
publication attempt or a new document revision and review when the bytes must
change. Never edit the approved revision in place.

## Contract references

- Core lifecycle: `server/services/shared-spec-core.ts`
- HTTP contract: `server/routes/shared-spec-routes.ts`
- Publication safety: `server/services/shared-spec-publication.ts`
- Portable CLI: `server/scripts/shared-spec-cli.ts`
- Host and credential notes: `docs/coordination-clients.md`
