#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=github-release-ssh.sh
source "$SCRIPT_DIR/github-release-ssh.sh"

BRANCH="main"
REPO_URL="$GITHUB_REPO_URL"
LOCK_FILE=".git/index.lock"
COMMITTED_ONLY=0
EXPECTED_HEAD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --committed-only)
      COMMITTED_ONLY=1
      shift
      ;;
    --expected-head)
      EXPECTED_HEAD="${2:-}"
      [[ -n "$EXPECTED_HEAD" ]] || { echo "ERROR: --expected-head requires a commit SHA." >&2; exit 64; }
      shift 2
      ;;
    *)
      break
      ;;
  esac
done

if [[ -z "${HOLAHOLA_GITHUB_DEPLOY_KEY:-}" ]]; then
  echo "ERROR: HOLAHOLA_GITHUB_DEPLOY_KEY secret is not set. Add it in Replit Secrets." >&2
  exit 1
fi

echo "--- HolaHola: Sync to GitHub ---"

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "ERROR: Release must run from the ${BRANCH} branch (currently: ${CURRENT_BRANCH:-detached HEAD})." >&2
  exit 1
fi

# Wait for any in-progress git operation (checkpoint commit) to finish.
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

prepare_github_ssh "$HOLAHOLA_GITHUB_DEPLOY_KEY"
trap cleanup_github_ssh EXIT
unset HOLAHOLA_GITHUB_DEPLOY_KEY

echo "Fetching GitHub ${BRANCH} before preparing a release..."
git fetch --no-tags "$REPO_URL" "$BRANCH"

LOCAL_HEAD="$(git rev-parse --verify HEAD^{commit})"
GITHUB_HEAD="$(git rev-parse --verify FETCH_HEAD^{commit})"

if [[ -n "$EXPECTED_HEAD" && "$LOCAL_HEAD" != "$EXPECTED_HEAD" ]]; then
  echo "ERROR: Local HEAD changed from the bridge's inspected commit. Refusing to push a different commit." >&2
  exit 1
fi

# GitHub must already be an ancestor of the local commit. This check happens
# before creating a local release commit, and the push below remains protected
# against a remote race by Git's normal non-fast-forward rejection.
if ! git merge-base --is-ancestor "$GITHUB_HEAD" "$LOCAL_HEAD"; then
  if git merge-base --is-ancestor "$LOCAL_HEAD" "$GITHUB_HEAD"; then
    echo "ERROR: GitHub is ahead of Replit. Refusing to push over newer GitHub work." >&2
  else
    echo "ERROR: Replit and GitHub have diverged. Refusing to push until the histories are reconciled." >&2
  fi
  exit 1
fi

CHANGES=$(git status --porcelain --untracked-files=no 2>/dev/null)
if [[ -z "$CHANGES" ]]; then
  if [[ "$LOCAL_HEAD" == "$GITHUB_HEAD" ]]; then
    echo "Nothing to commit — working tree is clean and GitHub is up to date."
    exit 0
  fi
  echo "Nothing to commit — working tree is clean."
  echo "Pushing unpushed commits..."
  PUSH_HEAD="${EXPECTED_HEAD:-$LOCAL_HEAD}"
  if [[ "$(git rev-parse --verify HEAD^{commit})" != "$PUSH_HEAD" ]]; then
    echo "ERROR: Local HEAD changed before push. Refusing to publish an uninspected commit." >&2
    exit 1
  fi
  git push "$REPO_URL" "${PUSH_HEAD}:refs/heads/$BRANCH"
  echo "Done. Your GitHub repo is up to date."
  exit 0
fi

if [[ "$COMMITTED_ONLY" -eq 1 ]]; then
  echo "ERROR: Uncommitted local changes prevent a committed-only GitHub push." >&2
  git status --short --untracked-files=no >&2
  echo "The source bridge never stages or commits editor changes automatically." >&2
  exit 2
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
git push "$REPO_URL" "HEAD:refs/heads/$BRANCH"

echo ""
echo "Done! Changes pushed to github.com/davidwmcintosh/HolaHola"
