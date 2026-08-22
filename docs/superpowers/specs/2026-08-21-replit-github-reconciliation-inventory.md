# Replit–GitHub Main Reconciliation Inventory

## Protected source heads

Before reconciliation, annotated Git tags were created for both source heads:

| Source | Protected tag | Commit |
| --- | --- | --- |
| Replit `main` | `reconciliation/replit-main-2026-08-21` | `b88ac3304f29d1374359f11fbb16b5fc6771fde6` |
| GitHub `main` | `reconciliation/github-main-2026-08-21` | `37ed5a85d3527f66b805c2212598793676b2752e` |

The common ancestor is `f2be837cc121c9df135445d35b70d2764e87141b`.
Neither protected tag is moved as part of this reconciliation.

## GitHub source-snapshot release

GitHub rejects ordinary Git objects larger than 100 MiB. The historic
Replit-only graph contains a 176.18 MiB PDF blob, so publishing that entire
graph would require a prohibited force-push after rewriting its commits.

The approved release policy is therefore a non-force source snapshot:

- the protected Replit and GitHub tags retain both original histories in this
  checkout;
- GitHub `main` advances from its verified head with one snapshot commit whose
  tree is the complete reviewed Replit source tree;
- the large current PDF assets remain present as Git LFS pointers, preserving
  their content without placing oversized ordinary blobs in GitHub history.

GitHub becomes the approved source of the current application tree. The
protected tags remain the immutable record of the two pre-reconciliation
commit histories.

## Off-workspace protected-history archive

The two source tags, their reconciliation/backup lineages, and explicit
two-parent reconciliation merge refs are archived outside this workspace on
the configured private S3-compatible object store under
`history-archives/reconciliation-2026-08-21/`. The archive command rejects
moved tags and conflicting stored bytes, validates a portable bundle plus the
Git and LFS object graph, then downloads and fscks the stored bundle in an
isolated recovery clone.

See [Protected Replit History Archive](2026-08-22-replit-history-archive.md)
for the archive contents, validation command, and a recovery procedure that
never force-pushes or overwrites GitHub `main`.

## Unique-history inventory

| Side | Unique commits | Paths changed from the common ancestor |
| --- | ---: | ---: |
| Replit | 4,453 | 24,207 |
| GitHub | 1 | 1 |

The GitHub-only commit is:

```text
37ed5a85d3527f66b805c2212598793676b2752e  Update .gitignore
```

Its sole changed path is `.gitignore`. The only path changed on both sides is
also `.gitignore`. All remaining Replit paths are unique to the Replit side.

The exact, complete file and commit inventories are reproducible from the
protected tags without relying on branch movement:

```bash
REPLIT=reconciliation/replit-main-2026-08-21
GITHUB=reconciliation/github-main-2026-08-21
BASE="$(git merge-base "$REPLIT" "$GITHUB")"

# Every commit unique to each source history
git log --reverse --format='%H%x09%ad%x09%an%x09%s' --date=short "$GITHUB..$REPLIT"
git log --reverse --format='%H%x09%ad%x09%an%x09%s' --date=short "$REPLIT..$GITHUB"

# Every path changed from the shared ancestor on each source history
git diff --no-renames --name-status "$BASE" "$REPLIT"
git diff --no-renames --name-status "$BASE" "$GITHUB"

# Every same-path change requiring a reconciliation decision
comm -12 \
  <(git diff --no-renames --name-only "$BASE" "$REPLIT" | sort) \
  <(git diff --no-renames --name-only "$BASE" "$GITHUB" | sort)
```

## Deliberate same-path review

`.gitignore` was resolved to the Replit version. It retains GitHub's
environment-secret exclusions (`.env`, `.env.*`, and the `.env.example`
exception) and adds the existing exclusions for auto-generated runtime
briefing documents and `nohup.out`. This is the reviewed union: no GitHub
secret-protection rule was discarded, and the complete Replit runtime setup
remains intact.

No other docs, scripts, deployment configuration, episode document, or
canonical record path was changed by GitHub after the shared ancestor. The
approved source snapshot therefore preserves the complete Replit application
and record tree while retaining GitHub's one reviewed change.