#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT

KEY_PATH="$TEMP_DIR/test-deploy-key"
ssh-keygen -q -t ed25519 -N "" -f "$KEY_PATH"
# Match Replit's observed one-line secret representation. The helper must
# reconstruct it before OpenSSH can read it.
export HOLAHOLA_GITHUB_DEPLOY_KEY
HOLAHOLA_GITHUB_DEPLOY_KEY="$(tr -d '\n' < "$KEY_PATH")"

make_fake_git() {
  local fixture_dir="$1"
  cat > "$fixture_dir/git" <<'SH'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "${GIT_CALL_LOG:?}"

case "${1:-}" in
  branch)
    if [[ "${2:-}" == "--show-current" ]]; then
      printf '%s\n' main
      exit 0
    fi
    echo "Unexpected git branch command: $*" >&2
    exit 98
    ;;
  symbolic-ref)
    printf '%s\n' main
    ;;
  fetch)
    exit 0
    ;;
  rev-parse)
    revision="${!#}"
    if [[ "$revision" == HEAD* ]]; then
      printf '%s\n' local
    else
      printf '%s\n' remote
    fi
    ;;
  merge-base)
    case "${GIT_TEST_CASE:?}:${3:-}:${4:-}" in
      github-ahead:local:remote)
        exit 0
        ;;
      local-ahead:remote:local)
        exit 0
        ;;
    esac
    exit 1
    ;;
  status)
    if [[ "${GIT_TEST_CASE:?}" == "pull-dirty" ]]; then
      printf ' M uncommitted-change\n'
    fi
    ;;
  add|commit|push|merge)
    echo "Unexpected mutating git command: $*" >&2
    exit 99
    ;;
  *)
    echo "Unexpected git command: $*" >&2
    exit 98
    ;;
esac
SH
  chmod +x "$fixture_dir/git"
}

run_push_refusal_case() {
  local case_name="$1"
  local expected_message="$2"
  local fixture_dir="$TEMP_DIR/$case_name"
  mkdir -p "$fixture_dir"
  make_fake_git "$fixture_dir"

  local output
  local status=0
  output="$(
    GIT_CALL_LOG="$fixture_dir/calls" \
      GIT_TEST_CASE="$case_name" \
      PATH="$fixture_dir:$PATH" \
      bash "$ROOT_DIR/scripts/sync-to-github.sh" "test guard" 2>&1
  )" || status=$?

  [[ "$status" -eq 1 ]]
  grep -Fq "$expected_message" <<<"$output"
  ! grep -Eq '^(add|commit|push)' "$fixture_dir/calls"
}

run_pull_dirty_case() {
  local fixture_dir="$TEMP_DIR/pull-dirty"
  mkdir -p "$fixture_dir"
  make_fake_git "$fixture_dir"

  local output
  local status=0
  output="$(
    GIT_CALL_LOG="$fixture_dir/calls" \
      GIT_TEST_CASE="pull-dirty" \
      PATH="$fixture_dir:$PATH" \
      bash "$ROOT_DIR/scripts/sync-from-github.sh" 2>&1
  )" || status=$?

  [[ "$status" -eq 1 ]]
  grep -Fq "Uncommitted local changes prevent a safe GitHub release pull" <<<"$output"
  ! grep -Eq '^(fetch|merge)' "$fixture_dir/calls"
}

if rg -n 'GITHUB_TOKEN|https://[^[:space:]]+@github\.com' \
  "$ROOT_DIR/scripts/github-ssh-env.sh" \
  "$ROOT_DIR/scripts/sync-to-github.sh" \
  "$ROOT_DIR/scripts/sync-from-github.sh"; then
  echo "Legacy token-bearing GitHub transport remains in a guarded sync script." >&2
  exit 1
fi

run_push_refusal_case "github-ahead" "GitHub is ahead of Replit"
run_push_refusal_case "diverged" "Replit and GitHub have diverged"
run_pull_dirty_case

echo "PASS: GitHub sync guards reject unsafe history and dirty pull states."