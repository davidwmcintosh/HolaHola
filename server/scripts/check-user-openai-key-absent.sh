#!/usr/bin/env bash
# check-user-openai-key-absent.sh
#
# CI guard: greps server/ and scripts/ for any reference to the banned env var
# USER_OPENAI_API_KEY and exits 1 if any match is found.
#
# That split env-var pattern was removed; re-introducing it breaks deployments
# outside Replit.
#
# Usage:
#   bash server/scripts/check-user-openai-key-absent.sh
#   bash server/scripts/check-user-openai-key-absent.sh --self-check
#
# Exit code: 0 = guard passes (key absent), 1 = banned key found OR self-check fails

set -euo pipefail

# Store banned string split so this file does not match its own grep.
BANNED="USER""_OPENAI""_API""_KEY"

# Path to this script — excluded from the scan so the definition above
# does not trigger a false positive.
SELF="$(realpath "$0")"

# ── self-check mode ──────────────────────────────────────────────────────────
# Inject a synthetic reference into a temp file inside server/, run the main
# guard against it, and assert that the guard exits 1.
if [[ "${1:-}" == "--self-check" ]]; then
  echo "[self-check] Injecting synthetic ${BANNED} reference into a temp file..."

  TMPFILE="$(mktemp server/scripts/.tmp-selfcheck-XXXXXX.ts)"
  trap 'rm -f "$TMPFILE"' EXIT

  # Write the banned string using a heredoc so this file itself stays clean.
  cat > "$TMPFILE" <<'SYNTHETIC'
// SYNTHETIC CI SELF-CHECK — DO NOT SHIP
const key = process.env.USER_OPENAI_API_KEY;
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
echo "Scanning server/ and scripts/ for banned env var: ${BANNED}"

MATCHES=$(
  grep -rn "${BANNED}" \
    server/ scripts/ \
    --include="*.ts" \
    --include="*.js" \
    --include="*.sh" \
    --include="*.mts" \
    --include="*.mjs" \
    --include="*.cjs" \
    --exclude="$(basename "$SELF")" \
    2>/dev/null || true
)

if [[ -n "$MATCHES" ]]; then
  echo ""
  echo "❌  ${BANNED} found in source — this var was removed and must not return:"
  echo ""
  echo "$MATCHES"
  echo ""
  echo "Remove or replace all references above before merging."
  exit 1
else
  echo "✅  ${BANNED} is absent from server/ and scripts/ — guard passes."
  exit 0
fi
