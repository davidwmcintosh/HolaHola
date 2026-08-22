#!/usr/bin/env npx tsx
/**
 * test-reach-north-star-response-field.ts
 *
 * Deterministic CI guard: confirms that `reachNorthStarResult` would be
 * included in the agent-voice-turn HTTP response when reach_north_star fires.
 *
 * Two-part check — no live GL session, no pre-existing DB state required:
 *
 *  Part A — Static source assertion
 *    Grep server/routes.ts for the reachNorthStarResult spread inside res.json.
 *    This fails immediately if someone removes the spread from the HTTP response.
 *
 *  Part B — Handler output assertion (self-contained)
 *    Seed a temporary north_star_principles row + a conversation_memories row,
 *    instantiate NativeFunctionCallHandler, call processReachNorthStar with the
 *    seeded principle title, assert session.reachNorthStarResult is non-empty,
 *    then delete both seeded rows in a finally block.
 *
 *  Self-verification:
 *    • Removing the `...(reachNorthStarResult !== undefined ? { reachNorthStarResult } : {})`
 *      spread from res.json in server/routes.ts causes Part A to fail.
 *    • Breaking processReachNorthStar (empty return, undefined assignment, etc.)
 *      causes Part B to fail.
 *
 *  Exit 0 when both parts pass; exit 1 on any failure.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NativeFunctionCallHandler } from '../services/native-fc-handlers';
import type { StreamingSession } from '../services/streaming-session-types';
import { getSharedDb } from '../db';
import { northStarPrinciples, conversationMemories } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// ── Failure accumulator ───────────────────────────────────────────────────────

const FAIL_REASONS: string[] = [];

function pass(label: string, detail = '') {
  console.log(`  ✓  ${label}`);
  if (detail) console.log(`       ${detail.substring(0, 140).replace(/\n/g, ' ')}`);
}

function fail(label: string, reason: string) {
  console.error(`  ✗  ${label}: ${reason}`);
  FAIL_REASONS.push(`${label}: ${reason}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildMockSession(): StreamingSession {
  return {
    id: 'resp-field-test-session',
    userId: 'resp-field-test-user',
    conversationId: 'resp-field-test-conv',
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
  } as unknown as StreamingSession;
}

function buildHandler(): NativeFunctionCallHandler {
  return new NativeFunctionCallHandler(
    () => {},       // sendMessage
    () => {},       // sendError
    async () => {}, // processPhaseShift
  );
}

// ── Part A: Static source assertion ──────────────────────────────────────────

async function runPartA(): Promise<void> {
  console.log('\n── Part A: reachNorthStarResult spread present in res.json ────────────\n');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = path.dirname(__filename);
  const routesPath = path.resolve(__dirname, '../routes.ts');

  let source: string;
  try {
    source = fs.readFileSync(routesPath, 'utf8');
  } catch (err: any) {
    fail('routes.ts readable', `Could not read file: ${err.message}`);
    return;
  }

  // Matches: ...(reachNorthStarResult !== undefined ? { reachNorthStarResult } : {})
  // inside the res.json(...) call.
  const SPREAD_PATTERN =
    /reachNorthStarResult\s*!==\s*undefined\s*\?\s*\{\s*reachNorthStarResult\s*\}\s*:\s*\{\s*\}/;

  if (SPREAD_PATTERN.test(source)) {
    const lineIdx = source.split('\n').findIndex(l => SPREAD_PATTERN.test(l));
    pass(
      'reachNorthStarResult spread found in server/routes.ts',
      `line ~${lineIdx + 1}`,
    );
  } else {
    fail(
      'reachNorthStarResult spread found in server/routes.ts',
      'Pattern `reachNorthStarResult !== undefined ? { reachNorthStarResult } : {}` ' +
      'not found in routes.ts — the field has been dropped from res.json.',
    );
  }
}

// ── Part B: Handler output assertion (self-contained) ─────────────────────────

async function runPartB(): Promise<void> {
  console.log('\n── Part B: processReachNorthStar produces a non-empty result ───────────\n');

  const db = getSharedDb();

  // Unique marker so cleanup is surgical and never affects real data.
  const TEST_MARKER = `__ci_resp_field_test_${Date.now()}__`;
  const PRINCIPLE_TITLE = `CI Response-Field Guard ${TEST_MARKER}`;

  let memId: string | undefined;
  let principleId: string | undefined;

  try {
    // 1. Seed a conversation_memories row (the "founding moment" source).
    const [mem] = await db
      .insert(conversationMemories)
      .values({
        title: `Founding source for ${PRINCIPLE_TITLE}`,
        summary: `This is the founding summary for the CI response-field guard test (${TEST_MARKER}).`,
        content: `Verbatim founding content for the CI guard: "${PRINCIPLE_TITLE}" was born here.`,
        entryType: 'decision',
        tags: ['ci-test'],
        importance: 5,
      })
      .returning({ id: conversationMemories.id });
    memId = mem.id;
    console.log(`  Seeded conversation_memories: ${memId}`);

    // 2. Seed a north_star_principles row linked to that memory.
    const [principle] = await db
      .insert(northStarPrinciples)
      .values({
        principleTitle: PRINCIPLE_TITLE,
        principle: `A CI-seeded principle: every HTTP response field must be tested (${TEST_MARKER}).`,
        category: 'identity',
        sourceConversationId: memId,
        isActive: true,
        orderIndex: 9999,
      })
      .returning({ id: northStarPrinciples.id });
    principleId = principle.id;
    console.log(`  Seeded north_star_principles: ${principleId}`);

    // 3. Call the real handler.
    const handler = buildHandler();
    const session  = buildMockSession();
    (session as any).reachNorthStarResult = undefined;

    try {
      await (handler as any).processReachNorthStar(session, PRINCIPLE_TITLE, 'brief');
    } catch (err: any) {
      fail('processReachNorthStar completes without throwing', err.message);
      return;
    }

    const result: unknown = (session as any).reachNorthStarResult;

    // 4. Assert the result is non-empty.
    if (typeof result === 'string' && result.trim().length > 10) {
      pass(
        'session.reachNorthStarResult is non-empty after processReachNorthStar',
        `length=${result.length} excerpt="${result.substring(0, 100).replace(/\n/g, ' ')}..."`,
      );
      // The spread in routes.ts fires when reachNorthStarResult !== undefined.
      // A non-empty string (not undefined) would always be included.
      pass('value would be included by the res.json spread (result !== undefined)');
    } else {
      fail(
        'session.reachNorthStarResult is non-empty after processReachNorthStar',
        `got: ${JSON.stringify(result)} — handler produced nothing useful`,
      );
    }
  } finally {
    // 5. Clean up seeded rows unconditionally.
    if (principleId) {
      await db.delete(northStarPrinciples).where(eq(northStarPrinciples.id, principleId));
      console.log(`  Cleaned up principle: ${principleId}`);
    }
    if (memId) {
      await db.delete(conversationMemories).where(eq(conversationMemories.id, memId));
      console.log(`  Cleaned up memory: ${memId}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n=== reach_north_star response-field guard (deterministic) ===\n');

  await runPartA();
  await runPartB();

  console.log('\n─── Summary ─────────────────────────────────────────────────────────────\n');

  if (FAIL_REASONS.length === 0) {
    console.log('  ✓  Part A: reachNorthStarResult spread present in res.json.');
    console.log('  ✓  Part B: processReachNorthStar delivers a non-empty result.');
    console.log('\n✓ reach_north_star response-field guard passed\n');
    process.exit(0);
  } else {
    console.error(`\nFAILURES (${FAIL_REASONS.length}):`);
    FAIL_REASONS.forEach(r => console.error(`  • ${r}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
