/**
 * One-time restore of tutor_voices.voice_id / voice_name after an unexplained
 * bulk overwrite on 2026-09-04 (~20:54 UTC, all 27 tutor rows touched within a
 * ~2s window). Values below were captured via two independent GET
 * /api/admin/tutor-voices checks immediately before the corruption, both
 * identical.
 *
 * Deliberately raw SQL, touching ONLY voice_id and voice_name by id — the
 * general upsert route re-derives/nulls several other columns (elStability
 * etc.) based on provider, which were NOT part of the actual corruption and
 * must not be touched here.
 *
 * Usage: npx tsx server/scripts/restore-tutor-voices-20260904.ts
 */
import { neon } from '@neondatabase/serverless';

const ORIGINAL: Record<string, { voiceId: string; voiceName: string }> = {
  'biology|female':          { voiceId: 'Aoede',         voiceName: 'Aoede' },
  'biology|male':            { voiceId: 'Orus',          voiceName: 'Orus' },
  'business|female':         { voiceId: 'Zephyr',        voiceName: 'Zephyr' },
  'business|male':           { voiceId: 'Puck',          voiceName: 'Puck' },
  'english|female':          { voiceId: 'Leda',          voiceName: 'Cindy' },
  'english|male':            { voiceId: 'Sadaltager',    voiceName: 'Blake' },
  'french|female':           { voiceId: 'Aoede',         voiceName: 'Juliette' },
  'french|male':             { voiceId: 'Orus',          voiceName: 'Vincent' },
  'german|female':           { voiceId: 'Sulafat',       voiceName: 'Greta' },
  'german|male':             { voiceId: 'Iapetus',       voiceName: 'Lukas' },
  'hebrew|female':           { voiceId: 'Aoede',         voiceName: 'Yael' },
  'hebrew|male':             { voiceId: 'Puck',          voiceName: 'Noam' },
  'history|female':          { voiceId: 'Leda',          voiceName: 'Leda' },
  'history|male':            { voiceId: 'Charon',        voiceName: 'Charon' },
  'italian|female':          { voiceId: 'Despina',       voiceName: 'Olivia' },
  'italian|male':            { voiceId: 'Charon',        voiceName: 'Charon' },
  'japanese|female':         { voiceId: 'Despina',       voiceName: 'Sayuri' },
  'japanese|male':           { voiceId: 'Iapetus',       voiceName: 'Daisuke' },
  'korean|female':           { voiceId: 'Zephyr',        voiceName: 'Zephyr' },
  'korean|male':             { voiceId: 'Zubenelgenubi', voiceName: 'Minho' },
  'mandarin chinese|female': { voiceId: 'Kore',          voiceName: 'Kore' },
  'mandarin chinese|male':   { voiceId: 'Zubenelgenubi', voiceName: 'Tao' },
  'math|female':             { voiceId: 'Kore',          voiceName: 'Kore' },
  'math|male':               { voiceId: 'Fenrir',        voiceName: 'Fenrir' },
  'portuguese|female':       { voiceId: 'Aoede',         voiceName: 'Aoede' },
  'portuguese|male':         { voiceId: 'Algenib',       voiceName: 'Camilo' },
  'spanish|female':          { voiceId: 'Leda',          voiceName: 'Daniela' },
  'spanish|male':            { voiceId: 'Orus',          voiceName: 'Agustín' },
};

async function main() {
  const url = process.env.NEON_SHARED_DATABASE_URL;
  if (!url) throw new Error('NEON_SHARED_DATABASE_URL not set');
  const sql = neon(url);

  const isDryRun = process.argv.includes('--dry-run');
  console.log(isDryRun ? '[DRY RUN] No writes will be made.\n' : '[LIVE] Writing corrections.\n');

  const rows = await sql`
    SELECT id, language, gender, voice_id, voice_name
    FROM tutor_voices
    WHERE role = 'tutor'
    ORDER BY language, gender
  `;

  console.log(`Found ${rows.length} tutor rows.\n`);

  let fixed = 0, alreadyCorrect = 0, noMapping = 0;

  for (const row of rows as any[]) {
    const key = `${row.language}|${row.gender}`;
    const original = ORIGINAL[key];
    if (!original) {
      console.warn(`[SKIP] No captured original for ${key} (id ${row.id}) — leaving untouched`);
      noMapping++;
      continue;
    }
    if (row.voice_id === original.voiceId && row.voice_name === original.voiceName) {
      console.log(`[OK]   ${key} already correct`);
      alreadyCorrect++;
      continue;
    }

    console.log(`[FIX]  ${key}: "${row.voice_id}"/"${row.voice_name}" -> "${original.voiceId}"/"${original.voiceName}"`);
    if (!isDryRun) {
      await sql`
        UPDATE tutor_voices
        SET voice_id = ${original.voiceId}, voice_name = ${original.voiceName}, updated_at = now()
        WHERE id = ${row.id}
      `;
    }
    fixed++;
  }

  console.log(`\nDone. ${isDryRun ? 'Would fix' : 'Fixed'}: ${fixed}, already correct: ${alreadyCorrect}, no mapping (untouched): ${noMapping}`);
}

main().catch(err => { console.error(err); process.exit(1); });
