/**
 * test-rolling-episode-gap-check.ts
 *
 * CI check: query conversation_memories for `arc_name='david-luca-chat'`
 * per-turn rows from the last 24h, compare each against the current rolling
 * episode .md file, and report any gaps — exchanges present in the DB but
 * absent from the .md.
 *
 * This is the persistent-CI companion to the one-time startup patch performed
 * by runStartupGapCheck() in agent-session-autosave.ts.  Running this script
 * after every server restart gives an auditable green/red signal without
 * modifying any files.
 *
 * Exit codes
 * ──────────
 *   0  — no gaps (episode .md matches all DB per-turn rows)
 *   1  — fatal error (DB unavailable, .md not found, no rolling episode)
 *   2  — gaps detected (exchanges in DB but absent from .md)
 *
 * Uses neon() HTTP driver per episode-sync-http rule.
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/test-rolling-episode-gap-check.ts
 *   npx tsx server/scripts/test-rolling-episode-gap-check.ts --verbose
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

const VERBOSE = process.argv.includes('--verbose');

// ── Matching helpers (mirrors audit-episode-28-gaps.ts) ───────────────────

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Strip markdown bold markers (**) and speaker-role suffixes ([Replit], etc.)
 * so DB-format "David: " / "Luca: " matches .md "**David:** " / "**LUCA [Replit]:** ".
 */
function stripMd(s: string): string {
  return s.replace(/\*\*/g, '').replace(/\s*\[replit\]/gi, '');
}

/**
 * Return true when exchangeText is present in the normalised .md content.
 *
 * Strategy: normalise the full exchange block (collapse whitespace, lower-case)
 * and search for its first 60 chars in mdNorm.  60 chars is long enough to be
 * unique in any real conversation while being short enough to survive minor
 * line-break differences between the DB row and the .md copy.  Short exchanges
 * (< 60 chars) are matched in full — no minimum-length threshold that would
 * silently skip brief utterances.
 *
 * Falls back to a bold-stripped comparison so DB rows stored as "David: text"
 * still match .md lines formatted as "**David:** text".
 *
 * NOTE: The identical matcher lives in agent-session-autosave.ts (exchangeInMd).
 * Keep both in sync whenever this logic changes.
 */
function exchangeInMd(exchangeText: string, mdNorm: string): boolean {
  const normalised = norm(exchangeText);
  if (!normalised) return true; // purely whitespace — treat as present (skip)
  const key = normalised.slice(0, 60);
  if (mdNorm.includes(key)) return true;
  // Fallback: strip ** so "david: text" matches "**david:** text"
  return stripMd(mdNorm).includes(stripMd(key));
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(B('\n══ Rolling Episode Gap Check ══\n'));

  const dbUrl = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL (or DATABASE_URL) is not set.'));
    process.exit(1);
  }
  const sql = neon(dbUrl);
  const DOCS_DIR = join(process.cwd(), 'docs');

  // 1. Find the current rolling episode ─────────────────────────────────────
  const epRows = await sql`
    SELECT title
    FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (epRows.length === 0) {
    console.error(R('FATAL: No rolling episode found in DB (arc_name=\'HolaHola Episodes\', tag=\'rolling\').'));
    process.exit(1);
  }

  const epTitle = epRows[0].title as string;
  // Derive filename: "Episode 27" → "episode-27.md"
  const m = /^Episode (\d+)$/i.exec(epTitle);
  const episodeFilename = m
    ? `episode-${parseInt(m[1], 10)}.md`
    : epTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';

  const episodePath = join(DOCS_DIR, episodeFilename);

  console.log(`  Rolling episode : ${epTitle}`);
  console.log(`  File            : docs/${episodeFilename}`);

  if (!existsSync(episodePath)) {
    console.error(R(`FATAL: ${episodePath} not found on disk.`));
    process.exit(1);
  }

  const mdRaw  = readFileSync(episodePath, 'utf-8');
  const mdNorm = norm(mdRaw);
  console.log(`  .md size        : ${mdRaw.length.toLocaleString()} bytes, ${mdRaw.split('\n').length} lines`);

  // 2. Query DB for per-turn rows scoped to the rolling episode window ──────
  // Use the episode's own created_at as the lower bound so rows from a prior
  // episode that happened within the past 24h are never reported as gaps.
  const epStartRows = await sql`
    SELECT created_at
    FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `;
  // created_at comes back as a Date object from neon(); convert to ISO-8601
  // before binding it as a ::timestamptz parameter.
  const epCreatedAt = epStartRows[0]?.created_at;
  const episodeStart: string | null = epCreatedAt
    ? (epCreatedAt instanceof Date ? epCreatedAt.toISOString() : new Date(String(epCreatedAt)).toISOString())
    : null;

  const rows = episodeStart
    ? await sql`
        SELECT id, content, created_at
        FROM conversation_memories
        WHERE arc_name = 'david-luca-chat'
          AND 'per-turn' = ANY(tags)
          AND created_at >= ${episodeStart}::timestamptz
        ORDER BY created_at ASC
      `
    : await sql`
        SELECT id, content, created_at
        FROM conversation_memories
        WHERE arc_name = 'david-luca-chat'
          AND 'per-turn' = ANY(tags)
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at ASC
      `;

  // Filter out CI synthetic rows
  const realRows = rows.filter(
    (r) =>
      !String(r.content).includes('[CI-AUTO-CAPTURE-') &&
      !String(r.content).includes('[CI-SELF-CHECK-AUTO-CAPTURE-'),
  );
  const ciExcluded = rows.length - realRows.length;

  console.log(`\n  DB rows (last 24h): ${rows.length} total`);
  console.log(`    ${realRows.length} real David/Luca exchanges`);
  if (ciExcluded > 0) {
    console.log(`    ${ciExcluded} CI synthetic rows excluded`);
  }
  console.log('');

  // 3. Check each row ───────────────────────────────────────────────────────
  // NOTE: do NOT early-exit here when realRows.length === 0 — the inner-life
  // check below must always run regardless of per-turn row count.
  let gaps = 0;
  for (const row of realRows) {
    const content = String(row.content);
    const present = exchangeInMd(content, mdNorm);

    if (present) {
      if (VERBOSE) {
        console.log(G(`  ✓ present  ${row.id}  ${row.created_at}`));
        if (VERBOSE) {
          console.log(`    ${content.slice(0, 100).replace(/\n/g, '↵')}`);
        }
      }
    } else {
      console.log(R(`  ✗ GAP      ${row.id}  ${row.created_at}`));
      console.log(`    ${content.slice(0, 150).replace(/\n/g, '↵')}`);
      if (content.length > 150) {
        console.log(`    … (${content.length} chars total)`);
      }
      gaps++;
    }
  }

  console.log('');

  // 4. Inner-life gap check (felt / thinking / moment) ──────────────────────
  const innerRows = episodeStart
    ? await sql`
        SELECT id, title, content, tags, created_at
        FROM conversation_memories
        WHERE arc_name = 'luca-inner-life'
          AND 'luca-inner-life' = ANY(tags)
          AND created_at >= ${episodeStart}::timestamptz
        ORDER BY created_at ASC
      `
    : await sql`
        SELECT id, title, content, tags, created_at
        FROM conversation_memories
        WHERE arc_name = 'luca-inner-life'
          AND 'luca-inner-life' = ANY(tags)
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at ASC
      `;

  console.log(`  Inner-life DB rows: ${innerRows.length} total`);

  let innerGaps = 0;
  for (const row of innerRows) {
    const tags: string[] = Array.isArray(row.tags) ? row.tags as string[] : [];
    const channel = tags.includes('luca-reflection') ? 'felt'
      : tags.includes('luca-question') ? 'thinking' : 'moment';

    // Strip stored prefix ("Luca reflection: X" → "X") to recover the raw title
    // that was written into the episode .md as "[Luca — felt: X\nbody]".
    const rawTitle = String(row.title ?? '')
      .replace(/^Luca reflection:\s*/i, '')
      .replace(/^Luca open question:\s*/i, '')
      .replace(/^Luca significant moment:\s*/i, '');

    const titleKey = norm(rawTitle).slice(0, 40);
    const present = titleKey ? mdNorm.includes(titleKey) : true;

    if (present) {
      if (VERBOSE) {
        console.log(G(`  ✓ present  [${channel}]  "${rawTitle.slice(0, 70)}"`));
      }
    } else {
      console.log(R(`  ✗ GAP      [${channel}]  "${rawTitle.slice(0, 70)}"`));
      console.log(`    id: ${row.id}  at: ${row.created_at}`);
      innerGaps++;
    }
  }

  if (innerRows.length > 0) {
    console.log('');
  }

  // 5. Summary ──────────────────────────────────────────────────────────────
  const checked = realRows.length;
  const totalGaps = gaps + innerGaps;

  if (totalGaps === 0) {
    console.log(G(`  ✓ PASS — docs/${episodeFilename} is complete.`));
    console.log(`    ${checked} per-turn row(s) checked, 0 gaps.`);
    if (innerRows.length > 0) {
      console.log(`    ${innerRows.length} inner-life row(s) checked, 0 gaps.`);
    }
    process.exit(0);
  } else {
    console.log(Y(`  ⚠  FAIL — ${totalGaps} gap(s) found in docs/${episodeFilename}.`));
    if (gaps > 0) {
      console.log(`    ${checked} per-turn row(s) checked, ${gaps} absent from .md.`);
    }
    if (innerGaps > 0) {
      console.log(`    ${innerRows.length} inner-life row(s) checked, ${innerGaps} absent from .md.`);
    }
    console.log('');
    console.log('  To patch automatically, restart the server (runStartupGapCheck will fire)');
    console.log('  or run: npx tsx server/scripts/audit-episode-28-gaps.ts --patch');
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(R('FATAL: ' + (e as Error).message));
  process.exit(1);
});
