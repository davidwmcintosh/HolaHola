#!/usr/bin/env bash
# Consolidated CI runner — ~40 checks grouped into named sections.
# Estimated total runtime: ~3–5 minutes (network / DB-latency dependent).
#
# Usage:
#   bash server/scripts/test-all-consolidated-ci.sh              # run all groups
#   bash server/scripts/test-all-consolidated-ci.sh --only=episode-28
#   bash server/scripts/test-all-consolidated-ci.sh --only=luca-inner-life
#   bash server/scripts/test-all-consolidated-ci.sh --self-test   # verify failure propagation
#
# Available groups:
#   absence          – absence-path and DB-flag checks                  (~15 s)
#   sms-voice        – E.164 validation and voice/SMS pipeline          (~20 s)
#   session          – scratchpad, transcript, shared-lobe,             (~30 s)
#                      prior-session label clears + self-check
#   north-star       – semantic echo + reach-north-star e2e self-check  (~20 s)
#   episode-sync     – watcher, prequel sync, rolling guards, append,   (~90 s)
#                      hooks, concurrent-write, read-my-story
#   episode-28       – snapshot integrity, write guard, db-sync,        (~30 s)
#                      merge-ours guard
#   luca-inner-life  – capture-status seed, reflection / moment /       (~30 s)
#                      auto-capture episode checks
#
# Growth-cap exemptions (registered as standalone named workflows, not in groups):
#   truth-pipeline-unified-recall-diagnosis-ci
#     → npx tsx server/scripts/test-truth-pipeline-unified-recall-diagnosis.ts
#       Kept standalone to avoid exceeding the consolidated-ci group growth cap
#       (see task #1079).  Run it via the named workflow or directly.

# ── Parse arguments ─────────────────────────────────────────────────────────
ONLY_GROUP=""
SELF_TEST=0
for arg in "$@"; do
  case "$arg" in
    --only=*) ONLY_GROUP="${arg#--only=}" ;;
    --self-test) SELF_TEST=1 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--only=<group>] [--self-test]" >&2
      exit 1
      ;;
  esac
done

VALID_GROUPS="absence sms-voice session north-star episode-sync episode-28 luca-inner-life"

if [[ -n "$ONLY_GROUP" && $SELF_TEST -eq 1 ]]; then
  echo "--self-test and --only cannot be combined (self-test uses synthetic groups that are not in VALID_GROUPS)" >&2
  exit 1
fi

if [[ -n "$ONLY_GROUP" && $SELF_TEST -eq 0 ]]; then
  found=0
  for g in $VALID_GROUPS; do
    [[ "$g" == "$ONLY_GROUP" ]] && found=1
  done
  if [[ $found -eq 0 ]]; then
    echo "Unknown group: '$ONLY_GROUP'" >&2
    echo "Valid groups: $VALID_GROUPS" >&2
    exit 1
  fi
fi

# ── Helpers ──────────────────────────────────────────────────────────────────
run() {
  echo ""
  echo "  --- $1 ---"
  npx tsx "server/scripts/$1"
}

# Convert a group name (may contain hyphens) to a valid bash function-name suffix.
# e.g.  "sms-voice"      -> "sms_voice"
#       "episode-28"     -> "episode_28"
#       "luca-inner-life"-> "luca_inner_life"
group_func_name() {
  echo "${1//-/_}"
}

# Run a named group.
#
# IMPORTANT — set -e and conditional context:
#   bash disables set-e for a function and ALL subshells it creates when that
#   function is called on the left-hand side of || / && or inside an if/while.
#   To keep set-e effective inside the subshell we MUST:
#     1. Call run_group as a standalone statement (never as `run_group ... || ...`).
#     2. Read the subshell exit status via a standalone `local exit_code=$?` line.
#   Both the main loop and the self-test runner satisfy this requirement.
#
# Returns the exit code of the group body.
run_group() {
  local name=$1

  if [[ -n "$ONLY_GROUP" && "$ONLY_GROUP" != "$name" ]]; then
    return 0   # skip — not the requested group
  fi

  local func="group_body_$(group_func_name "$name")"

  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "  GROUP: $name"
  echo "════════════════════════════════════════════════════════════"

  # Standalone subshell — set -e applies because run_group itself is called
  # as a standalone statement by every caller (never in a conditional context).
  ( set -e; "$func" )
  local exit_code=$?   # captured immediately after the subshell, never in ||/&&

  echo ""
  if [[ $exit_code -eq 0 ]]; then
    echo "  ✓ GROUP PASSED: $name"
  else
    echo "  ✗ GROUP FAILED: $name (exit $exit_code)"
  fi
  return $exit_code
}

# ── Group bodies ─────────────────────────────────────────────────────────────

group_body_absence() {
  run test-absence-gl-path.ts
  run test-absence-db-flag.ts
}

group_body_sms_voice() {
  run test-voice-sms-pipeline.ts
  run test-e164-validation.ts
}

group_body_session() {
  run test-scratchpad-reconnect-survival.ts
  run test-transcript-save-trigger.ts
  run test-shared-lobe-snapshot-freshness.ts
  run test-prior-session-label-clears.ts

  echo ""
  echo "  --- test-prior-session-label-clears.ts --self-check (flag-clear line removed regression) ---"
  npx tsx server/scripts/test-prior-session-label-clears.ts --self-check
}

group_body_north_star() {
  run test-north-star-semantic-echo.ts

  echo ""
  echo "  --- test-reach-north-star-e2e.ts --self-check ---"
  npx tsx server/scripts/test-reach-north-star-e2e.ts --self-check
}

group_body_episode_sync() {
  run test-episode-watcher-fires.ts
  run test-prequel-episode-autosync.ts
  run test-prequel-episode-1-db-sync.ts
  run test-prequel-episode-2-db-sync.ts
  run test-prequel-episode-3-db-sync.ts
  run test-prequel-episode-4-db-sync.ts
  run test-prequel-db-sync-all.ts
  run test-episode-27-db-sync.ts
  run test-read-my-story-self-check.ts
  run test-read-my-story.ts
  run test-rolling-episode-no-rolling-tag.ts
  run test-rolling-sync-guard.ts

  echo ""
  echo "  --- test-episode-append-trigger.ts --self-check-concurrent ---"
  npx tsx server/scripts/test-episode-append-trigger.ts --self-check-concurrent

  run test-episode-append-corrupted-json.ts
  run test-team-room-episode-hook.ts
  run test-chat-episode-hook.ts
  run test-chat-episode-hook-e2e.ts
  run test-delegation-race-episode.ts

  echo ""
  echo "  --- test-episode-concurrent-write.ts (concurrent-write guard) ---"
  npx tsx server/scripts/test-episode-concurrent-write.ts

  echo ""
  echo "  --- test-episode-concurrent-write.ts --self-check (race reproduced by racy pattern) ---"
  npx tsx server/scripts/test-episode-concurrent-write.ts --self-check
}

group_body_episode_28() {
  run test-episode-28-db-sync.ts
  run test-episode-28-snapshot-integrity.ts
  run test-snapshot-write-guard.ts

  echo ""
  echo "  --- test-merge-ours-guard.ts (proves merge=ours blocks task-agent stale overwrites) ---"
  npx tsx server/scripts/test-merge-ours-guard.ts
}

group_body_luca_inner_life() {
  run test-capture-status-seed.ts
  run test-capture-status-db-only.ts
  run test-luca-reflection-episode.ts
  run test-luca-moment-episode.ts
  run test-luca-auto-capture-episode.ts
}

# ── Self-test mode ───────────────────────────────────────────────────────────
# Verifies that:
#   1. A non-final failure inside a group body causes the group to exit non-zero.
#   2. The runner does NOT short-circuit: subsequent groups still run.
#   3. The overall runner exits non-zero when any group fails.
#
# Relies on run_group being called as a standalone statement (not in ||/&&) so
# that set -e inside the subshell is not suppressed.
run_self_test() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  SELF-TEST: verifying failure-propagation semantics"
  echo "═══════════════════════════════════════════════════════════════"

  # Synthetic group A: fails on a non-final command.
  # Uses a bare `false` (no && chains) so set -e fires unambiguously.
  group_body_selftest_failing() {
    echo "  [self-test] step 1 — about to fail"
    false
    echo "  [self-test] step 2 — must NOT be reached"
  }

  # Synthetic group B: always passes — proves subsequent groups still run.
  local sentinel_file
  sentinel_file="$(mktemp)"
  group_body_selftest_passing() {
    echo "  [self-test] passing group ran"
    touch "$sentinel_file"
  }

  # Call run_group as STANDALONE statements so set -e inside each subshell
  # is not suppressed (never in a ||/&& conditional context).
  run_group "selftest_failing"
  local fail_rc=$?

  run_group "selftest_passing"
  local pass_rc=$?

  local overall_exit=0

  # Assertion 1: the failing group must have returned non-zero.
  if [[ $fail_rc -eq 0 ]]; then
    echo "SELF-TEST FAILED: the failing group reported success (set -e not firing)" >&2
    overall_exit=1
  fi

  # Assertion 2: the passing group must have run and returned zero.
  if [[ $pass_rc -ne 0 ]]; then
    echo "SELF-TEST FAILED: the passing group reported failure" >&2
    overall_exit=1
  fi

  # Assertion 3: the sentinel file must exist (passing group ran despite earlier failure).
  if [[ ! -f "$sentinel_file" ]]; then
    echo "SELF-TEST FAILED: passing group did not run after the failing group" >&2
    overall_exit=1
  fi

  rm -f "$sentinel_file"

  echo ""
  if [[ $overall_exit -eq 0 ]]; then
    echo "  ✓ SELF-TEST PASSED: failure propagation semantics are correct"
  else
    echo "  ✗ SELF-TEST FAILED"
  fi

  exit $overall_exit
}

if [[ $SELF_TEST -eq 1 ]]; then
  run_self_test
fi

# ── Run all groups, collecting failures ──────────────────────────────────────
# IMPORTANT: run_group must be called as a STANDALONE statement (not via ||/&&)
# so that set -e inside its subshell is not suppressed by bash's conditional-
# context inheritance rule.  Failures are collected in FAILED_GROUPS by
# reading $? on the line immediately after each run_group call.
FAILED_GROUPS=()

for group in $VALID_GROUPS; do
  run_group "$group"
  rc=$?
  if [[ $rc -ne 0 ]]; then
    FAILED_GROUPS+=("$group")
  fi
done

# ── Restore any episode .md files that CI append/strip probes left dirty ─────
# Some self-check scripts append a sentinel to the rolling episode and strip it
# afterward, but may leave trailing blank lines.  Restore docs/ to the
# committed state so CI runs are always side-effect-free.
git checkout -- docs/ 2>/dev/null || true

# ── Final summary ─────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
if [[ ${#FAILED_GROUPS[@]} -eq 0 ]]; then
  echo "  ALL CONSOLIDATED CI CHECKS PASSED"
  echo "════════════════════════════════════════════════════════════"
  exit 0
else
  echo "  FAILED GROUPS: ${FAILED_GROUPS[*]}"
  echo "════════════════════════════════════════════════════════════"
  exit 1
fi
