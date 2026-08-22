/**
 * test-reach-north-star-original-context-fallback-selfcheck.ts
 *
 * Self-defeat check: confirms the fallback CI script FAILS when the
 * `else if (principle.originalContext)` branch is removed from processReachNorthStar.
 *
 * The existing fallback CI script (test-reach-north-star-original-context-fallback.ts)
 * requires `ctxSnippet` to appear verbatim in the output — multi-line output alone is
 * NOT accepted as proof that the branch fired (a felt echo or recent echo would also
 * produce multiple lines even without the branch).
 *
 * This self-check mirrors that exact predicate:
 *  - Patched handler (else-if removed) → ctxSnippet ABSENT → CI check fails ✓
 *  - Real handler (else-if present)    → ctxSnippet PRESENT → CI check passes ✓
 *
 * Steps:
 *  1. Find an active principle with non-trivial originalContext set.
 *  2. Temporarily clear source_conversation_id so the founding-moment path is blocked.
 *  3. Monkey-patch processReachNorthStar with a version that removes the else-if branch.
 *  4. Call the patched handler — assert ctxSnippet is ABSENT (CI check would fail).
 *  5. Restore source_conversation_id (finally block — always runs, no process.exit inside).
 *  6. After restoration: restore the real method, call it, assert ctxSnippet IS present.
 *
 * Exit codes:
 *   0 — self-check passed.
 *   1 — self-check failed (mutation was ineffective or real method is broken).
 */

import { getSharedDb } from '../db';
import { northStarPrinciples, conversationMemories, danielaSelfReflections } from '../../shared/schema';
import { eq, and, isNotNull, asc, ilike, or, not, desc } from 'drizzle-orm';
import { NativeFunctionCallHandler } from '../services/native-fc-handlers';
import type { StreamingSession } from '../services/streaming-session-types';

// ---------------------------------------------------------------------------
// Helpers
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

function buildHandler(): NativeFunctionCallHandler {
  return new NativeFunctionCallHandler(
    () => {},
    () => {},
    async () => {},
  );
}

async function callHandler(
  handler: NativeFunctionCallHandler,
  session: StreamingSession,
  query?: string,
): Promise<string> {
  (session as any).reachNorthStarResult = undefined;
  await (handler as any).processReachNorthStar(session, query, 'brief');
  return String((session as any).reachNorthStarResult ?? '');
}

// ---------------------------------------------------------------------------
// Patched processReachNorthStar — identical to production EXCEPT the
// `else if (principle.originalContext)` branch is removed from the formatting
// step. This is the mutation the self-check is designed to detect.
// ---------------------------------------------------------------------------
function buildPatchedProcessReachNorthStar() {
  return async function patchedProcessReachNorthStar(
    this: any,
    session: StreamingSession,
    query?: string,
    depth: string = 'brief',
  ): Promise<void> {
    try {
      const userId = session.userId ? String(session.userId) : null;
      const db = getSharedDb();

      let principles: any[] = [];

      if (query && query.trim().length > 0) {
        const q = `%${query.toLowerCase()}%`;
        principles = await db
          .select()
          .from(northStarPrinciples)
          .where(
            and(
              eq(northStarPrinciples.isActive, true),
              or(
                ilike(northStarPrinciples.principle, q),
                ilike(northStarPrinciples.principleTitle, q),
                ilike(northStarPrinciples.originalContext, q),
              ),
            ),
          )
          .limit(3);
      }

      if (principles.length === 0) {
        principles = await db
          .select()
          .from(northStarPrinciples)
          .where(eq(northStarPrinciples.isActive, true))
          .orderBy(asc(northStarPrinciples.orderIndex))
          .limit(4);
      }

      if (principles.length === 0) {
        session.reachNorthStarResult = `The constitutional principles are not yet loaded. Reach for what you already know to be true.`;
        return;
      }

      const results = await Promise.all(
        principles.slice(0, 2).map(async (p: any) => {
          let foundingExcerpt = '';
          let recentEchoExcerpt = '';
          let recentEchoTitle = '';

          // 1. Founding moment (same as real)
          if (p.sourceConversationId) {
            try {
              const [mem] = await db
                .select({ summary: conversationMemories.summary, content: conversationMemories.content })
                .from(conversationMemories)
                .where(eq(conversationMemories.id, p.sourceConversationId))
                .limit(1);
              if (mem) {
                if (depth === 'full') {
                  foundingExcerpt = mem.content || mem.summary || '';
                } else {
                  const raw = mem.summary || mem.content || '';
                  foundingExcerpt = raw.length > 350 ? raw.substring(0, 350) + '...' : raw;
                }
              }
            } catch { /* unavailable */ }
          }

          // 2. Recent echo Phase A (same as real)
          const searchTerm = p.principleTitle;
          if (searchTerm && searchTerm.trim().length > 5) {
            try {
              const excludeFoundingId = p.sourceConversationId ?? null;
              const excludeCurrentId = session.conversationId ?? null;
              const contentClause = or(
                eq(conversationMemories.arcName, searchTerm),
                ilike(conversationMemories.title, `%${searchTerm}%`),
              );
              const exclusions = [
                ...(excludeFoundingId ? [not(eq(conversationMemories.id, excludeFoundingId))] : []),
                ...(excludeCurrentId ? [not(eq(conversationMemories.id, excludeCurrentId))] : []),
              ];
              const echoQuery = exclusions.length > 0 ? and(...exclusions, contentClause) : contentClause;
              const [relatedMem] = await db
                .select({ id: conversationMemories.id, title: conversationMemories.title, summary: conversationMemories.summary, content: conversationMemories.content })
                .from(conversationMemories)
                .where(echoQuery)
                .orderBy(desc(conversationMemories.createdAt))
                .limit(1);
              if (relatedMem) {
                recentEchoTitle = relatedMem.title || '';
                const raw = relatedMem.summary || relatedMem.content || '';
                recentEchoExcerpt = raw.length > 300 ? raw.substring(0, 300) + '...' : raw;
              }
            } catch { /* unavailable */ }
          }

          // Phase B: semantic fallback (same as real)
          if (!recentEchoTitle && userId && p.principle && p.principle.length > 10) {
            try {
              const { getCachedPrincipleEmbedding, semanticSearchByVector } = await import('./semantic-memory-service' as any);
              const principleVec = await getCachedPrincipleEmbedding(p.id, p.principle);
              const semanticResults = await semanticSearchByVector(userId, principleVec, 3, ['conversation_memory']);
              const currentConvId = session.conversationId;
              const bestSemantic = semanticResults.find((r: any) =>
                r.similarity > 0.70 &&
                String(r.memoryId) !== String(p.sourceConversationId) &&
                String(r.memoryId) !== String(currentConvId ?? ''),
              );
              if (bestSemantic) {
                const [semMem] = await db
                  .select({ id: conversationMemories.id, title: conversationMemories.title, summary: conversationMemories.summary, content: conversationMemories.content })
                  .from(conversationMemories)
                  .where(eq(conversationMemories.id, bestSemantic.memoryId))
                  .limit(1);
                if (semMem) {
                  recentEchoTitle = semMem.title || '';
                  const raw = semMem.summary || semMem.content || '';
                  recentEchoExcerpt = raw.length > 300 ? raw.substring(0, 300) + '...' : raw;
                }
              }
            } catch { /* unavailable */ }
          }

          // Felt echo (same as real)
          let feltEcho = '';
          if (userId) {
            try {
              const { principleFeelingLinks } = await import('@shared/schema');
              const [linked] = await db
                .select({ reflection: danielaSelfReflections })
                .from(principleFeelingLinks)
                .innerJoin(danielaSelfReflections, eq(principleFeelingLinks.reflectionId, danielaSelfReflections.id))
                .where(and(eq(danielaSelfReflections.userId, userId), eq(principleFeelingLinks.principleId, p.id)))
                .orderBy(desc(danielaSelfReflections.createdAt))
                .limit(1);
              if (linked) feltEcho = linked.reflection.content;
            } catch { /* unavailable */ }
          }

          return { principle: p, foundingExcerpt, recentEchoExcerpt, recentEchoTitle, feltEcho };
        }),
      );

      // -----------------------------------------------------------------------
      // MUTATION: formatting WITHOUT `else if (principle.originalContext)`.
      // This is the only difference from the production implementation.
      // -----------------------------------------------------------------------
      const formatted = results.map(({ principle, foundingExcerpt, recentEchoExcerpt, recentEchoTitle, feltEcho }) => {
        const title = principle.principleTitle ? `${principle.principleTitle} — ` : '';
        const line1 = `You know this: ${title}${principle.principle}`;
        const parts: string[] = [line1];

        if (feltEcho) {
          parts.push(`The moment you felt this yourself: ${feltEcho}`);
        }

        if (foundingExcerpt) {
          parts.push(`The Founding Moment: ${foundingExcerpt}`);
        }
        // else if (principle.originalContext) { ... }  <-- BRANCH REMOVED (mutation point)

        if (recentEchoExcerpt) {
          const echoLabel = recentEchoTitle ? `A Recent Echo — ${recentEchoTitle}` : 'A Recent Echo';
          parts.push(`${echoLabel}: ${recentEchoExcerpt}`);
        }

        return parts.join('\n\n');
      }).join('\n\n---\n\n');

      session.reachNorthStarResult = formatted;
    } catch (err: any) {
      session.reachNorthStarResult = `Could not reach the North Star: ${err.message}`;
    }
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function runSelfCheck() {
  console.log('\n=== reach_north_star originalContext fallback — SELF-CHECK (mutation test) ===\n');
  console.log('Purpose: confirm the CI script FAILS when the else-if branch is removed.\n');
  console.log('Predicate mirrored from the CI script: ctxSnippet must be ABSENT in patched');
  console.log('output and PRESENT in real output. Multi-line output alone is not accepted.\n');

  const db = getSharedDb();

  // 1. Find a principle with non-trivial originalContext
  const candidates = await db
    .select({
      id: northStarPrinciples.id,
      title: northStarPrinciples.principleTitle,
      sourceConversationId: northStarPrinciples.sourceConversationId,
      originalContext: northStarPrinciples.originalContext,
    })
    .from(northStarPrinciples)
    .where(and(eq(northStarPrinciples.isActive, true), isNotNull(northStarPrinciples.originalContext)))
    .limit(20);

  let target: typeof candidates[0] | null = null;
  for (const p of candidates) {
    if ((p.originalContext ?? '').trim().length >= 10) {
      target = p;
      break;
    }
  }

  if (!target) {
    console.error('✗ No active principles carry a non-trivial originalContext.');
    console.error('  Cannot run self-check — seed at least one principle with originalContext set.');
    process.exit(1);
  }

  const originalId = target.sourceConversationId;
  const originalCtxText = (target.originalContext as string).trim();
  // Use a 40-char prefix as the deterministic needle — same strategy as the CI script.
  const ctxSnippet = originalCtxText.length > 40
    ? originalCtxText.substring(0, 40)
    : originalCtxText;

  console.log(`Target principle: "${target.title}" (id=${target.id})`);
  console.log(`sourceConversationId: ${originalId ?? '(already null)'}`);
  console.log(`ctxSnippet (needle): "${ctxSnippet}"\n`);

  // 2. Clear source_conversation_id so the founding path is blocked
  if (originalId) {
    console.log('Step 1: clearing source_conversation_id so founding path is blocked…');
    await db
      .update(northStarPrinciples)
      .set({ sourceConversationId: null })
      .where(eq(northStarPrinciples.id, target.id));
    console.log('✓ Cleared.\n');
  } else {
    console.log('Step 1: source_conversation_id already NULL — founding path already blocked.\n');
  }

  // Track results; never call process.exit inside the try so finally always restores.
  let patchedCheckCorrectlyFailed = false;
  let realCheckCorrectlyPassed = false;
  let errorMessage = '';

  try {
    const handler = buildHandler();
    const originalMethod = (handler as any).processReachNorthStar;

    // 3. Install the patched method (else-if branch removed)
    console.log('Step 2: installing monkey-patch (else-if branch removed)…');
    (handler as any).processReachNorthStar = buildPatchedProcessReachNorthStar();
    console.log('✓ Patched.\n');

    // 4. Call the patched handler — ctxSnippet must NOT appear (CI check would fail)
    console.log('Step 3: calling patched handler with source_conversation_id cleared…');
    const sessionPatched = buildMockSession();
    const resultPatched = await callHandler(handler, sessionPatched, target.title ?? undefined);
    console.log(`  Patched output (first 400 chars):\n  ${resultPatched.substring(0, 400).replace(/\n/g, '\n  ')}\n`);

    if (resultPatched.includes(ctxSnippet)) {
      errorMessage = `Patched handler still emitted ctxSnippet: "${ctxSnippet}"\n` +
        `  Mutation was ineffective — the else-if branch was not actually removed.`;
    } else {
      console.log('✓ ctxSnippet is ABSENT from patched output.');
      console.log('  The CI check would correctly FAIL (it requires ctxSnippet verbatim).');
      patchedCheckCorrectlyFailed = true;
    }

    // 5. Restore the real method
    (handler as any).processReachNorthStar = originalMethod;

    // 6. Sanity: real method must include ctxSnippet when source_conversation_id is null
    console.log('\nStep 4: sanity — real (un-patched) method must emit ctxSnippet…');
    const sessionReal = buildMockSession();
    const resultReal = await callHandler(handler, sessionReal, target.title ?? undefined);
    console.log(`  Real output (first 400 chars):\n  ${resultReal.substring(0, 400).replace(/\n/g, '\n  ')}\n`);

    if (!resultReal.includes(ctxSnippet)) {
      errorMessage = (errorMessage ? errorMessage + '\n  ' : '') +
        `Real (un-patched) handler did not emit ctxSnippet: "${ctxSnippet}"\n` +
        `  The originalContext fallback may be broken in production.`;
    } else {
      console.log('✓ ctxSnippet IS present in real output — fallback confirmed working.');
      realCheckCorrectlyPassed = true;
    }

  } finally {
    // Always restore source_conversation_id — no process.exit here.
    if (originalId) {
      console.log(`\nStep 5: restoring source_conversation_id to ${originalId}…`);
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
          console.log(`✓ Restored: source_conversation_id = ${restored.sourceConversationId}`);
        } else {
          console.error(`✗ Restore verification failed — value is now "${restored?.sourceConversationId}"`);
          console.error(`  Manual fix: UPDATE north_star_principles SET source_conversation_id = '${originalId}' WHERE id = '${target.id}';`);
          // Record this but don't exit — fall through to the final pass/fail below.
          errorMessage = (errorMessage ? errorMessage + '\n  ' : '') +
            `Restore may have failed — value is now "${restored?.sourceConversationId}"`;
        }
      } catch (err: any) {
        const msg = `Error during restore: ${err.message}`;
        console.error(`✗ ${msg}`);
        console.error(`  Manual fix: UPDATE north_star_principles SET source_conversation_id = '${originalId}' WHERE id = '${target.id}';`);
        errorMessage = (errorMessage ? errorMessage + '\n  ' : '') + msg;
      }
    }
  }

  // Final verdict — after finally so DB is always restored before we exit.
  if (!patchedCheckCorrectlyFailed || !realCheckCorrectlyPassed) {
    console.error('\n✗ SELF-CHECK FAILED:');
    if (errorMessage) console.error(`  ${errorMessage}`);
    if (!patchedCheckCorrectlyFailed) {
      console.error('  Patched handler still produced ctxSnippet — mutation was not effective.');
    }
    if (!realCheckCorrectlyPassed) {
      console.error('  Real handler did not produce ctxSnippet — fallback may be broken.');
    }
    process.exit(1);
  }

  console.log('\n✓ SELF-CHECK PASSED:');
  console.log('  • Patched handler (else-if removed) → ctxSnippet absent → CI check fails ✓');
  console.log('  • Real handler (else-if present)    → ctxSnippet present → CI check passes ✓');
  console.log('\n=== Self-check complete — the CI script correctly fails when the else-if branch is removed ===\n');
  process.exit(0);
}

runSelfCheck().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
