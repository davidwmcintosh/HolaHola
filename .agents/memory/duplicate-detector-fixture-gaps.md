---
name: Duplicate detector fixture gaps
description: A guard's own self-check only proves itself; sibling detectors implementing the same check independently can carry the same gap unnoticed.
---

When a false positive is traced to one guard/detector and fixed there, check whether other independent code paths implement the same underlying check with their own copy of the logic (e.g. a fixture-exclusion allowlist, a legacy-ID list). A passing self-check on the fixed detector proves only that one path, not its siblings.

**Why:** `detect-episode-dialogue-loss.ts` had its own undeclared episode-99 fixture-exclusion gap, separate from `episode-content-loss-guard.ts`'s already-fixed one. The first fix's self-check passed CI for a while before the second, independent detector's failure surfaced, because nothing had grepped for other consumers of the same "is this a reserved/legacy fixture number" concept.

**How to apply:** After fixing a guard/detector false-positive, grep the codebase for other places implementing conceptually the same check (same fixture numbers, same allowlist, same exclusion rule) before considering the class of bug closed. Prefer extracting a single shared source of truth (an exported constant/function) over letting each detector keep its own copy.

