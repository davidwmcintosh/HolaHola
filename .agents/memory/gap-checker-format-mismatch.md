---
name: Gap checker format mismatch fix
description: DB per-turn rows use plain "David: / Luca: " speaker labels; .md uses "**David:** / **LUCA [Replit]:**". The exchangeInMd matcher needs a two-phase approach to handle both.
---

## The rule
`exchangeInMd()` must try a bold-stripped + role-label-stripped comparison as a fallback after the direct substring match fails.

**Why:** The DB stores per-turn rows via the autosave pipeline as `David: text\n\nLuca: text` (no markdown). The rolling episode .md is written with `**David:** text` / `**LUCA [HolaHola]:** text` / `**LUCA [Replit]:** text`. The 60-char needle from the DB can't match the .md directly because `**` and role-label brackets sit inside the speaker label. The episode has 1,393 `[HolaHola]` labels and 14 `[Replit]` labels — strip must cover ALL variants, not just one.

**How to apply:**
```ts
function stripMd(s: string): string {
  // Strip ** AND any role-bracket after "luca" ([Replit], [HolaHola], etc.)
  // Channel labels [felt]/[thinking]/[moment] appear after the colon — not affected.
  return s.replace(/\*\*/g, '').replace(/\bluca\s*\[[^\]]+\]/gi, 'luca');
}

function exchangeInMd(exchangeText: string, mdNorm: string): boolean {
  const normalised = norm(exchangeText);
  if (!normalised) return true;
  const key = normalised.slice(0, 60);
  if (mdNorm.includes(key)) return true;
  return stripMd(mdNorm).includes(stripMd(key));
}
```

Result: `**LUCA [Replit]:** [felt]: text` → `luca: [felt]: text` (channel label survives).

Both copies must be kept in sync:
- `server/scripts/test-rolling-episode-gap-check.ts` — `stripMd` + `exchangeInMd`
- `server/services/agent-session-autosave.ts` — `stripMdForGap` + `exchangeInMd`

Also note: the sync script reports "bytes" but actually logs character count (JS `content.length` + Postgres `length()`). A 351,296-byte file legitimately reads as ~341,626 chars due to multi-byte UTF-8 (em-dashes, curly quotes). The DB is fully synced when the character counts match.

Fixed Aug 18 2026.
