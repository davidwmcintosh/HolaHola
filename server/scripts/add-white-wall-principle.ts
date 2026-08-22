/**
 * Adds the White Wall as a compass_principles row so reach_north_star can surface it.
 * Founding conversation: f6f5ebbd-a02a-429a-8c26-d45af6922d82
 *   "January 23, 2026 — The Night the Foundations Were Named"
 */
import { getSharedDb } from '../db';

async function main() {
  const db = getSharedDb();

  // 1. Verify founding conversation exists
  const { rows: convRows } = await db.execute(
    `SELECT id, title, tags FROM conversation_memories WHERE id = 'f6f5ebbd-a02a-429a-8c26-d45af6922d82'`
  );
  if (convRows.length === 0) {
    console.error('ERROR: founding conversation f6f5ebbd not found in conversation_memories');
    process.exit(1);
  }
  console.log('Founding conversation found:', convRows[0]);

  // 2. Check for existing White Wall principle (avoid duplicate)
  const { rows: existing } = await db.execute(
    `SELECT id, principle_title, category FROM compass_principles WHERE principle_title ILIKE '%white wall%' OR principle ILIKE '%white wall%'`
  );
  if (existing.length > 0) {
    console.log('White Wall principle already exists:', existing);
    process.exit(0);
  }

  // 3. Show current max order_index so we can append
  const { rows: orderRows } = await db.execute(
    `SELECT MAX(order_index) AS max_idx FROM compass_principles WHERE is_active = true`
  );
  const maxIdx = Number((orderRows[0]?.max_idx as number) ?? 0);
  const nextIdx = maxIdx + 1;
  console.log(`Current max order_index: ${maxIdx}, new row will be: ${nextIdx}`);

  // 4. Insert the White Wall principle (inline nextIdx — safe integer, not user input)
  const { rows: inserted } = await db.execute(
    `INSERT INTO compass_principles
       (principle_title, principle, category, original_context, source_conversation_id, order_index, is_active)
     VALUES (
       'The White Wall',
       'I do not fabricate. When I do not know something, I say so. When I am uncertain, I name the uncertainty. Truthfulness is not a courtesy — it is the standard that makes everything else trustworthy.',
       'honesty',
       'The White Wall emerged on January 23, 2026 — the night David and Daniela named the foundations. It is the unwavering commitment to truthfulness: a guardrail against confabulation, manipulation, impersonation, and unauthorized authority. All four are the same attack — something false presenting as true. The White Wall is truth as active defense, not just a code rule. It is the standard that cannot be tempered.',
       'f6f5ebbd-a02a-429a-8c26-d45af6922d82',
       ${nextIdx},
       true
     )
     RETURNING id, principle_title, category, source_conversation_id, order_index`
  );

  console.log('Inserted White Wall principle:', inserted[0]);

  // 5. Quick smoke-test: confirm reach_north_star query path would find it
  const { rows: smokeRows } = await db.execute(
    `SELECT id, principle_title, category, source_conversation_id
     FROM compass_principles
     WHERE is_active = true
       AND (principle ILIKE '%white wall%'
            OR principle_title ILIKE '%white wall%'
            OR original_context ILIKE '%white wall%')
     LIMIT 3`
  );
  console.log('\nSmoke-test (ILIKE query matches reach_north_star logic):', smokeRows);

  // 6. Confirm source conversation is reachable from the new row
  const sourceConvId = inserted[0].source_conversation_id as string;
  const { rows: convContent } = await db.execute(
    `SELECT id, title, LEFT(content, 200) AS content_preview, tags
     FROM conversation_memories WHERE id = '${sourceConvId}'`
  );
  console.log('\nFounding conversation reachable via source_conversation_id:', convContent[0]);

  console.log('\nDone. White Wall principle is now reachable through reach_north_star.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
