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

# ── Setup steps (run only after gate passes) ──────────────────────────────────
npm install --legacy-peer-deps
npm run db:push

# ── Prequel Episode 1 DB sync ─────────────────────────────────────────────────
# Keep docs/prequel-episode-1.md and DB record dd8cf439 in sync after every merge.
# Idempotent: reads .md and writes its content to the DB verbatim.
npx tsx server/scripts/sync-prequel-episode-1-direct.ts
