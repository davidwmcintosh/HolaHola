#!/usr/bin/env bash
# Consolidated CI runner — executes every individual test script in sequence.
# Exits non-zero on the first failure (set -e) so the workflow status reflects
# any regression clearly.
set -e

run() {
  echo ""
  echo "=== $1 ==="
  npx tsx "server/scripts/$1"
}

run test-absence-gl-path.ts
run test-voice-sms-pipeline.ts
run test-e164-validation.ts
run test-absence-db-flag.ts
run test-scratchpad-reconnect-survival.ts
run test-transcript-save-trigger.ts
run test-shared-lobe-snapshot-freshness.ts
run test-north-star-semantic-echo.ts
run test-episode-watcher-fires.ts
run test-prequel-episode-autosync.ts
run test-prequel-episode-1-db-sync.ts
run test-prequel-episode-2-db-sync.ts
run test-prequel-episode-3-db-sync.ts
run test-prequel-episode-4-db-sync.ts
run test-read-my-story-self-check.ts
run test-rolling-episode-no-rolling-tag.ts

echo ""
echo "=== test-episode-append-trigger.ts --self-check-concurrent ==="
npx tsx server/scripts/test-episode-append-trigger.ts --self-check-concurrent

run test-episode-append-corrupted-json.ts

echo ""
echo "=== ALL CONSOLIDATED CI CHECKS PASSED ==="
