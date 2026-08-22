/**
 * Removes the exact CI-CONCURRENT-SENTINEL HTML-comment artefacts that were
 * historically written into Episode 27's canonical DB content by an unsafe CI
 * check. The database is updated first; the Markdown file is then regenerated
 * from the committed DB value so both representations remain exact replicas.
 *
 * Safe to rerun: when no exact artefact remains, it verifies the existing
 * DB/Markdown equality without changing either record.
 *
 * Usage: npx tsx server/scripts/repair-episode-27-ci-sentinels.ts
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

const EPISODE_ID = '27000000-0000-4000-8000-000000000027';
const MD_PATH = join(process.cwd(), 'docs', 'episode-27.md');
const ARTIFACT_RE = /\n?<!-- \[CI-CONCURRENT-SENTINEL-\d+\] should-be-stripped-by-cleanup -->\n?/g;
const ARTIFACT_NEEDLE = 'CI-CONCURRENT-SENTINEL';

async function main(): Promise<void> {
  const databaseUrl = process.env.NEON_SHARED_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('NEON_SHARED_DATABASE_URL is required.');
  }

  const sql = neon(databaseUrl);
  const rows = await sql`
    SELECT content
    FROM conversation_memories
    WHERE id = ${EPISODE_ID}
  `;
  if (rows.length !== 1) {
    throw new Error(`Episode 27 DB row ${EPISODE_ID} was not found.`);
  }

  const canonicalContent = String(rows[0].content ?? '');
  if (!canonicalContent) {
    throw new Error('Episode 27 canonical content is empty; refusing repair.');
  }

  const exactArtifacts = canonicalContent.match(ARTIFACT_RE) ?? [];
  const repairedContent = canonicalContent.replace(ARTIFACT_RE, '');
  if (exactArtifacts.length > 0) {
    await sql`
      UPDATE conversation_memories
      SET content = ${repairedContent}
      WHERE id = ${EPISODE_ID}
    `;
    console.log(`Removed ${exactArtifacts.length} exact CI sentinel block(s) from Episode 27 canonical DB content.`);
  } else {
    console.log('No exact CI sentinel blocks remain in Episode 27 canonical DB content.');
  }

  const verifyRows = await sql`
    SELECT content
    FROM conversation_memories
    WHERE id = ${EPISODE_ID}
  `;
  const verifiedContent = String(verifyRows[0]?.content ?? '');
  if (verifiedContent.includes(ARTIFACT_NEEDLE)) {
    throw new Error('Episode 27 canonical DB content still contains a CI concurrent sentinel.');
  }

  writeFileSync(MD_PATH, verifiedContent, 'utf8');
  const markdownReplica = existsSync(MD_PATH) ? readFileSync(MD_PATH, 'utf8') : '';
  if (markdownReplica !== verifiedContent) {
    throw new Error('Episode 27 Markdown replica does not exactly match canonical DB content.');
  }
  if (markdownReplica.includes(ARTIFACT_NEEDLE)) {
    throw new Error('Episode 27 Markdown replica still contains a CI concurrent sentinel.');
  }

  console.log(
    `Episode 27 repaired and replicated: ${verifiedContent.length} bytes; ` +
    'DB and Markdown are exact and sentinel-free.',
  );
}

main().catch((error) => {
  console.error(`FATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});