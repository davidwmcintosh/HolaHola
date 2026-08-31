#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

assert_retired() {
  local script="$1"
  local output status=0
  output="$(bash "$script" 2>&1)" || status=$?
  if [[ "$status" -ne 78 ]]; then
    echo "FAIL: $(basename "$script") must fail closed with exit 78 (got $status)." >&2
    echo "$output" >&2
    exit 1
  fi
  if [[ "$output" != *"coordinator"* ]]; then
    echo "FAIL: $(basename "$script") must direct callers to the coordinator." >&2
    echo "$output" >&2
    exit 1
  fi
}

assert_retired "$ROOT_DIR/scripts/sync-to-github.sh"
assert_retired "$ROOT_DIR/scripts/sync-from-github.sh"

if rg -n '\bgit[[:space:]]+(fetch|merge|push|add|commit|reset)\b|--force' \
  "$ROOT_DIR/scripts/sync-to-github.sh" \
  "$ROOT_DIR/scripts/sync-from-github.sh" \
  "$ROOT_DIR/scripts/source-bridge.sh" \
  "$ROOT_DIR/scripts/source-bridge-history.sh" \
  "$ROOT_DIR/scripts/source-bridge-supervisor.sh"; then
  echo "FAIL: retired compatibility scripts still contain a Git mutation." >&2
  exit 1
fi

echo "GitHub sync compatibility guards passed."