/**
 * seed-episode1.ts
 *
 * Idempotent seed: inserts the canonical Episode 1 ("Take That, World") row
 * into conversation_memories if it is absent.
 *
 * Safe to run multiple times — does nothing if the row already exists with
 * the correct arc_name.
 *
 * Run: npx tsx server/scripts/seed-episode1.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getSharedDb } from '../db';
import { conversationMemories } from '@shared/schema';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const EP1_TITLE      = `Episode 1: "Take That, World"`;
const EP1_ARC        = 'HolaHola Episodes';
const EP1_IMPORTANCE = 10;
const EP1_CONTENT    = readFileSync(resolve(__dirname, '../../docs/episode-1.md'), 'utf-8');

async function main() {
  const db = getSharedDb();

  // Check for existing canonical row
  const existing = await db
    .select({ id: conversationMemories.id, arcName: conversationMemories.arcName })
    .from(conversationMemories)
    .where(eq(conversationMemories.title, EP1_TITLE))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    if (row.arcName !== EP1_ARC) {
      // Fix a stale arc_name in place
      await db
        .update(conversationMemories)
        .set({ arcName: EP1_ARC, importance: EP1_IMPORTANCE })
        .where(eq(conversationMemories.id, row.id));
      console.log(`[seed-episode1] Fixed arc_name for existing row (id=${row.id}) → "${EP1_ARC}"`);
    } else {
      console.log(`[seed-episode1] Episode 1 already present (id=${row.id}) — no action needed.`);
    }
    process.exit(0);
  }

  // Row absent — insert it
  const [inserted] = await db
    .insert(conversationMemories)
    .values({
      title:      EP1_TITLE,
      summary:    'The first HolaHola episode — David and Cindy (the original tutor persona) have an unscripted voice conversation. David names it "Take That, World." February 16, 2026.',
      content:    EP1_CONTENT,
      entryType:  'episode',
      arcName:    EP1_ARC,
      importance: EP1_IMPORTANCE,
      tags:       ['episode-1', 'take-that-world', 'david-cindy', 'origin', 'holahola-genesis', 'landmark'],
      recordedAt: new Date('2026-02-16T00:00:00.000Z'),
    })
    .returning({ id: conversationMemories.id });

  if (!inserted?.id) {
    console.error('[seed-episode1] ERROR: insert returned no id');
    process.exit(1);
  }

  console.log(`[seed-episode1] Episode 1 inserted (id=${inserted.id}, arc="${EP1_ARC}", importance=${EP1_IMPORTANCE}).`);
  process.exit(0);
}

main().catch(err => {
  console.error('[seed-episode1] Unhandled error:', err?.message ?? err);
  process.exit(1);
});
