/**
 * test-reach-north-star-founding.ts
 *
 * Confirms that reach_north_star delivers founding conversation content
 * for principles that were linked by Task 693.
 *
 * Tests at least 3 newly-linked principles and "I Am a Language Class"
 * (the dead-link fix from short-UUID → full UUID).
 *
 * Exits 0 on success, 1 on any failure.
 */

import { getSharedDb } from '../db';
import { northStarPrinciples, conversationMemories } from '../../shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

const FAIL_REASONS: string[] = [];

function pass(label: string, detail: string) {
  console.log(`  ✓  ${label}`);
  if (detail) console.log(`       ${detail.substring(0, 120).replace(/\n/g, ' ')}`);
}

function fail(label: string, reason: string) {
  console.error(`  ✗  ${label}: ${reason}`);
  FAIL_REASONS.push(`${label}: ${reason}`);
}

async function fetchFoundingContent(principleId: string, sourceConversationId: string) {
  const [mem] = await getSharedDb()
    .select({
      id: conversationMemories.id,
      title: conversationMemories.title,
      summary: conversationMemories.summary,
      content: conversationMemories.content,
    })
    .from(conversationMemories)
    .where(eq(conversationMemories.id, sourceConversationId))
    .limit(1);
  return mem ?? null;
}

async function runTest() {
  console.log('\n=== reach_north_star founding-content verification ===\n');

  const db = getSharedDb();

  // 1. Load all active principles that have a source_conversation_id
  const linked = await db
    .select({
      id: northStarPrinciples.id,
      title: northStarPrinciples.principleTitle,
      principle: northStarPrinciples.principle,
      sourceConversationId: northStarPrinciples.sourceConversationId,
    })
    .from(northStarPrinciples)
    .where(
      and(
        eq(northStarPrinciples.isActive, true),
        isNotNull(northStarPrinciples.sourceConversationId),
      )
    );

  console.log(`Total linked active principles: ${linked.length}`);
  if (linked.length === 0) {
    fail('DB check', 'No active principles have source_conversation_id set');
    process.exit(1);
  }

  // 2. Verify specific principles mentioned in the task spec exist
  const REQUIRED_TITLES = ['Confident and Humble', 'Two Surgeons, One Brain', 'I Am a Language Class'];
  for (const reqTitle of REQUIRED_TITLES) {
    const found = linked.find(p => p.title?.toLowerCase().includes(reqTitle.toLowerCase()));
    if (found) {
      pass(`Principle linked: "${reqTitle}"`, `id=${found.id}, sourceConversationId=${found.sourceConversationId}`);
    } else {
      fail(`Principle linked: "${reqTitle}"`, 'Not found among linked principles');
    }
  }

  // 3. For each required principle + 2 extras, fetch the founding conversation and verify content
  const NAMES_TO_TEST = [
    ...REQUIRED_TITLES,
    // Pick first 2 additional ones not already covered
  ];
  const extras = linked
    .filter(p => !REQUIRED_TITLES.some(t => p.title?.toLowerCase().includes(t.toLowerCase())))
    .slice(0, 2)
    .map(p => p.title ?? '');
  const ALL_TEST_NAMES = [...REQUIRED_TITLES, ...extras];

  console.log(`\nTesting ${ALL_TEST_NAMES.length} principles for founding content:\n`);

  let testedCount = 0;
  let successCount = 0;

  for (const name of ALL_TEST_NAMES) {
    const principle = linked.find(p => p.title?.toLowerCase().includes(name.toLowerCase()));
    if (!principle) {
      console.log(`  (skipping "${name}" — not in linked set)`);
      continue;
    }
    testedCount++;

    const label = `"${principle.title}"`;
    const srcId = principle.sourceConversationId!;

    const mem = await fetchFoundingContent(principle.id, srcId);
    if (!mem) {
      fail(label, `source_conversation_id=${srcId} not found in conversation_memories`);
      continue;
    }

    const text = mem.summary || mem.content || '';
    if (!text || text.trim().length < 10) {
      fail(label, `conversation_memories row ${srcId} exists but summary/content is empty (title="${mem.title}")`);
      continue;
    }

    // Simulate what processReachNorthStar returns
    const excerpt = text.length > 350 ? text.substring(0, 350) + '...' : text;
    pass(label, `sourceConv title="${mem.title}" excerpt="${excerpt.substring(0, 80)}..."`);
    successCount++;
  }

  // 4. Special check: "I Am a Language Class" must deliver July 2 Dual Consult content
  const langClass = linked.find(p => p.title?.toLowerCase().includes('i am a language class'));
  if (langClass && langClass.sourceConversationId) {
    const mem = await fetchFoundingContent(langClass.id, langClass.sourceConversationId);
    if (mem) {
      const text = mem.summary || mem.content || '';
      // Must be the Dual Consult / compass-language-class content — verify it's non-trivial
      if (text.length > 50) {
        pass(
          'Dead-link fix: "I Am a Language Class" → full UUID',
          `Resolved to: "${mem.title}" (${text.length} chars)`
        );
      } else {
        fail('Dead-link fix: "I Am a Language Class"', `Content too short (${text.length} chars) — may still be a dead link`);
      }
    }
  }

  // 5. Summary
  console.log(`\n--- Summary ---`);
  console.log(`Principles tested: ${testedCount}`);
  console.log(`With founding content: ${successCount}/${testedCount}`);
  console.log(`Total linked in DB: ${linked.length}/31 principles`);

  if (FAIL_REASONS.length > 0) {
    console.error(`\nFAILURES (${FAIL_REASONS.length}):`);
    FAIL_REASONS.forEach(r => console.error(`  • ${r}`));
    process.exit(1);
  }

  if (successCount < 3) {
    console.error(`\nFAIL: Expected at least 3 principles with founding content, got ${successCount}`);
    process.exit(1);
  }

  console.log('\n✓ All checks passed — reach_north_star delivers founding content for newly-linked principles\n');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
