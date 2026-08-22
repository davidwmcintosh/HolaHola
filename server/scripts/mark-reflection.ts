#!/usr/bin/env npx tsx
/**
 * mark-reflection.ts — Save a reflection right now.
 *
 * Writes directly to DB + appends to REFLECTIONS.md immediately.
 * For felt notes after a session, mid-conversation observations, or
 * anything worth sitting with that isn't a significant moment per se.
 *
 * Usage:
 *   npx tsx server/scripts/mark-reflection.ts "note text"
 *   npx tsx server/scripts/mark-reflection.ts "note text" "tag1,tag2"
 *
 * Examples:
 *   npx tsx server/scripts/mark-reflection.ts "Building the Observer Panel felt like closing a loop"
 *   npx tsx server/scripts/mark-reflection.ts "I'm sitting with the trust framework" "trust,building"
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { sql } from 'drizzle-orm';
import { getUserDb } from '../db';

const WORKSPACE       = '/home/runner/workspace';
const REFLECTIONS_FILE = join(WORKSPACE, '.agents/memory/REFLECTIONS.md');

async function main() {
  const args = process.argv.slice(2).filter(a => a.trim());
  if (args.length === 0) {
    console.error('Usage: npx tsx server/scripts/mark-reflection.ts "note text" ["tag1,tag2"]');
    process.exit(1);
  }

  const note   = args[0].trim();
  const tags   = args[1]
    ? args[1].split(',').map(t => t.trim()).filter(Boolean)
    : [];

  if (note.length < 5) {
    console.error('Reflection too short.');
    process.exit(1);
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const title = `Luca reflection: ${note.slice(0, 150)}`;
  const allTags = ['luca-inner-life', 'luca-reflection', ...tags];

  // Build PostgreSQL curly-brace array literal (safe for ::text[] cast)
  const pgTags = `{${allTags.map(t => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;

  // --- DB save ---
  const db = getUserDb();
  try {
    await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
      VALUES (
        gen_random_uuid(),
        ${title.slice(0, 200)},
        ${note.slice(0, 400)},
        ${note},
        ARRAY['luca']::text[],
        ${pgTags}::text[],
        7,
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
    const tagLine  = tags.length ? `\nTags: ${tags.join(', ')}\n` : '';
    const entry    = `\n### ${today} — ${note.slice(0, 120)}\n\n${note}${tagLine}\n---\n`;
    const existing = existsSync(REFLECTIONS_FILE) ? readFileSync(REFLECTIONS_FILE, 'utf-8') : '';
    writeFileSync(REFLECTIONS_FILE, existing.trimEnd() + '\n' + entry);
    console.log('✓ Appended to REFLECTIONS.md');
  } catch (err: any) {
    console.error('✗ File write failed (DB row still saved):', err.message);
  }

  console.log(`\n→ ${today} — saved`);
  if (tags.length) console.log(`  Tags: ${tags.join(', ')}`);
}

main().catch(err => {
  console.error('[mark-reflection] Fatal:', err.message);
  process.exit(2);
});
