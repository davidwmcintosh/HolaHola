/**
 * Task #876 — Idempotent migration: link 3 unanchored collaboration compass principles
 * to their provenance conversation_memories record.
 *
 * Principles linked:
 *   - "Trust, Not Permission"      f3f768a7-71e3-4fd2-8026-1f30949a34f4
 *   - "Beacons as Contributions"   474f3752-f641-472f-a26b-4548f7ffdafe
 *   - "Queue Before Learning"      826d1600-9aca-4168-8348-68c91334bfae
 *
 * Provenance record:
 *   7493754d-d2a8-485e-9ddc-bd8ef4d7d96a
 *   "Beacon system → Express Lane transition (Dec 2025)"
 *   — documents the Wren-era archiving gap that explains why no verbatim
 *     founding exchange was captured for these three principles.
 *
 * Safety guarantee: all three target rows are confirmed to exist BEFORE any
 * write is attempted. If any row is missing the script aborts with no mutation.
 * Safe to run multiple times (idempotent: only updates NULL rows).
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: NEON_SHARED_DATABASE_URL is not set');
  process.exit(1);
}

const PROVENANCE_ID = '7493754d-d2a8-485e-9ddc-bd8ef4d7d96a';

const PRINCIPLE_IDS = [
  'f3f768a7-71e3-4fd2-8026-1f30949a34f4', // Trust, Not Permission
  '474f3752-f641-472f-a26b-4548f7ffdafe', // Beacons as Contributions
  '826d1600-9aca-4168-8348-68c91334bfae', // Queue Before Learning
];

async function main() {
  const sql = neon(DATABASE_URL as string);

  // ── Step 1: Verify provenance record exists ───────────────────────────────
  const provRows = await sql`
    SELECT id, title FROM conversation_memories
    WHERE id = ${PROVENANCE_ID}
  `;
  if (provRows.length === 0) {
    console.error(`FATAL: Provenance record ${PROVENANCE_ID} not found in conversation_memories`);
    process.exit(1);
  }
  console.log(`✓ Provenance record exists: "${provRows[0].title}"`);

  // ── Step 2: Prevalidate — all 3 target rows must exist before any write ───
  const existing = await sql`
    SELECT id, principle_title, source_conversation_id
    FROM compass_principles
    WHERE id = ANY(${PRINCIPLE_IDS})
    ORDER BY principle_title
  `;

  console.log(`\nPrevalidation: found ${existing.length} of ${PRINCIPLE_IDS.length} target rows`);

  if (existing.length !== PRINCIPLE_IDS.length) {
    const foundIds = new Set(existing.map((r) => r['id'] as string));
    const missingIds = PRINCIPLE_IDS.filter(id => !foundIds.has(id));
    console.error(`\nFATAL: ${missingIds.length} target row(s) missing from DB — aborting with no mutation:`);
    for (const id of missingIds) {
      console.error(`  missing: ${id}`);
    }
    process.exit(1);
  }

  for (const row of existing) {
    console.log(`  ${row['principle_title']}: source_conversation_id = ${row['source_conversation_id'] ?? 'NULL'}`);
  }

  // Check if already fully linked
  const needsUpdate = existing.filter(r => r['source_conversation_id'] === null);
  if (needsUpdate.length === 0) {
    console.log('\n✓ All 3 principles already linked — nothing to do.');

    // Final confirmation read
    const confirm = await sql`
      SELECT id, principle_title, source_conversation_id
      FROM compass_principles
      WHERE id = ANY(${PRINCIPLE_IDS})
        AND source_conversation_id = ${PROVENANCE_ID}
    `;
    if (confirm.length !== PRINCIPLE_IDS.length) {
      console.error(`\nFATAL: Expected ${PRINCIPLE_IDS.length} linked rows, found ${confirm.length}`);
      process.exit(1);
    }
    console.log('\n✓ Migration complete — all 3 principles confirmed linked to provenance record.');
    return;
  }

  // ── Step 3: Apply update (only now, after prevalidation passes) ───────────
  console.log(`\nLinking ${needsUpdate.length} unlinked principle(s)...`);

  const updated = await sql`
    UPDATE compass_principles
    SET source_conversation_id = ${PROVENANCE_ID}
    WHERE id = ANY(${PRINCIPLE_IDS})
      AND source_conversation_id IS NULL
    RETURNING id, principle_title, source_conversation_id
  `;

  console.log(`  Updated ${updated.length} row(s):`);
  for (const row of updated) {
    console.log(`  ✓ ${row['principle_title']} → ${row['source_conversation_id']}`);
  }

  // ── Step 4: Post-write verification ──────────────────────────────────────
  const after = await sql`
    SELECT id, principle_title, source_conversation_id
    FROM compass_principles
    WHERE id = ANY(${PRINCIPLE_IDS})
    ORDER BY principle_title
  `;

  if (after.length !== PRINCIPLE_IDS.length) {
    console.error(`\nFATAL: Expected ${PRINCIPLE_IDS.length} rows after update, found ${after.length}`);
    process.exit(1);
  }

  let allLinked = true;
  for (const row of after) {
    const linked = row['source_conversation_id'] === PROVENANCE_ID;
    console.log(`  ${linked ? '✓' : '✗'} ${row['principle_title']}: ${row['source_conversation_id'] ?? 'NULL'}`);
    if (!linked) allLinked = false;
  }

  if (!allLinked) {
    console.error('\nFATAL: Not all principles are linked after migration');
    process.exit(1);
  }

  console.log('\n✓ Migration complete — all 3 principles linked to provenance record.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
