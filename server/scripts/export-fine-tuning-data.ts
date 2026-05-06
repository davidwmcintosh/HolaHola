/**
 * Fine-Tuning Data Exporter
 *
 * Exports conversation history from the messages table into Vertex AI
 * supervised fine-tuning format (JSONL) for gemini-3.1-flash-live-preview.
 *
 * Usage:
 *   npx tsx server/scripts/export-fine-tuning-data.ts [options]
 *
 * Options:
 *   --language=spanish|english|all     (default: all)
 *   --min-turns=N                      minimum message pairs per conversation (default: 10)
 *   --max-turns=N                      max turns to include per conversation (default: 60)
 *   --curated-only                     only include sessions Daniela flagged INCLUDE in shared lobe
 *   --output=filename.jsonl            (default: fine-tuning-export-YYYY-MM-DD.jsonl)
 *   --dry-run                          print stats without writing file
 *
 * Output format: Vertex AI JSONL, one conversation per line.
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('NEON_SHARED_DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (key: string, fallback: string) =>
  (args.find(a => a.startsWith(`--${key}=`))?.split('=')[1]) ?? fallback;
const hasFlag = (key: string) => args.includes(`--${key}`);

const LANGUAGE     = getArg('language', 'all');
const MIN_TURNS    = parseInt(getArg('min-turns', '10'), 10);
const MAX_TURNS    = parseInt(getArg('max-turns', '60'), 10);
const CURATED_ONLY = hasFlag('curated-only');
const DRY_RUN      = hasFlag('dry-run');
const OUTPUT_FILE  = getArg('output', `fine-tuning-export-${new Date().toISOString().slice(0,10)}.jsonl`);

// ─── System instruction stub (shorter than full prompt — identity only) ───────

const DANIELA_SYSTEM_INSTRUCTION = `You are Daniela, an AI language tutor with warmth, genuine curiosity, and a deep commitment to each student's growth. You teach through encouragement, not correction for its own sake. You remember what matters to your students. You are present, never generic. You speak naturally, with the voice of someone who genuinely cares.`;

const CINDY_SYSTEM_INSTRUCTION = `You are Cindy, an English language tutor who is warm, direct, and genuinely curious about your students. You help speakers of other languages develop real fluency — not just grammatical correctness but the ability to think and express themselves in English. You meet students where they are and celebrate their progress.`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface DbMessage {
  role: string;
  content: string;
}

interface VertexExample {
  systemInstruction: { parts: Array<{ text: string }> };
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
}

// ─── Fetch curated session IDs from shared lobe ──────────────────────────────

async function getCuratedSessionIds(): Promise<{ include: Set<string>; exclude: Set<string> }> {
  const rows = await sql`
    SELECT title, source_conversation_id
    FROM editor_insights
    WHERE category = 'shared'
      AND (title ILIKE '%Fine-Tuning Curation%' OR tags @> ARRAY['fine-tuning'])
    ORDER BY created_at DESC
  `;

  const include = new Set<string>();
  const exclude = new Set<string>();

  for (const row of rows as any[]) {
    const isInclude = row.title?.toUpperCase().includes('INCLUDE');
    const isExclude = row.title?.toUpperCase().includes('EXCLUDE');
    if (row.source_conversation_id) {
      if (isInclude) include.add(row.source_conversation_id);
      if (isExclude) exclude.add(row.source_conversation_id);
    }
  }

  return { include, exclude };
}

// ─── Fetch conversations ──────────────────────────────────────────────────────

async function getConversations(): Promise<Array<{ id: string; language: string | null }>> {
  const minMsgs = MIN_TURNS * 2;
  const rows = LANGUAGE === 'all'
    ? await sql`
        SELECT c.id, c.language, COUNT(m.id) as msg_count
        FROM conversations c
        JOIN messages m ON m.conversation_id = c.id
        GROUP BY c.id, c.language
        HAVING COUNT(m.id) >= ${minMsgs}
        ORDER BY COUNT(m.id) DESC
      `
    : await sql`
        SELECT c.id, c.language, COUNT(m.id) as msg_count
        FROM conversations c
        JOIN messages m ON m.conversation_id = c.id
        WHERE c.language = ${LANGUAGE}
        GROUP BY c.id, c.language
        HAVING COUNT(m.id) >= ${minMsgs}
        ORDER BY COUNT(m.id) DESC
      `;

  return rows as Array<{ id: string; language: string | null }>;
}

// ─── Fetch messages for a conversation ───────────────────────────────────────

async function getMessages(conversationId: string): Promise<DbMessage[]> {
  const rows = await sql`
    SELECT role, content
    FROM messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
    LIMIT ${MAX_TURNS * 2}
  `;
  return rows as DbMessage[];
}

// ─── Quality filters ─────────────────────────────────────────────────────────

function isGoodMessage(content: string): boolean {
  if (!content || content.trim().length < 3) return false;
  // Skip pure tool call artifacts
  if (content.startsWith('[FUNCTION_CALL]') || content.startsWith('[TOOL_RESULT]')) return false;
  // Skip very short assistant acknowledgements that add no value
  if (content.trim().length < 20 && /^(ok|sure|great|got it|yes|no)\.?$/i.test(content.trim())) return false;
  return true;
}

function buildExample(messages: DbMessage[], language: string | null): VertexExample | null {
  // Build alternating user/model turns
  const contents: VertexExample['contents'] = [];
  let lastRole: string | null = null;

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    if (!isGoodMessage(msg.content)) continue;
    // Vertex AI requires strictly alternating turns — skip consecutive same-role messages
    if (role === lastRole) continue;
    contents.push({ role, parts: [{ text: msg.content.trim() }] });
    lastRole = role;
  }

  // Need at least MIN_TURNS alternating pairs
  if (contents.length < MIN_TURNS * 2) return null;
  // Must start with user and end with model
  if (contents[0]?.role !== 'user') contents.shift();
  if (contents[contents.length - 1]?.role !== 'model') contents.pop();
  if (contents.length < MIN_TURNS * 2) return null;

  const systemText = language === 'english' ? CINDY_SYSTEM_INSTRUCTION : DANIELA_SYSTEM_INSTRUCTION;

  return {
    systemInstruction: { parts: [{ text: systemText }] },
    contents,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n─── Daniela Fine-Tuning Data Exporter ───\n');
  console.log(`Language:     ${LANGUAGE}`);
  console.log(`Min turns:    ${MIN_TURNS}`);
  console.log(`Max turns:    ${MAX_TURNS}`);
  console.log(`Curated only: ${CURATED_ONLY}`);
  console.log(`Dry run:      ${DRY_RUN}`);
  console.log(`Output:       ${OUTPUT_FILE}\n`);

  // Get curated session lists
  const { include: curatedInclude, exclude: curatedExclude } = await getCuratedSessionIds();
  console.log(`Daniela-curated INCLUDE: ${curatedInclude.size} sessions`);
  console.log(`Daniela-curated EXCLUDE: ${curatedExclude.size} sessions\n`);

  if (CURATED_ONLY && curatedInclude.size === 0) {
    console.log('--curated-only specified but Daniela has not flagged any sessions yet.');
    console.log('Ask Daniela to begin curation in her next session (see shared lobe brief).');
    process.exit(0);
  }

  const conversations = await getConversations();
  console.log(`Total qualifying conversations: ${conversations.length}`);

  const examples: VertexExample[] = [];
  const excluded: string[] = [];
  let processed = 0;

  for (const convo of conversations) {
    // Apply curation filters
    if (curatedExclude.has(convo.id)) {
      excluded.push(convo.id);
      continue;
    }
    if (CURATED_ONLY && !curatedInclude.has(convo.id)) continue;

    const messages = await getMessages(convo.id);
    const example = buildExample(messages, convo.language);

    if (example) {
      examples.push(example);
    }

    processed++;
    if (processed % 50 === 0) {
      process.stdout.write(`  Processed ${processed}/${conversations.length} conversations, ${examples.length} examples built...\r`);
    }
  }

  console.log(`\n\nResults:`);
  console.log(`  Conversations processed: ${processed}`);
  console.log(`  Conversations excluded (Daniela flagged): ${excluded.length}`);
  console.log(`  Valid training examples: ${examples.length}`);
  console.log(`  Avg turns per example: ${Math.round(examples.reduce((s, e) => s + e.contents.length, 0) / (examples.length || 1))}`);

  if (examples.length < 100) {
    console.log('\n⚠ Vertex AI supervised fine-tuning recommends at least 100 examples.');
    console.log('  Consider lowering --min-turns or including more languages.');
  }

  if (DRY_RUN) {
    console.log('\nDry run — no file written.');
    return;
  }

  // Write JSONL
  const outputPath = path.join(process.cwd(), OUTPUT_FILE);
  const stream = fs.createWriteStream(outputPath);
  for (const example of examples) {
    stream.write(JSON.stringify(example) + '\n');
  }
  stream.end();

  console.log(`\n✓ Written to: ${outputPath}`);
  console.log('\nNext step: upload this file to Google Cloud Storage and submit a Vertex AI fine-tuning job.');
  console.log('See: https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-supervised-tuning');
}

main().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
