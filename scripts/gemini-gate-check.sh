#!/bin/bash
# ── Gemini approval gate ──────────────────────────────────────────────────────
# Standalone script: extracted from post-merge.sh so it can be called from CI
# tests without triggering npm install / db:push.
#
# Scans the full commit range introduced by this merge for changes to
# Daniela's protected context-injection / tool-description files.  If any
# protected file was touched but no docs/gemini-audit-*.md doc appears in the
# same commit range, exit 1 so the post-merge setup step fails visibly.
#
# Protected-file list is parsed at runtime from docs/GEMINI_REQUIRED.md —
# the single authoritative source.  To add a new protected file, update that
# doc; this script requires no separate change.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GEMINI_DOC="$SCRIPT_DIR/../docs/GEMINI_REQUIRED.md"

if [ ! -f "$GEMINI_DOC" ]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════════════╗"
  echo "║       ⚠️   GEMINI APPROVAL GATE FAILED — PROTECTED-FILE LIST MISSING ⚠️  ║"
  echo "╠══════════════════════════════════════════════════════════════════════════╣"
  echo "║                                                                          ║"
  echo "║  docs/GEMINI_REQUIRED.md was not found.                                 ║"
  echo "║                                                                          ║"
  echo "║  This file is the authoritative source of the protected-file list.      ║"
  echo "║  Without it the gate cannot determine which files require Gemini         ║"
  echo "║  approval, so the merge is blocked.                                      ║"
  echo "║                                                                          ║"
  echo "║  WHAT TO DO:                                                            ║"
  echo "║    • Restore docs/GEMINI_REQUIRED.md if it was accidentally deleted.    ║"
  echo "║    • If you intentionally moved it, update SCRIPT_DIR/../docs/ path in  ║"
  echo "║      scripts/gemini-gate-check.sh to point to the new location.        ║"
  echo "║                                                                          ║"
  echo "╚══════════════════════════════════════════════════════════════════════════╝"
  echo ""
  exit 1
fi

# ── Parse protected lists from GEMINI_REQUIRED.md ────────────────────────────

# Files that always require Gemini approval (exact path match).
# Scoped to the "Protected categories and files" section of the doc so that
# audit-doc paths and script references in other sections are not picked up.
mapfile -t PROTECTED_EXACT < <(
  awk '/^## Protected categories and files/,/^---/' "$GEMINI_DOC" \
  | grep -oP '(?<=`)[^`]+(?=`)' \
  | grep '/' \
  | grep -v '^[A-Z]' \
  | sort -u
)

# Path fragments — extracted from the machine-readable block between
# <!--PROTECTED_FRAGMENTS_START--> and <!--PROTECTED_FRAGMENTS_END-->.
mapfile -t PROTECTED_FRAGMENTS < <(
  awk '/<!--PROTECTED_FRAGMENTS_START-->/,/<!--PROTECTED_FRAGMENTS_END-->/' "$GEMINI_DOC" \
  | grep -oP '(?<=`)[^`]+(?=`)'
)

echo "[gemini-gate] Loaded from docs/GEMINI_REQUIRED.md: ${#PROTECTED_EXACT[@]} exact path(s), ${#PROTECTED_FRAGMENTS[@]} fragment(s)."

# ── Determine the full commit range introduced by this merge ──────────────────
# ORIG_HEAD is set by git during a real merge; it points to the tip before the
# merge, so ORIG_HEAD..HEAD covers every commit that arrived in this batch.
# If ORIG_HEAD is absent (e.g. a plain fast-forward or first commit) fall back
# to HEAD~1..HEAD.
if git rev-parse --verify ORIG_HEAD >/dev/null 2>&1; then
  RANGE="ORIG_HEAD..HEAD"
else
  RANGE="HEAD~1..HEAD"
fi

CHANGED_FILES=$(git diff "$RANGE" --name-only 2>/dev/null || true)

if [ -z "$CHANGED_FILES" ]; then
  # Last-resort fallback: files touched in the HEAD commit only
  CHANGED_FILES=$(git show --name-only --format="" HEAD 2>/dev/null || true)
fi

if [ -z "$CHANGED_FILES" ]; then
  echo "[gemini-gate] Could not determine changed files — skipping gate check."
  exit 0
fi

# ── Check for protected-file hits ─────────────────────────────────────────
PROTECTED_HITS=()

for f in "${PROTECTED_EXACT[@]}"; do
  if echo "$CHANGED_FILES" | grep -qF "$f"; then
    PROTECTED_HITS+=("$f")
  fi
done

for frag in "${PROTECTED_FRAGMENTS[@]}"; do
  if echo "$CHANGED_FILES" | grep -qF "$frag"; then
    PROTECTED_HITS+=("[path containing: $frag]")
  fi
done

# ── Check for a matching audit doc in the same range ──────────────────────
AUDIT_DOC_FOUND=""
if echo "$CHANGED_FILES" | grep -qE "^docs/gemini-audit-"; then
  AUDIT_DOC_FOUND="yes"
fi

# ── Emit result ────────────────────────────────────────────────────────────
if [ ${#PROTECTED_HITS[@]} -eq 0 ]; then
  echo "[gemini-gate] No protected files changed in range $RANGE. Gate passed."
  exit 0
elif [ -n "$AUDIT_DOC_FOUND" ]; then
  echo "[gemini-gate] Protected file(s) changed AND a gemini-audit doc is present in range $RANGE. Gate passed."
  exit 0
else
  # ── GATE FAILURE ──────────────────────────────────────────────────────────
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════════════╗"
  echo "║       ⚠️   GEMINI APPROVAL GATE FAILED — DO NOT SHIP THIS CHANGE   ⚠️    ║"
  echo "╠══════════════════════════════════════════════════════════════════════════╣"
  echo "║                                                                          ║"
  echo "║  Commit range checked: $RANGE"
  printf  "║  %-72s ║\n" ""
  echo "║  The following protected file(s) were changed in this merge:            ║"
  for hit in "${PROTECTED_HITS[@]}"; do
    printf "║    •  %-68s ║\n" "$hit"
  done
  echo "║                                                                          ║"
  echo "║  No  docs/gemini-audit-*.md  file was found in the same commit range.  ║"
  echo "║                                                                          ║"
  echo "║  These files govern Daniela's context injection / tool descriptions.    ║"
  echo "║  Shipping them without a Gemini approval loop risks silent behavioral   ║"
  echo "║  drift that neither Alden nor Luca can catch from the outside.          ║"
  echo "║                                                                          ║"
  echo "║  WHAT TO DO:                                                            ║"
  echo "║    1. Run the full Gemini approval loop (docs/GEMINI_REQUIRED.md).      ║"
  echo "║    2. Iterate until you receive an unconditional clear — no 'but'.      ║"
  echo "║    3. Save the audit to docs/gemini-audit-YYYY-MM-DD.md.               ║"
  echo "║    4. Include that file in the same commit batch and re-merge.          ║"
  echo "║                                                                          ║"
  echo "║  Reference: docs/GEMINI_REQUIRED.md                                    ║"
  echo "║  Memory:    .agents/memory/gemini-approval-gates.md                    ║"
  echo "║                                                                          ║"
  echo "╚══════════════════════════════════════════════════════════════════════════╝"
  echo ""
  exit 1
fi
