/**
 * restore-rolling-episodes-from-db.ts
 *
 * Restores all rolling episode .md files from the canonical DB records when
 * a file has been overwritten by a stale task-agent commit (shrinkage detection).
 *
 * Rolling episodes are discovered automatically by querying the DB for all
 * conversation_memories rows tagged 'rolling' in the HolaHola Episodes arc.
 * No code changes are needed when a new episode becomes the rolling one.
 *
 * Usage:
 *   npx tsx server/scripts/restore-rolling-episodes-from-db.ts
 *     → always restores all rolling episodes (unconditional)
 *
 *   npx tsx server/scripts/restore-rolling-episodes-from-db.ts --check-shrinkage
 *     → only restores when .md is shorter than DB by > SHRINKAGE_THRESHOLD
 *       characters (normalized). Exits 0 in both cases. Used at startup.
 *
 * Exit codes:
 *   0  — OK (no shrinkage detected for any episode, or all restores succeeded)
 *   1  — Fatal error (DB unavailable, write failed)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const W = (s: string) => `\x1b[33;1m${s}\x1b[0m`;

/**
 * Minimum number of normalized characters by which the .md must be shorter
 * than the DB before we treat it as a stale overwrite. Tiny diffs (e.g. a
 * trailing newline) are ignored; real overwrites lose thousands of bytes.
 */
const SHRINKAGE_THRESHOLD = 200;

const ARC_NAME = 'HolaHola Episodes';

/** Normalize for length comparison (same logic as the CI sync check). */
function normalize(s: string): string {
  return s
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Derive the docs/ file path from an episode title.
 *
 * Handles titles of the form:
 *   "Episode 27"
 *   "Episode 27 — Luca's Episode One"
 *   "Episode 28 — Something"
 *
 * Returns null if the title does not contain a recognisable episode number.
 */
function titleToMdPath(title: string): string | null {
  const match = title.match(/^Episode\s+(\d+)/i);
  if (!match) return null;
  const num = match[1];
  return join(process.cwd(), 'docs', `episode-${num}.md`);
}

interface EpisodeRow {
  id: string;
  title: string;
  content: string;
}

async function checkAndRestore(
  episode: EpisodeRow,
  mdPath: string,
  checkShrinkageOnly: boolean,
): Promise<boolean> {
  const { id, title, content: dbContent } = episode;

  console.log('');
  console.log(B(`  ── ${title} (${id}) ──`));

  if (!dbContent) {
    console.error(R(`  FATAL: DB content field is empty for ${title} — cannot restore`));
    return false;
  }

  const dbNorm = normalize(dbContent);
  console.log(Y(`  ℹ  DB record: ${dbContent.length} raw bytes / ${dbNorm.length} normalized chars`));

  if (!existsSync(mdPath)) {
    console.log(Y(`  ℹ  .md file does not exist — restoring from DB`));
  } else {
    try {
      const mdContent = readFileSync(mdPath, 'utf8');
      const mdNorm = normalize(mdContent);
      console.log(Y(`  ℹ  .md file : ${mdContent.length} raw bytes / ${mdNorm.length} normalized chars`));

      if (checkShrinkageOnly) {
        const shrinkage = dbNorm.length - mdNorm.length;

        if (shrinkage <= SHRINKAGE_THRESHOLD) {
          console.log(
            G(`  ✓  No shrinkage detected (db=${dbNorm.length}, md=${mdNorm.length}, delta=${shrinkage}).`),
          );
          console.log(G(`     ${mdPath} is at least as large as DB — no restore needed.`));
          return true; // no restore needed
        }

        // Shrinkage exceeded threshold → overwrite detected
        console.log('');
        console.log(W('  ⚠  SHRINKAGE DETECTED — task-agent overwrite suspected'));
        console.log(W(`     DB has ${dbNorm.length} chars; .md has ${mdNorm.length} chars`));
        console.log(W(`     Delta: -${shrinkage} chars (threshold: ${SHRINKAGE_THRESHOLD})`));
        console.log(W(`     Restoring ${mdPath} from DB canonical version...`));
        console.log('');
      }
    } catch (err: any) {
      console.error(R(`  ✗  Could not read .md file: ${err?.message ?? err} — will restore unconditionally`));
    }
  }

  // ── Restore ─────────────────────────────────────────────────────────────────
  try {
    writeFileSync(mdPath, dbContent, 'utf8');
    console.log(B(''));
    console.log(B('  ══════════════════════════════════════════════════════════════════'));
    console.log(B(`  RESTORED: ${mdPath}`));
    console.log(B(`  DB id   : ${id}`));
    console.log(B(`  Size    : ${dbContent.length} bytes`));
    console.log(B('  ══════════════════════════════════════════════════════════════════'));
    console.log('');
    return true;
  } catch (err: any) {
    console.error(R(`FATAL: Could not write ${mdPath}: ${err?.message ?? err}`));
    return false;
  }
}

async function main() {
  const checkShrinkageOnly = process.argv.includes('--check-shrinkage');

  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set'));
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  // ── Backfill: stamp rolling-protected on any historically-rolling episodes ──
  // set-rolling-episode.ts now stamps 'rolling-protected' on demoted rows
  // BEFORE removing 'rolling', but older handoffs (e.g. the Episode 27 →
  // Episode 28 promotion) ran before that step was added and left Episode 27
  // with neither tag.  This idempotent UPDATE catches any such gaps so the
  // discovery query below finds them.
  //
  // The title list covers every episode known to have been the rolling one
  // before the step-A0 protection was introduced.  It is safe to re-run on
  // every startup because the CASE guard makes it a no-op for rows that
  // already have the tag.
  const knownHistoricalRollingTitles = ['Episode 27'];
  for (const historicalTitle of knownHistoricalRollingTitles) {
    try {
      const backfillResult = await sql`
        UPDATE conversation_memories
        SET tags = CASE WHEN 'rolling-protected' = ANY(tags)
                        THEN tags
                        ELSE array_append(tags, 'rolling-protected')
                   END
        WHERE arc_name = ${ARC_NAME}
          AND title    = ${historicalTitle}
          AND NOT ('rolling-protected' = ANY(tags))
        RETURNING id
      `;
      if (backfillResult.length > 0) {
        console.log(
          Y(`[rolling-restore] Backfilled rolling-protected on "${historicalTitle}" ` +
            `(id: ${(backfillResult[0] as any).id})`),
        );
      }
    } catch (err: any) {
      // Non-fatal — if the backfill fails we still attempt the main restore.
      console.error(Y(`[rolling-restore] Backfill warning for "${historicalTitle}": ${err?.message ?? err}`));
    }
  }

  // ── Discover all rolling episodes in the arc ────────────────────────────────
  // Query for EITHER 'rolling' (current) OR 'rolling-protected' (all episodes
  // that have ever been rolling). 'rolling-protected' is a permanent tag added
  // by set-rolling-episode.ts when promoting; it is never removed, so retired
  // rolling episodes remain protected even after the handoff.
  const rows = await sql`
    SELECT id, title, content
    FROM conversation_memories
    WHERE arc_name = ${ARC_NAME}
      AND (
        'rolling' = ANY(tags)
        OR 'rolling-protected' = ANY(tags)
      )
    ORDER BY created_at ASC
  `;

  if (rows.length === 0) {
    console.log(Y('[rolling-restore] No rolling episodes found in DB — nothing to restore.'));
    process.exit(0);
  }

  console.log(B(`[rolling-restore] Found ${rows.length} rolling episode(s) to check.`));

  let anyFatal = false;

  for (const row of rows) {
    const episode: EpisodeRow = {
      id: row.id as string,
      title: row.title as string,
      content: row.content as string,
    };

    const mdPath = titleToMdPath(episode.title);
    if (!mdPath) {
      console.error(R(`  SKIP: Cannot derive .md path from title "${episode.title}" — no episode number found`));
      continue;
    }

    const ok = await checkAndRestore(episode, mdPath, checkShrinkageOnly);
    if (!ok) anyFatal = true;
  }

  if (anyFatal) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
});
