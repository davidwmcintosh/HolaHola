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

# Core project checks.
run_check "TypeScript typecheck" npm run check
run_check "Application test suite" npm test
run_check "Consolidated CI groups" bash server/scripts/test-all-consolidated-ci.sh

# Source-bridge and GitHub transport safety.
run_check "Source bridge safety" npm run test:source-bridge
run_check "GitHub release safety" npm run test:github-release-safety
run_check "GitHub sync shell guards" bash scripts/test-github-sync-guards.sh

# Checks intentionally kept outside consolidated-ci because they are
# independent growth-cap or workflow-boundary checks.
run_check "Replit attribution discipline" npx tsx server/scripts/test-replit-attribution-discipline.ts
run_check "Episode 28 gap audit self-check" npx tsx server/scripts/audit-episode-28-gaps.ts --self-check
run_check "Episode 28 startup shrinkage self-check" npx tsx server/scripts/restore-episode-28-from-db.ts --self-check
run_check "Capture status ordering" npx tsx server/scripts/test-capture-status-ordering.ts
run_check "Truth-pipeline unified recall diagnosis" npx tsx server/scripts/test-truth-pipeline-unified-recall-diagnosis.ts
run_check "Capture status stale escalation" npx tsx server/scripts/test-capture-status-stale-escalation.ts
run_check "Inner-life no-episode-row guard" npx tsx server/scripts/test-inner-life-no-episode-row.ts
run_check "GL reconnected client recovery" npx tsx server/scripts/test-gl-reconnected-client-recovery.ts
run_check "GL game-session detector" bash -c 'npx tsx server/scripts/test-gl-game-session-detector.ts && npx tsx server/scripts/test-gl-game-session-detector.ts --self-check'
run_check "Raw-window capture alignment" npx tsx server/scripts/test-raw-window-capture.ts --self-check

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