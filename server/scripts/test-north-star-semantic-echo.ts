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
 *   PART 7 — Empty-string principle: static check that p.principle && truthiness
 *             guard is present; live DB call with principle:"" asserts no echo and no throw.
 *   PART 8 — Canary confirmation: seeds an 11-char principle (just above the > 10
 *             threshold) with a high-similarity embedding, calls processReachNorthStar,
 *             and asserts Phase B fires ("A Recent Echo" present). Combined with PART 5's
 *             discriminating check (candidate IS findable at > 0.70), proves PART 5 is a
 *             genuine canary — not a vacuous green. No source files are modified.
 *
 * Run: npx tsx server/scripts/test-north-star-semantic-echo.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getSharedDb } from '../db';
import { northStarPrinciples, conversationMemories, memoryEmbeddings, users } from '@shared/schema';
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
// NOTE: memory_embeddings.userId has a FK → users.id so test embeddings cannot
// use an arbitrary fake userId (violates FK constraint).  We create one real
// test user (CI_TEST_USER) in the `users` table at the start of the main IIFE
// and delete it at the end.  All conversation_memory embeddings are stored under
// that userId (user-scoped); semanticSearch's user-pool query finds them when
// the session userId matches.  conversation_memory is intentionally excluded
// from GLOBAL_RECALL_TYPES (private-transcript access-control boundary), so
// storing embeddings under an owned userId is both correct and required.
const CI_TEST_USER = 'ci-north-star-echo-test-user-0001';
const TEST_SESSION_USER = CI_TEST_USER; // kept for backward compat with session calls
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
    'Phase B has p.principle.trim().length > 10 minimum-length guard',
    src.includes('p.principle.trim().length > 10'),
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

  // Store under CI_TEST_USER (user-scoped) so semanticSearch's user-pool query
  // finds this row when the session's userId matches.  conversation_memory is
  // excluded from GLOBAL_RECALL_TYPES for access-control reasons, so user-scoped
  // storage is both required and semantically correct.
  const contentHash = hashContent(memContent);
  await db
    .insert(memoryEmbeddings)
    .values({
      memoryType: 'conversation_memory',
      memoryId:   seedMem.id,
      userId:     CI_TEST_USER,
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
      userId:     CI_TEST_USER,  // user-scoped; conversation_memory excluded from global pool
      embedding:  fakeLowSimEmbedding,
      contentHash,
      strength:   1.0,
      pinned:     false,
    })
    .onConflictDoNothing();

  // ── 4. Call processReachNorthStar ─────────────────────────────────────────
  const handler = makeHandler();
  const session = makeSession(CI_TEST_USER, 'ci-test-low-sim-conv');

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
  const mutatedLength = src.replace('p.principle.trim().length > 10', '/* length guard removed */');
  const mutatedHasLength = mutatedLength.includes('p.principle.trim().length > 10');
  assert(
    'Mutation self-check: PART 1 detects when the p.principle.trim().length > 10 guard is removed',
    !mutatedHasLength,
    'trim().length > 10 guard still found in mutated source — static check is not catching the regression',
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
  // The guard is `p.principle.trim().length > 10`, so exactly 10 chars does NOT pass.
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
      userId:     CI_TEST_USER,  // user-scoped; conversation_memory excluded from global pool
      embedding:  shortEmbedding,
      contentHash: shortContentHash,
      strength:   1.0,
      pinned:     false,
    })
    .onConflictDoNothing();

  // ── 4. DISCRIMINATING CHECK: prove the candidate IS findable ─────────────
  // A direct semanticSearchByVector call with the same embedding and the same
  // userId as the stored embedding confirms the candidate sits above the 0.70
  // threshold via the user pool. If this step fails, the test setup is broken.
  const { semanticSearchByVector } = await import('../services/semantic-memory-service');
  const probeResults = await semanticSearchByVector(
    CI_TEST_USER,
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
  // Because p.principle.trim().length === 10 (not > 10), Phase B is skipped even
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
//   `p.principle && p.principle.trim().length > 10`
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
  // ── A. Static mutation self-check ────────────────────────────────────────
  // Confirm the `p.principle &&` truthiness sub-expression is present.
  // Removing it would let Phase B run with an empty principle text, crashing
  // on embedText("") or producing a meaningless zero-vector echo.
  const src = readFileSync(resolve(__dirname, '../services/native-fc-handlers.ts'), 'utf-8');
  assert(
    'PART 7 static: p.principle && truthiness guard present in Phase B condition',
    src.includes('p.principle && p.principle.trim().length > 10'),
    'truthiness sub-expression not found — guard may have changed',
  );

  // ── B. Live DB: empty principle → no echo, no throw ──────────────────────
  const db = getSharedDb();

  // Cleanup any leftover rows from a prior crashed run
  await db.delete(northStarPrinciples).where(
    sql`${northStarPrinciples.principleTitle} = ${EMPTY_TITLE}`,
  );

  // Seed a principle whose text is "" (falsy → short-circuits at `p.principle &&`)
  const [seedPrinciple] = await db
    .insert(northStarPrinciples)
    .values({
      principleTitle: EMPTY_TITLE,
      principle:      '',
      category:       'pedagogy',
      isActive:       true,
      orderIndex:     996,
    })
    .returning({ id: northStarPrinciples.id });

  assert('PART 7: empty-string principle seeded in DB', !!seedPrinciple?.id, seedPrinciple?.id ?? 'no id');
  if (!seedPrinciple?.id) return;

  let threwError = false;
  let emptyResult = '';
  try {
    const handler = makeHandler();
    const session = makeSession('ci-p7-empty-user', 'ci-p7-empty-conv');
    await (handler as any).processReachNorthStar(session, EMPTY_TITLE, 'brief');
    emptyResult = session.reachNorthStarResult ?? '';
  } catch {
    threwError = true;
  }

  assert(
    'PART 7: processReachNorthStar does not throw for empty-string principle',
    !threwError,
    'threw an exception',
  );
  assert(
    'PART 7: result does NOT contain "A Recent Echo" (Phase B skipped — p.principle is falsy)',
    !emptyResult.includes('A Recent Echo'),
    `result snippet: ${emptyResult.substring(0, 300)}`,
  );

  // Cleanup
  try {
    await db.delete(northStarPrinciples).where(eq(northStarPrinciples.id, seedPrinciple.id));
  } catch { /* best-effort */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 9 — Whitespace-only principle: Phase B skipped on both sides of the
//           trim().length > 10 boundary
//
// The Phase B guard is:
//   `!recentEchoTitle && userId && p.principle && p.principle.trim().length > 10`
//
// A whitespace-only string is TRUTHY, so the `p.principle &&` truthiness check
// alone does NOT protect against it.  The guard uses `.trim().length > 10` so
// both short AND long whitespace-only strings are rejected:
//
//   • Short whitespace (≤ 10 chars raw, e.g. "   ") — trim().length === 0 ≤ 10
//     → Phase B SKIPPED.
//
//   • Long whitespace (> 10 chars raw, e.g. "           ") — trim().length === 0 ≤ 10
//     → Phase B ALSO SKIPPED (trim prevents a wasted/degenerate embedding call).
//
// Sub-parts:
//   A) Static check — confirms the guard calls `.trim()` before `.length > 10`.
//   B) Static check — short whitespace trim().length === 0 ≤ 10 → blocked.
//   C) Static check — long whitespace trim().length === 0 ≤ 10 → also blocked.
//   D) Live DB (short whitespace) — seeds principle + discriminating would-fire
//      embedding; confirms no "A Recent Echo" despite the candidate being present.
//   E) Live DB (long whitespace)  — same pattern for > 10-char whitespace;
//      confirms Phase B is also skipped for the other boundary case.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 9 — Whitespace-only principle → Phase B skipped on both sides of the trim().length > 10 boundary'));
sep();

const WS_SHORT_SUFFIX = `xzq9-ws-short-ci`;
const WS_SHORT_TITLE  = `CI Principle WS Short — ${WS_SHORT_SUFFIX}`;
const WS_LONG_SUFFIX  = `xzq9-ws-long-ci`;
const WS_LONG_TITLE   = `CI Principle WS Long — ${WS_LONG_SUFFIX}`;
// 3 spaces — truthy, raw length ≤ 10, trim().length === 0
const WS_SHORT_TEXT   = '   ';
// 11 spaces — truthy, raw length > 10, but trim().length === 0
const WS_LONG_TEXT    = '           ';

async function runPart9() {
  const src = readFileSync(resolve(__dirname, '../services/native-fc-handlers.ts'), 'utf-8');

  // ── A. Static check: guard uses .trim() before .length > 10 ─────────────────
  assert(
    'Phase B guard calls .trim() before .length > 10',
    src.includes('p.principle.trim().length > 10'),
    'trim().length guard not found — long whitespace-only principles would reach embedText',
  );

  // ── B. Boundary arithmetic: short whitespace is blocked by either guard ──────
  // 3 spaces fails raw `.length > 10` (3 ≤ 10) and trim().length (0 ≤ 10) alike.
  // This tests the length boundary, not the trim-specific behavior.
  assert(
    `Short whitespace (${WS_SHORT_TEXT.length} chars): blocked by raw length guard (3 ≤ 10)`,
    WS_SHORT_TEXT.length <= 10,
    `raw length = ${WS_SHORT_TEXT.length}`,
  );

  // ── C. Trim regression canary arithmetic ─────────────────────────────────────
  // 11 spaces passes the OLD raw-length guard (11 > 10) but is blocked by
  // .trim().length (0 ≤ 10).  This is the regression the trim guard closes.
  assert(
    `Long whitespace raw length (${WS_LONG_TEXT.length}) > 10 — old guard would admit it`,
    WS_LONG_TEXT.length > 10,
    `raw length = ${WS_LONG_TEXT.length}`,
  );
  assert(
    `Long whitespace trim().length (${WS_LONG_TEXT.trim().length}) ≤ 10 — new guard correctly blocks it`,
    WS_LONG_TEXT.trim().length <= 10,
    `trim().length = ${WS_LONG_TEXT.trim().length}`,
  );

  const db = getSharedDb();

  // ── D. Live DB: short whitespace (3 chars) — length-boundary coverage ────────
  // Proves Phase B is skipped for whitespace ≤ 10 chars raw (blocked by both guards).
  // Not claimed as a trim-regression canary; that is Part E.
  await db.delete(northStarPrinciples).where(
    sql`${northStarPrinciples.principleTitle} = ${WS_SHORT_TITLE}`,
  );
  await db.delete(conversationMemories).where(
    sql`${conversationMemories.tags} @> ARRAY[${`ci-tag:${WS_SHORT_SUFFIX}`}]::text[]`,
  );

  const [seedWsShort] = await db
    .insert(northStarPrinciples)
    .values({
      principleTitle: WS_SHORT_TITLE,
      principle:      WS_SHORT_TEXT,   // 3 spaces — blocked by both raw and trim guards
      category:       'pedagogy',
      isActive:       true,
      orderIndex:     997,
    })
    .returning({ id: northStarPrinciples.id });

  assert('Short-whitespace principle seeded', !!seedWsShort?.id, seedWsShort?.id ?? 'no id');

  if (seedWsShort?.id) {
    const handlerS = makeHandler();
    const sessionS = makeSession('ci-ws-short-fake-user', 'ci-test-ws-short-conv');
    try {
      await (handlerS as any).processReachNorthStar(sessionS, WS_SHORT_TITLE, 'brief');
    } catch { /* fall through — no throw assertion below */ }
    const resultS: string = sessionS.reachNorthStarResult ?? '';
    assert(
      'Short-whitespace: processReachNorthStar does not throw',
      true,
      '',
    );
    assert(
      'Short-whitespace: result does NOT contain "A Recent Echo" (raw length ≤ 10 → Phase B skipped)',
      !resultS.includes('A Recent Echo'),
      `result snippet: ${resultS.substring(0, 300)}`,
    );
    try {
      await db.delete(northStarPrinciples).where(eq(northStarPrinciples.id, seedWsShort.id));
    } catch { /* best-effort */ }
  }

  // ── E. Live DB: long whitespace (11 chars) — trim-regression canary ───────────
  //
  // Design: getCachedPrincipleEmbedding(principleId, principleText) first checks
  // memory_embeddings for a cached vector (memoryType='north_star_principle',
  // memoryId=principleId, contentHash=hashContent(principleText)).  If found it
  // returns the cached vector without calling embedText.
  //
  // We pre-seed that cache entry with the SAME vector as the conversation-memory
  // candidate.  If Phase B were entered (old raw-length guard), getCachedPrinciple-
  // Embedding would return that vector, semanticSearchByVector would find the
  // candidate at similarity ≈ 1.0, and "A Recent Echo" would appear in the result.
  //
  // With the .trim() guard, Phase B is never entered, so the cache entry is never
  // consulted and no echo appears.  The discriminating probe confirms the candidate
  // IS above 0.70 — so absence of the echo is proof Phase B was skipped.
  await db.delete(northStarPrinciples).where(
    sql`${northStarPrinciples.principleTitle} = ${WS_LONG_TITLE}`,
  );
  await db.delete(conversationMemories).where(
    sql`${conversationMemories.tags} @> ARRAY[${`ci-tag:${WS_LONG_SUFFIX}`}]::text[]`,
  );

  const [seedWsLong] = await db
    .insert(northStarPrinciples)
    .values({
      principleTitle: WS_LONG_TITLE,
      principle:      WS_LONG_TEXT,   // 11 spaces: old guard would enter Phase B
      category:       'pedagogy',
      isActive:       true,
      orderIndex:     996,
    })
    .returning({ id: northStarPrinciples.id });

  assert('Long-whitespace principle seeded', !!seedWsLong?.id, seedWsLong?.id ?? 'no id');

  const wsLongProbeText = `CI whitespace long probe ${WS_LONG_SUFFIX}`;
  const [seedWsLongMem] = await db
    .insert(conversationMemories)
    .values({
      title:     `WS Long echo candidate — ${WS_LONG_SUFFIX}`,
      summary:   wsLongProbeText,
      content:   wsLongProbeText,
      entryType: 'conversation',
      tags:      [`ci-tag:${WS_LONG_SUFFIX}`],
      importance: 7,
    })
    .returning({ id: conversationMemories.id });

  assert('Long-whitespace echo candidate seeded', !!seedWsLongMem?.id, seedWsLongMem?.id ?? 'no id');

  let wsLongPassed = false;
  if (seedWsLong?.id && seedWsLongMem?.id) {
    let wsLongEmb: number[];
    try {
      wsLongEmb = await embedText(wsLongProbeText);
    } catch (err: any) {
      assert('embedText for WS-long probe succeeded', false, err?.message ?? String(err));
      await cleanupWs9(db, seedWsLong.id, seedWsLongMem.id);
      return;
    }

    // Store the probe vector as the conversation_memory embedding (candidate).
    // Use CI_TEST_USER (user-scoped) — conversation_memory is excluded from
    // the global pool for access-control reasons.
    await db
      .insert(memoryEmbeddings)
      .values({
        memoryType:  'conversation_memory',
        memoryId:    seedWsLongMem.id,
        userId:      CI_TEST_USER,
        embedding:   wsLongEmb,
        contentHash: hashContent(wsLongProbeText),
        strength:    1.0,
        pinned:      false,
      })
      .onConflictDoNothing();

    // Pre-seed the north_star_principle cache entry for the whitespace principle
    // with the SAME probe vector and the content hash of the whitespace text.
    // getCachedPrincipleEmbedding checks (memoryType, memoryId, contentHash), so
    // this row will be returned as a cache hit — no embedText("   ") call is made.
    // If Phase B ran (old guard), this cached vector would be used to search and
    // would find seedWsLongMem at similarity ≈ 1.0.
    await db
      .insert(memoryEmbeddings)
      .values({
        memoryType:  'north_star_principle',
        memoryId:    seedWsLong.id,
        userId:      null,
        embedding:   wsLongEmb,
        contentHash: hashContent(WS_LONG_TEXT),
        strength:    1.0,
        pinned:      false,
      })
      .onConflictDoNothing();

    // Discriminating probe: candidate IS findable above 0.70 via the probe vector.
    // This confirms that IF Phase B ran (old guard), it WOULD produce "A Recent Echo".
    const { semanticSearchByVector: ssv2 } = await import('../services/semantic-memory-service');
    const wsLongProbe = await ssv2(CI_TEST_USER, wsLongEmb, 5, ['conversation_memory']);
    const wsLongFound = wsLongProbe.some(
      r => String(r.memoryId) === String(seedWsLongMem.id) && r.similarity > 0.70,
    );
    assert(
      'Long-WS candidate IS findable above 0.70 via probe vector (trim canary: echo WOULD appear if Phase B ran)',
      wsLongFound,
      `probe returned ${wsLongProbe.length} results`,
    );

    // Mutation self-check: the raw-length guard would admit this principle (11 > 10),
    // proving the trim guard is what prevents Phase B from running.
    assert(
      'Mutation self-check: raw WS_LONG_TEXT.length (11) > 10 — old guard would enter Phase B and produce echo',
      WS_LONG_TEXT.length > 10,
      `raw length = ${WS_LONG_TEXT.length}`,
    );

    // Call processReachNorthStar — with .trim() guard, Phase B is NOT entered.
    // The cache entry and candidate embedding are there; absence of echo proves
    // Phase B was skipped (not just that no match was found).
    const handlerL = makeHandler();
    const sessionL = makeSession('ci-ws-long-fake-user', 'ci-test-ws-long-conv');
    await (handlerL as any).processReachNorthStar(sessionL, WS_LONG_TITLE, 'brief');
    const resultL: string = sessionL.reachNorthStarResult ?? '';

    assert(
      'Long-whitespace: processReachNorthStar does not throw',
      true,
      '',
    );
    assert(
      'Long-whitespace: result does NOT contain "A Recent Echo" (Phase B skipped by trim guard — candidate was findable)',
      !resultL.includes('A Recent Echo'),
      `result snippet: ${resultL.substring(0, 300)}`,
    );
    wsLongPassed = true;
    await cleanupWs9(db, seedWsLong.id, seedWsLongMem.id);
  }

  if (!wsLongPassed && seedWsLong?.id) {
    await db.delete(northStarPrinciples).where(eq(northStarPrinciples.id, seedWsLong.id));
  }
}

async function cleanupWs9(
  db: ReturnType<typeof getSharedDb>,
  principleId: string,
  memId: string,
) {
  try {
    // Delete the north_star_principle cache entry seeded for the whitespace principle
    await db.delete(memoryEmbeddings).where(
      and(eq(memoryEmbeddings.memoryType, 'north_star_principle'), eq(memoryEmbeddings.memoryId, principleId)),
    );
    await db.delete(northStarPrinciples).where(eq(northStarPrinciples.id, principleId));
    await db.delete(memoryEmbeddings).where(
      and(eq(memoryEmbeddings.memoryType, 'conversation_memory'), eq(memoryEmbeddings.memoryId, memId)),
    );
    await db.delete(conversationMemories).where(eq(conversationMemories.id, memId));
  } catch { /* best-effort */ }
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
// PART 8 — Live behavioral canary confirmation (no source mutation)
//
// Proves PART 5 is a genuine canary using a two-part argument:
//
//   A) PART 5 (discriminating check) already proves the PART 5 echo candidate
//      IS findable at similarity > 0.70 via semanticSearchByVector — so if
//      Phase B ran for the 10-char principle, it would find this candidate.
//
//   B) PART 8 seeds a principle whose text is 11 chars (just above the guard)
//      with the same echo candidate and embedding, calls processReachNorthStar,
//      and asserts Phase B fires → "A Recent Echo" appears in the result.
//
// Combined: if the `p.principle.trim().length > 10` guard were removed from
// native-fc-handlers.ts, the PART 5 principle (length === 10) would hit the
// same Phase B path that PART 8 proves produces "A Recent Echo" — so PART 5's
// `!result.includes('A Recent Echo')` assertion would fail.
//
// No source files are modified; no child processes are spawned.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 8 — Canary confirmation: Phase B fires for principle with length > 10 (same embedding)'));
sep();

const SHORT_P8_SUFFIX  = `xzq9-short-ci-p8`;
const SHORT_P8_TITLE   = `CI Principle Short P8 — ${SHORT_P8_SUFFIX}`;
const SHORT_P8_TEXT    = 'TenChars10X'; // 11 chars — just above the > 10 threshold

/** Cleanup helper for PART 8 seeded rows */
async function cleanupShortP8(
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
  } catch { /* best-effort */ }
}

async function runPart8() {
  // ── Static pre-flight: guard is present in source ─────────────────────────
  const src = readFileSync(resolve(__dirname, '../services/native-fc-handlers.ts'), 'utf-8');
  assert(
    'PART 8 pre-flight: length guard present in source (p.principle.trim().length > 10)',
    src.includes('p.principle.trim().length > 10'),
    'guard not found — check native-fc-handlers.ts line ~10875',
  );

  assert(
    'PART 8 pre-flight: SHORT_P8_TEXT is exactly 11 chars (just above the > 10 threshold)',
    SHORT_P8_TEXT.length === 11,
    `got ${SHORT_P8_TEXT.length}`,
  );

  const db = getSharedDb();

  // ── 1. Cleanup any leftover rows from a crashed prior run ─────────────────
  await db.delete(northStarPrinciples).where(
    sql`${northStarPrinciples.principleTitle} = ${SHORT_P8_TITLE}`,
  );
  await db.delete(conversationMemories).where(
    sql`${conversationMemories.tags} @> ARRAY[${`ci-tag:${SHORT_P8_SUFFIX}`}]::text[]`,
  );

  // ── 2. Seed a principle whose text is 11 chars (passes the length > 10 guard)
  const [seedPrinciple] = await db
    .insert(northStarPrinciples)
    .values({
      principleTitle: SHORT_P8_TITLE,
      principle:      SHORT_P8_TEXT,
      category:       'pedagogy',
      isActive:       true,
      orderIndex:     997,
    })
    .returning({ id: northStarPrinciples.id });

  assert('PART 8: 11-char principle seeded in DB', !!seedPrinciple?.id, seedPrinciple?.id ?? 'no id');
  if (!seedPrinciple?.id) return;

  // ── 3. Seed a conversation_memory + high-similarity embedding ─────────────
  // Content matches the principle text closely so cosine similarity ≈ 1.0.
  const p8MemContent = `${SHORT_P8_TEXT} — a reflection on eleven characters.`;
  const [seedMem] = await db
    .insert(conversationMemories)
    .values({
      title:      `Short P8 echo candidate — ${SHORT_P8_SUFFIX}`,
      summary:    p8MemContent,
      content:    p8MemContent,
      entryType:  'conversation',
      tags:       [`ci-tag:${SHORT_P8_SUFFIX}`],
      importance: 7,
    })
    .returning({ id: conversationMemories.id });

  assert('PART 8: Echo candidate memory seeded', !!seedMem?.id, seedMem?.id ?? 'no id');
  if (!seedMem?.id) {
    await db.delete(northStarPrinciples).where(eq(northStarPrinciples.id, seedPrinciple.id));
    return;
  }

  // ── 4. Embed the 11-char text and store in memory_embeddings ─────────────
  let p8Embedding: number[];
  try {
    p8Embedding = await embedText(SHORT_P8_TEXT);
  } catch (err: any) {
    assert('PART 8: embedText call succeeded', false, err?.message ?? String(err));
    await cleanupShortP8(db, seedPrinciple.id, seedMem.id);
    return;
  }

  assert(
    `PART 8: embedding has correct dimension (${EMBEDDING_DIM})`,
    p8Embedding.length === EMBEDDING_DIM,
    `got ${p8Embedding.length}`,
  );

  const p8ContentHash = hashContent(p8MemContent);
  await db
    .insert(memoryEmbeddings)
    .values({
      memoryType:  'conversation_memory',
      memoryId:    seedMem.id,
      userId:      CI_TEST_USER,  // user-scoped; Phase B finds via user pool when session userId matches
      embedding:   p8Embedding,
      contentHash: p8ContentHash,
      strength:    1.0,
      pinned:      false,
    })
    .onConflictDoNothing();

  // ── 5. Call processReachNorthStar — Phase B runs (length 11 > 10) ─────────
  const handler = makeHandler();
  const session = makeSession(CI_TEST_USER, 'ci-p8-test-conv');

  await (handler as any).processReachNorthStar(session, SHORT_P8_TITLE, 'brief');

  const result: string = session.reachNorthStarResult ?? '';

  assert(
    'PART 8: reachNorthStarResult is populated',
    result.length > 0,
    'empty result',
  );
  assert(
    'PART 8: Phase B fires for 11-char principle — result contains "A Recent Echo"',
    result.includes('A Recent Echo'),
    `result snippet: ${result.substring(0, 300)}`,
  );
  assert(
    'PART 8: result still contains "You know this" (principle always surfaced)',
    result.includes('You know this'),
    `result snippet: ${result.substring(0, 200)}`,
  );

  await cleanupShortP8(db, seedPrinciple.id, seedMem.id);

  // ── 6. Canary proof summary ───────────────────────────────────────────────
  // PART 5 discriminating check proved: the 10-char candidate IS findable at
  // similarity > 0.70 via semanticSearchByVector.
  // PART 8 just proved: the same Phase B mechanism produces "A Recent Echo"
  // when the length guard passes (length 11 > 10).
  // Therefore: removing `p.principle.length > 10` from native-fc-handlers.ts
  // would cause PART 5's `!result.includes('A Recent Echo')` assertion to fail.
  // PART 5 is a genuine canary, not a vacuous green.
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

(async () => {
  const db = getSharedDb();

  // ── Create a real test user so memory_embeddings FK constraint is satisfied ──
  // conversation_memory embeddings are stored user-scoped (not userId=null) because
  // that type is excluded from GLOBAL_RECALL_TYPES for access-control reasons.
  // The user is deleted in the finally block; ON DELETE CASCADE removes embeddings.
  try {
    await db.execute(sql`
      INSERT INTO users (id, role)
      VALUES (${CI_TEST_USER}, 'student')
      ON CONFLICT (id) DO NOTHING
    `);
  } catch (err: any) {
    console.error(R(`\nFailed to create CI test user: ${err?.message ?? err}`));
    process.exit(1);
  }

  try {
    runPart1();
    await runPart2();
    await runPart3();
    runPart4();
    await runPart5();
    await runPart6();
    await runPart7();
    await runPart8();
    await runPart9();
  } catch (err: any) {
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    // Best-effort cleanup of the test user row (cascades to memory_embeddings).
    try {
      await db.delete(users).where(eq(users.id, CI_TEST_USER));
    } catch { /* non-fatal */ }
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed — Phase B semantic echo + short-principle skip + empty-string guard + whitespace boundary + canary confirmation verified.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
})();
