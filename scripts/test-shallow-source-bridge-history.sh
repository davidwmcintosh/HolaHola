#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf -- "$TEMP_DIR"' EXIT

cat > "$TEMP_DIR/git" <<'SH'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "${GIT_CALL_LOG:?}"
case "${1:-}" in
  rev-parse)
    [[ "${2:-}" == "--is-shallow-repository" ]] && { echo true; exit 0; }
    ;;
  merge-base)
    count="$(cat "${GIT_MERGE_BASE_COUNT:?}")"
    if [[ "$count" -ge "${GIT_MERGE_BASE_SUCCEEDS_AFTER:?}" ]]; then exit 0; fi
    echo $((count + 1)) > "$GIT_MERGE_BASE_COUNT"
    exit 1
    ;;
  fetch)
    exit 0
    ;;
esac
exit 98
SH
chmod +x "$TEMP_DIR/git"

run_case() {
  local succeeds_after="$1"
  local maximum="$2"
  local expected_result="$3"
  local calls="$TEMP_DIR/calls-$expected_result"
  local counter="$TEMP_DIR/counter-$expected_result"
  printf '0\n' > "$counter"
  set +e
  PATH="$TEMP_DIR:$PATH" \
  GIT_CALL_LOG="$calls" \
  GIT_MERGE_BASE_COUNT="$counter" \
  GIT_MERGE_BASE_SUCCEEDS_AFTER="$succeeds_after" \
  REPO_URL="ssh://example.invalid/HolaHola.git" \
  BRANCH="main" \
  SOURCE_BRIDGE_SHALLOW_DEEPEN_STEP=5 \
  SOURCE_BRIDGE_SHALLOW_MAX_DEPTH="$maximum" \
  bash -c 'source "$1/scripts/source-bridge-history.sh"; ensure_source_bridge_ancestry local remote; exit $?' bash "$ROOT_DIR"
  local result=$?
  set -e
  [[ "$result" -eq "$expected_result" ]]
  grep -Fq 'fetch --no-tags --filter=blob:none --deepen=5 ssh://example.invalid/HolaHola.git main' "$calls"
  ! grep -Eq -- '--unshallow|--depth(=| )0' "$calls"
}

run_case 2 20 0
run_case 999 10 2

echo "PASS: shallow source-bridge history guard deepens only with blob:none and fails closed at its limit."