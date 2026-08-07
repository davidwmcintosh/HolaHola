/**
 * test-reach-north-star-founding.ts
 *
 * CI check: loads ALL active North Star principles that carry a
 * sourceConversationId and asserts that the linked conversation_memories row
 * still exists and has non-empty content.
 *
 * Exits 1 and names every broken principle if any link is dead.
 * Exits 1 with a loud error if no principles are linked at all (guard against
 * an empty table hiding the check).
 */

import { getSharedDb } from '../db';
import { northStarPrinciples, conversationMemories } from '../../shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

interface BrokenLink {
  principleId: string;
  principleTitle: string | null;
  sourceConversationId: string;
  reason: string;
}

async function main() {
  console.log('\n=== reach_north_star founding-link integrity check ===\n');

  const db = getSharedDb();

  // 1. Load all active principles that carry a sourceConversationId
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

  console.log(`Active principles with sourceConversationId: ${linked.length}`);

  if (linked.length === 0) {
    console.error('\nFAIL: No active principles have sourceConversationId set.');
    console.error('Either the table is empty or all links have been cleared.');
    console.error('reach_north_star will surface principles without founding context.');
    process.exit(1);
  }

  // 2. Check every linked principle
  const broken: BrokenLink[] = [];
  const ok: string[] = [];

  for (const p of linked) {
    const srcId = p.sourceConversationId!;
    const label = p.title ?? p.id;

    const [mem] = await db
      .select({
        id: conversationMemories.id,
        title: conversationMemories.title,
        summary: conversationMemories.summary,
        content: conversationMemories.content,
      })
      .from(conversationMemories)
      .where(eq(conversationMemories.id, srcId))
      .limit(1);

    if (!mem) {
      broken.push({
        principleId: p.id,
        principleTitle: p.title,
        sourceConversationId: srcId,
        reason: `conversation_memories row "${srcId}" does not exist`,
      });
      console.error(`  ✗  "${label}" — source row missing (${srcId})`);
      continue;
    }

    const text = mem.summary || mem.content || '';
    if (!text || text.trim().length < 10) {
      broken.push({
        principleId: p.id,
        principleTitle: p.title,
        sourceConversationId: srcId,
        reason: `row "${srcId}" exists but summary/content is empty (title="${mem.title}")`,
      });
      console.error(`  ✗  "${label}" — row exists but content is empty (${srcId})`);
      continue;
    }

    const excerpt = text.length > 100 ? text.substring(0, 100).replace(/\n/g, ' ') + '…' : text.replace(/\n/g, ' ');
    console.log(`  ✓  "${label}"`);
    console.log(`       → "${mem.title}" (${text.length} chars) — ${excerpt}`);
    ok.push(label);
  }

  // 3. Summary
  console.log(`\n--- Summary ---`);
  console.log(`Checked: ${linked.length} principles`);
  console.log(`OK:      ${ok.length}`);
  console.log(`Broken:  ${broken.length}`);

  if (broken.length > 0) {
    console.error(`\nFAIL — ${broken.length} dead founding link(s) detected:`);
    for (const b of broken) {
      console.error(`  • Principle: "${b.principleTitle ?? b.principleId}"`);
      console.error(`    sourceConversationId: ${b.sourceConversationId}`);
      console.error(`    Reason: ${b.reason}`);
    }
    console.error('\nreach_north_star will silently skip founding context for these principles.');
    console.error('Restore the conversation_memories rows or clear their sourceConversationId.');
    process.exit(1);
  }

  console.log('\n✓ All founding conversation links are intact.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
