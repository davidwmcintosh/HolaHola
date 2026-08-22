#!/usr/bin/env bash
#
# Preserve the original Replit ↔ GitHub reconciliation evidence outside the
# workspace. The durable artifact is a portable Git bundle plus a manifest in
# the configured S3-compatible private object store; this script never pushes,
# resets, merges into, or otherwise changes GitHub main.
#
# Usage:
#   bash scripts/archive-reconciliation-history.sh
#   bash scripts/archive-reconciliation-history.sh --verify

set -Eeuo pipefail

ARCHIVE_ID="reconciliation-2026-08-21"
ARCHIVE_PREFIX="${RECONCILIATION_ARCHIVE_PREFIX:-history-archives/${ARCHIVE_ID}}"
VERIFY_ONLY=false

case "${1:-}" in
  "")
    ;;
  --verify)
    VERIFY_ONLY=true
    ;;
  *)
    echo "Usage: bash scripts/archive-reconciliation-history.sh [--verify]" >&2
    exit 2
    ;;
esac

SOURCE_REFS=(
  "refs/tags/reconciliation/replit-main-2026-08-21"
  "refs/tags/reconciliation/github-main-2026-08-21"
  "refs/heads/backup/replit-main-before-github-reconciliation"
  "refs/heads/backup/github-main-before-reconciliation"
  "refs/heads/backup/github-main-live-before-lfs-reconcile"
  "refs/heads/reconcile/github-main-with-replit-main"
  "refs/heads/reconcile/github-main-with-replit-main-lfs"
  "refs/heads/reconcile/github-main-with-replit-main-lfs-release"
  "refs/heads/reconcile/github-main-live-lfs-release"
  "refs/heads/reconcile/replit-main-lfs-lineage"
)

# Each tip preserves a reconciliation lineage. Its nearest merge is recorded
# separately in the durable manifest, so recovery does not depend on traversing
# descendants to identify the two-parent evidence commit.
MERGE_TIP_REFS=(
  "refs/heads/reconcile/github-main-with-replit-main"
  "refs/heads/reconcile/github-main-with-replit-main-lfs"
  "refs/heads/reconcile/github-main-with-replit-main-lfs-release"
  "refs/heads/reconcile/github-main-live-lfs-release"
)

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_local_ref() {
  local ref="$1"
  git rev-parse --verify --quiet "${ref}^{commit}" >/dev/null ||
    die "required local ref is missing or is not a commit: ${ref}"
}

merge_oid_for_tip() {
  local tip_ref="$1"
  local merge_oid parent_count
  merge_oid="$(git rev-list --merges --max-count=1 "$tip_ref")"
  [[ -n "$merge_oid" ]] ||
    die "no two-parent reconciliation merge is reachable from ${tip_ref}"
  parent_count="$(git show -s --format='%P' "$merge_oid" | wc -w | tr -d ' ')"
  [[ "$parent_count" == "2" ]] ||
    die "expected two parents for ${merge_oid} from ${tip_ref}, found ${parent_count}"
  printf '%s\n' "$merge_oid"
}

verify_downloaded_archive() {
  local download_dir="$1"
  local bundle_path="${download_dir}/${ARCHIVE_ID}.bundle"
  local manifest_path="${download_dir}/manifest.txt"
  local expected_bundle_sha actual_bundle_sha

  [[ -f "$bundle_path" ]] || die "downloaded archive bundle is missing"
  [[ -f "$manifest_path" ]] || die "downloaded archive manifest is missing"

  expected_bundle_sha="$(awk -F= '$1 == "bundle_sha256" { print $2; exit }' "$manifest_path")"
  [[ -n "$expected_bundle_sha" ]] || die "archive manifest has no bundle_sha256"
  actual_bundle_sha="$(sha256sum "$bundle_path" | awk '{print $1}')"
  [[ "$actual_bundle_sha" == "$expected_bundle_sha" ]] ||
    die "downloaded bundle SHA-256 does not match its manifest"

  git bundle verify "$bundle_path" >/dev/null

  local verify_repo
  verify_repo="$(mktemp -d .git/reconciliation-fsck.XXXXXX)"
  trap 'rm -rf -- "$verify_repo"' RETURN
  git clone --quiet --bare "$bundle_path" "$verify_repo/recovered.git"
  git -C "$verify_repo/recovered.git" fsck --full --strict --no-reflogs

  local ref expected_oid actual_oid
  for ref in "${SOURCE_REFS[@]}"; do
    expected_oid="$(git rev-parse "$ref")"
    actual_oid="$(git -C "$verify_repo/recovered.git" rev-parse "$ref")"
    [[ "$actual_oid" == "$expected_oid" ]] ||
      die "downloaded bundle changed protected ref ${ref}: ${actual_oid}, expected ${expected_oid}"
  done

  echo "Downloaded archive passed SHA-256, git bundle verify, and isolated git fsck."
}

for ref in "${SOURCE_REFS[@]}"; do
  require_local_ref "$ref"
done

# The source tags are the historical anchors named in the reconciliation
# inventory. Refusing tag drift keeps a future local move from being silently
# archived as different evidence.
[[ "$(git rev-parse refs/tags/reconciliation/replit-main-2026-08-21^{commit})" == "b88ac3304f29d1374359f11fbb16b5fc6771fde6" ]] ||
  die "protected Replit source tag no longer matches the documented source head"
[[ "$(git rev-parse refs/tags/reconciliation/github-main-2026-08-21^{commit})" == "37ed5a85d3527f66b805c2212598793676b2752e" ]] ||
  die "protected GitHub source tag no longer matches the documented source head"

if "$VERIFY_ONLY"; then
  verify_dir="$(mktemp -d .git/reconciliation-verify.XXXXXX)"
  trap 'rm -rf -- "$verify_dir"' EXIT
  RECONCILIATION_ARCHIVE_PREFIX="$ARCHIVE_PREFIX" \
    npx tsx scripts/reconciliation-history-object-storage.ts download "$verify_dir"
  verify_downloaded_archive "$verify_dir"
  exit 0
fi

work_dir="$(mktemp -d .git/reconciliation-archive.XXXXXX)"
trap 'rm -rf -- "$work_dir"' EXIT
bundle_path="${work_dir}/${ARCHIVE_ID}.bundle"
manifest_path="${work_dir}/manifest.txt"
bundle_key="${ARCHIVE_PREFIX}/${ARCHIVE_ID}.bundle"
manifest_key="${ARCHIVE_PREFIX}/manifest.txt"

declare -A MERGE_OIDS=()
for ref in "${MERGE_TIP_REFS[@]}"; do
  MERGE_OIDS["$ref"]="$(merge_oid_for_tip "$ref")"
done

# The bundle keeps the original annotated tags, complete source history, and
# reconciliation lineage in a transportable format. It is verified locally
# before upload, then retrieved and verified again from durable storage below.
git bundle create "$bundle_path" "${SOURCE_REFS[@]}"
git bundle verify "$bundle_path" >/dev/null
git fsck --full --strict --no-reflogs "${SOURCE_REFS[@]}"
git lfs fsck --pointers "refs/tags/reconciliation/replit-main-2026-08-21"
git lfs fsck --pointers "refs/tags/reconciliation/github-main-2026-08-21"
git lfs fsck --pointers "refs/heads/reconcile/github-main-live-lfs-release"

{
  echo "HolaHola protected reconciliation history archive"
  echo "archive_id=${ARCHIVE_ID}"
  echo "storage_backend=s3-compatible-private-object-storage"
  echo "bundle_object_key=${bundle_key}"
  echo "manifest_object_key=${manifest_key}"
  echo "created_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "[source_refs]"
  for ref in "${SOURCE_REFS[@]}"; do
    printf '%s\t%s\t%s\n' \
      "$ref" \
      "$(git rev-parse "$ref")" \
      "$(git rev-parse "${ref}^{commit}")"
  done
  echo
  echo "[two_parent_reconciliation_merges]"
  for ref in "${MERGE_TIP_REFS[@]}"; do
    merge_oid="${MERGE_OIDS[$ref]}"
    printf '%s\t%s\t%s\n' \
      "$ref" \
      "$merge_oid" \
      "$(git show -s --format='%P' "$merge_oid")"
  done
  echo
  echo "[integrity]"
  printf 'bundle_sha256=%s\n' "$(sha256sum "$bundle_path" | awk '{print $1}')"
  printf 'bundle_bytes=%s\n' "$(wc -c < "$bundle_path" | tr -d ' ')"
  echo "bundle_verified=git bundle verify"
  echo "objects_verified=git fsck --full --strict --no-reflogs"
  echo "lfs_pointers_verified=git lfs fsck --pointers"
} > "$manifest_path"

# The uploader refuses to replace a pre-existing object with different bytes.
# This makes the archive immutable through this workflow even after reruns.
RECONCILIATION_ARCHIVE_PREFIX="$ARCHIVE_PREFIX" \
  npx tsx scripts/reconciliation-history-object-storage.ts upload "$bundle_path" "$manifest_path"

verify_dir="$(mktemp -d .git/reconciliation-verify.XXXXXX)"
trap 'rm -rf -- "$work_dir" "$verify_dir"' EXIT
RECONCILIATION_ARCHIVE_PREFIX="$ARCHIVE_PREFIX" \
  npx tsx scripts/reconciliation-history-object-storage.ts download "$verify_dir"
verify_downloaded_archive "$verify_dir"

echo "Archive complete in configured private object storage:"
echo "  ${bundle_key}"
echo "  ${manifest_key}"