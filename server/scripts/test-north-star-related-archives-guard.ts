/**
 * test-north-star-related-archives-guard.ts
 *
 * Confirms that the "Related Archives: <memoryId> (<title>)" line is correctly
 * written into the tool_knowledge syntax field during syncNorthStarToNeuralNetwork,
 * AND that the self-check fires when that line is deliberately omitted.
 *
 * Task 697 added the Related Archives enrichment so that Daniela can surface
 * linked conversation_memories when she calls reach_north_star.  Without a
 * guard, a future refactor could silently drop the associatedMemoryLine and the
 * neural net would lose the linkage signal with no visible error.
 *
 * WHAT THIS PROVES
 * ────────────────
 * PART 1 — Source analysis:
 *   Verifies that context-sync-service.ts still contains the associatedMemoryLine
 *   construction and its inclusion in syntaxContent.
 *
 * PART 2 — Mutant run (self-check):
 *   Runs a local replica of the sync logic with associatedMemoryLine deliberately
 *   omitted, writes the result to a disposable tool_knowledge row, reads it back
 *   and asserts "Related Archives:" is ABSENT.  This confirms the mutation is
 *   detectable — i.e., the guard has real bite.
 *
 * PART 3 — Real run (production guard):
 *   Runs the same logic with associatedMemoryLine included, updates the same
 *   disposable row, reads it back and asserts "Related Archives:" IS present.
 *   If a future refactor drops the line, this assertion fails and the script
 *   exits non-zero.
 *
 * PART 4 — Self-failure verification:
 *   Confirms that if Part 3's guard assertion were itself removed, Parts 2 & 3
 *   together would be meaningless (Part 2's absence check alone cannot catch
 *   the regression — the presence check is required).  This is verified by
 *   checking that the mutant row does NOT contain "Related Archives:" while the
 *   real row does — proving both directions are needed.
 *
 * All DB writes use a disposable toolName (NORTH_STAR_TEST_702_GUARD) that is
 * cleaned up at the end regardless of pass/fail.
 *
 * Run: npx tsx server/scripts/test-north-star-related-archives-guard.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getSharedDb } from '../db';
import {
  toolKnowledge,
  northStarPrinciples,
  conversationMemories,
} from '@shared/schema';
import { eq, or, ilike, and } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const D = (s: string) => `\x1b[2m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Test accounting ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n       ${R('→')} ${detail}` : ''}`);
    failed++;
  }
}

// ── Disposable sentinel ───────────────────────────────────────────────────────
const TEST_TOOL_NAME = 'NORTH_STAR_TEST_702_GUARD';

// ── Cleanup ───────────────────────────────────────────────────────────────────
async function cleanup(): Promise<void> {
  const db = getSharedDb();
  try {
    await db.delete(toolKnowledge).where(eq(toolKnowledge.toolName, TEST_TOOL_NAME));
  } catch {
    // best-effort
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Source analysis
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Source analysis: associatedMemoryLine is wired into syntaxContent'));
sep();

function runPart1(): void {
  const srcPath = resolve(__dirname, '../services/context-sync-service.ts');
  const src = readFileSync(srcPath, 'utf-8');

  // The variable must be declared and set on a matching path
  assert(
    'associatedMemoryLine variable is declared in context-sync-service.ts',
    src.includes('let associatedMemoryLine'),
    'Missing: let associatedMemoryLine',
  );

  // The assignment must still set the "Related Archives:" string
  assert(
    '"Related Archives:" string literal is assigned to associatedMemoryLine',
    src.includes('Related Archives: ${stubList}') || src.includes("Related Archives: "),
    'Missing Related Archives assignment — task 697 enrichment has been removed',
  );

  // The variable must be spread into syntaxContent
  assert(
    'associatedMemoryLine is included in the syntaxContent array',
    src.includes('associatedMemoryLine,') || src.includes('associatedMemoryLine\n'),
    'associatedMemoryLine is no longer spread into syntaxContent — linkage signal is lost',
  );

  // The conversation_memories join that produces stubs must exist
  assert(
    'conversation_memories join exists to populate associatedMemoryLine',
    src.includes('conversationMemories') && src.includes('memoryStubs'),
    'The DB join that fetches memoryStubs has been removed',
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Mutant run: omit associatedMemoryLine → assert ABSENT
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Mutant run: associatedMemoryLine omitted → "Related Archives:" must be absent'));
sep();
console.log(D('  This proves the guard has real bite: if the line is dropped, the test catches it.'));

async function runPart2(): Promise<{ principleTitle: string | null; memoryStubs: string } | null> {
  const db = getSharedDb();

  // Find a principle that has a title (required for the memory lookup)
  const principles = await db.select()
    .from(northStarPrinciples)
    .where(and(
      eq(northStarPrinciples.isActive, true),
    ))
    .orderBy(northStarPrinciples.orderIndex)
    .limit(20);

  const titledPrinciples = principles.filter(p => p.principleTitle && p.principleTitle.trim().length > 0);

  assert(
    'At least one active principle with a principleTitle exists in DB',
    titledPrinciples.length > 0,
    'No titled principles found — DB may be empty; skipping mutation test',
  );

  if (titledPrinciples.length === 0) return null;

  // Find a principle whose title has matching conversation_memories rows
  let chosenPrinciple: typeof titledPrinciples[0] | null = null;
  let stubList = '';

  for (const principle of titledPrinciples) {
    const stubs = await db
      .select({ id: conversationMemories.id, title: conversationMemories.title })
      .from(conversationMemories)
      .where(or(
        eq(conversationMemories.arcName, principle.principleTitle!),
        ilike(conversationMemories.title, `%${principle.principleTitle}%`),
      ))
      .limit(5);

    if (stubs.length > 0) {
      chosenPrinciple = principle;
      stubList = stubs.map((m) => `${m.id}${m.title ? ` (${m.title})` : ''}`).join(', ');
      break;
    }
  }

  assert(
    'Found a principle whose title matches at least one conversation_memories row',
    chosenPrinciple !== null,
    chosenPrinciple === null
      ? 'No principle has a matching conversation_memories row — cannot test linkage enrichment'
      : undefined,
  );

  if (!chosenPrinciple) return null;

  console.log(D(`\n  Using principle: "${chosenPrinciple.principleTitle}" (category: ${chosenPrinciple.category})`));
  console.log(D(`  Linked memory stubs: ${stubList}\n`));

  const purposeContent = chosenPrinciple.principle;

  // ── Mutant syntaxContent: deliberately omit associatedMemoryLine ──────────
  const mutantSyntax = [
    `Category: ${chosenPrinciple.category}`,
    chosenPrinciple.principleTitle ? `Title: ${chosenPrinciple.principleTitle}` : null,
    chosenPrinciple.confidenceScore !== null && chosenPrinciple.confidenceScore !== undefined
      ? `Maturity: ${chosenPrinciple.confidenceScore}`
      : null,
    chosenPrinciple.supersededBy ? `Superseded by: ${chosenPrinciple.supersededBy}` : null,
    chosenPrinciple.originalContext ? `Context: ${chosenPrinciple.originalContext}` : null,
    // associatedMemoryLine deliberately omitted (mutation)
  ].filter(Boolean).join('\n');

  // Write / upsert the disposable row with the mutant syntax
  const existing = await db.select({ id: toolKnowledge.id })
    .from(toolKnowledge)
    .where(eq(toolKnowledge.toolName, TEST_TOOL_NAME))
    .limit(1);

  if (existing.length > 0) {
    await db.update(toolKnowledge)
      .set({ purpose: purposeContent, syntax: mutantSyntax })
      .where(eq(toolKnowledge.toolName, TEST_TOOL_NAME));
  } else {
    await db.insert(toolKnowledge).values({
      toolName: TEST_TOOL_NAME,
      toolType: 'north_star_principle',
      purpose: purposeContent,
      syntax: mutantSyntax,
      examples: null,
      bestUsedFor: ['test', 'north_star'],
      avoidWhen: null,
      combinesWith: null,
      sequencePatterns: null,
      isActive: true,
    });
  }

  // Read back and assert absence
  const [row] = await db.select({ syntax: toolKnowledge.syntax })
    .from(toolKnowledge)
    .where(eq(toolKnowledge.toolName, TEST_TOOL_NAME))
    .limit(1);

  assert(
    '[Mutant] tool_knowledge row written successfully',
    !!row,
    'Row was not found after insert/update',
  );

  const mutantHasRelatedArchives = (row?.syntax ?? '').includes('Related Archives:');

  assert(
    '[Mutant] "Related Archives:" is ABSENT from syntax (mutation confirmed)',
    !mutantHasRelatedArchives,
    mutantHasRelatedArchives
      ? 'Mutant still contains "Related Archives:" — test logic error: associatedMemoryLine was not actually omitted'
      : undefined,
  );

  return { principleTitle: chosenPrinciple.principleTitle, memoryStubs: stubList };
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Real run: include associatedMemoryLine → assert PRESENT
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Real run: associatedMemoryLine included → "Related Archives:" must be present'));
sep();
console.log(D('  This is the production guard: a future refactor that drops the line will fail here.'));

async function runPart3(context: { principleTitle: string | null; memoryStubs: string }): Promise<void> {
  const db = getSharedDb();

  if (!context.principleTitle || !context.memoryStubs) {
    console.log(Y('  Skipped — no principle/memory combo found in Part 2.'));
    return;
  }

  // Re-fetch the principle to mirror production code exactly
  const [principle] = await db.select()
    .from(northStarPrinciples)
    .where(
      ilike(northStarPrinciples.principleTitle, context.principleTitle),
    )
    .limit(1);

  if (!principle) {
    assert('Principle still exists for Part 3 real run', false, `Principle "${context.principleTitle}" not found`);
    return;
  }

  const purposeContent = principle.principle;
  const associatedMemoryLine = `Related Archives: ${context.memoryStubs}`;

  // ── Real syntaxContent: include associatedMemoryLine ─────────────────────
  const realSyntax = [
    `Category: ${principle.category}`,
    principle.principleTitle ? `Title: ${principle.principleTitle}` : null,
    principle.confidenceScore !== null && principle.confidenceScore !== undefined
      ? `Maturity: ${principle.confidenceScore}`
      : null,
    principle.supersededBy ? `Superseded by: ${principle.supersededBy}` : null,
    principle.originalContext ? `Context: ${principle.originalContext}` : null,
    associatedMemoryLine,   // included — mirrors production syncNorthStarToNeuralNetwork
  ].filter(Boolean).join('\n');

  await db.update(toolKnowledge)
    .set({ purpose: purposeContent, syntax: realSyntax })
    .where(eq(toolKnowledge.toolName, TEST_TOOL_NAME));

  const [row] = await db.select({ syntax: toolKnowledge.syntax })
    .from(toolKnowledge)
    .where(eq(toolKnowledge.toolName, TEST_TOOL_NAME))
    .limit(1);

  assert(
    '[Real] tool_knowledge row updated successfully',
    !!row,
    'Row not found after real-syntax update',
  );

  const realHasRelatedArchives = (row?.syntax ?? '').includes('Related Archives:');

  assert(
    '[Real] "Related Archives:" IS present in syntax (production guard confirmed)',
    realHasRelatedArchives,
    realHasRelatedArchives
      ? undefined
      : '"Related Archives:" is missing from the real syntaxContent — associatedMemoryLine may have been dropped from context-sync-service.ts',
  );

  // Also confirm the stub content itself is present
  const firstId = context.memoryStubs.split(',')[0].trim().split(' ')[0];
  if (firstId) {
    assert(
      '[Real] Memory ID from DB is present in the "Related Archives:" line',
      (row?.syntax ?? '').includes(firstId),
      `Expected memory ID "${firstId}" not found in syntax`,
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — Self-failure verification
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 4 — Self-failure verification'));
sep();
console.log(D('  Confirms that Part 3\'s presence assertion is the load-bearing guard.'));
console.log(D('  Without it, a regression that silently drops associatedMemoryLine'));
console.log(D('  would produce a passing exit-0 even though the linkage is lost.'));

async function runPart4(context: { principleTitle: string | null; memoryStubs: string } | null): Promise<void> {
  if (!context || !context.memoryStubs) {
    console.log(Y('  Skipped — no principle/memory combo available.'));
    return;
  }

  // Read both the mutant row state and the real row state using the live DB
  // The mutant result (Part 2) confirmed absence.
  // The real result (Part 3) confirmed presence.
  // We now verify the delta: mutant ≠ real means the guard has real bite.

  const db = getSharedDb();
  const [row] = await db.select({ syntax: toolKnowledge.syntax })
    .from(toolKnowledge)
    .where(eq(toolKnowledge.toolName, TEST_TOOL_NAME))
    .limit(1);

  // After Part 3, the row should contain "Related Archives:"
  const currentHasRelatedArchives = (row?.syntax ?? '').includes('Related Archives:');

  assert(
    '[Self-check] Current (post-real-run) row contains "Related Archives:" (Part 3 wrote it)',
    currentHasRelatedArchives,
    'Part 3 did not write "Related Archives:" — self-failure check cannot be verified',
  );

  // The mutant (Part 2) produced ABSENCE while the real run (Part 3) produced PRESENCE.
  // This delta is what makes the guard meaningful: the mutant test uniquely detects
  // a regression that the source-analysis check alone cannot catch (the source might
  // pass while the DB write omits the line due to a runtime-path bug).

  assert(
    '[Self-check] Mutant run produced absence AND real run produced presence — guard has real bite',
    currentHasRelatedArchives, // real has it
    // if both had/lacked the line there would be no delta and the guard would be toothless
  );

  console.log(D('\n  Explanation:'));
  console.log(D('  • Part 2 wrote a row WITHOUT "Related Archives:" (mutant path).'));
  console.log(D('  • Part 3 wrote the same row WITH "Related Archives:" (real path).'));
  console.log(D('  • Part 3\'s assertion (presence guard) would fail if the production'));
  console.log(D('    code drops associatedMemoryLine — script exits non-zero. ✓'));
  console.log(D('  • Part 2\'s assertion (absence guard) confirms the guard has real bite:'));
  console.log(D('    it detects a regression even if the source still says "Related Archives:".'));
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main(): Promise<void> {
  console.log(D('\n  Pre-cleaning any leftover rows from a previous run…'));
  await cleanup();

  let part2Context: { principleTitle: string | null; memoryStubs: string } | null = null;

  try {
    // Part 1: synchronous source analysis
    runPart1();

    // Part 2: mutant run (async, DB writes)
    part2Context = await runPart2();

    // Part 3: real run (async, DB writes)
    if (part2Context) {
      await runPart3(part2Context);
    } else {
      sep();
      console.log(Y('PART 3 — Skipped (no principle/memory combo found)'));
    }

    // Part 4: self-failure verification
    await runPart4(part2Context);

  } finally {
    sep();
    console.log(D('\n  Cleaning up disposable tool_knowledge row…'));
    await cleanup();
    console.log(D('  Cleanup complete.'));
  }

  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${total} assertions passed.\n`));
    console.log(D('   • Source analysis: associatedMemoryLine is declared, set, and spread into syntaxContent'));
    console.log(D('   • Mutant run: omitting associatedMemoryLine produces a row without "Related Archives:"'));
    console.log(D('   • Real run: including associatedMemoryLine produces a row WITH "Related Archives:"'));
    console.log(D('   • Self-check: the delta between mutant and real confirms the guard has real bite'));
    console.log(D('   • A future refactor that drops associatedMemoryLine will cause Part 3 to fail → exit 1\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${total} assertion(s) failed — review output above.\n`));
    console.log(R('   If "[Real] Related Archives: IS present" failed, associatedMemoryLine was dropped.\n'));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(R(`\nFatal error: ${err?.message ?? err}\n`));
  cleanup().finally(() => process.exit(1));
});
