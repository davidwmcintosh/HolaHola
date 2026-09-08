# Shared-spec CLI

The shared-spec CLI is part of the canonical checkout and talks to the same
authenticated HTTP contract in development and production.

## Setup

From a fresh checkout:

```bash
npm ci
```

Supply an actor's coordination credential through the shell environment. Never
commit it or put it in a command copied into logs.

```bash
export SHARED_SPEC_TOKEN='<actor coordination credential>'
```

## Read-only smoke check

Use the same command shape against either host:

```bash
npm run shared-spec -- list \
  --url https://getholahola.com/api/shared-spec \
  --token "$SHARED_SPEC_TOKEN"
```

For development, replace the URL with the current development origin plus
`/api/shared-spec`. A successful response is a JSON document array. A missing
or invalid credential returns HTTP 401; the CLI exits non-zero.

## Commands

```text
list
show --id DOCUMENT_ID
create --title TITLE --kind KIND --repository OWNER/REPO --path PATH --markdown MARKDOWN --idempotency-key KEY
revision --id DOCUMENT_ID --base REVISION_ID --markdown MARKDOWN --idempotency-key KEY
ready --id DOCUMENT_ID --revision REVISION_ID [--reviewer ACTOR_ID] --idempotency-key KEY
claim --id REVIEW_ID --idempotency-key KEY
approve --id REVIEW_ID [--rationale TEXT] [--evidence JSON] --idempotency-key KEY
reject --id REVIEW_ID [--rationale TEXT] [--evidence JSON] --idempotency-key KEY
export --id DOCUMENT_ID
```

Every command also requires `--url` and `--token`. Mutation commands require an
idempotency key. `export` prints the exact approved Markdown bytes from the raw
export endpoint.