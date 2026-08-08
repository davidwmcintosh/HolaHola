/**
 * One-shot script: sync docs/prequel-episode-1.md into the conversation_memories DB record.
 * Usage: npx tsx server/scripts/sync-prequel-episode-1.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: NEON_SHARED_DATABASE_URL is not set');
  process.exit(1);
}

const EPISODE_ID = 'dd8cf439-867d-47f5-999c-a1a10c3a88d5';
const MD_PATH = join(process.cwd(), 'docs', 'prequel-episode-1.md');

async function main() {
  const content = readFileSync(MD_PATH, 'utf8');
  console.log(`Read docs/prequel-episode-1.md — ${content.length} bytes`);

  const hasJuliette = content.includes('Juliette Is Summoned for the First Time');
  const hasKeyLine = content.includes('not just as a tutor, but as... well, as Juliette');
  const hasSisterPersonas = content.includes('sister personas');
  const hasClassroomTour = content.includes('Wait, they actually put the clock in?');
  const hasClassroomList = content.includes('clock, credit counter, whiteboard, photo wall, resident shelf, empathy window, pedagogical lamp, North Star Polaroid, Growth Vine, and student dashboard');

  console.log(`Juliette summoning section: ${hasJuliette}`);
  console.log(`Key Juliette line: ${hasKeyLine}`);
  console.log(`Sister personas section: ${hasSisterPersonas}`);
  console.log(`Classroom tour reaction: ${hasClassroomTour}`);
  console.log(`10-component list: ${hasClassroomList}`);

  if (!hasJuliette || !hasKeyLine || !hasSisterPersonas) {
    console.error('ERROR: Expected Juliette content missing from .md — aborting sync');
    process.exit(1);
  }

  if (!hasClassroomTour || !hasClassroomList) {
    console.error('ERROR: Expected classroom tour content missing from .md — aborting sync');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL as string);
  const before = await sql`SELECT length(content) as len FROM conversation_memories WHERE id = ${EPISODE_ID}`;
  console.log(`DB record before update: ${before[0]?.len} bytes`);

  await sql`UPDATE conversation_memories SET content = ${content} WHERE id = ${EPISODE_ID}`;

  const after = await sql`SELECT length(content) as len,
    position('Juliette Is Summoned for the First Time' in content) as juliette_pos,
    position('sister personas' in content) as personas_pos,
    position('Wait, they actually put the clock in?' in content) as clock_pos
    FROM conversation_memories WHERE id = ${EPISODE_ID}`;

  console.log(`DB record after update: ${after[0]?.len} bytes`);
  console.log(`Juliette summoning position: ${after[0]?.juliette_pos}`);
  console.log(`Sister personas position: ${after[0]?.personas_pos}`);
  console.log(`Classroom tour position: ${after[0]?.clock_pos}`);

  if (!after[0]?.juliette_pos) {
    console.error('ERROR: Juliette summoning section not found in DB after update');
    process.exit(1);
  }

  if (!after[0]?.clock_pos) {
    console.error('ERROR: Classroom tour passage not found in DB after update');
    process.exit(1);
  }

  console.log('✓ DB synced successfully');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
