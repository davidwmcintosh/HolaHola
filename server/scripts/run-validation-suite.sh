#!/usr/bin/env bash
#
# Single validation entry point for the Project workflow.
#
# The individual checks remain directly runnable, but are no longer registered
# as separate Replit workflows. Keep running after a failure so one suite run
# reports the complete health picture.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

FAILED=()

run_check() {
  local label="$1"
  shift

  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "  CHECK: ${label}"
  echo "════════════════════════════════════════════════════════════"

  "$@"
  local rc=$?
  if [[ $rc -eq 0 ]]; then
    echo "  ✓ PASSED: ${label}"
  else
    echo "  ✗ FAILED: ${label} (exit ${rc})" >&2
    FAILED+=("${label}")
  fi
}

# Fast project checks. Full consolidated CI is intentionally a separate named
# validation workflow so neither command can exceed Replit's validation timeout.
run_check "TypeScript typecheck" npm run check
run_check "Application test suite" npm test

# Source-bridge and GitHub transport safety.
run_check "Source bridge safety" npm run test:source-bridge
run_check "GitHub release safety" npm run test:github-release-safety
run_check "GitHub sync shell guards" bash scripts/test-github-sync-guards.sh

echo ""
echo "════════════════════════════════════════════════════════════"
if [[ ${#FAILED[@]} -eq 0 ]]; then
  echo "  ALL VALIDATION SUITE CHECKS PASSED"
  echo "════════════════════════════════════════════════════════════"
  exit 0
fi

echo "  FAILED CHECKS: ${FAILED[*]}" >&2
echo "════════════════════════════════════════════════════════════" >&2
exit 1