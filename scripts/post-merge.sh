#!/bin/bash
set -e

# ── Gemini approval gate ──────────────────────────────────────────────────────
# Run FIRST — before any mutating steps — so a failed check halts immediately
# without running npm install or db:push.
#
# Gate logic lives in scripts/gemini-gate-check.sh so it can be exercised by
# CI tests (server/scripts/gemini-gate-check.test.ts) without triggering the
# npm install / db:push steps below.
#
# Protected-file list is kept in sync with docs/GEMINI_REQUIRED.md.
# To pass this gate the committing agent must include a docs/gemini-audit-*.md
# file in the same commit (or commit batch).  See docs/GEMINI_REQUIRED.md for
# the full approval loop.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/gemini-gate-check.sh"

# ── Setup steps (run only after gate passes) ──────────────────────────────────
npm install --legacy-peer-deps
npm run db:push
