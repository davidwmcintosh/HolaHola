#!/bin/bash
set -e

REPO_URL="https://davidwmcintosh:${GITHUB_TOKEN}@github.com/davidwmcintosh/HolaHola.git"
BRANCH="main"
LOCK_FILE=".git/index.lock"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN secret is not set. Add it in Replit Secrets."
  exit 1
fi

echo "--- HolaHola: Sync to GitHub ---"

# Wait for any in-progress git operation (checkpoint commit) to finish
if [ -f "$LOCK_FILE" ]; then
  echo "Git lock file detected — waiting for it to clear..."
  WAIT=0
  while [ -f "$LOCK_FILE" ] && [ $WAIT -lt 30 ]; do
    sleep 2
    WAIT=$((WAIT + 2))
    echo "  still waiting... (${WAIT}s)"
  done
  if [ -f "$LOCK_FILE" ]; then
    echo "Lock file still present after 30s. Remove it manually with:"
    echo "  rm $LOCK_FILE"
    echo "Then re-run this script."
    exit 1
  fi
  echo "Lock cleared. Proceeding."
fi

CHANGES=$(git status --porcelain 2>/dev/null)
if [ -z "$CHANGES" ]; then
  echo "Nothing to commit — working tree is clean."
  echo "Pushing any unpushed commits..."
  git push "$REPO_URL" "$BRANCH" 2>&1 | sed "s/${GITHUB_TOKEN}/****/g"
  echo "Done. Your GitHub repo is up to date."
  exit 0
fi

echo "Changes to be committed:"
git status --short

git add -A

if [ -n "$1" ]; then
  COMMIT_MSG="$1"
else
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
  COMMIT_MSG="Sync from Replit - ${TIMESTAMP}"
fi

git commit -m "$COMMIT_MSG" 2>&1

echo "Pushing to GitHub (branch: ${BRANCH})..."
git push "$REPO_URL" "$BRANCH" 2>&1 | sed "s/${GITHUB_TOKEN}/****/g"

echo ""
echo "Done! Changes pushed to github.com/davidwmcintosh/HolaHola"
