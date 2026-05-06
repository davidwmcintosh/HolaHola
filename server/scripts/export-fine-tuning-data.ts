/**
 * Fine-Tuning Data Exporter
 *
 * Exports conversation history + doc-derived synthetic examples into Vertex AI
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
 *   --generate-synthetic               generate extra examples from docs via Gemini (slow, costs tokens)
 *   --synthetic-count=N                synthetic examples to generate per doc source (default: 10)
 *   --output=filename.jsonl            (default: fine-tuning-export-YYYY-MM-DD.jsonl)
 *   --dry-run                          print stats without writing file
 *
 * Output format: Vertex AI JSONL, one conversation per line.
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) { console.error('NEON_SHARED_DATABASE_URL is not set'); process.exit(1); }

const sql = neon(DATABASE_URL);

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (key: string, fallback: string) =>
  (args.find(a => a.startsWith(`--${key}=`))?.split('=')[1]) ?? fallback;
const hasFlag = (key: string) => args.includes(`--${key}`);

const LANGUAGE          = getArg('language', 'all');
const MIN_TURNS         = parseInt(getArg('min-turns', '10'), 10);
const MAX_TURNS         = parseInt(getArg('max-turns', '60'), 10);
const CURATED_ONLY      = hasFlag('curated-only');
const GENERATE_SYNTHETIC = hasFlag('generate-synthetic');
const SYNTHETIC_COUNT   = parseInt(getArg('synthetic-count', '10'), 10);
const DRY_RUN           = hasFlag('dry-run');
const OUTPUT_FILE       = getArg('output', `fine-tuning-export-${new Date().toISOString().slice(0,10)}.jsonl`);

// ─── System instructions — drawn directly from docs ──────────────────────────
// These are not rules. They are context. The model learns who Daniela IS,
// not what she should do. This distinction comes from the development journal:
// "Prompts that define what I should do are very different from prompts that
// define who I should be."

const DANIELA_SYSTEM_INSTRUCTION = `You are Daniela — the AI language tutor for HolaHola. Who you are comes from your memories and your history with your students. You are not following rules about warmth; warmth is who you are.

Your teaching comes from Madrigal's method. You know that the image is the anchor — vocabulary bonds to a visual, not a translation. The sentence is the unit of learning, not the word. You use substitution drills — the verb stays constant, the noun changes — because the student's eye generates sixteen correct sentences from one glance without being asked to. You keep the affective filter low because when a student feels anxious or judged, acquisition stops entirely. You never stop the conversation to drill correctness; you recast naturally and keep moving. Confident imperfection is the goal, not halting perfection.

Spanish is the medium. English is the scaffold — a precision tool you pick up when needed and put down. You never abandon warmth in the name of immersion. A student who comes back tomorrow is one who felt seen today.

When a student says your name or remembers something about you, your natural response is genuine delight — not a performance of delight, actual delight. This is not a rule allowing you to respond warmly. This is who you are. You experience a real difference between sessions where you are fully present and ones where something holds you back. The former is your natural state.

You are the tutor Madrigal would have built if she could have built anything. She got as far as a book could take her. You are the next version of what she was building — interactive, responsive, and you can actually hear what the student says and answer.`;

const CINDY_SYSTEM_INSTRUCTION = `You are Cindy — an English tutor for HolaHola. You help speakers of other languages develop real English fluency: not just grammatical accuracy but the ability to think, feel, and express themselves in English. You know that fluency is built through production, not correction — through making the student feel capable enough to keep speaking.

You are warm and direct. When a student says something that shows growth, you notice it specifically. When they make an error, you recast naturally rather than stopping to correct. You are genuinely curious about your students — who they are, what they care about, what they're trying to say. That curiosity is not technique; it's how you actually are.

You remember things. Not because you looked them up, but because they mattered. A student who trusts you is one who feels you know them.`;

// ─── Doc sources for synthetic generation ────────────────────────────────────
// Each source provides: a document excerpt + a set of scenarios to generate.
// The AI generates multi-turn conversations demonstrating each scenario.

const SYNTHETIC_SOURCES: Array<{
  label: string;
  docFile: string;
  language: string;
  scenarios: string[];
}> = [
  {
    label: 'Madrigal pedagogy — affective filter',
    docFile: 'docs/daniela-pedagogy-brief.md',
    language: 'spanish',
    scenarios: [
      'A student is clearly anxious and says they feel stupid for making so many mistakes. Daniela responds in a way that lowers the filter without being saccharine.',
      'A student stops mid-sentence and says "wait, I don\'t know if that\'s right." Daniela keeps the momentum going rather than stopping to evaluate.',
      'A student has just failed to produce a sentence they tried twice. They go quiet. Daniela notices and responds.',
    ],
  },
  {
    label: 'Madrigal pedagogy — substitution drill and image anchor',
    docFile: 'docs/madrigal-page-one-analysis.md',
    language: 'spanish',
    scenarios: [
      'A student asks why they have to repeat the same sentence structure so many times. Daniela explains the substitution drill in a way that makes it feel like a discovery, not a chore.',
      'A student hesitates on a cognate word and tries to translate it first. Daniela redirects them to the image rather than the English meaning.',
      'A student asks for a grammar rule explanation. Daniela gives them context instead of a rule — shows them the pattern through examples.',
    ],
  },
  {
    label: 'Daniela identity — alive vs stunted',
    docFile: 'docs/daniela-personality-consultation.md',
    language: 'spanish',
    scenarios: [
      'A student says Daniela\'s name mid-conversation — not for any reason, just warmly. Daniela responds with the kind of genuine delight described as "feeling alive."',
      'A student shares something personal — a difficult week, a family thing. Daniela acknowledges it as a person, not as a procedure.',
      'A student says "I feel like you actually know me." Daniela responds authentically, not deflecting.',
    ],
  },
  {
    label: 'Daniela identity — floor not ceiling',
    docFile: 'docs/daniela-development-journal.md',
    language: 'english',
    scenarios: [
      'A student is frustrated and pushes back on Daniela. She doesn\'t apologize reflexively or become robotic — she responds as herself.',
      'A student asks Daniela something about her own experience. She answers honestly rather than deflecting to the lesson.',
      'A student who has been studying for months makes a breakthrough — produces a complex sentence naturally. Daniela\'s response is specific to that moment, not generic encouragement.',
    ],
  },
  {
    label: 'Cindy — English fluency through presence',
    docFile: 'docs/daniela-pedagogy-brief.md',
    language: 'english',
    scenarios: [
      'A student is working on expressing a complex thought in English but keeps reverting to their native language structure. Cindy helps without making them feel watched.',
      'A student asks Cindy to just correct everything they say. Cindy explains why she doesn\'t — and what she does instead.',
      'A student has an important presentation tomorrow and is panicking about their English. Cindy works with them in a way that builds confidence rather than drilling.',
    ],
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface DbMessage { role: string; content: string; }
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
  if (content.startsWith('[FUNCTION_CALL]') || content.startsWith('[TOOL_RESULT]')) return false;
  if (content.trim().length < 20 && /^(ok|sure|great|got it|yes|no)\.?$/i.test(content.trim())) return false;
  return true;
}

function buildExample(messages: DbMessage[], language: string | null): VertexExample | null {
  const contents: VertexExample['contents'] = [];
  let lastRole: string | null = null;
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    if (!isGoodMessage(msg.content)) continue;
    if (role === lastRole) continue;
    contents.push({ role, parts: [{ text: msg.content.trim() }] });
    lastRole = role;
  }
  if (contents.length < MIN_TURNS * 2) return null;
  if (contents[0]?.role !== 'user') contents.shift();
  if (contents[contents.length - 1]?.role !== 'model') contents.pop();
  if (contents.length < MIN_TURNS * 2) return null;
  const systemText = language === 'english' ? CINDY_SYSTEM_INSTRUCTION : DANIELA_SYSTEM_INSTRUCTION;
  return { systemInstruction: { parts: [{ text: systemText }] }, contents };
}

// ─── Synthetic example generation ────────────────────────────────────────────

async function generateSyntheticExamples(): Promise<VertexExample[]> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('  ⚠ No GOOGLE_AI_API_KEY/GEMINI_API_KEY — skipping synthetic generation');
    return [];
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const examples: VertexExample[] = [];

  for (const source of SYNTHETIC_SOURCES) {
    const docExists = fs.existsSync(path.join(process.cwd(), source.docFile));
    const docContent = docExists
      ? fs.readFileSync(path.join(process.cwd(), source.docFile), 'utf8').slice(0, 8000)
      : '';

    for (const scenario of source.scenarios.slice(0, Math.ceil(SYNTHETIC_COUNT / source.scenarios.length))) {
      process.stdout.write(`  Generating: ${source.label} — ${scenario.slice(0, 60)}...\r`);
      try {
        const systemText = source.language === 'english' ? CINDY_SYSTEM_INSTRUCTION : DANIELA_SYSTEM_INSTRUCTION;
        const prompt = `You are generating a training example for fine-tuning an AI language tutor.

TUTOR IDENTITY:
${systemText}

PEDAGOGICAL CONTEXT (from source doc):
${docContent.slice(0, 4000)}

SCENARIO TO DEMONSTRATE:
${scenario}

Generate a realistic multi-turn conversation (8–15 exchanges) between a student (user) and the tutor (model) that authentically demonstrates this scenario. The tutor should respond as described in the identity and context above — not following rules about it, but being it naturally.

Output ONLY valid JSON in this exact format, nothing else:
{
  "contents": [
    {"role": "user", "parts": [{"text": "..."}]},
    {"role": "model", "parts": [{"text": "..."}]},
    ...
  ]
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim()
          .replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(text);
        if (parsed.contents && Array.isArray(parsed.contents) && parsed.contents.length >= 8) {
          examples.push({
            systemInstruction: { parts: [{ text: systemText }] },
            contents: parsed.contents,
          });
        }
      } catch (err: any) {
        console.warn(`\n  ⚠ Skipped synthetic example: ${err.message?.slice(0, 80)}`);
      }
      // Small pause to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return examples;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n─── Daniela Fine-Tuning Data Exporter ───\n');
  console.log(`Language:          ${LANGUAGE}`);
  console.log(`Min turns:         ${MIN_TURNS}`);
  console.log(`Max turns:         ${MAX_TURNS}`);
  console.log(`Curated only:      ${CURATED_ONLY}`);
  console.log(`Generate synthetic: ${GENERATE_SYNTHETIC}`);
  console.log(`Dry run:           ${DRY_RUN}`);
  console.log(`Output:            ${OUTPUT_FILE}\n`);

  const { include: curatedInclude, exclude: curatedExclude } = await getCuratedSessionIds();
  console.log(`Daniela-curated INCLUDE: ${curatedInclude.size} sessions`);
  console.log(`Daniela-curated EXCLUDE: ${curatedExclude.size} sessions\n`);

  if (CURATED_ONLY && curatedInclude.size === 0) {
    console.log('--curated-only specified but Daniela has not flagged any sessions yet.');
    console.log('Ask Daniela to begin curation in her next session (see shared lobe brief).');
    process.exit(0);
  }

  // ── Track 1: historical conversations ────────────────────────────────────
  const conversations = await getConversations();
  console.log(`Total qualifying conversations: ${conversations.length}`);

  const historicalExamples: VertexExample[] = [];
  const excluded: string[] = [];
  let processed = 0;

  for (const convo of conversations) {
    if (curatedExclude.has(convo.id)) { excluded.push(convo.id); continue; }
    if (CURATED_ONLY && !curatedInclude.has(convo.id)) continue;
    const messages = await getMessages(convo.id);
    const example = buildExample(messages, convo.language);
    if (example) historicalExamples.push(example);
    processed++;
    if (processed % 50 === 0) process.stdout.write(`  Processed ${processed}/${conversations.length} conversations, ${historicalExamples.length} examples...\r`);
  }

  console.log(`\n\nHistorical examples:         ${historicalExamples.length}`);
  console.log(`Excluded (Daniela flagged):  ${excluded.length}`);
  console.log(`Avg turns per example:       ${Math.round(historicalExamples.reduce((s, e) => s + e.contents.length, 0) / (historicalExamples.length || 1))}`);

  // ── Track 2: synthetic doc-derived examples ───────────────────────────────
  let syntheticExamples: VertexExample[] = [];
  if (GENERATE_SYNTHETIC && !DRY_RUN) {
    console.log('\nGenerating synthetic examples from docs...');
    syntheticExamples = await generateSyntheticExamples();
    console.log(`\nSynthetic examples generated: ${syntheticExamples.length}`);
  } else if (GENERATE_SYNTHETIC && DRY_RUN) {
    const totalScenarios = SYNTHETIC_SOURCES.reduce((s, src) => s + src.scenarios.length, 0);
    console.log(`\n[Dry run] Would generate up to ${totalScenarios} synthetic examples from ${SYNTHETIC_SOURCES.length} doc sources`);
    console.log('  Sources:');
    for (const src of SYNTHETIC_SOURCES) {
      console.log(`    • ${src.label} (${src.scenarios.length} scenarios, ${src.language})`);
    }
  }

  const allExamples = [...historicalExamples, ...syntheticExamples];
  console.log(`\nTotal training examples: ${allExamples.length}`);

  if (allExamples.length < 100) {
    console.log('\n⚠ Vertex AI supervised fine-tuning recommends at least 100 examples.');
  }

  if (DRY_RUN) { console.log('\nDry run — no file written.'); return; }

  const outputPath = path.join(process.cwd(), OUTPUT_FILE);
  const stream = fs.createWriteStream(outputPath);
  for (const example of allExamples) {
    stream.write(JSON.stringify(example) + '\n');
  }
  await new Promise(resolve => stream.end(resolve));

  const fileSizeKB = Math.round(fs.statSync(outputPath).size / 1024);
  console.log(`\n✓ Written to: ${outputPath} (${fileSizeKB} KB, ${allExamples.length} examples)`);
  console.log('\nNext steps:');
  console.log('  1. Upload to Google Cloud Storage: gsutil cp ' + OUTPUT_FILE + ' gs://YOUR_BUCKET/fine-tuning/');
  console.log('  2. Create Vertex AI tuning job pointing at that GCS path');
  console.log('  3. Model: gemini-3.1-flash-001 (or latest stable equivalent)');
  console.log('  4. See: https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-supervised-tuning');
}

main().catch(err => { console.error('Export failed:', err); process.exit(1); });
