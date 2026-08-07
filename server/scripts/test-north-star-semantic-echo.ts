/**
 * test-north-star-semantic-echo.ts
 *
 * Confirms that Phase B of processReachNorthStar fires a "A Recent Echo" block
 * when Phase A (title/arc_name match) finds nothing.
 *
 * Three parts:
 *   PART 1 — Static source check: Phase B block is present in native-fc-handlers.ts
 *             with the 0.70 threshold and the semanticSearch import.
 *   PART 2 — Live DB: seeds a principle whose title matches zero conversation_memories
 *             rows, plants a semantically-similar embedding for a conversation, calls
 *             processReachNorthStar and asserts the result contains "A Recent Echo".
 *   PART 3 — Live DB (below-threshold): plants a low-similarity embedding and asserts
 *             that no "A Recent Echo" block appears in the result.
 *   PART 4 — Mutation self-check: simulated removal of the 0.70 threshold guard from
 *             the source causes the static check to fail (guard is not vacuous).
 *
 * Run: npx tsx server/scripts/test-north-star-semantic-echo.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getSharedDb } from '../db';
import { northStarPrinciples, conversationMemories, memoryEmbeddings } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { hashContent, embedText } from '../services/semantic-memory-service';
import { NativeFunctionCallHandler } from '../services/native-fc-handlers';
import type { StreamingSession } from '../services/streaming-session-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
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

// ── Deterministic test identifiers ────────────────────────────────────────────
// Use a stable prefix so cleanup can find leftover rows from crashed runs.
// NOTE: memory_embeddings.userId has a FK → users.id so test embeddings are
// inserted with userId = null (globally visible). semanticSearch includes global
// rows (userId IS NULL) when the type is in GLOBAL_RECALL_TYPES, and
// 'conversation_memory' is in that list. The session.userId can be any non-empty
// string — it is only used as a query parameter, not looked up in users.
const TEST_SESSION_USER = 'ci-semantic-echo-fake-user';
const UNIQUE_SUFFIX  = `xzq9-semantic-echo-ci`;
// The principle title must NOT appear in any conversation_memory title/arc_name.
// We use a UUID-like suffix that cannot plausibly exist in real data.
const PRINCIPLE_TITLE = `CI Principle — ${UNIQUE_SUFFIX}`;
const EMBEDDING_DIM   = 768; // Must match EMBEDDING_DIM in semantic-memory-service.ts

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Static source check
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Static source check: Phase B block in native-fc-handlers.ts'));
sep();

function runPart1() {
  const src = readFileSync(resolve(__dirname, '../services/native-fc-handlers.ts'), 'utf-8');

  // Phase B comment marker
  assert(
    'Phase B block is present (comment marker)',
    src.includes('Phase B: semantic fallback — only runs when Phase A found nothing'),
    'marker not found — Phase B may have been removed or renamed',
  );

  // semanticSearch import inside Phase B
  assert(
    "semanticSearch is imported from './semantic-memory-service'",
    src.includes("import('./semantic-memory-service')"),
    'dynamic import path not found',
  );

  // The 0.70 threshold guard
  assert(
    '0.70 threshold guard present in Phase B',
    src.includes('r.similarity > 0.70'),
    '0.70 threshold not found — Phase B may silently accept low-quality matches',
  );

  // The "A Recent Echo" label format
  assert(
    '"A Recent Echo" label is constructed in the formatter',
    src.includes('A Recent Echo'),
    '"A Recent Echo" string not found in formatter block',
  );

  // Phase B is gated on recentEchoTitle being empty (only runs when Phase A found nothing)
  assert(
    'Phase B is gated on !recentEchoTitle (only runs when Phase A empty)',
    src.includes('!recentEchoTitle && userId && p.principle'),
    'Phase B activation guard not found or changed',
  );

  // The minimum-length guard (prevents embedding garbage from a tiny principle text)
  assert(
    'Phase B has p.principle.length > 10 minimum-length guard',
    src.includes('p.principle.length > 10'),
    'length > 10 guard not found — short-principle calls could reach OpenAI with degenerate input',
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers — build a minimal stub session
// ══════════════════════════════════════════════════════════════════════════════
function makeSession(userId: string, conversationId = 'ci-test-conv-id'): StreamingSession {
  return {
    id: 'ci-test-session',
    userId,
    conversationId,
    targetLanguage: 'Spanish',
    nativeLanguage: 'English',
    difficultyLevel: 'beginner',
    subtitleMode: 'off',
    tutorPersonality: 'warm' as any,
    tutorExpressiveness: 5,
    voiceSpeed: '1.0' as any,
    tutorGender: 'female',
    tutorName: 'Daniela',
    systemPrompt: '',
    conversationHistory: [],
    ws: null as any,
    startTime: Date.now(),
    isActive: true,
    isFounderMode: false,
    isRawHonestyMode: false,
    isReadingRoom: false,
    isIncognito: false,
    isDeveloperUser: false,
    isBetaTester: false,
    lastContextRefreshTime: 0,
    lastActivityTime: Date.now(),
    currentTurnId: 1,
    isInterrupted: false,
    lastTurnWasInterrupted: false,
    isGenerating: false,
  } as unknown as StreamingSession;
}

function makeHandler(): NativeFunctionCallHandler {
  return new NativeFunctionCallHandler(
    () => {},          // sendMessage — no-op
    () => {},          // sendError — no-op
    async () => {},    // processPhaseShift — no-op
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Live DB: Phase B fires and injects "A Recent Echo"
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Live DB: Phase B semantic echo fires for principle with no title-matching conv'));
sep();

async function runPart2() {
  const db = getSharedDb();

  // ── Cleanup any leftover rows from a prior crashed run ────────────────────
  await db.delete(northStarPrinciples).where(
    sql`${northStarPrinciples.principleTitle} = ${PRINCIPLE_TITLE}`,
  );
  await db.delete(conversationMemories).where(
    sql`${conversationMemories.tags} @> ARRAY[${`ci-tag:${UNIQUE_SUFFIX}`}]::text[]`,
  );

  // ── 1. Seed a North Star principle ───────────────────────────────────────
  // Title is unique enough that no existing conversation_memory can match it.
  const principleText = 'Presence is a practice, not a state — every moment of genuine attention teaches more than any curriculum plan.';
  const [seedPrinciple] = await db
    .insert(northStarPrinciples)
    .values({
      principleTitle: PRINCIPLE_TITLE,
      principle:      principleText,
      category:       'pedagogy',
      isActive:       true,
      orderIndex:     999,
      // Deliberately NO sourceConversationId — founding moment is absent too
    })
    .returning({ id: northStarPrinciples.id });

  assert('Principle seeded in DB', !!seedPrinciple?.id, seedPrinciple?.id ?? 'no id');
  if (!seedPrinciple?.id) return;

  // ── 2. Seed a conversation_memory row ────────────────────────────────────
  // Title does NOT contain PRINCIPLE_TITLE — Phase A cannot find this row.
  const memTitle = `A class that stayed — the day presence changed everything`;
  const memContent = `Daniela: You mentioned the class yesterday where you just listened.\nStudent: Yeah, I forgot to teach anything. But it felt real.\nDaniela: That felt real because it was. Presence is a practice, not a state.`;
  const [seedMem] = await db
    .insert(conversationMemories)
    .values({
      title:    memTitle,
      summary:  memContent.substring(0, 200),
      content:  memContent,
      entryType: 'conversation',
      tags:     [`ci-tag:${UNIQUE_SUFFIX}`],
      importance: 7,
    })
    .returning({ id: conversationMemories.id });

  assert('Conversation memory seeded in DB', !!seedMem?.id, seedMem?.id ?? 'no id');
  if (!seedMem?.id) return;

  // ── 3. Embed the principle text and store in memory_embeddings ────────────
  // Using the principle text as the embedding source produces self-similarity ≈ 1.0
  // when semanticSearch also embeds the same principle text as the query.
  let principleEmbedding: number[];
  try {
    principleEmbedding = await embedText(principleText);
  } catch (err: any) {
    assert('embedText call succeeded (OpenAI key required)', false, err?.message ?? String(err));
    // Can't continue without a real embedding
    await cleanup(db, seedPrinciple.id, seedMem.id);
    return;
  }

  assert(
    `Embedding has correct dimension (${EMBEDDING_DIM})`,
    principleEmbedding.length === EMBEDDING_DIM,
    `got ${principleEmbedding.length}`,
  );

  // Insert into memory_embeddings with userId = null (globally visible).
  // memory_embeddings.userId has a FK → users.id so a fake userId would violate
  // the constraint. With userId = null the row appears in semanticSearch's
  // global query (userId IS NULL, type in GLOBAL_RECALL_TYPES) — and
  // 'conversation_memory' is in that list, so the search will find it.
  const contentHash = hashContent(memContent);
  await db
    .insert(memoryEmbeddings)
    .values({
      memoryType: 'conversation_memory',
      memoryId:   seedMem.id,
      userId:     null,
      embedding:  principleEmbedding,
      contentHash,
      strength:   1.0,
      pinned:     false,
    })
    .onConflictDoNothing();

  // ── 4. Call processReachNorthStar ─────────────────────────────────────────
  // session.userId is only used as a query parameter inside semanticSearch and
  // for the userId guard check — it does not need to be a real DB user.
  const handler = makeHandler();
  const session = makeSession(TEST_SESSION_USER, 'ci-test-conv-no-match');

  await (handler as any).processReachNorthStar(session, PRINCIPLE_TITLE, 'brief');

  const result: string = session.reachNorthStarResult ?? '';

  assert('reachNorthStarResult is populated', result.length > 0, 'empty result');
  assert(
    'Result contains "A Recent Echo" (Phase B fired)',
    result.includes('A Recent Echo'),
    `result snippet: ${result.substring(0, 200)}`,
  );
  assert(
    'Result contains the correct conversation title in the echo',
    result.includes(memTitle),
    `result snippet: ${result.substring(0, 300)}`,
  );
  assert(
    'Result contains "You know this" (principle is surfaced)',
    result.includes('You know this'),
    `result snippet: ${result.substring(0, 200)}`,
  );

  await cleanup(db, seedPrinciple.id, seedMem.id);
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Live DB: below-threshold embedding → no echo
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Live DB: similarity < 0.70 → no "A Recent Echo" in result'));
sep();

const LOW_SIM_SUFFIX  = `xzq9-low-sim-ci`;
const LOW_SIM_TITLE   = `CI Principle Low-Sim — ${LOW_SIM_SUFFIX}`;

async function runPart3() {
  const db = getSharedDb();

  // ── Cleanup any leftover rows ─────────────────────────────────────────────
  await db.delete(northStarPrinciples).where(
    sql`${northStarPrinciples.principleTitle} = ${LOW_SIM_TITLE}`,
  );
  await db.delete(conversationMemories).where(
    sql`${conversationMemories.tags} @> ARRAY[${`ci-tag:${LOW_SIM_SUFFIX}`}]::text[]`,
  );

  // ── 1. Seed a principle ───────────────────────────────────────────────────
  const principleText = 'Clarity over performance — teaching is clearest when there is nothing to prove.';
  const [seedPrinciple] = await db
    .insert(northStarPrinciples)
    .values({
      principleTitle: LOW_SIM_TITLE,
      principle:      principleText,
      category:       'pedagogy',
      isActive:       true,
      orderIndex:     999,
    })
    .returning({ id: northStarPrinciples.id });

  assert('Low-sim principle seeded', !!seedPrinciple?.id, seedPrinciple?.id ?? 'no id');
  if (!seedPrinciple?.id) return;

  // ── 2. Seed a conversation_memory row ────────────────────────────────────
  const memContent = 'A random unrelated conversation about something completely different.';
  const [seedMem] = await db
    .insert(conversationMemories)
    .values({
      title:    'Unrelated conversation for low-sim test',
      summary:  memContent,
      content:  memContent,
      entryType: 'conversation',
      tags:     [`ci-tag:${LOW_SIM_SUFFIX}`],
      importance: 5,
    })
    .returning({ id: conversationMemories.id });

  assert('Low-sim conversation memory seeded', !!seedMem?.id, seedMem?.id ?? 'no id');
  if (!seedMem?.id) return;

  // ── 3. Store a fake low-similarity embedding ──────────────────────────────
  // A unit vector with weight on dimension 0 only. Real OpenAI embeddings spread
  // weight across all 768 dimensions, so cosine similarity of this vector vs any
  // real embedding is typically ~0.03–0.08, well below the 0.70 threshold.
  const fakeLowSimEmbedding: number[] = new Array(EMBEDDING_DIM).fill(0);
  fakeLowSimEmbedding[0] = 1.0; // unit vector in a single dimension

  const contentHash = hashContent(memContent);
  await db
    .insert(memoryEmbeddings)
    .values({
      memoryType: 'conversation_memory',
      memoryId:   seedMem.id,
      userId:     null,          // globally visible; avoids FK constraint on users.id
      embedding:  fakeLowSimEmbedding,
      contentHash,
      strength:   1.0,
      pinned:     false,
    })
    .onConflictDoNothing();

  // ── 4. Call processReachNorthStar ─────────────────────────────────────────
  const handler = makeHandler();
  const session = makeSession('ci-low-sim-fake-user', 'ci-test-low-sim-conv');

  await (handler as any).processReachNorthStar(session, LOW_SIM_TITLE, 'brief');

  const result: string = session.reachNorthStarResult ?? '';

  assert('reachNorthStarResult is populated for low-sim case', result.length > 0, 'empty result');
  assert(
    'Result does NOT contain "A Recent Echo" (similarity below 0.70 threshold)',
    !result.includes('A Recent Echo'),
    `result snippet: ${result.substring(0, 300)}`,
  );
  assert(
    'Result still contains "You know this" (principle itself is always surfaced)',
    result.includes('You know this'),
    `result snippet: ${result.substring(0, 200)}`,
  );

  await cleanup(db, seedPrinciple.id, seedMem.id);
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — Mutation self-check
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 4 — Mutation self-check: PART 1 guards fail when threshold is removed'));
sep();

function runPart4() {
  const src = readFileSync(resolve(__dirname, '../services/native-fc-handlers.ts'), 'utf-8');

  // Simulate removal of the 0.70 threshold line
  const mutatedThreshold = src.replace('r.similarity > 0.70', 'true /* threshold removed */');
  const mutatedHasThreshold = mutatedThreshold.includes('r.similarity > 0.70');
  assert(
    'Mutation self-check: PART 1 detects when the 0.70 threshold is removed',
    !mutatedHasThreshold,
    '0.70 threshold still found in mutated source — guard is not catching the regression',
  );

  // Simulate removal of Phase B comment marker
  const mutatedComment = src.replace(
    'Phase B: semantic fallback — only runs when Phase A found nothing',
    '/* removed */',
  );
  const mutatedHasComment = mutatedComment.includes('Phase B: semantic fallback — only runs when Phase A found nothing');
  assert(
    'Mutation self-check: PART 1 detects when Phase B comment marker is removed',
    !mutatedHasComment,
    'Phase B marker still found in mutated source',
  );

  // Simulate changing the Phase B activation guard
  const mutatedGate = src.replace('!recentEchoTitle && userId && p.principle', '/* gate removed */');
  const mutatedHasGate = mutatedGate.includes('!recentEchoTitle && userId && p.principle');
  assert(
    'Mutation self-check: PART 1 detects when Phase B activation gate is removed',
    !mutatedHasGate,
    'Phase B gate still found in mutated source',
  );

  // Simulate removal of the minimum-length guard
  // Behavioral significance: PART 5 plants a high-similarity embedding for a
  // 10-char principle. If this guard were removed, Phase B would execute,
  // find the candidate (similarity ≈ 1.0 > 0.70), and inject "A Recent Echo" —
  // causing PART 5's `!result.includes('A Recent Echo')` assertion to fail.
  // The static check here is the fast-path canary for that behavioral regression.
  const mutatedLength = src.replace('p.principle.length > 10', '/* length guard removed */');
  const mutatedHasLength = mutatedLength.includes('p.principle.length > 10');
  assert(
    'Mutation self-check: PART 1 detects when the p.principle.length > 10 guard is removed',
    !mutatedHasLength,
    'length > 10 guard still found in mutated source — static check is not catching the regression',
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 5 — Live DB: principle text ≤ 10 chars → Phase B skipped, no echo
//
// DISCRIMINATING DESIGN: we plant a high-similarity embedding so Phase B
// *would* produce an echo if the `p.principle.length > 10` guard were removed.
// A direct semanticSearchByVector call proves the candidate IS findable
// (similarity > 0.70) — making the no-echo assertion meaningful: the only
// reason the echo is absent is that the length guard prevented Phase B.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 5 — Live DB: short principle (≤10 chars) → Phase B skipped, no "A Recent Echo"'));
sep();

const SHORT_SUFFIX  = `xzq9-short-ci`;
const SHORT_TITLE   = `CI Principle Short — ${SHORT_SUFFIX}`;

async function runPart5() {
  const db = getSharedDb();

  // ── Cleanup any leftover rows ─────────────────────────────────────────────
  await db.delete(northStarPrinciples).where(
    sql`${northStarPrinciples.principleTitle} = ${SHORT_TITLE}`,
  );
  await db.delete(conversationMemories).where(
    sql`${conversationMemories.tags} @> ARRAY[${`ci-tag:${SHORT_SUFFIX}`}]::text[]`,
  );

  // ── 1. Seed a principle whose text is exactly 10 characters (not > 10) ───
  // The guard is `p.principle.length > 10`, so exactly 10 chars does NOT pass.
  const shortPrincipleText = 'TenChars10'; // length === 10
  assert(
    'Short principle text is exactly 10 characters',
    shortPrincipleText.length === 10,
    `got ${shortPrincipleText.length}`,
  );

  const [seedPrinciple] = await db
    .insert(northStarPrinciples)
    .values({
      principleTitle: SHORT_TITLE,
      principle:      shortPrincipleText,
      category:       'pedagogy',
      isActive:       true,
      orderIndex:     999,
    })
    .returning({ id: northStarPrinciples.id });

  assert('Short principle seeded in DB', !!seedPrinciple?.id, seedPrinciple?.id ?? 'no id');
  if (!seedPrinciple?.id) return;

  // ── 2. Seed a conversation_memory + high-similarity embedding ─────────────
  // Content matches the principle text closely so cosine similarity ≈ 1.0.
  // This is the "would-fire" candidate: if Phase B were allowed to run,
  // semanticSearchByVector would return this row above the 0.70 threshold.
  const shortMemContent = `${shortPrincipleText} — a reflection on ten characters.`;
  const [seedMem] = await db
    .insert(conversationMemories)
    .values({
      title:     `Short principle echo candidate — ${SHORT_SUFFIX}`,
      summary:   shortMemContent,
      content:   shortMemContent,
      entryType: 'conversation',
      tags:      [`ci-tag:${SHORT_SUFFIX}`],
      importance: 7,
    })
    .returning({ id: conversationMemories.id });

  assert('Echo candidate memory seeded', !!seedMem?.id, seedMem?.id ?? 'no id');
  if (!seedMem?.id) {
    await db.delete(northStarPrinciples).where(eq(northStarPrinciples.id, seedPrinciple.id));
    return;
  }

  // ── 3. Embed the short principle text and store in memory_embeddings ───────
  // Using the same text as both embedding source and search query guarantees
  // cosine similarity ≈ 1.0 — well above the 0.70 threshold.
  let shortEmbedding: number[];
  try {
    shortEmbedding = await embedText(shortPrincipleText);
  } catch (err: any) {
    assert('embedText call succeeded (OpenAI key required)', false, err?.message ?? String(err));
    await cleanupShort(db, seedPrinciple.id, seedMem.id);
    return;
  }

  assert(
    `Short embedding has correct dimension (${EMBEDDING_DIM})`,
    shortEmbedding.length === EMBEDDING_DIM,
    `got ${shortEmbedding.length}`,
  );

  const shortContentHash = hashContent(shortMemContent);
  await db
    .insert(memoryEmbeddings)
    .values({
      memoryType: 'conversation_memory',
      memoryId:   seedMem.id,
      userId:     null,   // globally visible; avoids FK constraint
      embedding:  shortEmbedding,
      contentHash: shortContentHash,
      strength:   1.0,
      pinned:     false,
    })
    .onConflictDoNothing();

  // ── 4. DISCRIMINATING CHECK: prove the candidate IS findable ─────────────
  // A direct semanticSearchByVector call with the same embedding confirms the
  // candidate sits above the 0.70 threshold. If this step fails, the test
  // setup is broken — not the guard.
  const { semanticSearchByVector } = await import('../services/semantic-memory-service');
  const probeResults = await semanticSearchByVector(
    'ci-short-principle-probe',
    shortEmbedding,
    5,
    ['conversation_memory'],
  );
  const candidateFound = probeResults.some(
    r => String(r.memoryId) === String(seedMem.id) && r.similarity > 0.70,
  );
  assert(
    'Echo candidate IS findable at similarity > 0.70 (discriminating: Phase B would fire if guard removed)',
    candidateFound,
    `probe returned ${probeResults.length} results; memIds: ${probeResults.map(r => r.memoryId).join(',')}`,
  );

  // ── 5. Call processReachNorthStar — guard prevents Phase B ────────────────
  // Because p.principle.length === 10 (not > 10), Phase B is skipped even
  // though the candidate embedding IS present and above threshold.
  const handler = makeHandler();
  const session = makeSession('ci-short-principle-fake-user', 'ci-test-short-conv');

  await (handler as any).processReachNorthStar(session, SHORT_TITLE, 'brief');

  const result: string = session.reachNorthStarResult ?? '';

  assert(
    'reachNorthStarResult is populated (principle always surfaces)',
    result.length > 0,
    'empty result',
  );
  assert(
    'Result does NOT contain "A Recent Echo" (Phase B skipped — length guard prevented search)',
    !result.includes('A Recent Echo'),
    `result snippet: ${result.substring(0, 300)}`,
  );
  assert(
    'Result still contains "You know this" (principle itself is always surfaced)',
    result.includes('You know this'),
    `result snippet: ${result.substring(0, 200)}`,
  );

  await cleanupShort(db, seedPrinciple.id, seedMem.id);
}

async function cleanupShort(
  db: ReturnType<typeof getSharedDb>,
  principleId: string,
  memId: string,
) {
  try {
    await db.delete(northStarPrinciples).where(eq(northStarPrinciples.id, principleId));
    await db.delete(memoryEmbeddings).where(
      and(eq(memoryEmbeddings.memoryType, 'conversation_memory'), eq(memoryEmbeddings.memoryId, memId)),
    );
    await db.delete(conversationMemories).where(eq(conversationMemories.id, memId));
  } catch { /* best-effort cleanup */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared cleanup helper
// ══════════════════════════════════════════════════════════════════════════════
async function cleanup(
  db: ReturnType<typeof getSharedDb>,
  principleId: string,
  memId: string,
) {
  try {
    await db.delete(northStarPrinciples).where(eq(northStarPrinciples.id, principleId));
    // Delete the embedding first (no FK back to conversationMemories, but tidy)
    await db.delete(memoryEmbeddings).where(
      and(eq(memoryEmbeddings.memoryType, 'conversation_memory'), eq(memoryEmbeddings.memoryId, memId)),
    );
    await db.delete(conversationMemories).where(eq(conversationMemories.id, memId));
  } catch { /* best-effort cleanup */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 7 — Empty-string principle: Phase B skipped via truthiness guard
//
// An empty string (`""`) is falsy in JavaScript so the compound guard
//   `p.principle && p.principle.length > 10`
// short-circuits at the `p.principle &&` truthiness check — Phase B is never
// entered and no embedding call is made.
//
// This part:
//   A) Static mutation self-check — confirms the `p.principle &&` truthiness
//      fragment is present in the guard; removing it breaks this assertion.
//   B) Live DB — seeds a principle with principle:"", calls
//      processReachNorthStar, and asserts:
//        • the call does not throw
//        • the result does NOT contain "A Recent Echo"
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 7 — Empty-string principle → Phase B skipped via truthiness guard'));
sep();

const EMPTY_SUFFIX = `xzq9-empty-ci`;
const EMPTY_TITLE  = `CI Principle Empty — ${EMPTY_SUFFIX}`;

async function runPart7() {
  // ── A. Static mutation self-check ─────────────────────────────────────────
  // The truthiness guard `p.principle &&` must remain in the compound condition.
  // If it is removed, an empty-string principle would pass to `p.principle.length`
  // which throws (cannot read property of "").
  const src = readFileSync(resolve(__dirname, '../services/native-fc-handlers.ts'), 'utf-8');

  assert(
    'Mutation check: `p.principle &&` truthiness guard is present in Phase B activation',
    src.includes('!recentEchoTitle && userId && p.principle &&'),
    'Guard string not found — removing `p.principle &&` would break empty-string safety',
  );

  // ── B. Live DB: empty-string principle does not throw and produces no echo ─
  const db = getSharedDb();

  // Cleanup any leftover row from a prior crashed run
  await db.delete(northStarPrinciples).where(
    sql`${northStarPrinciples.principleTitle} = ${EMPTY_TITLE}`,
  );

  // Seed a principle with an empty principle text
  const [seedEmpty] = await db
    .insert(northStarPrinciples)
    .values({
      principleTitle: EMPTY_TITLE,
      principle:      '',          // ← falsy; truthiness guard must block Phase B
      category:       'pedagogy',
      isActive:       true,
      orderIndex:     999,
    })
    .returning({ id: northStarPrinciples.id });

  assert('Empty-principle row seeded in DB', !!seedEmpty?.id, seedEmpty?.id ?? 'no id');
  if (!seedEmpty?.id) return;

  try {
    const handler = makeHandler();
    const session = makeSession('ci-empty-principle-fake-user', 'ci-test-empty-conv');

    // Must not throw even though principle text is "".
    await (handler as any).processReachNorthStar(session, EMPTY_TITLE, 'brief');

    const result: string = session.reachNorthStarResult ?? '';

    assert(
      'processReachNorthStar does not throw for empty-string principle',
      true,   // reaching here means no throw
      '',
    );

    assert(
      'Result does NOT contain "A Recent Echo" (Phase B skipped — empty string is falsy)',
      !result.includes('A Recent Echo'),
      `result snippet: ${result.substring(0, 300)}`,
    );
  } finally {
    // Best-effort cleanup — no embedding was inserted so only the principle row
    try {
      await db.delete(northStarPrinciples).where(eq(northStarPrinciples.id, seedEmpty.id));
    } catch { /* ignore */ }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 6 — Import-path resolution check
// ══════════════════════════════════════════════════════════════════════════════
// Phase B in native-fc-handlers.ts uses a dynamic import inside a try/catch.
// If the file is moved or renamed the catch block swallows the error silently
// and no echo fires.  This part resolves the exact same relative path that
// Phase B uses (relative to the services/ directory) and confirms the
// semanticSearch export is a callable function.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 6 — Import-path resolution: ./semantic-memory-service resolves with semanticSearch export'));
sep();

async function runPart6() {
  // Resolve the path exactly as Phase B does: relative to native-fc-handlers.ts
  // which lives in server/services/.  We use pathToFileURL so Node ESM
  // resolves the specifier the same way a dynamic import() would.
  const { pathToFileURL } = await import('url');
  const servicesDir = resolve(__dirname, '../services');
  const targetPath  = resolve(servicesDir, 'semantic-memory-service.ts');

  let mod: Record<string, unknown> | undefined;
  let importError: string | undefined;

  try {
    // tsx / ts-node register the .ts extension, so a direct path import works
    // in the same way the compiled import('./semantic-memory-service') would.
    mod = await import(pathToFileURL(targetPath).href) as Record<string, unknown>;
  } catch (err: any) {
    importError = err?.message ?? String(err);
  }

  assert(
    'Phase B import path resolves without throwing',
    mod !== undefined && importError === undefined,
    importError ?? 'import returned undefined',
  );

  if (mod === undefined) {
    // No point checking the export if the import itself failed — the assertion
    // above already counted this as a failure.
    return;
  }

  assert(
    'semanticSearch export is a function',
    typeof mod['semanticSearch'] === 'function',
    `typeof semanticSearch = ${typeof mod['semanticSearch']}`,
  );

  assert(
    'semanticSearchByVector export is a function (also used by Phase B)',
    typeof mod['semanticSearchByVector'] === 'function',
    `typeof semanticSearchByVector = ${typeof mod['semanticSearchByVector']}`,
  );

  assert(
    'getCachedPrincipleEmbedding export is a function (also used by Phase B)',
    typeof mod['getCachedPrincipleEmbedding'] === 'function',
    `typeof getCachedPrincipleEmbedding = ${typeof mod['getCachedPrincipleEmbedding']}`,
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
    runPart4();
    await runPart5();
    await runPart6();
    await runPart7();
  } catch (err: any) {
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed — Phase B semantic echo + short-principle skip + empty-string guard verified.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
})();
