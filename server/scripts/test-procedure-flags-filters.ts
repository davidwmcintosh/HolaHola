/**
 * test-procedure-flags-filters.ts
 *
 * Confirms that GET /api/admin/procedure-flags ?targetTable= and ?after= query
 * params actually narrow the returned set:
 *
 *   PART 1 — targetTable filter
 *     Seeds two flags with different parsedTargetTable values; applying the
 *     targetTable filter returns only the matching one and excludes the other.
 *
 *   PART 2 — after date filter
 *     Seeds two flags — one with a createdAt two days in the past, one fresh.
 *     Applying ?after=<yesterday> returns only the fresh flag and excludes the
 *     old one.
 *
 * Does NOT require a running HTTP server — mirrors the exact DB operations and
 * parsing logic from routes.ts GET /api/admin/procedure-flags so it runs in CI.
 *
 * Run: npx tsx server/scripts/test-procedure-flags-filters.ts
 */

import { getSharedDb } from '../db';
import { agentNotes } from '@shared/schema';
import { eq, ilike, isNull, and, gte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

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

// ── Parsing logic (mirrors routes.ts GET /api/admin/procedure-flags) ──────────

const SUBJECT_PREFIX = '[Daniela \u2014 REQUIRES FOUNDER REVIEW] ';

function parseProcedureFlag(note: { subject: string; body: string; readAt: Date | null }) {
  const subjectRest = note.subject.replace(SUBJECT_PREFIX, '');
  const colonIdx = subjectRest.indexOf(':');
  const targetTable = colonIdx > -1 ? subjectRest.substring(0, colonIdx).trim() : subjectRest;

  const bodyLines = note.body.split('\n');
  const reasoning = (bodyLines.find(l => l.startsWith('Reasoning: '))?.replace('Reasoning: ', '') || '').trim();

  return {
    parsedTargetTable: targetTable,
    parsedReasoning: reasoning,
    pending: !note.readAt,
  };
}

function makeSubject(targetTable: string, tag: string) {
  return `${SUBJECT_PREFIX}${targetTable}: filter-test ${tag}`;
}

function makeBody(targetTable: string) {
  return [
    `Reasoning: CI filter test for ${targetTable}`,
    `Session: test-session-filter-366`,
    `Language: es`,
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  const db = getSharedDb();
  const insertedIds: string[] = [];

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // PART 1 — targetTable filter
    // ══════════════════════════════════════════════════════════════════════════
    sep();
    console.log(B('PART 1 — targetTable filter narrows results'));
    sep();

    const TABLE_A = 'teaching_examples';
    const TABLE_B = 'conversation_memories';

    const [rowA] = await db
      .insert(agentNotes)
      .values({
        fromAgent: 'daniela',
        toAgent: 'agent',
        subject: makeSubject(TABLE_A, 'part1-a'),
        body: makeBody(TABLE_A),
        sessionLabel: 'procedure-flags filter test task-366',
      })
      .returning();

    const [rowB] = await db
      .insert(agentNotes)
      .values({
        fromAgent: 'daniela',
        toAgent: 'agent',
        subject: makeSubject(TABLE_B, 'part1-b'),
        body: makeBody(TABLE_B),
        sessionLabel: 'procedure-flags filter test task-366',
      })
      .returning();

    assert('Inserted TABLE_A flag', !!rowA?.id, 'no row returned');
    assert('Inserted TABLE_B flag', !!rowB?.id, 'no row returned');

    if (rowA?.id) insertedIds.push(rowA.id);
    if (rowB?.id) insertedIds.push(rowB.id);

    if (!rowA?.id || !rowB?.id) {
      console.log(R('\nCannot continue Part 1 without both inserted rows.'));
    } else {
      // Fetch both rows (no targetTable filter)
      const allRows = await db
        .select()
        .from(agentNotes)
        .where(
          and(
            ilike(agentNotes.subject, '[Daniela \u2014 REQUIRES FOUNDER REVIEW]%'),
            isNull(agentNotes.readAt),
          ),
        );

      const allParsed = allRows.map(r => ({ ...r, ...parseProcedureFlag(r) }));

      // Mirror the post-parse in-memory filter from routes.ts
      const targetTableParam = TABLE_A.toLowerCase();
      const filtered = allParsed.filter(
        f => f.parsedTargetTable.toLowerCase() === targetTableParam,
      );

      const hasA = filtered.some(f => f.id === rowA.id);
      const hasB = filtered.some(f => f.id === rowB.id);

      assert(
        `?targetTable=${TABLE_A} includes the ${TABLE_A} flag`,
        hasA,
        `id ${rowA.id} not found in filtered set`,
      );
      assert(
        `?targetTable=${TABLE_A} excludes the ${TABLE_B} flag`,
        !hasB,
        `id ${rowB.id} was unexpectedly included`,
      );
      assert(
        'Filtered set contains exactly the TABLE_A test row (and not TABLE_B)',
        filtered.filter(f => [rowA.id, rowB.id].includes(f.id)).length === 1,
        `got ${filtered.filter(f => [rowA.id, rowB.id].includes(f.id)).length} of our test rows`,
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PART 2 — after date filter
    // ══════════════════════════════════════════════════════════════════════════
    sep();
    console.log(B('PART 2 — after date filter excludes older flags'));
    sep();

    // Insert a "fresh" flag with the default createdAt (now)
    const [freshRow] = await db
      .insert(agentNotes)
      .values({
        fromAgent: 'daniela',
        toAgent: 'agent',
        subject: makeSubject('teaching_examples', 'part2-fresh'),
        body: makeBody('teaching_examples'),
        sessionLabel: 'procedure-flags filter test task-366',
      })
      .returning();

    assert('Inserted fresh flag', !!freshRow?.id, 'no row returned');
    if (freshRow?.id) insertedIds.push(freshRow.id);

    // Back-date an "old" flag to 2 days ago via a direct SQL UPDATE so we
    // don't rely on the application being able to set createdAt at insert time.
    const [oldRow] = await db
      .insert(agentNotes)
      .values({
        fromAgent: 'daniela',
        toAgent: 'agent',
        subject: makeSubject('teaching_examples', 'part2-old'),
        body: makeBody('teaching_examples'),
        sessionLabel: 'procedure-flags filter test task-366',
      })
      .returning();

    assert('Inserted old flag', !!oldRow?.id, 'no row returned');
    if (oldRow?.id) insertedIds.push(oldRow.id);

    if (freshRow?.id && oldRow?.id) {
      // Back-date the old row to 2 days ago
      await db.execute(
        sql`UPDATE agent_notes SET created_at = NOW() - INTERVAL '2 days' WHERE id = ${oldRow.id}`,
      );

      // afterDate = yesterday (1 day ago) — old flag is 2 days old, fresh is just now
      const afterDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const rows = await db
        .select()
        .from(agentNotes)
        .where(
          and(
            ilike(agentNotes.subject, '[Daniela \u2014 REQUIRES FOUNDER REVIEW]%'),
            isNull(agentNotes.readAt),
            gte(agentNotes.createdAt, afterDate),
          ),
        );

      const hasFresh = rows.some(r => r.id === freshRow.id);
      const hasOld   = rows.some(r => r.id === oldRow.id);

      assert(
        '?after=<yesterday> includes the fresh flag (created today)',
        hasFresh,
        `fresh flag id ${freshRow.id} not found`,
      );
      assert(
        '?after=<yesterday> excludes the old flag (created 2 days ago)',
        !hasOld,
        `old flag id ${oldRow.id} was unexpectedly included`,
      );
    }

  } finally {
    // ── Cleanup: remove all test rows so they don't pollute the real panel ───
    for (const id of insertedIds) {
      await db.delete(agentNotes).where(eq(agentNotes.id, id));
    }
    if (insertedIds.length > 0) {
      console.log(`\n  (cleaned up ${insertedIds.length} test note(s): ${insertedIds.join(', ')})`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  sep();
  console.log(
    `\n${passed + failed} checks — ${G(String(passed) + ' passed')}${failed > 0 ? ', ' + R(String(failed) + ' failed') : ''}`,
  );
  if (failed > 0) {
    console.error(R('\nSome procedure-flag filter checks FAILED.'));
    process.exit(1);
  } else {
    console.log(G('\nAll procedure-flag filter checks passed ✓'));
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(R('\nUnhandled error:'), err);
    process.exit(1);
  });
