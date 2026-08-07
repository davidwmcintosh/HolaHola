---
name: Audit doc restoration pattern
description: How to safely append to gemini-audit-2026-08-07.md without corrupting prior entries; `cat >>` and Edit both corrupted intermediate commits.
---

# Audit doc restoration pattern

## The rule
When appending to `docs/gemini-audit-2026-08-07.md`, always restore from `main-repl/main` first, then append. Never restore from `HEAD~1` — intermediate commits from other tasks may have already corrupted that version.

```bash
git show main-repl/main:docs/gemini-audit-2026-08-07.md > /tmp/audit-base.md
cp /tmp/audit-base.md docs/gemini-audit-2026-08-07.md
cat >> docs/gemini-audit-2026-08-07.md << 'EOF'
[new section]
EOF
```

**Why:** Multiple task agents commit to the same audit file between remote-main syncs. `HEAD~1` only goes back one commit — prior agents may have already introduced corruption there. `main-repl/main` is the authoritative clean baseline.

**How to apply:** Any task touching `docs/gemini-audit-2026-08-07.md`. Verify result with `grep -n "^# Gemini Audit" docs/gemini-audit-2026-08-07.md` to confirm all prior section headers are intact before committing.

## Completion reviewer scope
The completion reviewer compares `main-repl/main` against `HEAD` (all unmerged commits), not just the last commit. Changes from other tasks' commits are visible in the diff. Document this in `drift_reason` if unrelated changes appear in the diff — do not attempt to revert other tasks' work.
