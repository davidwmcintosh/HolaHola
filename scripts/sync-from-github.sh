#!/bin/bash

REPO_URL="https://davidwmcintosh:${GITHUB_TOKEN}@github.com/davidwmcintosh/HolaHola.git"
BRANCH="main"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN secret is not set. Add it in Replit Secrets."
  exit 1
fi

echo "--- HolaHola: Sync from GitHub ---"

CHANGES=$(git status --porcelain 2>/dev/null)
if [ -n "$CHANGES" ]; then
  echo "WARNING: You have uncommitted local changes:"
  git status --short
  echo ""
  echo "These changes may conflict with incoming updates."
  read -p "Continue anyway? (y/N) " CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Aborted. Commit or stash your changes first, then run this script again."
    exit 1
  fi
fi

echo "Pulling latest changes from GitHub (branch: ${BRANCH})..."
git pull "$REPO_URL" "$BRANCH" 2>&1 | sed "s/${GITHUB_TOKEN}/****/g"

echo ""
echo "Done! Replit is now up to date with github.com/davidwmcintosh/HolaHola"
