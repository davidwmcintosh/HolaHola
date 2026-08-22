# Safe GitHub Deploy-Key Synchronization

## Goal

Allow approved Replit/Alden changes to synchronize to the HolaHola GitHub
repository without relying on the old HTTPS token and without ever
overwriting newer GitHub work.

## Design

The existing automatic commit behavior is preserved. When the Replit working
tree contains changes, the push script will:

1. Validate that `HOLAHOLA_GITHUB_DEPLOY_KEY` exists.
2. Materialize the armored private key in a mode-0600 temporary file,
   reconstructing standard PEM/OpenSSH line breaks when the Replit secret
   provider has stored the body as one line.
3. Use an SSH-only Git transport pointed at
   `git@github.com:davidwmcintosh/HolaHola.git`.
4. Fetch `main` before creating a commit.
5. Refuse to continue if the local branch and fetched GitHub branch have
   diverged, or if GitHub contains commits not present locally.
6. Commit the current Replit changes with the supplied message.
7. Push with ordinary fast-forward semantics. No force-push option is used.

If GitHub advances between the preflight fetch and the push, GitHub's normal
non-fast-forward rejection remains the final safety gate.

The pull script will use the same SSH transport and will:

- refuse to proceed with a dirty working tree;
- fetch the requested branch;
- fast-forward only when the local branch is an ancestor of GitHub;
- refuse both divergence and local-ahead states rather than creating an
  implicit merge.

## Secret handling

The private key is never printed, committed, placed in a repository config
URL, or left in the project tree. Temporary materialized files are removed on
exit. The public key remains registered only as the repository's GitHub Deploy
key with write access.

## Failure behavior

Failures are explicit and actionable:

- missing secret: stop before any Git operation;
- malformed or encrypted key: stop before contacting GitHub;
- authentication or repository access failure: stop without changing files;
- dirty tree during pull: stop without merging;
- GitHub-ahead or divergent history during push: stop before committing;
- non-fast-forward race during push: report the rejection and preserve all
  local work.

The scripts will not use `GITHUB_TOKEN`, embed credentials in URLs, force-push,
or silently accept a merge.

## Verification

Verification will cover:

- the current one-line Replit secret format;
- successful SSH read access;
- missing/malformed-key failures;
- GitHub-ahead and divergent-history refusal;
- dirty-tree refusal on pull;
- absence of legacy token-bearing repository URLs in the scripts;
- shell syntax and the project typecheck.
