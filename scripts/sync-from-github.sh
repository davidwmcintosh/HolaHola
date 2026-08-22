#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=github-release-ssh.sh
source "$SCRIPT_DIR/github-release-ssh.sh"

BRANCH="main"
REPO_URL="$GITHUB_REPO_URL"
EXPECTED_LOCAL_HEAD=""
EXPECTED_GITHUB_HEAD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expected-local-head)
      EXPECTED_LOCAL_HEAD="${2:-}"
      [[ -n "$EXPECTED_LOCAL_HEAD" ]] || { echo "ERROR: --expected-local-head requires a commit SHA." >&2; exit 64; }
      shift 2
      ;;
    --expected-github-head)
      EXPECTED_GITHUB_HEAD="${2:-}"
      [[ -n "$EXPECTED_GITHUB_HEAD" ]] || { echo "ERROR: --expected-github-head requires a commit SHA." >&2; exit 64; }
      shift 2
      ;;
    *)
      echo "ERROR: Unknown sync-from-github option: $1" >&2
      exit 64
      ;;
  esac
done

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

if [[ -n "$EXPECTED_LOCAL_HEAD" && "$LOCAL_HEAD" != "$EXPECTED_LOCAL_HEAD" ]]; then
  echo "ERROR: Replit HEAD changed from the bridge's inspected commit. Refusing to fast-forward a moving checkout." >&2
  exit 1
fi
if [[ -n "$EXPECTED_GITHUB_HEAD" && "$GITHUB_HEAD" != "$EXPECTED_GITHUB_HEAD" ]]; then
  echo "ERROR: GitHub HEAD changed from the bridge's inspected commit. Refusing to receive a different commit." >&2
  exit 1
fi

if [[ "$LOCAL_HEAD" == "$GITHUB_HEAD" ]]; then
  echo "Replit is already up to date."
elif git merge-base --is-ancestor "$LOCAL_HEAD" "$GITHUB_HEAD"; then
  # Only fast-forward. Never create a merge commit or discard local commits.
  if [[ -n "$EXPECTED_LOCAL_HEAD" && "$(git rev-parse --verify HEAD^{commit})" != "$EXPECTED_LOCAL_HEAD" ]]; then
    echo "ERROR: Replit HEAD changed before fast-forward. Refusing to merge a moving checkout." >&2
    exit 1
  fi
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
