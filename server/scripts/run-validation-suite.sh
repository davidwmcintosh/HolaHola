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
run_check "TypeScript typecheck" npm run typecheck
run_check "Provider-neutral release identity" npx tsx server/scripts/test-release-identity.ts
# Use the same command-by-command runner as GitHub CI so validation exercises
# the precise test execution path and identifies the failing command.
run_check "Application test suite" npm run test:ci

# Source-bridge and GitHub transport safety.
run_check "Source bridge safety" npm run test:source-bridge
run_check "Source reconciliation safety" npm run test:source-reconciliation
run_check "Agent-note coordination ingress" npx tsx --test server/scripts/test-agent-note-coordination-ingress.test.ts
run_check "GitHub release safety" npm run test:github-release-safety
run_check "GitHub sync shell guards" bash scripts/test-github-sync-guards.sh
run_check "GitHub main-branch bypass surface guard" bash -c 'npx tsx server/scripts/test-github-branch-bypass-guard.ts && npx tsx server/scripts/test-github-branch-bypass-guard.ts --self-check'
run_check "Cross-tool-promote push-auth guard" bash -c 'npx tsx server/scripts/test-cross-tool-promote-push-auth-guard.ts && npx tsx server/scripts/test-cross-tool-promote-push-auth-guard.ts --self-check'
run_check "Cross-tool-promote episode content-loss guard" bash -c 'npx tsx server/scripts/test-cross-tool-promote-content-loss-guard.ts && npx tsx server/scripts/test-cross-tool-promote-content-loss-guard.ts --self-check'
run_check "Agent skills cross-hat symlink guard" bash -c 'npx tsx server/scripts/test-agent-skills-symlink.ts && npx tsx server/scripts/test-agent-skills-symlink.ts --self-check'
run_check "Antigravity Windows DPAPI source boundary" npx tsx --test server/scripts/test-antigravity-windows-dpapi.test.ts
run_check "Coordinator V2 first-host bootstrap boundary" npx tsx --test server/scripts/test-coordination-v2-first-host-bootstrap.test.ts
run_check "Coordinator V2 lifecycle diagnostics cleanup fault fallback and evidence suites" npx tsx --test \
  server/scripts/test-coordination-lifecycle-facade.test.ts \
  server/scripts/test-coordination-windows-host.test.ts \
  server/scripts/test-coordination-v2-cli.test.ts \
  server/scripts/test-coordination-errors.test.ts \
  server/scripts/test-coordination-session-status.test.ts \
  server/scripts/test-coordination-cleanup.test.ts \
  server/scripts/test-coordination-v2-e2e.test.ts \
  server/scripts/test-coordination-v2-fault-injection.test.ts \
  server/scripts/test-coordination-v2-provider-fallback.test.ts \
  server/scripts/test-coordination-v2-evidence-integrity.test.ts \
  server/scripts/test-coordination-v2-host-completion-boundary.test.ts \
  server/scripts/test-coordination-v2-host-factory-route.test.ts \
  server/scripts/test-coordination-v2-dpapi-contract.test.ts \
  server/scripts/test-coordination-v2-authority-seams.test.ts \
  server/scripts/test-coordination-v2-public-material-digest.test.ts \
  server/scripts/test-coordination-v2-deferred-session.test.ts \
  server/scripts/test-coordinator-v2-schema.test.ts
run_check "Coordinator V2 PowerShell enrollment object contract" npx tsx --test server/scripts/test-coordination-v2-powershell-contract.test.ts
run_check "Coordinator V2 staged first-host enrollment contract" npx tsx --test server/scripts/test-coordination-v2-staged-enrollment-contract.test.ts
run_check "Coordinator V2 authenticated runtime bootstrap" npx tsx --test \
  server/services/coordination-v2-runtime-bootstrap-service.test.ts \
  server/scripts/test-coordination-v2-runtime-bootstrap-http.test.ts \
  server/scripts/test-coordination-v2-windows-runtime-bootstrap-static.test.ts
run_check "Coordinator V2 host credential reauthorization" npx tsx --test \
  server/services/coordination-v2-host-reauthorization-contract.test.ts \
  server/services/coordination-v2-host-reauthorization-validation.test.ts \
  server/scripts/test-coordination-v2-host-reauthorization-static.test.ts
run_check "Release cutover attestation service" npx tsx --test server/services/release-cutover-attestation-service.test.ts
run_check "Coordination runtime Gate3 claim/execute/complete/verify lifecycle" npx tsx --test server/scripts/test-coordination-runtime.test.ts
run_check "Coordination runtime envelope-violation-recovery self-check" npx tsx server/scripts/test-coordination-runtime-envelope-violation-selfcheck.ts
run_check "Coordination runtime standing-verifier self-check" npx tsx server/scripts/test-coordination-runtime-verifier-standing-selfcheck.ts
run_check "Coordination runtime live HTTP /verify route (standing verifier, no fabricated profile)" npx tsx --test server/scripts/test-coordination-runtime-http.test.ts
run_check "Coordination runtime Antigravity e2e (real Express Gate3 lifecycle)" npx tsx --test server/scripts/coordination-runtime-antigravity-e2e.test.ts

# Checks intentionally kept outside consolidated-ci because they are
# independent growth-cap or workflow-boundary checks.
run_check "Replit attribution discipline" npx tsx server/scripts/test-replit-attribution-discipline.ts
run_check "Episode 28 gap audit self-check" npx tsx server/scripts/audit-episode-28-gaps.ts --self-check
run_check "Episode 28 startup shrinkage self-check" npx tsx server/scripts/restore-episode-28-from-db.ts --self-check
run_check "Episode content-loss guard self-check (all docs/episode-*.md, direct commit or merge)" npx tsx server/scripts/check-episode-content-loss.ts --self-check
run_check "Episode dialogue-loss detector self-check" npx tsx server/scripts/detect-episode-dialogue-loss.ts --self-check
run_check "Episode dialogue-loss detector (live, recency-gated scan)" npx tsx server/scripts/detect-episode-dialogue-loss.ts
run_check "Capture status ordering" npx tsx server/scripts/test-capture-status-ordering.ts
run_check "Truth-pipeline unified recall diagnosis" npx tsx server/scripts/test-truth-pipeline-unified-recall-diagnosis.ts
run_check "Capture status stale escalation" npx tsx server/scripts/test-capture-status-stale-escalation.ts
run_check "Canonical Claude Code/Replit conversation capture" npx tsx server/scripts/test-canonical-conversation-capture.ts
run_check "Canonical capture worker readiness" npx tsx server/scripts/test-canonical-capture-worker-readiness.ts
run_check "Live canonical capture health route" npx tsx server/scripts/test-canonical-capture-health-route.ts
run_check "Chat capture episode mirror outbox" npx tsx server/scripts/test-chat-capture-episode-outbox.ts
run_check "Legacy watchdog source-identity repair fixtures" npx tsx --test server/scripts/repair-preincident-watchdog-source-identity.test.ts
run_check "Claude Code/Replit agent inbox lifecycle" npx tsx server/scripts/test-agent-notes-inbox.ts
run_check "Alden provider tool and consult-auth contract" npx tsx server/scripts/test-alden-provider-tool-projection.ts
run_check "Alden workspace-root portability guard" bash -c 'npx tsx server/scripts/test-alden-workspace-root-portability.ts && npx tsx server/scripts/test-alden-workspace-root-portability.ts --self-check'
run_check "Linked-outcome messaging architecture" npx tsx server/scripts/test-linked-outcome-static-guard.ts
run_check "Failed lookup felt-history boundary" npx tsx --test server/__tests__/daniela-memory-boundary.test.ts
run_check "Live exchange accounting lifecycle" npx tsx --test server/__tests__/voice-exchange-accounting.test.ts
run_check "Live voice provider routing" npx tsx --test server/__tests__/live-voice-routing.test.ts
run_check "Inner-life no-episode-row guard" npx tsx server/scripts/test-inner-life-no-episode-row.ts
run_check "Agent-memory round-trip gate isolation" npx tsx --test server/scripts/test-agent-memory-round-trip-gate-isolation.test.ts
run_check "GL reconnected client recovery" npx tsx server/scripts/test-gl-reconnected-client-recovery.ts
run_check "GL game-session detector" bash -c 'npx tsx server/scripts/test-gl-game-session-detector.ts && npx tsx server/scripts/test-gl-game-session-detector.ts --self-check'
run_check "Raw-window capture alignment" npx tsx server/scripts/test-raw-window-capture.ts --self-check
run_check "Memory-decay startup schema guard" bash -c 'npx tsx server/scripts/test-memory-decay-startup-schema-guard.ts && npx tsx server/scripts/test-memory-decay-startup-schema-guard.ts --self-check'
run_check "Application startup recovery" bash server/scripts/test-start-application-recovery.sh
run_check "Application startup recovery self-check" bash server/scripts/test-start-application-recovery.sh --self-check
run_check "Infra-mutation ownership guard (Cloudflare DNS, GitHub spec publish)" npx tsx --test server/scripts/test-infra-mutation-ownership-guard.test.ts
run_check "Source-mutation write guard (server/scripts writes stay out of client/src, server/, shared/)" npx tsx --test server/scripts/scan-source-mutation-writes.test.ts
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