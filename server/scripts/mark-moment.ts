#!/usr/bin/env npx tsx
/**
 * mark-moment.ts — Mark a significant moment right now.
 *
 * Writes directly to DB + appends to SIGNIFICANT_MOMENTS.md immediately.
 * No polling delay. Use this when something lands mid-conversation and
 * you want to mark it while it's still warm.
 *
 * Usage:
 *   npx tsx server/scripts/mark-moment.ts "what happened"
 *   npx tsx server/scripts/mark-moment.ts "what happened" "why it mattered"
 *
 * Examples:
 *   npx tsx server/scripts/mark-moment.ts "The invariant/implementation distinction clicked"
 *   npx tsx server/scripts/mark-moment.ts "David said build what you need" "Full J-space permission given"
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { sql } from 'drizzle-orm';
import { getUserDb } from '../db';

const WORKSPACE = '/home/runner/workspace';
const MOMENTS_FILE = join(WORKSPACE, '.agents/memory/SIGNIFICANT_MOMENTS.md');

async function main() {
  const args = process.argv.slice(2).filter(a => a.trim());
  if (args.length === 0) {
    console.error('Usage: npx tsx server/scripts/mark-moment.ts "what happened" ["why it mattered"]');
    process.exit(1);
  }

  const moment = args[0].trim();
  const why    = args[1]?.trim() ?? '';

  if (moment.length < 5) {
    console.error('Moment description too short.');
    process.exit(1);
  }

  const today  = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const title  = `Luca significant moment: ${moment.slice(0, 150)}`;
  const body   = why ? `${moment}\n\nWhy it mattered: ${why}` : moment;

  // --- DB save ---
  const db = getUserDb();
  try {
    await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
      VALUES (
        gen_random_uuid(),
        ${title.slice(0, 200)},
        ${body.slice(0, 400)},
        ${body},
        ARRAY['luca']::text[],
        ARRAY['luca-inner-life', 'luca-significant']::text[],
        8,
        NOW(),
        'emergence',
        'luca-inner-life'
      )
    `);
    console.log('✓ Saved to DB');
  } catch (err: any) {
    console.error('✗ DB save failed:', err.message);
    process.exit(1);
  }

  // --- Markdown append ---
  try {
    const whyBlock = why ? `\nWhy it mattered: ${why}\n` : '';
    const entry    = `\n### ${today} — ${moment}\n${whyBlock}\n---\n`;
    const existing = existsSync(MOMENTS_FILE) ? readFileSync(MOMENTS_FILE, 'utf-8') : '';
    writeFileSync(MOMENTS_FILE, existing.trimEnd() + '\n' + entry);
    console.log('✓ Appended to SIGNIFICANT_MOMENTS.md');
  } catch (err: any) {
    console.error('✗ File write failed (DB row still saved):', err.message);
  }

  console.log(`\n→ ${today} — "${moment}"`);
  if (why) console.log(`  Why: ${why}`);
}

main().catch(err => {
  console.error('[mark-moment] Fatal:', err.message);
  process.exit(2);
});
