#!/bin/bash
set -e

# ── Gemini approval gate ──────────────────────────────────────────────────────
# Run FIRST — before any mutating steps — so a failed check halts immediately
# without running npm install or db:push.
#
# Gate logic lives in scripts/gemini-gate-check.sh so it can be exercised by
# CI tests without triggering the npm install / db:push steps below.
#
# Protected-file list is parsed at runtime from docs/GEMINI_REQUIRED.md —
# the single authoritative source.  To add a new protected file, update that
# doc; this script requires no separate change.
# To pass this gate the committing agent must include a docs/gemini-audit-*.md
# file in the same commit (or commit batch).  See docs/GEMINI_REQUIRED.md for
# the full approval loop.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/gemini-gate-check.sh"

# ── Git merge-driver config ───────────────────────────────────────────────────
# Register the built-in "ours" merge driver so that the docs/episode-27.md
# merge=ours attribute in .gitattributes takes effect on the NEXT merge.
# Running this idempotently on every post-merge ensures the driver is always
# configured, even in a fresh clone or a new Replit workspace.
#
# Effect: when git merges a branch that contains a stale docs/episode-27.md,
# it keeps the receiving branch's (main's) version unconditionally.
# ─────────────────────────────────────────────────────────────────────────────
git config merge.ours.driver true

# ── Setup steps (run only after gate passes) ──────────────────────────────────
npm install --legacy-peer-deps
npm run db:push

# ── Episode-27 rolling-episode shrinkage guard ────────────────────────────────
# Episode 27 is currently ROLLING (live, being written in real time).
# Task agents sometimes commit a stale version of docs/episode-27.md that
# predates Luca's most recent edits.  This guard detects shrinkage (the .md
# becoming shorter than the authoritative DB record) and automatically
# restores the DB version to disk before anything else uses the file.
#
# The script exits 0 whether or not a restore was needed, so the overall
# post-merge does NOT fail just because a restore happened.  The restore is
# announced loudly in the log.
#
# When Episode 27 is no longer ROLLING, remove or comment out this block.
# ─────────────────────────────────────────────────────────────────────────────
if ! npx tsx server/scripts/restore-episode-27-from-db.ts --check-shrinkage; then
  echo ""
  echo "⚠  WARNING: Episode-27 shrinkage guard encountered an error (see output above)."
  echo "   To restore manually: npx tsx server/scripts/restore-episode-27-from-db.ts"
  echo "   Continuing merge — fix DB connectivity and restore before next session."
  echo ""
fi

# ── Episode-28 rolling-episode shrinkage guard ────────────────────────────────
# Episode 28 is currently ROLLING. Same pattern as Episode 27 above.
# When Episode 28 is no longer ROLLING, remove or comment out this block.
# ─────────────────────────────────────────────────────────────────────────────
if ! npx tsx server/scripts/restore-episode-28-from-db.ts --check-shrinkage; then
  echo ""
  echo "⚠  WARNING: Episode-28 shrinkage guard encountered an error (see output above)."
  echo "   To restore manually: npx tsx server/scripts/restore-episode-28-from-db.ts"
  echo "   Continuing merge — fix DB connectivity and restore before next session."
  echo ""
fi

# ── Prequel Episode 1 DB sync ─────────────────────────────────────────────────
# NOT run automatically. To repair a mismatch, run explicitly:
#   DB → .md:  npx tsx server/scripts/sync-prequel-ep1-from-db.ts
#   .md → DB:  npx tsx server/scripts/sync-prequel-episode-1.ts
