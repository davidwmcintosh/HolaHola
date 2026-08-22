/**
 * test-reach-north-star-founding-selfcheck.ts
 *
 * Self-defeating companion to test-reach-north-star-founding.ts.
 *
 * Drives the REAL NativeFunctionCallHandler.processReachNorthStar with a
 * minimal mock session so that the test exercises the actual production
 * code path, not a local simulation.
 *
 * Steps:
 *  1. Pick the first active principle that has a source_conversation_id AND
 *     whose founding conversation_memories row is non-empty.
 *  2. Pre-check: call processReachNorthStar with the DB intact and assert
 *     the output contains "The Founding Moment".
 *  3. Temporarily clear source_conversation_id (set to NULL in DB).
 *  4. Call processReachNorthStar again and assert "The Founding Moment" is
 *     ABSENT from the output (guard correctly blocked).
 *  5. Restore the original value unconditionally (finally block).
 *  6. Verify the restored row, then exit 0 on success, 1 on any failure.
 */

import { getSharedDb } from '../db';
import { northStarPrinciples, conversationMemories } from '../../shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { NativeFunctionCallHandler } from '../services/native-fc-handlers';
import type { StreamingSession } from '../services/streaming-session-types';

// ---------------------------------------------------------------------------
// Build a minimal mock session — only the fields processReachNorthStar reads.
// ---------------------------------------------------------------------------
function buildMockSession(overrides: Partial<Record<string, unknown>> = {}): StreamingSession {
  return {
    id: 'selfcheck-session',
    userId: 'selfcheck-user',
    conversationId: 'selfcheck-conv',
    targetLanguage: 'Spanish',
    nativeLanguage: 'English',
    difficultyLevel: 'A1',
    subtitleMode: 'off',
    tutorPersonality: 'warm',
    tutorExpressiveness: 1,
    voiceSpeed: 'normal',
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
    telemetryTtsCharacters: 0,
    telemetrySttSeconds: 0,
    telemetryExchangeCount: 0,
    telemetryStudentSpeakingMs: 0,
    telemetryTutorSpeakingMs: 0,
    telemetryLlmInputTokens: 0,
    telemetryLlmOutputTokens: 0,
    ...overrides,
  } as unknown as StreamingSession;
}

// ---------------------------------------------------------------------------
// Instantiate the real handler with no-op callbacks.
// ---------------------------------------------------------------------------
function buildHandler(): NativeFunctionCallHandler {
  return new NativeFunctionCallHandler(
    () => {},          // sendMessage
    () => {},          // sendError
    async () => {},    // processPhaseShift
  );
}

// ---------------------------------------------------------------------------
// Call the real (private) processReachNorthStar and return reachNorthStarResult.
// ---------------------------------------------------------------------------
async function callRealHandler(
  handler: NativeFunctionCallHandler,
  session: StreamingSession,
  query?: string,
): Promise<string> {
  // Reset result so stale values don't bleed through
  (session as any).reachNorthStarResult = undefined;
  await (handler as any).processReachNorthStar(session, query, 'brief');
  return String((session as any).reachNorthStarResult ?? '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function runSelfCheck() {
  console.log('\n=== reach_north_star founding-content SELF-CHECK ===\n');
  console.log('Purpose: confirm the real handler omits "The Founding Moment" when source_conversation_id is cleared.\n');

  const db = getSharedDb();

  // 1. Find a suitable principle
  const linked = await db
    .select({
      id: northStarPrinciples.id,
      title: northStarPrinciples.principleTitle,
      sourceConversationId: northStarPrinciples.sourceConversationId,
    })
    .from(northStarPrinciples)
    .where(
      and(
        eq(northStarPrinciples.isActive, true),
        isNotNull(northStarPrinciples.sourceConversationId),
      )
    )
    .limit(10);

  // Pick first whose conversation_memories row has real content
  let target: typeof linked[0] | null = null;
  for (const p of linked) {
    const [mem] = await db
      .select({ summary: conversationMemories.summary, content: conversationMemories.content })
      .from(conversationMemories)
      .where(eq(conversationMemories.id, p.sourceConversationId!))
      .limit(1);
    if (mem && (mem.summary || mem.content || '').trim().length >= 10) {
      target = p;
      break;
    }
  }

  if (!target) {
    console.error('✗ Could not find an active principle whose source_conversation_id points to a non-empty conversation_memories row.');
    process.exit(1);
  }

  const originalId = target.sourceConversationId!;
  console.log(`Target principle: "${target.title}" (id=${target.id})`);
  console.log(`sourceConversationId: ${originalId}\n`);

  const handler = buildHandler();

  // 2. Pre-check — with DB intact the output MUST contain "The Founding Moment"
  console.log('Step 1: calling real handler with source_conversation_id intact…');
  const sessionBefore = buildMockSession();
  const resultBefore = await callRealHandler(handler, sessionBefore, target.title ?? undefined);

  if (!resultBefore.includes('The Founding Moment')) {
    console.error(`✗ Pre-check FAILED: handler did not include "The Founding Moment" before clearing.`);
    console.error(`  Output was: ${resultBefore.substring(0, 400)}`);
    process.exit(1);
  }
  console.log('✓ Pre-check passed — "The Founding Moment" is present in the output.\n');

  // 3. Temporarily clear source_conversation_id
  console.log('Step 2: clearing source_conversation_id in DB…');
  await db
    .update(northStarPrinciples)
    .set({ sourceConversationId: null })
    .where(eq(northStarPrinciples.id, target.id));
  console.log('✓ Cleared.\n');

  let selfCheckPassed = false;
  let resultAfter = '';

  try {
    // 4. Call the real handler again — founding moment must now be absent
    console.log('Step 3: calling real handler with source_conversation_id cleared…');
    const sessionAfter = buildMockSession();
    resultAfter = await callRealHandler(handler, sessionAfter, target.title ?? undefined);

    if (resultAfter.includes('The Founding Moment')) {
      console.error('✗ SELF-CHECK FAILED: "The Founding Moment" still appeared after clearing source_conversation_id.');
      console.error('  The production handler does not gate founding content on sourceConversationId — the guard is broken.');
      console.error(`  Output excerpt: ${resultAfter.substring(0, 400)}`);
    } else {
      console.log('✓ "The Founding Moment" correctly absent when source_conversation_id is NULL.');
      console.log('✓ Self-check PASSED — the real handler gates founding content on sourceConversationId.\n');
      selfCheckPassed = true;
    }
  } finally {
    // 5. Restore unconditionally
    console.log(`Step 4: restoring source_conversation_id to ${originalId}…`);
    try {
      await db
        .update(northStarPrinciples)
        .set({ sourceConversationId: originalId })
        .where(eq(northStarPrinciples.id, target.id));

      const [restored] = await db
        .select({ sourceConversationId: northStarPrinciples.sourceConversationId })
        .from(northStarPrinciples)
        .where(eq(northStarPrinciples.id, target.id))
        .limit(1);

      if (restored?.sourceConversationId === originalId) {
        console.log(`✓ Restored: source_conversation_id = ${restored.sourceConversationId}\n`);
      } else {
        console.error(`✗ Restore may have failed — value is now "${restored?.sourceConversationId}"`);
        console.error(`  Manual fix: UPDATE compass_principles SET source_conversation_id = '${originalId}' WHERE id = '${target.id}';`);
        process.exit(1);
      }
    } catch (err) {
      console.error('✗ Error during restore:', err);
      console.error(`  Manual fix: UPDATE compass_principles SET source_conversation_id = '${originalId}' WHERE id = '${target.id}';`);
      process.exit(1);
    }
  }

  if (!selfCheckPassed) {
    console.error('\nFAIL: Self-check did not pass. See errors above.');
    process.exit(1);
  }

  // 6. Post-restore verification — founding moment must return
  console.log('Step 5: post-restore verification — founding moment must return…');
  const sessionRestored = buildMockSession();
  const resultRestored = await callRealHandler(handler, sessionRestored, target.title ?? undefined);
  if (!resultRestored.includes('The Founding Moment')) {
    console.error('✗ Post-restore check FAILED: "The Founding Moment" did not return after restoring source_conversation_id.');
    console.error(`  Output: ${resultRestored.substring(0, 400)}`);
    process.exit(1);
  }
  console.log('✓ Post-restore: "The Founding Moment" is present again.\n');

  console.log('=== Self-check complete — reach_north_star founding guard is correctly gated on source_conversation_id ===\n');
  process.exit(0);
}

runSelfCheck().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
