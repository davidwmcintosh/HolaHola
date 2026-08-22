#!/usr/bin/env bash
# Safe, two-way source bridge for Replit main and owner GitHub main.
#
# Operational status is deliberately stored under .local/ (gitignored). This
# coordinator is the only unattended source-sync writer; it never stages,
# commits, resets, force-pushes, or creates merge commits.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=github-release-ssh.sh
source "$SCRIPT_DIR/github-release-ssh.sh"

BRANCH="${SOURCE_BRIDGE_BRANCH:-main}"
REPO_URL="${GITHUB_REPO_URL:?GITHUB_REPO_URL must be configured by github-release-ssh.sh}"
STATUS_FILE="${SOURCE_BRIDGE_STATUS_FILE:-.local/source-bridge-status.json}"
SUMMARY_FILE="${SOURCE_BRIDGE_SUMMARY_FILE:-.local/source-bridge-status.md}"
LOCK_FILE="${SOURCE_BRIDGE_LOCK_FILE:-.local/source-bridge.lock}"
RETRY_MAX="${SOURCE_BRIDGE_RETRY_MAX:-3}"
RETRY_DELAY_SECONDS="${SOURCE_BRIDGE_RETRY_DELAY_SECONDS:-10}"
POLL_SECONDS="${SOURCE_BRIDGE_POLL_SECONDS:-300}"
ORIGIN="${SOURCE_BRIDGE_ORIGIN:-manual}"

LOCAL_HEAD=""
GITHUB_HEAD=""
LAST_ERROR=""
LOCK_FD=""

usage() {
  cat <<'EOF'
Usage:
  scripts/source-bridge.sh once
  scripts/source-bridge.sh watch
  scripts/source-bridge.sh prepare-promotion
  scripts/source-bridge.sh record-promotion <exact-commit-sha>

The bridge coordinates committed source only. It writes status to .local and
never publishes a deployment; publish remains an explicit Replit action.
EOF
}

write_status() {
  local state="$1"
  local error="${2:-}"
  local candidate="${3:-}"
  local validation="${4:-}"
  local promoted="${5:-}"

  SOURCE_BRIDGE_STATUS_FILE="$STATUS_FILE" \
  SOURCE_BRIDGE_SUMMARY_FILE="$SUMMARY_FILE" \
  SOURCE_BRIDGE_STATE="$state" \
  SOURCE_BRIDGE_ERROR="$error" \
  SOURCE_BRIDGE_LOCAL_HEAD="$LOCAL_HEAD" \
  SOURCE_BRIDGE_GITHUB_HEAD="$GITHUB_HEAD" \
  SOURCE_BRIDGE_CANDIDATE="$candidate" \
  SOURCE_BRIDGE_VALIDATION="$validation" \
  SOURCE_BRIDGE_PROMOTED="$promoted" \
  SOURCE_BRIDGE_ORIGIN="$ORIGIN" \
  node --input-type=module <<'NODE'
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const statusFile = process.env.SOURCE_BRIDGE_STATUS_FILE;
const summaryFile = process.env.SOURCE_BRIDGE_SUMMARY_FILE;
const value = (key) => process.env[key] || undefined;
let validation;
try {
  validation = process.env.SOURCE_BRIDGE_VALIDATION
    ? JSON.parse(process.env.SOURCE_BRIDGE_VALIDATION)
    : undefined;
} catch {
  validation = { result: 'invalid-status-writer-input' };
}

const now = new Date().toISOString();
const status = {
  schemaVersion: 1,
  state: process.env.SOURCE_BRIDGE_STATE,
  origin: value('SOURCE_BRIDGE_ORIGIN'),
  replitSha: value('SOURCE_BRIDGE_LOCAL_HEAD'),
  githubSha: value('SOURCE_BRIDGE_GITHUB_HEAD'),
  candidateSha: value('SOURCE_BRIDGE_CANDIDATE'),
  validation,
  promotedSha: value('SOURCE_BRIDGE_PROMOTED'),
  error: value('SOURCE_BRIDGE_ERROR'),
  updatedAt: now,
  attemptAt: now,
};

for (const file of [statusFile, summaryFile]) mkdirSync(dirname(file), { recursive: true });
const statusTemp = `${statusFile}.${process.pid}.tmp`;
writeFileSync(statusTemp, `${JSON.stringify(status, null, 2)}\n`, { mode: 0o600 });
renameSync(statusTemp, statusFile);

const summary = [
  '# Source bridge status',
  '',
  `- Updated: ${now}`,
  `- State: **${status.state}**`,
  `- Replit main: ${status.replitSha || 'unknown'}`,
  `- GitHub main: ${status.githubSha || 'unknown'}`,
  `- Candidate: ${status.candidateSha || 'none'}`,
  `- Validation: ${validation ? JSON.stringify(validation) : 'not recorded'}`,
  `- Promoted commit: ${status.promotedSha || 'not recorded'}`,
  `- Error: ${status.error || 'none'}`,
  '',
  'This is local operational state. It does not publish production or change Git history.',
  '',
].join('\n');
const summaryTemp = `${summaryFile}.${process.pid}.tmp`;
writeFileSync(summaryTemp, summary, { mode: 0o600 });
renameSync(summaryTemp, summaryFile);
NODE
}

read_status_field() {
  local field="$1"
  SOURCE_BRIDGE_STATUS_FILE="$STATUS_FILE" SOURCE_BRIDGE_FIELD="$field" node --input-type=module <<'NODE'
import { existsSync, readFileSync } from 'node:fs';
const file = process.env.SOURCE_BRIDGE_STATUS_FILE;
if (!existsSync(file)) process.exit(0);
try {
  const value = JSON.parse(readFileSync(file, 'utf8'))[process.env.SOURCE_BRIDGE_FIELD];
  if (typeof value === 'string') process.stdout.write(value);
  else if (value && typeof value === 'object') process.stdout.write(JSON.stringify(value));
} catch {
  // A corrupt operational status must never become a source-control decision.
}
NODE
}

ensure_main_and_key() {
  if [[ -z "${HOLAHOLA_GITHUB_DEPLOY_KEY:-}" ]]; then
    LAST_ERROR="HOLAHOLA_GITHUB_DEPLOY_KEY is unavailable; source bridge cannot contact GitHub."
    return 1
  fi

  local branch
  branch="$(git branch --show-current)"
  if [[ "$branch" != "$BRANCH" ]]; then
    LAST_ERROR="Source bridge requires ${BRANCH}; current branch is ${branch:-detached HEAD}."
    return 1
  fi
}

acquire_lock() {
  mkdir -p -- "$(dirname -- "$LOCK_FILE")"
  # The advisory lock is tied to this open file descriptor. Unlike a
  # mkdir+PID lock, there is no observable creation window another bridge can
  # steal, and release cannot remove another process's lock.
  exec {LOCK_FD}>"$LOCK_FILE"
  if flock -n "$LOCK_FD"; then
    return 0
  fi
  exec {LOCK_FD}>&-
  LOCK_FD=""
  write_status "retrying" "Another source-bridge process holds the advisory lock."
  return 2
}

release_lock() {
  if [[ -n "$LOCK_FD" ]]; then
    flock -u "$LOCK_FD" || true
    exec {LOCK_FD}>&-
    LOCK_FD=""
  fi
}

with_lock() {
  local lock_result=0
  if acquire_lock; then
    :
  else
    lock_result=$?
    if [[ "$lock_result" -eq 2 ]]; then
      return 2
    fi
    return "$lock_result"
  fi

  local result=0
  "$@" || result=$?
  release_lock
  return "$result"
}

fetch_heads() {
  if ! prepare_github_ssh "$HOLAHOLA_GITHUB_DEPLOY_KEY"; then
    LAST_ERROR="Could not prepare the protected GitHub SSH transport."
    return 1
  fi
  trap cleanup_github_ssh RETURN

  if ! git fetch --no-tags "$REPO_URL" "$BRANCH"; then
    LAST_ERROR="GitHub fetch failed; the next bridge pass will retry."
    cleanup_github_ssh
    trap - RETURN
    return 1
  fi

  LOCAL_HEAD="$(git rev-parse --verify HEAD^{commit})"
  GITHUB_HEAD="$(git rev-parse --verify FETCH_HEAD^{commit})"
  cleanup_github_ssh
  trap - RETURN
}

worktree_is_clean() {
  [[ -z "$(git status --porcelain 2>/dev/null)" ]]
}

validate_candidate() {
  if [[ "${SOURCE_BRIDGE_SKIP_VALIDATION:-0}" == "1" ]]; then
    printf '%s' '{"typecheck":"skipped-for-test","githubReleaseSafety":"skipped-for-test","build":"skipped-for-test"}'
    return 0
  fi

  if ! npm run check; then
    LAST_ERROR="TypeScript validation failed for received GitHub source."
    return 1
  fi
  if ! npm run test:github-release-safety; then
    LAST_ERROR="GitHub release-safety validation failed for received GitHub source."
    return 1
  fi
  if ! npm run build; then
    LAST_ERROR="Production build validation failed for received GitHub source."
    return 1
  fi
  printf '%s' '{"typecheck":"passed","githubReleaseSafety":"passed","build":"passed"}'
}

verify_validated_candidate_is_current() {
  local candidate="$1"
  # Validation can take long enough for a Replit task merge/checkpoint to
  # advance the checkout. Never mark a candidate ready based on a stale
  # pre-validation snapshot: re-fetch and derive both heads again.
  if ! worktree_is_clean; then
    LAST_ERROR="Validated candidate became dirty before promotion readiness could be recorded."
    return 1
  fi
  fetch_heads || return 1
  if [[ "$LOCAL_HEAD" != "$candidate" || "$GITHUB_HEAD" != "$candidate" ]]; then
    LAST_ERROR="Validated candidate is no longer the current equal Replit/GitHub commit."
    return 1
  fi
}

bridge_pass() {
  ensure_main_and_key || return 1
  fetch_heads || return 1

  # Fetch occurs before this check so a dirty status still identifies both heads.
  if ! worktree_is_clean; then
    write_status "dirty" "Uncommitted files prevent automatic source synchronization."
    return 0
  fi

  if [[ "$LOCAL_HEAD" == "$GITHUB_HEAD" ]]; then
    local previous_state previous_candidate
    previous_state="$(read_status_field state)"
    previous_candidate="$(read_status_field candidateSha)"
    if [[ "$previous_state" == "ready_to_promote" && "$previous_candidate" == "$LOCAL_HEAD" ]]; then
      write_status "ready_to_promote" "Awaiting explicit Replit publish." "$LOCAL_HEAD" "$(read_status_field validation)"
    else
      write_status "synced" "" "$LOCAL_HEAD"
    fi
    return 0
  fi

  if git merge-base --is-ancestor "$GITHUB_HEAD" "$LOCAL_HEAD"; then
    write_status "replit_ahead" "Committed Replit source is pending a guarded GitHub push." "$LOCAL_HEAD"
    if ! "$SCRIPT_DIR/sync-to-github.sh" --committed-only --expected-head "$LOCAL_HEAD"; then
      LAST_ERROR="Guarded committed-only GitHub push failed; source remains intact."
      return 1
    fi
    fetch_heads || return 1
    if [[ "$LOCAL_HEAD" != "$GITHUB_HEAD" ]]; then
      LAST_ERROR="GitHub push returned without proving the exact Replit commit is present remotely."
      return 1
    fi
    write_status "synced" "" "$LOCAL_HEAD"
    return 0
  fi

  if git merge-base --is-ancestor "$LOCAL_HEAD" "$GITHUB_HEAD"; then
    write_status "github_ahead" "GitHub source is pending a clean fast-forward into Replit." "$GITHUB_HEAD"
    if ! "$SCRIPT_DIR/sync-from-github.sh" \
      --expected-local-head "$LOCAL_HEAD" \
      --expected-github-head "$GITHUB_HEAD"; then
      LAST_ERROR="Guarded GitHub fast-forward failed; source remains intact."
      return 1
    fi
    LOCAL_HEAD="$(git rev-parse --verify HEAD^{commit})"
    if [[ "$LOCAL_HEAD" != "$GITHUB_HEAD" ]]; then
      LAST_ERROR="Fast-forward returned without landing the fetched GitHub commit."
      return 1
    fi
    local validation
    validation="$(validate_candidate)" || return 1
    verify_validated_candidate_is_current "$LOCAL_HEAD" || return 1
    write_status "ready_to_promote" "Received GitHub source passed validation; publish remains explicit." "$LOCAL_HEAD" "$validation"
    return 0
  fi

  write_status "diverged" "Replit and GitHub histories diverged; explicit reconciliation is required."
  return 0
}

run_with_retries() {
  local attempt=1
  while (( attempt <= RETRY_MAX )); do
    LAST_ERROR=""
    if with_lock bridge_pass; then
      return 0
    else
      local result=$?
      if [[ "$result" -eq 2 ]]; then
        return 0
      fi
    fi
    if (( attempt == RETRY_MAX )); then
      write_status "failed" "${LAST_ERROR:-Source bridge failed after ${RETRY_MAX} attempts. Run scripts/source-bridge.sh once after resolving the error.}"
      return 1
    fi
    write_status "retrying" "${LAST_ERROR:-Source bridge attempt ${attempt} failed; retrying.}"
    sleep "$RETRY_DELAY_SECONDS"
    attempt=$((attempt + 1))
  done
}

prepare_promotion() {
  ensure_main_and_key || return 1
  fetch_heads || return 1
  if ! worktree_is_clean; then
    write_status "dirty" "Promotion preparation refused because the worktree is dirty."
    return 1
  fi
  if [[ "$LOCAL_HEAD" != "$GITHUB_HEAD" ]]; then
    write_status "failed" "Promotion preparation requires exact Replit/GitHub commit equality."
    return 1
  fi
  local validation
  validation="$(validate_candidate)" || return 1
  verify_validated_candidate_is_current "$LOCAL_HEAD" || return 1
  write_status "ready_to_promote" "Validation passed. Use Replit Publish explicitly; this command does not deploy." "$LOCAL_HEAD" "$validation"
}

record_promotion() {
  local promoted_sha="${1:-}"
  if [[ -z "$promoted_sha" ]]; then
    echo "ERROR: record-promotion requires the exact published commit SHA." >&2
    return 1
  fi
  ensure_main_and_key || return 1
  fetch_heads || return 1
  if ! worktree_is_clean; then
    write_status "dirty" "Promotion recording refused because the worktree is dirty."
    return 1
  fi

  local status_state candidate
  status_state="$(read_status_field state)"
  candidate="$(read_status_field candidateSha)"
  if [[ "$status_state" != "ready_to_promote" || "$candidate" != "$promoted_sha" || "$LOCAL_HEAD" != "$promoted_sha" || "$GITHUB_HEAD" != "$promoted_sha" ]]; then
    write_status "failed" "Promotion recording refused: the matching validated candidate is no longer the current equal Replit/GitHub commit."
    return 1
  fi
  write_status "synced" "Explicit Replit publish recorded for the current validated candidate." "$candidate" "$(read_status_field validation)" "$candidate"
}

main() {
  local command="${1:-}"
  case "$command" in
    once)
      run_with_retries
      ;;
    watch)
      while true; do
        run_with_retries || true
        sleep "$POLL_SECONDS"
      done
      ;;
    prepare-promotion)
      with_lock prepare_promotion
      ;;
    record-promotion)
      shift
      with_lock record_promotion "$@"
      ;;
    *)
      usage >&2
      exit 64
      ;;
  esac
}

main "$@"