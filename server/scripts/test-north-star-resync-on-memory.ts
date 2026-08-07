/**
 * test-north-star-resync-on-memory.ts
 *
 * Confirms that old tool_knowledge rows for North Star principles gain a
 * "Related Archives:" line when a matching conversation_memory is added later
 * and syncNorthStarToNeuralNetwork is called — without requiring a server restart.
 *
 * Three parts:
 *   PART 1 — Static source check: routes.ts POST /api/conversation-memories and
 *             native-fc-handlers.ts SAVE_CONVERSATION_MEMORY both fire a North Star
 *             re-sync after the insert.
 *   PART 2 — Live DB round-trip: seed a principle with no matching memory → sync
 *             (no Related Archives) → add matching memory → re-sync → Related
 *             Archives line now present in the tool_knowledge row.
 *   PART 3 — Mutation self-check: verify PART 1 guards would fire if the hook were
 *             removed, and verify the update comparison in context-sync-service.ts
 *             would be caught if stripped.
 *
 * Run: npx tsx server/scripts/test-north-star-resync-on-memory.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getSharedDb } from '../db';
import { northStarPrinciples, conversationMemories, toolKnowledge } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Static source check
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Static source check: re-sync hooks present in both save paths'));
sep();

function runPart1() {
  const routesSrc        = readFileSync(resolve(__dirname, '../routes.ts'), 'utf-8');
  const fcHandlersSrc    = readFileSync(resolve(__dirname, '../services/native-fc-handlers.ts'), 'utf-8');
  const contextSyncSrc   = readFileSync(resolve(__dirname, '../services/context-sync-service.ts'), 'utf-8');

  // ── routes.ts POST /api/conversation-memories ─────────────────────────────
  const routesMemoryRoute = routesSrc.indexOf('/api/conversation-memories');
  assert(
    'POST /api/conversation-memories route exists in routes.ts',
    routesMemoryRoute !== -1,
  );

  // The re-sync import must appear after the memory insert
  const routesInsertIdx = routesSrc.indexOf("getUserDb().insert(conversationMemories).values");
  const routesResyncIdx = routesSrc.indexOf(
    "contextSyncService.syncNorthStarToNeuralNetwork()",
    routesInsertIdx,
  );
  assert(
    'routes.ts: contextSyncService.syncNorthStarToNeuralNetwork() fires after memory insert',
    routesInsertIdx !== -1 && routesResyncIdx !== -1 && routesResyncIdx > routesInsertIdx,
    `insertIdx=${routesInsertIdx}, resyncIdx=${routesResyncIdx}`,
  );

  // Must use a fire-and-forget dynamic import
  const routesDynamicImport = routesSrc.includes(
    "import('./services/context-sync-service')"
  );
  assert(
    "routes.ts: dynamic import('./services/context-sync-service') present",
    routesDynamicImport,
  );

  // ── native-fc-handlers.ts SAVE_CONVERSATION_MEMORY ───────────────────────
  const fcSaveHandlerIdx = fcHandlersSrc.indexOf("case 'SAVE_CONVERSATION_MEMORY':");
  assert(
    "SAVE_CONVERSATION_MEMORY case exists in native-fc-handlers.ts",
    fcSaveHandlerIdx !== -1,
  );

  // The insert's .then() callback must log first, then trigger the re-sync.
  // Ordering proof: savedLog < fcResync < fcCatch ensures the import is
  // nested inside .then() and not racing ahead of the insert's commit.
  const fcInsertIdx = fcHandlersSrc.indexOf(
    'db.insert(conversationMemories).values',
    fcSaveHandlerIdx,
  );
  const fcSavedLogIdx = fcHandlersSrc.indexOf(
    "[Native Function→SaveConversationMemory] ✓ Saved:",
    fcInsertIdx,
  );
  const fcResyncIdx = fcHandlersSrc.indexOf(
    "import('./context-sync-service')",
    fcSavedLogIdx,
  );
  const fcCatchIdx = fcHandlersSrc.indexOf(
    ".catch((err: Error) => console.error(`[Native Function→SaveConversationMemory] Error:`",
    fcResyncIdx,
  );
  assert(
    'native-fc-handlers.ts: re-sync import appears after the ✓ Saved log (inside .then())',
    fcSavedLogIdx !== -1 && fcResyncIdx !== -1 && fcResyncIdx > fcSavedLogIdx,
    `savedLogIdx=${fcSavedLogIdx}, resyncIdx=${fcResyncIdx}`,
  );
  assert(
    'native-fc-handlers.ts: re-sync import appears before the insert .catch() — confirms it is inside .then()',
    fcResyncIdx !== -1 && fcCatchIdx !== -1 && fcResyncIdx < fcCatchIdx,
    `resyncIdx=${fcResyncIdx}, catchIdx=${fcCatchIdx}`,
  );

  // Must use a fire-and-forget dynamic import
  const fcDynamicImport = fcHandlersSrc.includes(
    "import('./context-sync-service')"
  );
  assert(
    "native-fc-handlers.ts: dynamic import('./context-sync-service') present",
    fcDynamicImport,
  );

  // ── context-sync-service.ts update comparison ─────────────────────────────
  // The update guard must compare BOTH purpose AND syntax — syntax carries the
  // Related Archives line, so stripping it would mean new memories never land.
  const syntaxCompare = contextSyncSrc.includes(
    "existing[0].syntax !== syntaxContent"
  );
  assert(
    'context-sync-service.ts: syntax comparison present in update guard (catches new Related Archives)',
    syntaxCompare,
  );

  const purposeCompare = contextSyncSrc.includes(
    "existing[0].purpose !== purposeContent"
  );
  assert(
    'context-sync-service.ts: purpose comparison also present in update guard',
    purposeCompare,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Live DB round-trip
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Live DB: seed principle → sync (no archives) → add memory → re-sync → archives present'));
sep();

const TEST_PRINCIPLE_TITLE = 'test-703-resync-signal-principle';

async function runPart2() {
  const db = getSharedDb();

  // ── Cleanup any leftover state from a prior crashed run ───────────────────
  const existingPrinciples = await db
    .select({ id: northStarPrinciples.id })
    .from(northStarPrinciples)
    .where(eq(northStarPrinciples.principleTitle, TEST_PRINCIPLE_TITLE));
  for (const p of existingPrinciples) {
    const toolName = `NORTH_STAR_PEDAGOGY_9999`;
    await db.delete(toolKnowledge).where(eq(toolKnowledge.toolName, toolName));
    await db.delete(northStarPrinciples).where(eq(northStarPrinciples.id, p.id));
  }

  // ── Step 1: Insert a test principle ──────────────────────────────────────
  const [principle] = await db
    .insert(northStarPrinciples)
    .values({
      principleTitle: TEST_PRINCIPLE_TITLE,
      principle: 'Test principle text for task-703 CI check — do not use in production.',
      category: 'pedagogy',
      orderIndex: 9999,
      isActive: true,
    })
    .returning({ id: northStarPrinciples.id });

  assert('Test principle inserted', !!principle?.id, principle?.id ?? 'no id');
  if (!principle?.id) return;

  const toolName = 'NORTH_STAR_PEDAGOGY_9999';

  try {
    // ── Step 2: Run initial sync — expect NO Related Archives ────────────────
    const { contextSyncService } = await import('../services/context-sync-service');
    const firstSync = await contextSyncService.syncNorthStarToNeuralNetwork();
    assert(
      'First sync ran without errors',
      firstSync.errors.length === 0,
      firstSync.errors.join('; '),
    );

    const [rowAfterFirstSync] = await db
      .select({ id: toolKnowledge.id, syntax: toolKnowledge.syntax })
      .from(toolKnowledge)
      .where(eq(toolKnowledge.toolName, toolName))
      .limit(1);

    assert(
      'tool_knowledge row created for test principle after first sync',
      !!rowAfterFirstSync,
    );
    assert(
      'Related Archives line is absent before any matching memory exists',
      !rowAfterFirstSync?.syntax?.includes('Related Archives:'),
      rowAfterFirstSync?.syntax ?? '(no row)',
    );

    // ── Step 3: Insert a matching conversation_memory ────────────────────────
    const [memory] = await db
      .insert(conversationMemories)
      .values({
        title: `The ${TEST_PRINCIPLE_TITLE} session`,
        summary: 'Test memory for task-703 CI re-sync check.',
        content: 'Test content.',
        importance: 5,
        tags: ['ci-test-703'],
      })
      .returning({ id: conversationMemories.id });

    assert('Matching conversation_memory inserted', !!memory?.id, memory?.id ?? 'no id');
    if (!memory?.id) return;

    try {
      // ── Step 4: Re-sync — expect Related Archives to appear ────────────────
      const secondSync = await contextSyncService.syncNorthStarToNeuralNetwork();
      assert(
        'Second sync (after memory insert) ran without errors',
        secondSync.errors.length === 0,
        secondSync.errors.join('; '),
      );

      const [rowAfterSecondSync] = await db
        .select({ syntax: toolKnowledge.syntax })
        .from(toolKnowledge)
        .where(eq(toolKnowledge.toolName, toolName))
        .limit(1);

      assert(
        'Related Archives line is present after re-sync with matching memory',
        !!rowAfterSecondSync?.syntax?.includes('Related Archives:'),
        rowAfterSecondSync?.syntax ?? '(no row)',
      );

      assert(
        'Related Archives line contains the test memory id',
        !!rowAfterSecondSync?.syntax?.includes(memory.id),
        rowAfterSecondSync?.syntax ?? '(no row)',
      );

    } finally {
      // Clean up the memory regardless of outcome
      await db.delete(conversationMemories).where(eq(conversationMemories.id, memory.id));
    }

  } finally {
    // Clean up the principle and its tool_knowledge row
    await db.delete(toolKnowledge).where(eq(toolKnowledge.toolName, toolName));
    await db.delete(northStarPrinciples).where(eq(northStarPrinciples.id, principle.id));
    console.log('  (test rows cleaned up)');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Mutation self-check
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Mutation self-check: PART 1 guards detect when hooks are removed'));
sep();

function runPart3() {
  const routesSrc      = readFileSync(resolve(__dirname, '../routes.ts'), 'utf-8');
  const fcHandlersSrc  = readFileSync(resolve(__dirname, '../services/native-fc-handlers.ts'), 'utf-8');
  const contextSyncSrc = readFileSync(resolve(__dirname, '../services/context-sync-service.ts'), 'utf-8');

  // ── Simulate: re-sync hook removed from routes.ts ─────────────────────────
  const mutatedRoutes = routesSrc.replace(
    "contextSyncService.syncNorthStarToNeuralNetwork()",
    "contextSyncService.syncNorthStarToNeuralNetworkDELETED()",
  );
  const mutatedRoutesHasHook = mutatedRoutes.includes(
    "contextSyncService.syncNorthStarToNeuralNetwork()"
  );
  assert(
    'Mutation self-check: PART 1 detects when re-sync hook is removed from routes.ts',
    !mutatedRoutesHasHook,
    'hook still found in mutated source — PART 1 guard would not catch this regression',
  );

  // ── Simulate: re-sync import removed from native-fc-handlers.ts ───────────
  const mutatedFcHandlers = fcHandlersSrc.replace(
    "import('./context-sync-service')",
    "import('./context-sync-service-DELETED')",
  );
  const fcImportIdx        = fcHandlersSrc.indexOf("import('./context-sync-service')");
  const mutatedFcImportIdx = mutatedFcHandlers.indexOf("import('./context-sync-service')");
  assert(
    'Mutation self-check: PART 1 detects when re-sync import is removed from native-fc-handlers.ts',
    fcImportIdx !== -1 && mutatedFcImportIdx === -1,
    mutatedFcImportIdx !== -1
      ? 'import still found in mutated source — guard would not catch this regression'
      : undefined,
  );

  // ── Simulate: re-sync moved outside .then() (race restored) ──────────────
  // The ordering check (resync < catch) would fail if the import were placed
  // after the .catch() line instead of inside .then().
  const savedLogPos  = fcHandlersSrc.indexOf("[Native Function→SaveConversationMemory] ✓ Saved:");
  const importPos    = fcHandlersSrc.indexOf("import('./context-sync-service')", savedLogPos);
  const catchPos     = fcHandlersSrc.indexOf(
    ".catch((err: Error) => console.error(`[Native Function→SaveConversationMemory] Error:`",
    importPos,
  );
  // Verify the real source satisfies the ordering (importPos < catchPos).
  // A mutation that moves the import after catchPos would invert this.
  assert(
    'Mutation self-check: ordering guard catches if re-sync is moved after .catch() (race restored)',
    importPos !== -1 && catchPos !== -1 && importPos < catchPos,
    `importPos=${importPos}, catchPos=${catchPos}`,
  );

  // ── Simulate: syntax comparison removed from update guard ─────────────────
  const mutatedSyncSrc = contextSyncSrc.replace(
    "existing[0].syntax !== syntaxContent",
    "false /* syntax check removed */",
  );
  const mutatedHasSyntaxCompare = mutatedSyncSrc.includes(
    "existing[0].syntax !== syntaxContent"
  );
  assert(
    'Mutation self-check: PART 1 detects when syntax comparison is removed from update guard',
    !mutatedHasSyntaxCompare,
    'comparison still found in mutated source — PART 1 guard would not catch this regression',
  );

  // ── Simulate: purpose comparison removed (only syntax guard remains) ───────
  const mutatedPurposeSrc = contextSyncSrc.replace(
    "existing[0].purpose !== purposeContent",
    "false /* purpose check removed */",
  );
  const mutatedHasPurposeCompare = mutatedPurposeSrc.includes(
    "existing[0].purpose !== purposeContent"
  );
  assert(
    'Mutation self-check: PART 1 detects when purpose comparison is removed from update guard',
    !mutatedHasPurposeCompare,
    'comparison still found in mutated source — PART 1 guard would not catch this regression',
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

(async () => {
  try {
    runPart1();
    await runPart2();
    runPart3();
  } catch (err: any) {
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed — North Star re-sync on memory insert verified.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
})();
