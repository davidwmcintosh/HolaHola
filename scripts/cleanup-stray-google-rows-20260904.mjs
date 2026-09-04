// Removes the 20 stray 'google'-provider tutor_voices rows that appeared
// unexpectedly after calling POST /api/admin/tutor-voices/seed-openai — their
// voiceId/voiceName exactly match seedDefaultTutorVoices()'s hardcoded Chirp3-HD
// table, not seedDefaultOpenAIVoices()'s (which was actually called). Root
// cause under investigation; this only deletes rows matching that exact
// fingerprint (provider='google' AND created within the incident window),
// leaving every pre-existing row (including the real, months-old 'google'
// assistant/support rows) untouched.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_SHARED_DATABASE_URL);
const isDryRun = process.argv.includes('--dry-run');

const rows = await sql`
  SELECT id, language, gender, provider, voice_id, voice_name, created_at
  FROM tutor_voices
  WHERE role = 'tutor' AND provider = 'google' AND created_at > now() - interval '1 hour'
  ORDER BY created_at
`;

console.log(`${isDryRun ? '[DRY RUN] Would delete' : 'Deleting'} ${rows.length} rows:`);
for (const r of rows) {
  console.log(' ', r.language, r.gender, '|', r.voice_id, '/', r.voice_name, '|', r.created_at);
}

if (!isDryRun && rows.length > 0) {
  const ids = rows.map(r => r.id);
  const result = await sql`DELETE FROM tutor_voices WHERE id = ANY(${ids})`;
  console.log(`Deleted ${rows.length} rows.`);
}
