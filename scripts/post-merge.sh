#!/bin/bash
set -e

# ── Gemini approval gate ──────────────────────────────────────────────────────
# Run FIRST — before any mutating steps — so a failed check halts immediately
# without running npm install or db:push.
#
# Scans the full commit range introduced by this merge for changes to
# Daniela's protected context-injection / tool-description files.  If any
# protected file was touched but no docs/gemini-audit-*.md doc appears in the
# same commit range, exit 1 so the post-merge setup step fails visibly.
#
# Protected-file list is kept in sync with docs/GEMINI_REQUIRED.md.
# To pass this gate the committing agent must include a docs/gemini-audit-*.md
# file in the same commit (or commit batch).  See docs/GEMINI_REQUIRED.md for
# the full approval loop.
# ─────────────────────────────────────────────────────────────────────────────

# Files that always require Gemini approval (exact path match)
PROTECTED_EXACT=(
  "server/services/system-prompt.ts"
  "server/services/pre-session-synthesis.ts"
  "server/services/streaming-voice-orchestrator.ts"
  "server/services/daniela-caller.ts"
  "server/services/daniela-function-registry.ts"
  "server/services/neural-memory-search.ts"
)

# Path fragments — any changed file whose path contains one of these strings
# is treated as protected.  Only use strings that actually appear in file
# paths, not function names.
PROTECTED_FRAGMENTS=(
  "classroom-environment"
  "unified-recall"
)

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
else

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
  elif [ -n "$AUDIT_DOC_FOUND" ]; then
    echo "[gemini-gate] Protected file(s) changed AND a gemini-audit doc is present in range $RANGE. Gate passed."
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

fi

# ── Setup steps (run only after gate passes) ──────────────────────────────────
npm install --legacy-peer-deps
npm run db:push
