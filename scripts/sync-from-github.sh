#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=github-release-ssh.sh
source "$SCRIPT_DIR/github-release-ssh.sh"

BRANCH="main"
REPO_URL="$GITHUB_REPO_URL"

if [[ -z "${HOLAHOLA_GITHUB_DEPLOY_KEY:-}" ]]; then
  echo "ERROR: HOLAHOLA_GITHUB_DEPLOY_KEY secret is not set. Add it in Replit Secrets." >&2
  exit 1
fi

echo "--- HolaHola: Sync from GitHub ---"

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "ERROR: Release must run from the ${BRANCH} branch (currently: ${CURRENT_BRANCH:-detached HEAD})." >&2
  exit 1
fi

CHANGES=$(git status --porcelain 2>/dev/null)
if [[ -n "$CHANGES" ]]; then
  echo "ERROR: Uncommitted local changes prevent a safe GitHub release pull:" >&2
  git status --short
  echo "Commit or stash them first, then run this script again." >&2
  exit 1
fi

prepare_github_ssh "$HOLAHOLA_GITHUB_DEPLOY_KEY"
trap cleanup_github_ssh EXIT
unset HOLAHOLA_GITHUB_DEPLOY_KEY

echo "Fetching latest changes from GitHub (branch: ${BRANCH})..."
git fetch --no-tags "$REPO_URL" "$BRANCH"

LOCAL_HEAD="$(git rev-parse --verify HEAD^{commit})"
GITHUB_HEAD="$(git rev-parse --verify FETCH_HEAD^{commit})"

if [[ "$LOCAL_HEAD" == "$GITHUB_HEAD" ]]; then
  echo "Replit is already up to date."
elif git merge-base --is-ancestor "$LOCAL_HEAD" "$GITHUB_HEAD"; then
  # Only fast-forward. Never create a merge commit or discard local commits.
  git merge --ff-only FETCH_HEAD
elif git merge-base --is-ancestor "$GITHUB_HEAD" "$LOCAL_HEAD"; then
  echo "ERROR: Replit is ahead of GitHub. Refusing to move Replit backward." >&2
  exit 1
else
  echo "ERROR: Replit and GitHub have diverged. Refusing to merge automatically." >&2
  exit 1
fi

echo ""
echo "Done! Replit is now up to date with github.com/davidwmcintosh/HolaHola"
