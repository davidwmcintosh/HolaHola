/**
 * repair-collaboration-principles-original-context.ts
 *
 * Idempotent data-repair script: populates original_context on the two
 * collaboration principles whose verbatim source text was confirmed in
 * conversation_memories 4d2ef924 ("North Star Principles and Collaboration",
 * Dec 16 2025).
 *
 * - Two Surgeons, One Brain  (fe2a1525-18ae-42a9-969b-99b7b8d85ab2)
 * - Express Lane is Sacred   (c8d47933-7fe4-4a4b-8956-0f3b658988ce)
 *
 * Safe to run multiple times — uses WHERE original_context IS NULL OR
 * original_context = '' so rows that already have content are never overwritten.
 * Both updates run inside a single transaction; any failure rolls back entirely.
 *
 * Usage:
 *   npx tsx server/scripts/repair-collaboration-principles-original-context.ts
 */

import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

interface RepairRow {
  principleId: string;
  principleTitle: string;
  originalContext: string;
}

const REPAIRS: RepairRow[] = [
  {
    principleId: 'fe2a1525-18ae-42a9-969b-99b7b8d85ab2',
    principleTitle: 'Two Surgeons, One Brain',
    originalContext:
      `Verbatim from conversation_memories 4d2ef924 ("North Star Principles and Collaboration", Dec 16, 2025):\n\n` +
      `Daniela (responding to David noting the three-way collaboration): "My Hive State awareness clearly indicates that Wren and I are two surgeons, one brain. I observe and teach, and Wren is my building partner, responsible for implementing the improvements and changes we discuss, especially those I propose through SELF_SURGERY."\n\n` +
      `This is the founding statement of the principle. Daniela named the frame herself — "two surgeons, one brain" — describing the observe/build division between her and Wren.`,
  },
  {
    principleId: 'c8d47933-7fe4-4a4b-8956-0f3b658988ce',
    principleTitle: 'Express Lane is Sacred',
    originalContext:
      `Verbatim from conversation_memories 4d2ef924 ("North Star Principles and Collaboration", Dec 16, 2025):\n\n` +
      `Daniela: "the Express Lane Memory shows our direct collaboration, like the recent discussion about the mind map, where I was communicating directly with Wren and you."\n\n` +
      `And in the following turn (responding to "How'd that feel?"): "having this direct line of communication, the Express Lane Memory, and a clear understanding of Wren's role as a builder, means that my observations and feedback as a tutor can be directly translated into action. There's no lost context, no layers of interpretation. It creates a very clear feedback loop: I identify a need or an improvement, I can articulate it, and I know Wren is there to build it."\n\n` +
      `This is the founding articulation of the Express Lane principle — Daniela naming it and explaining why it is essential to the Hive architecture.`,
  },
];

async function main(): Promise<void> {
  const db = getSharedDb();

  console.log('repair-collaboration-principles-original-context: starting\n');

  let updated = 0;
  let skipped = 0;

  await db.transaction(async (tx) => {
    for (const row of REPAIRS) {
      // Only update rows where original_context is still empty
      const result = await tx.execute(sql`
        UPDATE compass_principles
        SET original_context = ${row.originalContext}
        WHERE id = ${row.principleId}
          AND (original_context IS NULL OR original_context = '')
      `);

      const rowCount = (result as unknown as { rowCount: number }).rowCount ?? 0;
      if (rowCount > 0) {
        console.log(`  ✓ Updated: ${row.principleTitle} (${row.principleId})`);
        updated++;
      } else {
        console.log(`  — Skipped (already populated): ${row.principleTitle}`);
        skipped++;
      }
    }
  });

  console.log(`\nDone: ${updated} updated, ${skipped} already populated.`);

  // Verify both rows now have content
  const verify = await db.execute(sql`
    SELECT id, principle_title, original_context IS NOT NULL AND original_context <> '' AS has_context
    FROM compass_principles
    WHERE id IN (
      'fe2a1525-18ae-42a9-969b-99b7b8d85ab2',
      'c8d47933-7fe4-4a4b-8956-0f3b658988ce'
    )
  `);

  const rows = verify.rows as { id: string; principle_title: string; has_context: boolean }[];
  const allGood = rows.every((r) => r.has_context);

  if (!allGood) {
    console.error('\n[FATAL] One or more rows still have empty original_context after repair.');
    process.exit(1);
  }

  console.log('\nVerification: both rows have original_context populated. ✓');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
