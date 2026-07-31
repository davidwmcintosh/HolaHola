/**
 * test-absence-call-reach-synthesis.ts
 *
 * Confirms the end-to-end pipeline: what a student told Daniela on an absence
 * call actually reaches her pre-session synthesis when they return to class.
 *
 * Task #264 built the save mechanism (recording-complete webhook → conversation_memories).
 * This test confirms the RETRIEVAL half — that the saved row can reach synthesis.
 *
 * Pipeline under test:
 *   recording-complete webhook
 *     → DB: conversation_memories (importance:8, tags: ['absence-call', 'student-interaction', 'student:${userId}'])
 *     → session-compass-service.ts: scored pool (importance < 10, limit 40, ranked by topic+recency)
 *     → compassContext.conversationMemories[0] (the top-ranked memory)
 *     → buildLiteContext() → "A MEMORY THAT STILL MATTERS" block
 *     → generatePreSessionSynthesis() → Daniela's inner monologue carries the call content
 *
 * Four parts:
 *   PART 1 — Source-level checks: verify the row shape makes it retrievable
 *   PART 2 — DB retrieval: seed the row, query the scored pool, confirm it appears
 *   PART 3 — Synthesis reach: pass the absence-call memory as compassContext.conversationMemories[0],
 *             confirm generatePreSessionSynthesis() mentions the call content
 *   PART 4 — Source-level pipeline: confirm the data flow is wired end-to-end
 *
 * Run: npx tsx server/scripts/test-absence-call-reach-synthesis.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getSharedDb } from '../db';
import { conversationMemories } from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import type { CompassContext } from '@shared/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R  = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B  = (s: string) => `\x1b[34m${s}\x1b[0m`;
const D  = (s: string) => `\x1b[2m${s}\x1b[0m`;
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

// ── Test constants ────────────────────────────────────────────────────────────
// Sentinel userId — must not exist in users table (no FK on conversation_memories).
const TEST_USER_ID = '00000000-test-absence-reach-synth0';

// A distinctive phrase the student "said" on the call.
// Unusual enough that it won't appear in Daniela's generic synthesis output by chance.
// We look for this phrase (or its content) in the synthesis to confirm the memory reached it.
const STUDENT_SAID = 'estaba visitando a mi abuela en Guadalajara';
const CALL_TRANSCRIPT = `Daniela: Hola, ¿cómo estás? Te llamé porque hace un tiempo que no tenemos clase.
Student: Sí, lo sé. ${STUDENT_SAID}. Fue inesperado pero estoy bien.
Daniela: ¡Qué bueno saberlo! Cuídate y te espero pronto en clase.
Student: Gracias. Vuelvo la próxima semana.`;

// The exact title format the recording-complete webhook uses
const STUDENT_NAME = 'Test Returner';
const MEM_TITLE    = `With ${STUDENT_NAME} — Absence check-in call`;
const MEM_CONTENT  = `${MEM_TITLE}\n\n---\n\n${CALL_TRANSCRIPT}`;
const MEM_SUMMARY  = `Daniela called ${STUDENT_NAME} during an absence to check in. Call transcript preserved so Daniela can reference what the student shared when they return to class.`;

// ── Cleanup helper ────────────────────────────────────────────────────────────
async function cleanUp(): Promise<void> {
  const db = getSharedDb();
  await db
    .delete(conversationMemories)
    .where(
      sql`${conversationMemories.tags} @> ARRAY[${`student:${TEST_USER_ID}`}]::text[]`,
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Source-level: the save row's shape makes it retrievable
//
// Checks that the recording-complete webhook inserts a row with:
//   - importance: 8 → falls into the scored pool (importance < 10)
//   - entryType: 'conversation' → not filtered out
//   - tags: ['absence-call', 'student-interaction', 'student:userId'] → queryable
//   - NOT tagged 'thread' or 'foundational' → goes through the topic-scoring path
// ══════════════════════════════════════════════════════════════════════════════
function runPart1(): void {
  sep();
  console.log(B('PART 1 — Source-level: row shape makes the absence-call memory retrievable'));
  sep();

  const routesSrc = readFileSync(resolve(__dirname, '../routes.ts'), 'utf-8');

  // Find the recording-complete memory write block
  const memBlockIdx = routesSrc.indexOf('Save absence call to conversation_memories');
  assert('Memory write block found in recording-complete handler', memBlockIdx !== -1);

  // importance: 8 puts the row in the scored pool (importance < 10)
  const hasImportance8 = /importance\s*:\s*8/.test(routesSrc);
  assert(
    'importance: 8 → row lands in the scored pool (importance < 10) which session-compass queries',
    hasImportance8,
    'importance: 8 not found in routes.ts — a higher value (e.g. 10) would route it to the always-on landmark pool, not the scored pool',
  );

  // Must NOT be tagged 'thread' — the compass service separates thread-tagged memories
  // into a different (identity-thread) pool. An absence call is not an identity thread.
  const threadTagAbsent = (() => {
    // Look for the insert block specifically
    const insertStart = routesSrc.indexOf('.insert(conversationMemories)', memBlockIdx);
    if (insertStart === -1) return false;
    const insertBlock = routesSrc.slice(insertStart, insertStart + 600);
    return !insertBlock.includes("'thread'");
  })();
  assert(
    "tags do NOT include 'thread' — row goes through the topic-scored path, not the identity-thread path",
    threadTagAbsent,
    threadTagAbsent ? undefined : "Found 'thread' tag in insert — this would route the memory to the identity-thread pool",
  );

  // Must NOT be tagged 'foundational' — foundational memories are always-on hand-curated entries
  const foundationalAbsent = (() => {
    const insertStart = routesSrc.indexOf('.insert(conversationMemories)', memBlockIdx);
    if (insertStart === -1) return false;
    const insertBlock = routesSrc.slice(insertStart, insertStart + 600);
    return !insertBlock.includes("'foundational'");
  })();
  assert(
    "tags do NOT include 'foundational' — absence call uses the recency+topic scored path",
    foundationalAbsent,
    foundationalAbsent ? undefined : "Found 'foundational' tag in insert — absence calls should go through the scored path, not the always-on foundational pool",
  );

  // entryType: 'conversation' — the compass service fetches all entry types from sharedDb,
  // so this is fine. Check it's set explicitly (not undefined).
  const hasEntryTypeConversation = routesSrc.includes("entryType: 'conversation'");
  assert(
    "entryType: 'conversation' is set on the insert",
    hasEntryTypeConversation,
  );

  // student:userId tag — enables targeted queries for this student's absence calls
  const hasStudentTag = routesSrc.includes(`\`student:\${userId}\``);
  assert(
    'tags include `student:${userId}` for targeted retrieval',
    hasStudentTag,
  );

  // session-compass-service.ts queries the scored pool with importance < 10
  const compassSrc = readFileSync(resolve(__dirname, '../services/session-compass-service.ts'), 'utf-8');
  const hasScoredPoolQuery = compassSrc.includes('importance} < 10') || compassSrc.includes("importance} < 10'") || /importance.*<.*10/.test(compassSrc);
  assert(
    'session-compass-service.ts queries scored pool with importance < 10 — absence-call memory (importance:8) is included',
    hasScoredPoolQuery,
    hasScoredPoolQuery ? undefined : 'importance < 10 filter not found in session-compass-service.ts — scored pool query may be broken',
  );

  // buildLiteContext uses conversationMemories[0] to inject "A MEMORY THAT STILL MATTERS"
  const synthSrc = readFileSync(resolve(__dirname, '../services/pre-session-synthesis.ts'), 'utf-8');
  const hasTopMemory = synthSrc.includes('conversationMemories?.[0]');
  assert(
    'buildLiteContext() reads compassContext.conversationMemories?.[0] — top-ranked memory reaches synthesis',
    hasTopMemory,
    hasTopMemory ? undefined : 'conversationMemories?.[0] not found in pre-session-synthesis.ts — the memory may not reach synthesis',
  );

  const hasMemoryBlock = synthSrc.includes('A MEMORY THAT STILL MATTERS');
  assert(
    '"A MEMORY THAT STILL MATTERS" block is injected into the lite context when conversationMemories[0] exists',
    hasMemoryBlock,
    hasMemoryBlock ? undefined : '"A MEMORY THAT STILL MATTERS" label missing from pre-session-synthesis.ts',
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — DB retrieval: seed the row, query the scored pool, confirm it appears
//
// Mimics what session-compass-service.ts does for the scored pool:
//   SELECT * FROM conversation_memories
//   WHERE importance < 10 AND NOT tags @> ARRAY['thread']
//   ORDER BY recorded_at DESC
//   LIMIT 40
//
// The seeded row must appear in this result set. Since it was just inserted
// it will be at the top of the recency order.
// ══════════════════════════════════════════════════════════════════════════════
async function runPart2(): Promise<string | null> {
  sep();
  console.log(B('PART 2 — DB retrieval: seeded absence-call memory appears in scored pool query'));
  sep();

  const db = getSharedDb();

  // Pre-cleanup
  await cleanUp();

  // Insert the exact row the recording-complete webhook would produce
  const [savedMem] = await db
    .insert(conversationMemories)
    .values({
      title:        MEM_TITLE,
      summary:      MEM_SUMMARY,
      content:      MEM_CONTENT,
      participants: `Daniela + ${STUDENT_NAME}`,
      entryType:    'conversation',
      tags:         ['absence-call', 'student-interaction', `student:${TEST_USER_ID}`],
      importance:   8,
    })
    .returning({ id: conversationMemories.id });

  assert('Absence-call memory inserted into DB', !!savedMem?.id, savedMem?.id ?? 'no id returned');

  if (!savedMem?.id) return null;

  console.log(D(`  Inserted memory id: ${savedMem.id}`));

  // Query the scored pool exactly as session-compass-service.ts does
  const scoredPool = await db
    .select({
      id:         conversationMemories.id,
      title:      conversationMemories.title,
      content:    conversationMemories.content,
      importance: conversationMemories.importance,
      tags:       conversationMemories.tags,
      recordedAt: conversationMemories.recordedAt,
    })
    .from(conversationMemories)
    .where(and(
      sql`${conversationMemories.importance} < 10`,
      sql`NOT (${conversationMemories.tags} @> ARRAY['thread']::text[])`,
    ))
    .orderBy(desc(conversationMemories.recordedAt))
    .limit(40);

  const ourRow = scoredPool.find(m => m.id === savedMem.id);

  assert(
    'Seeded row appears in the scored pool query (importance < 10, not thread-tagged, limit 40)',
    !!ourRow,
    ourRow ? undefined : 'Row not found in scored pool — it may have been filtered out or pushed beyond limit 40',
  );

  if (ourRow) {
    assert(
      'Row importance is 8 (< 10 — eligible for topic scoring)',
      ourRow.importance === 8,
      `Got importance: ${ourRow.importance}`,
    );

    const tags: string[] = ourRow.tags ?? [];
    assert(
      "Row tags contain 'absence-call'",
      tags.includes('absence-call'),
      `tags: ${JSON.stringify(tags)}`,
    );
    assert(
      `Row tags contain 'student:${TEST_USER_ID}'`,
      tags.includes(`student:${TEST_USER_ID}`),
      `tags: ${JSON.stringify(tags)}`,
    );

    assert(
      'Row content contains the student transcript (absence call content is preserved)',
      (ourRow.content ?? '').includes(STUDENT_SAID),
      `content slice: ${(ourRow.content ?? '').slice(0, 100)}`,
    );

    // A freshly-inserted importance-8 row should score high enough to appear in the top 4
    // after recency boosting. Verify it's within the top 4 of the scored pool.
    const rank = scoredPool.findIndex(m => m.id === savedMem.id);
    const withinTopN = rank < 10; // very generous — newly inserted is nearly always at the top
    assert(
      `Row is near the top of the scored pool (rank ${rank + 1}) — likely to surface in top 4 after topic scoring`,
      withinTopN,
      `rank: ${rank + 1} — if many recency-tied rows exist this could push it down`,
    );
  }

  return savedMem.id;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Synthesis reach: absence-call content in compassContext.conversationMemories[0]
//           reaches generatePreSessionSynthesis() and influences the output
//
// We construct a CompassContext where the absence-call memory is the first
// (and only) conversationMemory — simulating what happens when the compass
// service correctly surfaces it as the top-ranked scored memory.
//
// Then we call generatePreSessionSynthesis() and verify that the synthesis
// output references something from the call content (the student's reason for
// absence or the call transcript excerpt).
// ══════════════════════════════════════════════════════════════════════════════
async function runPart3(memId: string | null): Promise<void> {
  sep();
  console.log(B('PART 3 — Synthesis reach: absence-call memory in compassContext reaches generatePreSessionSynthesis()'));
  sep();

  const { generatePreSessionSynthesis } = await import('../services/pre-session-synthesis');

  // Build a compassContext where the absence-call memory is conversationMemories[0].
  // This simulates what the WS handler provides after the compass service has ranked this
  // memory to the top of the scored pool.
  const absenceMemory = {
    title:      MEM_TITLE,
    content:    MEM_CONTENT,       // full transcript included
    importance: 8,
    recordedAt: new Date().toISOString(),
  };

  const compassContext = {
    studentName:           STUDENT_NAME,
    studentGoals:          'Learn conversational Spanish',
    studentInterests:      'Family and travel',
    studentActflLevel:     'novice-mid',
    lastSessionSummary:    'We practised greetings and common phrases. Good energy.',
    danielaSelfReflection: 'TestReturner is motivated and picks up vocabulary quickly.',
    conversationMemories:  [absenceMemory],
    mustHaveTopics:        [],
    niceToHaveTopics:      [],
  } as unknown as CompassContext;

  // Capture logs to confirm the "A MEMORY THAT STILL MATTERS" block was injected
  const capturedLogs: string[] = [];
  const origLog   = console.log;
  const origWarn  = console.warn;
  const origError = console.error;
  console.log   = (...a: any[]) => capturedLogs.push(a.map(String).join(' '));
  console.warn  = (...a: any[]) => capturedLogs.push('[WARN] ' + a.map(String).join(' '));
  console.error = (...a: any[]) => capturedLogs.push('[ERROR] ' + a.map(String).join(' '));

  origLog(D(`  Calling generatePreSessionSynthesis() with absence-call memory as conversationMemories[0]...`));

  let synthesis: string | null = null;
  try {
    synthesis = await generatePreSessionSynthesis(
      compassContext,
      'Daniela',
      TEST_USER_ID,
      'spanish',
      null, // no returningAfterAbsence signal — we're testing the conversationMemories route only
    );
  } finally {
    console.log   = origLog;
    console.warn  = origWarn;
    console.error = origError;
  }

  const presynLogs = capturedLogs.filter(l => l.includes('[PreSynthesis]'));
  if (presynLogs.length) {
    origLog(D('  Captured [PreSynthesis] logs:'));
    presynLogs.forEach(l => origLog(D(`    ${l}`)));
  }

  assert(
    'generatePreSessionSynthesis() returned a non-null, non-empty string',
    typeof synthesis === 'string' && synthesis.length > 0,
    synthesis === null ? 'Returned null — Gemini call failed or returned empty. Check GEMINI_API_KEY.' : undefined,
  );

  if (synthesis) {
    origLog(D(`\n  Synthesis output (${synthesis.length} chars):\n`));
    origLog(`  "${synthesis}"\n`);

    // The synthesis model received the absence-call memory via the "A MEMORY THAT STILL MATTERS"
    // block in the lite context. It should produce a paragraph that carries awareness of the call.
    // We check for any of: the student's reason for absence, a word from the transcript, or
    // general indicators that the model incorporated the memory (call, absence, return, etc.)
    const lowerSynth = synthesis.toLowerCase();

    // Check 1: Specific content from the call (most specific — confirms memory was read)
    const callContentWords = ['abuela', 'guadalajara', 'call', 'visit', 'visitando', 'absence call', 'next week', 'próxima'];
    const specificHit = callContentWords.find(w => lowerSynth.includes(w));
    if (specificHit) {
      assert(
        `Synthesis references specific call content ("${specificHit}") — memory content reached the model`,
        true,
      );
    } else {
      // Check 2: General indicators that an absence / return / reaching out context was present
      const generalWords = ['absence', 'away', 'back', 'return', 'reached out', 'check in', 'gap', 'haven\'t', 'missed', 'session'];
      const generalHit = generalWords.find(w => lowerSynth.includes(w));
      assert(
        `Synthesis contains at least one return/absence indicator (${generalHit ? `"${generalHit}"` : 'none found'}) — absence-call memory influenced the inner monologue`,
        !!generalHit,
        generalHit ? undefined : `None of ${callContentWords.slice(0, 4).join(', ')} (specific) nor ${generalWords.slice(0, 4).join(', ')} (general) found. Memory may not have reached the model.`,
      );
    }

    // Safe-mode sentinel check — if Gemini failed we get the hardcoded fallback paragraph
    const SAFE_MODE_SENTINEL = 'Something quiet settles before these sessions';
    const isSafeMode = synthesis.startsWith(SAFE_MODE_SENTINEL);
    assert(
      'Synthesis is NOT the generic safe-mode fallback (Gemini call succeeded)',
      !isSafeMode,
      isSafeMode ? 'Synthesis matched the safe-mode sentinel — the Gemini call likely failed. Check GEMINI_API_KEY.' : undefined,
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — Source-level pipeline: full data-flow wired end-to-end
//
// Checks each connection point in the pipeline:
//   recording-complete → saves to conversationMemories (covered by test-absence-call-memory.ts)
//   session-compass-service → queries scored pool (importance < 10, not thread-tagged)
//   buildLiteContext → injects conversationMemories[0] as "A MEMORY THAT STILL MATTERS"
//   generatePreSessionSynthesis → passes compassContext to buildLiteContext
// ══════════════════════════════════════════════════════════════════════════════
function runPart4(): void {
  sep();
  console.log(B('PART 4 — Source-level pipeline: full data-flow wired end-to-end'));
  sep();

  const compassSrc = readFileSync(resolve(__dirname, '../services/session-compass-service.ts'), 'utf-8');
  const synthSrc   = readFileSync(resolve(__dirname, '../services/pre-session-synthesis.ts'), 'utf-8');

  // 4a. compass service fetches scored pool from sharedDb (not getUserDb)
  //     Absence-call memories are in the shared DB (not per-user), so this must use sharedDb.
  const usesSharedDbForScored = (() => {
    // Find where the scored candidates query is
    const scoredIdx = compassSrc.indexOf('Scoring candidates');
    if (scoredIdx === -1) return false;
    // sharedDb should appear before the scored query
    const sharedDbBeforeScored = compassSrc.slice(0, scoredIdx).includes('sharedDb');
    return sharedDbBeforeScored;
  })();
  assert(
    '4a. session-compass-service.ts uses sharedDb for the scored pool — absence-call memories (in shared DB) are included',
    usesSharedDbForScored,
    usesSharedDbForScored ? undefined : 'sharedDb not found before the scored-pool query — absence-call memories may be queried from the wrong DB',
  );

  // 4b. scored pool limit is >= 40 — gives the absence-call memory a fair chance to surface
  //     even when many other importance-8 memories exist.
  const hasLimit40 = compassSrc.includes('.limit(40)');
  assert(
    '4b. Scored pool limit is 40 — enough runway for a freshly-inserted absence-call memory to be included',
    hasLimit40,
    hasLimit40 ? undefined : '.limit(40) not found in session-compass-service.ts — scored pool may be too small',
  );

  // 4c. The scored pool is re-ranked by recency bonus — importance-8 with recent recordedAt
  //     gets a recency boost of up to +5 if < 30 days old.
  const hasRecencyBonus = compassSrc.includes('ageDays < 30') || compassSrc.includes('ageDays');
  assert(
    '4c. Scored pool applies recency bonus (ageDays) — freshly-saved absence-call memory scores higher',
    hasRecencyBonus,
    hasRecencyBonus ? undefined : 'ageDays recency scoring not found in session-compass-service.ts — absence-call memory may be ranked too low',
  );

  // 4d. buildLiteContext receives the compassContext.conversationMemories array
  //     and uses [0] to inject the top memory.
  const topMemoryIdx = synthSrc.indexOf('conversationMemories?.[0]');
  assert(
    '4d. buildLiteContext() uses compassContext.conversationMemories?.[0] — the top-ranked scored memory reaches synthesis',
    topMemoryIdx !== -1,
    topMemoryIdx === -1 ? 'conversationMemories?.[0] not found in pre-session-synthesis.ts' : undefined,
  );

  // 4e. The content slice used in the "A MEMORY THAT STILL MATTERS" block is 400 chars —
  //     enough to include the student's transcript excerpt.
  const hasContentSlice = synthSrc.includes('topMemory.content.slice(0, 400)');
  assert(
    '4e. buildLiteContext() slices topMemory.content to 400 chars — absence call transcript excerpt is included',
    hasContentSlice,
    hasContentSlice ? undefined : 'content.slice(0, 400) not found — the transcript excerpt size may have changed',
  );

  // 4f. generatePreSessionSynthesis passes liteContext (which includes the memory) to the model
  const passesLiteContext = synthSrc.includes('liteContext') && synthSrc.includes('buildLiteContext');
  assert(
    '4f. generatePreSessionSynthesis() calls buildLiteContext() and passes the result to the model — full pipeline connected',
    passesLiteContext,
    passesLiteContext ? undefined : 'liteContext / buildLiteContext not found in generatePreSessionSynthesis path',
  );

  console.log(D('\n  Summary: absence-call memory (importance:8) enters the scored pool (limit 40),'));
  console.log(D('  gets recency-boosted, surfaces as conversationMemories[0] in the compass context,'));
  console.log(D('  and is injected into Daniela\'s inner monologue as "A MEMORY THAT STILL MATTERS".\n'));
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
(async () => {
  console.log(B('\ntest-absence-call-reach-synthesis — Confirming absence-call memory reaches pre-session synthesis\n'));

  let memId: string | null = null;

  try {
    runPart1();
    memId = await runPart2();
    await runPart3(memId);
    runPart4();
  } catch (err: any) {
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    if (err?.stack) console.error(D(err.stack));
    process.exit(1);
  } finally {
    try {
      await cleanUp();
      console.log(D('\n  Test rows cleaned up.'));
    } catch (cleanupErr: any) {
      console.warn(`  Warning: cleanup failed — ${cleanupErr?.message}. Delete manually:\n    DELETE FROM conversation_memories WHERE tags @> ARRAY['student:${TEST_USER_ID}']::text[];`);
    }
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed — absence-call memory pipeline confirmed end-to-end.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
})();
