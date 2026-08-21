#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/github-ssh-env.sh
source "$SCRIPT_DIR/github-ssh-env.sh"

BRANCH="main"
LOCK_FILE=".git/index.lock"

echo "--- HolaHola: Sync to GitHub ---"

if [[ "$(git symbolic-ref --short HEAD 2>/dev/null || true)" != "$BRANCH" ]]; then
  echo "ERROR: sync-to-github must run on the local ${BRANCH} branch." >&2
  exit 1
fi

# Wait for any in-progress git operation (checkpoint commit) to finish
if [[ -f "$LOCK_FILE" ]]; then
  echo "Git lock file detected — waiting for it to clear..."
  WAIT=0
  while [[ -f "$LOCK_FILE" ]] && [[ $WAIT -lt 30 ]]; do
    sleep 2
    WAIT=$((WAIT + 2))
    echo "  still waiting... (${WAIT}s)"
  done
  if [[ -f "$LOCK_FILE" ]]; then
    echo "Lock file still present after 30s. Remove it manually with:"
    echo "  rm $LOCK_FILE"
    echo "Then re-run this script."
    exit 1
  fi
  echo "Lock cleared. Proceeding."
fi

github_ssh_setup
trap github_ssh_cleanup EXIT

echo "Fetching GitHub before inspecting or committing local changes..."
git fetch --no-tags "$HOLAHOLA_GITHUB_REPO_SSH" "refs/heads/$BRANCH"

LOCAL_COMMIT="$(git rev-parse HEAD)"
REMOTE_COMMIT="$(git rev-parse FETCH_HEAD)"

if [[ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]]; then
  if git merge-base --is-ancestor "$REMOTE_COMMIT" "$LOCAL_COMMIT"; then
    :
  elif git merge-base --is-ancestor "$LOCAL_COMMIT" "$REMOTE_COMMIT"; then
    echo "ERROR: GitHub is ahead of Replit. Refusing to commit or push." >&2
    exit 1
  else
    echo "ERROR: Replit and GitHub histories have diverged. Refusing to commit or push." >&2
    exit 1
  fi
fi

CHANGES="$(git status --porcelain)"
if [[ -z "$CHANGES" ]]; then
  if [[ "$LOCAL_COMMIT" == "$REMOTE_COMMIT" ]]; then
    echo "Nothing to commit and GitHub is already up to date."
  else
    echo "Working tree is clean; pushing local commits..."
    git push "$HOLAHOLA_GITHUB_REPO_SSH" "HEAD:refs/heads/$BRANCH"
    echo "Done. Your GitHub repo is up to date."
  fi
  exit 0
fi

echo "Changes to be committed:"
git status --short

git add -A

if [[ -n "${1:-}" ]]; then
  COMMIT_MSG="$1"
else
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
  COMMIT_MSG="Sync from Replit - ${TIMESTAMP}"
fi

git commit -m "$COMMIT_MSG" 2>&1

echo "Pushing to GitHub (branch: ${BRANCH})..."
git push "$HOLAHOLA_GITHUB_REPO_SSH" "HEAD:refs/heads/$BRANCH"

echo ""
echo "Done! Changes pushed to github.com/davidwmcintosh/HolaHola"
