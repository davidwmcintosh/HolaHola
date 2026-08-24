#!/usr/bin/env bash
# Shared shallow-history guard for source bridge operations. The caller must
# provide REPO_URL and BRANCH, and pass the inspected local and GitHub heads.

SOURCE_BRIDGE_HISTORY_ERROR=""

source_bridge_is_shallow() {
  [[ "$(git rev-parse --is-shallow-repository 2>/dev/null || true)" == "true" ]]
}

ensure_source_bridge_ancestry() {
  local local_head="$1"
  local github_head="$2"
  local step="${SOURCE_BRIDGE_SHALLOW_DEEPEN_STEP:-50}"
  local maximum="${SOURCE_BRIDGE_SHALLOW_MAX_DEPTH:-500}"
  SOURCE_BRIDGE_HISTORY_ERROR=""

  if git merge-base "$local_head" "$github_head" >/dev/null 2>&1; then
    return 0
  fi
  if ! source_bridge_is_shallow; then
    return 0
  fi
  if ! [[ "$step" =~ ^[1-9][0-9]*$ && "$maximum" =~ ^[1-9][0-9]*$ ]]; then
    SOURCE_BRIDGE_HISTORY_ERROR="Invalid shallow-history bounds; both SOURCE_BRIDGE_SHALLOW_DEEPEN_STEP and SOURCE_BRIDGE_SHALLOW_MAX_DEPTH must be positive integers."
    return 1
  fi

  local deepened=0 amount
  while (( deepened < maximum )); do
    amount="$step"
    if (( deepened + amount > maximum )); then amount=$(( maximum - deepened )); fi
    echo "Source bridge: deepening partial history by ${amount} commits (blob-free) to verify ancestry..." >&2
    if ! git fetch --no-tags --filter=blob:none --deepen="$amount" "$REPO_URL" "$BRANCH"; then
      SOURCE_BRIDGE_HISTORY_ERROR="Blob-free shallow-history deepening failed; refusing a merge or push."
      return 1
    fi
    deepened=$(( deepened + amount ))
    if git merge-base "$local_head" "$github_head" >/dev/null 2>&1; then
      return 0
    fi
  done

  SOURCE_BRIDGE_HISTORY_ERROR="Common ancestry is unavailable within ${maximum} blob-free shallow commits; refusing a merge or push."
  return 2
}