/**
 * Task #876 integrity test: confirm all 3 collaboration compass principles
 * have source_conversation_id pointing to the provenance record 7493754d.
 *
 * Exits 0 on success, 1 on any failure.
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: NEON_SHARED_DATABASE_URL is not set');
  process.exit(1);
}

const PROVENANCE_ID = '7493754d-d2a8-485e-9ddc-bd8ef4d7d96a';
const PROVENANCE_TITLE = 'Beacon system → Express Lane transition (Dec 2025)';

const EXPECTED = [
  { id: 'f3f768a7-71e3-4fd2-8026-1f30949a34f4', title: 'Trust, Not Permission' },
  { id: '474f3752-f641-472f-a26b-4548f7ffdafe', title: 'Beacons as Contributions' },
  { id: '826d1600-9aca-4168-8348-68c91334bfae', title: 'Queue Before Learning' },
];

type Result = { pass: boolean; label: string };

function pass(label: string): Result { return { pass: true, label }; }
function fail(label: string): Result { return { pass: false, label }; }

function hr() { console.log('─'.repeat(70)); }

async function main() {
  const sql = neon(DATABASE_URL as string);
  const results: Result[] = [];

  hr();
  console.log('PART 1 — Provenance record exists in conversation_memories');
  hr();

  const provRows = await sql`
    SELECT id, title, importance, tags
    FROM conversation_memories
    WHERE id = ${PROVENANCE_ID}
  `;

  if (provRows.length > 0) {
    const r = provRows[0];
    results.push(pass(`Provenance record ${PROVENANCE_ID} exists`));
    console.log(`  ✓ Record exists: "${r.title}"`);

    if (r.title === PROVENANCE_TITLE) {
      results.push(pass(`Title matches expected: "${PROVENANCE_TITLE}"`));
      console.log(`  ✓ Title matches`);
    } else {
      results.push(fail(`Title mismatch: expected "${PROVENANCE_TITLE}", got "${r.title}"`));
      console.log(`  ✗ Title mismatch: "${r.title}"`);
    }

    const hasWrenContent = (r.title ?? '').toLowerCase().includes('beacon') ||
      (r.tags ?? []).some((t: string) => t === 'wren' || t === 'beacons');
    if (hasWrenContent) {
      results.push(pass('Provenance record has Wren/beacon context'));
      console.log(`  ✓ Provenance record covers Wren/beacon context`);
    } else {
      results.push(fail('Provenance record missing Wren/beacon context'));
      console.log(`  ✗ Provenance record missing Wren/beacon context`);
    }
  } else {
    results.push(fail(`Provenance record ${PROVENANCE_ID} NOT FOUND in conversation_memories`));
    console.log(`  ✗ Provenance record not found`);
  }

  hr();
  console.log('PART 2 — All 3 principles are active and linked');
  hr();

  const principleIds = EXPECTED.map(e => e.id);
  const rows = await sql`
    SELECT id, principle_title, source_conversation_id, is_active
    FROM compass_principles
    WHERE id = ANY(${principleIds})
    ORDER BY principle_title
  `;

  for (const expected of EXPECTED) {
    const row = rows.find((r) => r['id'] === expected.id);
    if (!row) {
      results.push(fail(`Principle "${expected.title}" (${expected.id}) not found`));
      console.log(`  ✗ "${expected.title}" — row not found`);
      continue;
    }

    if (!row.is_active) {
      results.push(fail(`"${expected.title}" is not active`));
      console.log(`  ✗ "${expected.title}" — is_active = false`);
    } else {
      results.push(pass(`"${expected.title}" is active`));
    }

    if (row.source_conversation_id === PROVENANCE_ID) {
      results.push(pass(`"${expected.title}" source_conversation_id = ${PROVENANCE_ID}`));
      console.log(`  ✓ "${expected.title}" → linked to provenance record`);
    } else if (row.source_conversation_id === null) {
      results.push(fail(`"${expected.title}" source_conversation_id is still NULL`));
      console.log(`  ✗ "${expected.title}" — source_conversation_id is NULL (not linked)`);
      console.log(`      FIX: run  npx tsx server/scripts/migrate-compass-principles-876.ts`);
    } else {
      results.push(fail(`"${expected.title}" source_conversation_id points to wrong record: ${row.source_conversation_id}`));
      console.log(`  ✗ "${expected.title}" — wrong source_conversation_id: ${row.source_conversation_id}`);
    }
  }

  hr();
  console.log('PART 3 — Self-check: guard is non-vacuous');
  hr();

  // Confirm the guard would fire for a principle with NULL source_conversation_id
  const nullRow = await sql`
    SELECT id, principle_title, source_conversation_id
    FROM compass_principles
    WHERE source_conversation_id IS NULL
      AND id = ANY(${principleIds})
    LIMIT 1
  `;

  const guardFires = nullRow.length > 0;
  if (guardFires) {
    results.push(fail(`Self-check revealed a NULL link that should have been caught: ${nullRow[0].principle_title}`));
    console.log(`  ✗ Self-check guard fired correctly — but found a real NULL that means migration didn't run`);
  } else {
    results.push(pass('Self-check: no NULL links remain among the 3 target principles'));
    console.log(`  ✓ Self-check: no NULL source_conversation_id among the 3 target principles`);
  }

  // Summary
  hr();
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  if (failed > 0) {
    console.log(`\n✗  ${failed} of ${results.length} assertion(s) failed — review output above.\n`);
    process.exit(1);
  } else {
    console.log(`\n✓  All ${results.length} assertions passed.\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
