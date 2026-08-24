#!/usr/bin/env bash
# check-user-openai-key-absent.sh
#
# CI guard: the historical workflow name is retained, but it now protects the
# actual deployment contract. Runtime OpenAI clients must use the owner's
# USER_OPENAI_API_KEY, never Replit's proxy credential or the old OPENAI_API_KEY.
#
# Usage:
#   bash server/scripts/check-user-openai-key-absent.sh
#   bash server/scripts/check-user-openai-key-absent.sh --self-check
#
# Exit code: 0 = guard passes, 1 = forbidden credential reference found.

set -euo pipefail

# Store forbidden strings split so this file does not match its own grep.
REPLIT_PROXY="AI""_INTEGRATIONS""_OPENAI""_API""_KEY"
LEGACY_KEY="OPENAI""_API""_KEY"

RUNTIME_SOURCES=(
  server/pronunciation-analysis.ts
  server/routes.ts
  server/services/semantic-memory-service.ts
  server/services/tts-service.ts
  server/services/image-engine-test.ts
)

# ── self-check mode ──────────────────────────────────────────────────────────
# Inject a synthetic reference into a temp file inside server/, run the main
# guard against it, and assert that the guard exits 1.
if [[ "${1:-}" == "--self-check" ]]; then
  echo "[self-check] Injecting synthetic ${REPLIT_PROXY} reference into a runtime source..."

  TMPFILE="$(mktemp server/services/.tmp-selfcheck-XXXXXX.ts)"
  trap 'rm -f "$TMPFILE"' EXIT

  # Write the forbidden string using a heredoc so this file itself stays clean.
  cat > "$TMPFILE" <<'SYNTHETIC'
// SYNTHETIC CI SELF-CHECK — DO NOT SHIP
const key = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
SYNTHETIC

  echo "[self-check] Running guard (expect exit 1)..."
  # Run this script without --self-check; capture exit code without -e stopping us.
  set +e
  bash "$0" 2>&1
  GUARD_EXIT=$?
  set -e

  if [[ $GUARD_EXIT -eq 1 ]]; then
    echo ""
    echo "[self-check] ✅  Guard correctly exited 1 when synthetic reference was present"
    exit 0
  else
    echo ""
    echo "[self-check] ❌  Guard exited $GUARD_EXIT (expected 1) — self-check FAILED"
    exit 1
  fi
fi

# ── main guard ───────────────────────────────────────────────────────────────
echo "Scanning runtime OpenAI sources for Replit proxy or legacy OpenAI credentials"

MATCHES=$(
  grep -rnE "${REPLIT_PROXY}|process\\.env\\.${LEGACY_KEY}" \
    "${RUNTIME_SOURCES[@]}" server/services/.tmp-selfcheck-*.ts \
    2>/dev/null || true
)

if [[ -n "$MATCHES" ]]; then
  echo ""
  echo "❌  Replit proxy or legacy OpenAI credential found in a runtime client:"
  echo ""
  echo "$MATCHES"
  echo ""
  echo "Use USER_OPENAI_API_KEY with https://api.openai.com/v1 instead."
  exit 1
else
  echo "✅  Runtime OpenAI clients use the owner-managed credential only."
  exit 0
fi
