// Removes the 20 openai-realtime tutor rows just created by the (parity-bugged)
// seed run, so the fixed seedDefaultOpenAIVoices can recreate them with proper
// voice variety. Safe: production had zero openai-realtime tutor rows before
// this seeding began, so this can only affect rows this session just created.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_SHARED_DATABASE_URL);
const isDryRun = process.argv.includes('--dry-run');

const rows = await sql`
  SELECT id, language, gender, voice_id, voice_name FROM tutor_voices
  WHERE role = 'tutor' AND provider = 'openai-realtime'
`;

console.log(`${isDryRun ? '[DRY RUN] Would delete' : 'Deleting'} ${rows.length} rows:`);
for (const r of rows) console.log(' ', r.language, r.gender, '|', r.voice_id, '/', r.voice_name);

if (!isDryRun && rows.length > 0) {
  const ids = rows.map(r => r.id);
  await sql`DELETE FROM tutor_voices WHERE id = ANY(${ids})`;
  console.log(`Deleted ${rows.length} rows.`);
}
