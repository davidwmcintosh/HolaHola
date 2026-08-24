#!/usr/bin/env bash
# Keep the source bridge alive and make failures visible.
#
# This supervises the bridge process, not Git itself. The bridge remains the
# only process allowed to coordinate source, and its fail-closed rules remain
# authoritative.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CHILD_SCRIPT="${SOURCE_BRIDGE_CHILD_SCRIPT:-$SCRIPT_DIR/source-bridge.sh}"
STATUS_FILE="${SOURCE_BRIDGE_STATUS_FILE:-.local/source-bridge-status.json}"
HEARTBEAT_FILE="${SOURCE_BRIDGE_HEARTBEAT_FILE:-.local/source-bridge-heartbeat}"
ALERT_FILE="${SOURCE_BRIDGE_ALERT_FILE:-.local/source-bridge-alert.md}"
HEARTBEAT_SECONDS="${SOURCE_BRIDGE_HEARTBEAT_SECONDS:-15}"
RESTART_BACKOFF_SECONDS="${SOURCE_BRIDGE_RESTART_BACKOFF_SECONDS:-5}"
MAX_RESTART_BACKOFF_SECONDS="${SOURCE_BRIDGE_MAX_RESTART_BACKOFF_SECONDS:-300}"

child_pid=""
stopping=0

mkdir -p -- "$(dirname -- "$HEARTBEAT_FILE")" "$(dirname -- "$ALERT_FILE")"

write_heartbeat() {
  local temp="${HEARTBEAT_FILE}.${BASHPID}.tmp"
  date -u +%Y-%m-%dT%H:%M:%S.%3NZ > "$temp"
  mv -f -- "$temp" "$HEARTBEAT_FILE"
}

status_state() {
  if [[ ! -f "$STATUS_FILE" ]]; then
    printf '%s' "unknown"
    return
  fi
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    try { process.stdout.write(String(JSON.parse(readFileSync(process.env.STATUS_FILE, "utf8")).state || "unknown")); }
    catch { process.stdout.write("unknown"); }
  ' 2>/dev/null || printf '%s' "unknown"
}

write_alert() {
  local reason="$1"
  local state
  state="$(status_state)"
  local temp="${ALERT_FILE}.${BASHPID}.tmp"
  {
    printf '# Source bridge alert\n\n'
    printf -- '- Detected: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
    printf -- '- State: **%s**\n' "$state"
    printf -- '- Reason: %s\n' "$reason"
    printf '\nThe supervisor is still running and will clear this alert only after a verified sync.\n'
  } > "$temp"
  mv -f -- "$temp" "$ALERT_FILE"
}

clear_alert() {
  rm -f -- "$ALERT_FILE"
}

monitor_child() {
  while kill -0 "$child_pid" 2>/dev/null; do
    write_heartbeat
    export STATUS_FILE
    case "$(status_state)" in
      failed|diverged|dirty|github_ahead)
        write_alert "Bridge requires attention; inspect the status and workflow logs."
        ;;
      synced)
        clear_alert
        ;;
    esac
    sleep "$HEARTBEAT_SECONDS"
  done
}

stop_children() {
  stopping=1
  if [[ -n "$child_pid" ]] && kill -0 "$child_pid" 2>/dev/null; then
    kill "$child_pid" 2>/dev/null || true
    wait "$child_pid" 2>/dev/null || true
  fi
}
trap stop_children INT TERM

while true; do
  write_heartbeat
  echo "[SourceBridgeSupervisor] Starting bridge child."
  "$CHILD_SCRIPT" watch &
  child_pid=$!
  monitor_child

  set +e
  wait "$child_pid"
  child_exit=$?
  set -e
  child_pid=""

  if (( stopping )); then
    exit 0
  fi

  write_alert "Bridge child exited unexpectedly with status ${child_exit}; restarting with backoff."
  echo "[SourceBridgeSupervisor] Bridge child exited (${child_exit}); restarting in ${RESTART_BACKOFF_SECONDS}s."
  sleep "$RESTART_BACKOFF_SECONDS"
  RESTART_BACKOFF_SECONDS=$(( RESTART_BACKOFF_SECONDS < MAX_RESTART_BACKOFF_SECONDS
    ? RESTART_BACKOFF_SECONDS * 2
    : MAX_RESTART_BACKOFF_SECONDS ))
done