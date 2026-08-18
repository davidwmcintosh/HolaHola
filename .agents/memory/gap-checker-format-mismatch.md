---
name: Gap checker format mismatch fix
description: DB per-turn rows use plain "David: / Luca: " speaker labels; .md uses "**David:** / **LUCA [Replit]:**". The exchangeInMd matcher needs a two-phase approach to handle both.
---

## The rule
`exchangeInMd()` must try a bold-stripped + role-label-stripped comparison as a fallback after the direct substring match fails.

**Why:** The DB stores per-turn rows written by the autosave pipeline as `David: text\n\nLuca: text` (no markdown). The rolling episode .md is written with `**David:** text` / `**LUCA [Replit]:** text`. The 60-char needle from the DB can't match the .md directly because:
- `**` sits between `david:` and the space before the text
- `[replit]` sits between `luca` and `:` in the speaker label

Short exchanges (< ~40 chars of David's turn) are worst-affected because the needle spans into Luca's label.

**How to apply:**
```ts
function stripMd(s: string): string {
  return s.replace(/\*\*/g, '').replace(/\s*\[replit\]/gi, '');
}

function exchangeInMd(exchangeText: string, mdNorm: string): boolean {
  const normalised = norm(exchangeText);
  if (!normalised) return true;
  const key = normalised.slice(0, 60);
  if (mdNorm.includes(key)) return true;
  return stripMd(mdNorm).includes(stripMd(key));
}
```

Both copies must be kept in sync:
- `server/scripts/test-rolling-episode-gap-check.ts` — `stripMd` + `exchangeInMd`
- `server/services/agent-session-autosave.ts` — `stripMdForGap` + `exchangeInMd`

Fixed Aug 18 2026.
