#!/usr/bin/env bash
# Start the development application without ever competing for its port.
#
# Project starts this command through the Start application child workflow, but
# that child can also be started directly. The lock closes the startup race
# between those two paths; the port check also recognizes servers started by an
# older command that did not take this lock.
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-5000}"
LOCK_FILE="${START_APPLICATION_LOCK_FILE:-.local/start-application.lock}"

mkdir -p -- "$(dirname -- "$LOCK_FILE")"

port_is_listening() {
  # lsof is available in the Replit runtime and gives the most reliable
  # listener check. Keep a bash-only fallback for environments where it is not
  # installed.
  if command -v lsof >/dev/null 2>&1 &&
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    return 0
  fi
  (exec 3<>"/dev/tcp/127.0.0.1/$PORT") >/dev/null 2>&1
}

wait_for_existing_server() {
  echo "[start-application] reusing the existing server on port ${PORT}; this workflow will not start another one."
  while port_is_listening; do
    sleep 5
  done
  echo "[start-application] existing server on port ${PORT} stopped; ending the reused workflow."
}

exec 9>"$LOCK_FILE"

# A second launcher may arrive while the first is still running migrations
# before it binds the port. Wait for either the first server to become visible
# or the lock to be released by a failed startup. In the latter case this
# invocation safely becomes the one that starts the server.
if ! flock -n 9; then
  echo "[start-application] another startup owns ${LOCK_FILE}; waiting for it to bind port ${PORT}."
  while true; do
    if port_is_listening; then
      wait_for_existing_server
      exit 0
    fi
    if flock -n 9; then
      break
    fi
    sleep 1
  done
fi

# This covers a server started directly before the singleton launcher was
# introduced, as well as a server whose startup lock is not shared with us.
if port_is_listening; then
  wait_for_existing_server
  exit 0
fi

git config merge.ours.driver true ||
  echo '[merge.ours] WARNING: git config failed — merge=ours will not protect rolling episodes' >&2

npx tsx server/scripts/restore-rolling-episodes-from-db.ts --check-shrinkage ||
  echo '[rolling-restore] WARNING: shrinkage check failed — continuing' >&2

# Keep the lock descriptor open in the server process so another launcher
# cannot race this one after the port check.
exec npm run dev