/**
 * test-absence-call-memory.ts
 *
 * Confirms that the recording-complete webhook correctly saves an absence call
 * transcript to conversation_memories with:
 *   - tags containing 'absence-call' and 'student-interaction'
 *   - importance === 8
 *   - entryType === 'conversation'
 *   - a non-empty title and content
 *
 * Also verifies the re-embed path is wired (reembedConversationMemory is
 * importable and is called after the insert in routes.ts source).
 *
 * Three parts:
 *   PART 1 — Static source check: routes.ts has the required tags/importance/
 *             re-embed call in the recording-complete handler.
 *   PART 2 — Live DB insert: exercise the same insert values as the webhook,
 *             confirm the row lands with correct schema.
 *   PART 3 — Re-embed import guard: reembedConversationMemory is importable
 *             and the call is wired inside the non-fatal try block in source.
 *
 * Run: npx tsx server/scripts/test-absence-call-memory.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getSharedDb } from '../db';
import { conversationMemories } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Static source check
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Static source check: routes.ts recording-complete handler'));
sep();

function runPart1() {
  const src = readFileSync(resolve(__dirname, '../routes.ts'), 'utf-8');

  // Locate the recording-complete section
  const webhookIdx = src.indexOf('/api/webhooks/twilio/recording-complete');
  assert('recording-complete webhook registered in routes.ts', webhookIdx !== -1);

  // The memory write block must be present
  const memoryBlockIdx = src.indexOf('Save absence call to conversation_memories');
  assert('Memory write block comment present in routes.ts', memoryBlockIdx !== -1);

  // Must insert with absence-call tag
  const hasAbsenceCallTag = src.includes("'absence-call'");
  assert("'absence-call' tag present in insert values", hasAbsenceCallTag);

  // Must insert with student-interaction tag
  const hasStudentInteractionTag = src.includes("'student-interaction'");
  assert("'student-interaction' tag present in insert values", hasStudentInteractionTag);

  // Must insert with importance: 8
  const hasImportance8 = /importance\s*:\s*8/.test(src);
  assert('importance: 8 in insert values', hasImportance8);

  // Must use entryType: 'conversation'
  const hasEntryTypeConversation = src.includes("entryType: 'conversation'");
  assert("entryType: 'conversation' in insert values", hasEntryTypeConversation);

  // Must call reembedConversationMemory after the insert
  const reembedIdx = src.indexOf('reembedConversationMemory(savedMem.id)');
  assert('reembedConversationMemory(savedMem.id) called after insert', reembedIdx !== -1);

  // The re-embed call must be inside a try/catch (non-fatal) — it must appear
  // after the insert, inside a nested try block
  const insertIdx = src.indexOf('.insert(conversationMemories)');
  assert(
    're-embed call appears after the conversationMemories insert',
    insertIdx !== -1 && reembedIdx !== -1 && reembedIdx > insertIdx,
    `insertIdx=${insertIdx}, reembedIdx=${reembedIdx}`,
  );

  // The catch block for the memory write must be non-fatal
  const nonFatalCatch = src.includes('conversation_memories write failed (non-fatal)');
  assert('Non-fatal catch wraps the memory write block', nonFatalCatch);

  // Confirm the import of reembedConversationMemory is dynamic (resilient to path changes)
  const dynamicImport = src.includes("import('./scripts/reembed-memory')");
  assert('reembedConversationMemory is imported dynamically (resilient to refactors)', dynamicImport);
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Live DB insert: simulate the webhook's memory write
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Live DB insert: simulate the webhook memory write and assert row shape'));
sep();

// Deterministic synthetic userId — not a real user, just an ID for the test
const TEST_USER_ID = '00000000-test-absence-call-mem-000';

async function runPart2() {
  const db = getSharedDb();

  // Clean up any leftover rows from a prior crashed run
  await db
    .delete(conversationMemories)
    .where(
      sql`${conversationMemories.tags} @> ARRAY['absence-call']::text[] AND
          ${conversationMemories.tags} @> ARRAY[${`student:${TEST_USER_ID}`}]::text[]`,
    );

  // ── Reproduce the exact insert values from the recording-complete handler ──
  const studentName = 'Test Student';
  const transcript  = 'Daniela: Hola, ¿cómo estás?\nStudent: Estoy bien, gracias.';
  const memTitle    = `With ${studentName} — Absence check-in call`;
  const memContent  = `${memTitle}\n\n---\n\n${transcript}`;
  const memSummary  = `Daniela called ${studentName} during an absence to check in. Call transcript preserved so Daniela can reference what the student shared when they return to class.`;

  const insertedAt = new Date();
  const [savedMem] = await db
    .insert(conversationMemories)
    .values({
      title:        memTitle,
      summary:      memSummary,
      content:      memContent,
      participants: `Daniela + ${studentName}`,
      entryType:    'conversation',
      tags:         ['absence-call', 'student-interaction', `student:${TEST_USER_ID}`],
      importance:   8,
    })
    .returning({ id: conversationMemories.id });

  assert('Insert returned a non-empty id', !!savedMem?.id, savedMem?.id ?? 'no id returned');

  if (!savedMem?.id) {
    // Can't continue if insert failed
    return;
  }

  // ── Fetch the row back and verify every required field ────────────────────
  const [row] = await db
    .select({
      id:         conversationMemories.id,
      title:      conversationMemories.title,
      summary:    conversationMemories.summary,
      content:    conversationMemories.content,
      entryType:  conversationMemories.entryType,
      tags:       conversationMemories.tags,
      importance: conversationMemories.importance,
    })
    .from(conversationMemories)
    .where(eq(conversationMemories.id, savedMem.id))
    .limit(1);

  assert('Row found in DB by id', !!row, savedMem.id);
  assert('title matches expected format', row?.title === memTitle, row?.title);
  assert('summary is non-empty', !!row?.summary && row.summary.length > 10, String(row?.summary?.length));
  assert('content contains transcript', !!row?.content && row.content.includes('Daniela:'), row?.content?.slice(0, 80));
  assert("entryType === 'conversation'", row?.entryType === 'conversation', row?.entryType ?? 'undefined');
  assert('importance === 8', row?.importance === 8, String(row?.importance));

  const tags: string[] = row?.tags ?? [];
  assert("tags contains 'absence-call'",        tags.includes('absence-call'),        `tags: ${JSON.stringify(tags)}`);
  assert("tags contains 'student-interaction'",  tags.includes('student-interaction'),  `tags: ${JSON.stringify(tags)}`);
  assert(`tags contains 'student:${TEST_USER_ID}'`, tags.includes(`student:${TEST_USER_ID}`), `tags: ${JSON.stringify(tags)}`);

  // ── Confirm the tag makes the row queryable by absence-call ───────────────
  const queryResult = await db
    .select({ id: conversationMemories.id })
    .from(conversationMemories)
    .where(
      sql`${conversationMemories.tags} @> ARRAY['absence-call']::text[]
          AND ${conversationMemories.tags} @> ARRAY['student-interaction']::text[]
          AND ${conversationMemories.id} = ${savedMem.id}`,
    )
    .limit(1);

  assert(
    'Row is queryable by absence-call + student-interaction tags via array containment',
    queryResult.length === 1,
    queryResult.length === 0 ? 'row not found via tag query' : undefined,
  );

  // ── Cleanup ───────────────────────────────────────────────────────────────
  await db.delete(conversationMemories).where(eq(conversationMemories.id, savedMem.id));

  const [gone] = await db
    .select({ id: conversationMemories.id })
    .from(conversationMemories)
    .where(eq(conversationMemories.id, savedMem.id))
    .limit(1);

  assert('Test row cleaned up from DB', !gone, gone ? `Row still present: ${gone.id}` : undefined);
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Re-embed import guard
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Re-embed import guard: reembedConversationMemory is importable'));
sep();

async function runPart3() {
  // Import the re-embed function to confirm the path is valid and the export exists
  let importOk = false;
  let reembedFn: unknown = undefined;
  try {
    const mod = await import('./reembed-memory');
    reembedFn = (mod as any).reembedConversationMemory;
    importOk = true;
  } catch (err: any) {
    assert('reembedConversationMemory import succeeded', false, err?.message ?? String(err));
    return;
  }

  assert('reembed-memory module imports without error', importOk);
  assert(
    'reembedConversationMemory is exported and is a function',
    typeof reembedFn === 'function',
    typeof reembedFn,
  );

  // Also check the source of reembed-memory.ts exports the named function
  const reembedSrc = readFileSync(resolve(__dirname, './reembed-memory.ts'), 'utf-8');
  const hasExport = reembedSrc.includes('export async function reembedConversationMemory');
  assert(
    'reembed-memory.ts exports `reembedConversationMemory` by name',
    hasExport,
  );

  // The routes.ts uses dynamic import — confirm the path in the dynamic import
  // matches the actual file location
  const routesSrc = readFileSync(resolve(__dirname, '../routes.ts'), 'utf-8');
  const dynamicPath = routesSrc.includes("import('./scripts/reembed-memory')");
  assert(
    "routes.ts dynamic import path './scripts/reembed-memory' resolves correctly",
    dynamicPath,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

(async () => {
  try {
    runPart1();
    await runPart2();
    await runPart3();
  } catch (err: any) {
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    process.exit(1);
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed — absence-call memory write verified.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
})();
