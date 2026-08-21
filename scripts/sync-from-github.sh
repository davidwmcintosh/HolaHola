#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/github-ssh-env.sh
source "$SCRIPT_DIR/github-ssh-env.sh"

BRANCH="main"

echo "--- HolaHola: Sync from GitHub ---"

if [[ "$(git symbolic-ref --short HEAD 2>/dev/null || true)" != "$BRANCH" ]]; then
  echo "ERROR: sync-from-github must run on the local ${BRANCH} branch." >&2
  exit 1
fi

CHANGES="$(git status --porcelain)"
if [[ -n "$CHANGES" ]]; then
  echo "ERROR: local uncommitted changes are present. Refusing to merge GitHub." >&2
  git status --short
  echo "Commit or stash them before running this script again." >&2
  exit 1
fi

github_ssh_setup
trap github_ssh_cleanup EXIT

echo "Fetching GitHub (branch: ${BRANCH})..."
git fetch --no-tags "$HOLAHOLA_GITHUB_REPO_SSH" "refs/heads/$BRANCH"

LOCAL_COMMIT="$(git rev-parse HEAD)"
REMOTE_COMMIT="$(git rev-parse FETCH_HEAD)"

if [[ "$LOCAL_COMMIT" == "$REMOTE_COMMIT" ]]; then
  echo "Replit is already up to date with GitHub."
elif git merge-base --is-ancestor "$LOCAL_COMMIT" "$REMOTE_COMMIT"; then
  echo "Fast-forwarding Replit to GitHub..."
  git merge --ff-only "$REMOTE_COMMIT"
elif git merge-base --is-ancestor "$REMOTE_COMMIT" "$LOCAL_COMMIT"; then
  echo "ERROR: Replit contains commits not present on GitHub. Refusing to overwrite local work." >&2
  exit 1
else
  echo "ERROR: Replit and GitHub histories have diverged. Refusing to merge." >&2
  exit 1
fi

echo ""
echo "Done! Replit is now up to date with github.com/davidwmcintosh/HolaHola"
