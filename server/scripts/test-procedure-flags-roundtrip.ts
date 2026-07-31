/**
 * test-procedure-flags-roundtrip.ts
 *
 * Confirms that a flag raised during a normal session (an agent_note with the
 * "[Daniela — REQUIRES FOUNDER REVIEW]" subject prefix) is:
 *   1. Inserted into the DB correctly
 *   2. Returned by the GET /api/admin/procedure-flags query with all fields
 *      parsed correctly (targetTable, reasoning, proposedContent)
 *   3. Marked as reviewed when readAt is set (PATCH action=reviewed behaviour)
 *   4. Promoted to a selfSurgeryProposals row with all parsed fields preserved
 *      (targetTable, reasoning, proposedContent, conversationId, targetLanguage)
 *
 * Does NOT require a running HTTP server — it exercises the same DB operations
 * and parsing logic used by routes.ts directly, so it can run in any environment.
 *
 * Run: npx tsx server/scripts/test-procedure-flags-roundtrip.ts
 */

import { getSharedDb } from '../db';
import { agentNotes, selfSurgeryProposals } from '@shared/schema';
import { eq, ilike, isNull, and } from 'drizzle-orm';

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

function parseProcedureFlag(note: { subject: string; body: string; readAt: Date | null }) {
  const SUBJECT_PREFIX = '[Daniela \u2014 REQUIRES FOUNDER REVIEW] ';
  const subjectRest = note.subject.replace(SUBJECT_PREFIX, '');
  const colonIdx = subjectRest.indexOf(':');
  const targetTable = colonIdx > -1 ? subjectRest.substring(0, colonIdx).trim() : subjectRest;

  const bodyLines = note.body.split('\n');
  const reasoning = (bodyLines.find(l => l.startsWith('Reasoning: '))?.replace('Reasoning: ', '') || '').trim();
  const sessionId  = (bodyLines.find(l => l.startsWith('Session: '))?.replace('Session: ', '') || '').trim() || null;
  const language   = (bodyLines.find(l => l.startsWith('Language: '))?.replace('Language: ', '') || '').trim() || null;

  let proposedContent: any = null;
  const pcLineIdx = bodyLines.findIndex(l => l.startsWith('Proposed content: '));
  if (pcLineIdx > -1) {
    const pcRaw = bodyLines[pcLineIdx].replace('Proposed content: ', '');
    const extraLines: string[] = [];
    for (let i = pcLineIdx + 1; i < bodyLines.length; i++) {
      if (bodyLines[i] === '') break;
      extraLines.push(bodyLines[i]);
    }
    const fullPc = [pcRaw, ...extraLines].join('\n');
    try { proposedContent = JSON.parse(fullPc); } catch { proposedContent = fullPc; }
  }

  return {
    parsedTargetTable: targetTable,
    parsedReasoning: reasoning,
    parsedSessionId: sessionId,
    parsedLanguage: language,
    parsedProposedContent: proposedContent,
    pending: !note.readAt,
  };
}

// ── Test data ─────────────────────────────────────────────────────────────────

const TARGET_TABLE = 'teaching_examples';
const REASONING    = 'Student made three attempts with wrong subjunctive form — examples table may need more contrastive pairs.';
const SESSION_ID   = 'test-session-roundtrip-225';
const LANGUAGE     = 'es';
const PROPOSED_CONTENT = { add: [{ spanish: 'Quiero que vengas', english: 'I want you to come' }] };

const SUBJECT = `[Daniela \u2014 REQUIRES FOUNDER REVIEW] ${TARGET_TABLE}: ${REASONING.substring(0, 60)}`;
const BODY = [
  `Reasoning: ${REASONING}`,
  `Session: ${SESSION_ID}`,
  `Language: ${LANGUAGE}`,
  `Source: Daniela (self_surgery \u2014 normal session)`,
  `Proposed content: ${JSON.stringify(PROPOSED_CONTENT)}`,
].join('\n');

// Promote-path test data — must use a targetTable that the promote endpoint accepts
const PROMOTE_TARGET_TABLE = 'tutor_procedures';
const PROMOTE_REASONING    = 'Student consistently skipped greeting protocol — procedure may need a stronger opening scaffold.';
const PROMOTE_SESSION_ID   = 'test-session-promote-364';
const PROMOTE_LANGUAGE     = 'es';
const PROMOTE_PROPOSED_CONTENT = { update: { field: 'greeting_steps', value: ['introduce', 'ask_name', 'set_goal'] } };

const PROMOTE_SUBJECT = `[Daniela \u2014 REQUIRES FOUNDER REVIEW] ${PROMOTE_TARGET_TABLE}: ${PROMOTE_REASONING.substring(0, 60)}`;
const PROMOTE_BODY = [
  `Reasoning: ${PROMOTE_REASONING}`,
  `Session: ${PROMOTE_SESSION_ID}`,
  `Language: ${PROMOTE_LANGUAGE}`,
  `Source: Daniela (self_surgery \u2014 normal session)`,
  `Proposed content: ${JSON.stringify(PROMOTE_PROPOSED_CONTENT)}`,
].join('\n');

// ── Promote logic (mirrors routes.ts POST /api/admin/procedure-flags/:id/promote) ──

function promoteParseNote(note: { id: string; subject: string; body: string }) {
  const subjectRest = note.subject.replace('[Daniela \u2014 REQUIRES FOUNDER REVIEW] ', '');
  const colonIdx = subjectRest.indexOf(':');
  const targetTable = colonIdx > -1 ? subjectRest.substring(0, colonIdx).trim() : subjectRest;

  const bodyLines = note.body.split('\n');
  const reasoning = (bodyLines.find((l: string) => l.startsWith('Reasoning: '))?.replace('Reasoning: ', '') || '').trim() || 'Knowledge-domain flag from normal session';
  const sessionId = (bodyLines.find((l: string) => l.startsWith('Session: '))?.replace('Session: ', '') || '').trim() || null;
  const language  = (bodyLines.find((l: string) => l.startsWith('Language: '))?.replace('Language: ', '') || '').trim() || null;

  let proposedContent: any = {};
  const pcLineIdx = bodyLines.findIndex((l: string) => l.startsWith('Proposed content: '));
  if (pcLineIdx > -1) {
    const pcRaw = bodyLines[pcLineIdx].replace('Proposed content: ', '');
    const extraLines: string[] = [];
    for (let i = pcLineIdx + 1; i < bodyLines.length; i++) {
      if (bodyLines[i] === '') break;
      extraLines.push(bodyLines[i]);
    }
    const fullPc = [pcRaw, ...extraLines].join('\n');
    try { proposedContent = JSON.parse(fullPc); } catch { proposedContent = { raw: fullPc }; }
  }

  return { targetTable, reasoning, sessionId, language, proposedContent };
}

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  const db = getSharedDb();
  let insertedId: string | null = null;
  let promoteNoteId: string | null = null;
  let promoteProposalId: string | null = null;

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // PART 1 — Insert a mock procedure flag note
    // ══════════════════════════════════════════════════════════════════════════
    sep();
    console.log(B('PART 1 — Insert mock procedure flag'));
    sep();

    const [inserted] = await db
      .insert(agentNotes)
      .values({
        fromAgent: 'daniela',
        toAgent: 'agent',
        subject: SUBJECT,
        body: BODY,
        sessionLabel: 'Procedure flags roundtrip test — Task 225',
      })
      .returning();

    insertedId = inserted?.id ?? null;
    assert('Insert succeeded and returned an id', !!insertedId,
      insertedId ? undefined : 'No row returned from insert');
    assert('readAt is initially null (flag is pending)', inserted?.readAt === null);

    if (!insertedId) {
      console.log(R('\nCannot continue without an inserted row — aborting.'));
      return;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PART 2 — Query mirrors GET /api/admin/procedure-flags and parse fields
    // ══════════════════════════════════════════════════════════════════════════
    sep();
    console.log(B('PART 2 — Query procedure flags and verify parsing'));
    sep();

    const rows = await db
      .select()
      .from(agentNotes)
      .where(
        and(
          ilike(agentNotes.subject, '[Daniela \u2014 REQUIRES FOUNDER REVIEW]%'),
          isNull(agentNotes.readAt),
          eq(agentNotes.id, insertedId),
        ),
      )
      .limit(1);

    assert('Flag appears in pending procedure-flags query', rows.length === 1,
      `got ${rows.length} rows`);

    if (rows.length === 0) {
      console.log(R('\nFlag not found in query — cannot verify parsing.'));
    } else {
      const note = rows[0];
      const parsed = parseProcedureFlag(note);

      assert(
        `parsedTargetTable = "${TARGET_TABLE}"`,
        parsed.parsedTargetTable === TARGET_TABLE,
        `got: "${parsed.parsedTargetTable}"`,
      );
      assert(
        'parsedReasoning contains the original reasoning text',
        parsed.parsedReasoning === REASONING,
        `got: "${parsed.parsedReasoning}"`,
      );
      assert(
        `parsedSessionId = "${SESSION_ID}"`,
        parsed.parsedSessionId === SESSION_ID,
        `got: "${parsed.parsedSessionId}"`,
      );
      assert(
        `parsedLanguage = "${LANGUAGE}"`,
        parsed.parsedLanguage === LANGUAGE,
        `got: "${parsed.parsedLanguage}"`,
      );
      assert(
        'parsedProposedContent is a parsed JSON object (not a string)',
        typeof parsed.parsedProposedContent === 'object' && parsed.parsedProposedContent !== null,
        `got type: ${typeof parsed.parsedProposedContent}`,
      );
      assert(
        'parsedProposedContent.add is an array with one entry',
        Array.isArray(parsed.parsedProposedContent?.add) && parsed.parsedProposedContent.add.length === 1,
        `got: ${JSON.stringify(parsed.parsedProposedContent?.add)}`,
      );
      assert('pending = true before review', parsed.pending === true);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PART 3 — Mark as reviewed (mirrors PATCH action=reviewed)
    // ══════════════════════════════════════════════════════════════════════════
    sep();
    console.log(B('PART 3 — Mark flag as reviewed (action=reviewed)'));
    sep();

    const [updated] = await db
      .update(agentNotes)
      .set({ readAt: new Date() })
      .where(eq(agentNotes.id, insertedId))
      .returning();

    assert('PATCH update returned the row', !!updated);
    assert('readAt is now set (not null)', updated?.readAt !== null && updated?.readAt !== undefined,
      `got: ${updated?.readAt}`);

    // Verify the flag no longer appears in the pending query
    const pendingAfterReview = await db
      .select({ id: agentNotes.id })
      .from(agentNotes)
      .where(
        and(
          ilike(agentNotes.subject, '[Daniela \u2014 REQUIRES FOUNDER REVIEW]%'),
          isNull(agentNotes.readAt),
          eq(agentNotes.id, insertedId),
        ),
      )
      .limit(1);

    assert(
      'Flag no longer appears in pending query after review',
      pendingAfterReview.length === 0,
      `still returned ${pendingAfterReview.length} row(s)`,
    );

    // Verify it appears when includeReviewed is true (no isNull filter)
    const allRows = await db
      .select({ id: agentNotes.id, readAt: agentNotes.readAt })
      .from(agentNotes)
      .where(
        and(
          ilike(agentNotes.subject, '[Daniela \u2014 REQUIRES FOUNDER REVIEW]%'),
          eq(agentNotes.id, insertedId),
        ),
      )
      .limit(1);

    assert(
      'Flag still visible when includeReviewed=true (readAt populated)',
      allRows.length === 1 && allRows[0].readAt !== null,
      `got ${allRows.length} rows, readAt=${allRows[0]?.readAt}`,
    );

    // ══════════════════════════════════════════════════════════════════════════
    // PART 4 — Promote to selfSurgeryProposals and verify all fields preserved
    // ══════════════════════════════════════════════════════════════════════════
    sep();
    console.log(B('PART 4 — Promote flag to self-surgery proposal (field preservation)'));
    sep();

    // 4a. Insert a promote-specific note (uses a targetTable the promote endpoint accepts)
    const [promoteNote] = await db
      .insert(agentNotes)
      .values({
        fromAgent: 'daniela',
        toAgent: 'agent',
        subject: PROMOTE_SUBJECT,
        body: PROMOTE_BODY,
        sessionLabel: 'Procedure flags promote roundtrip test — Task 364',
      })
      .returning();

    promoteNoteId = promoteNote?.id ?? null;
    assert('Promote test note inserted', !!promoteNoteId);

    if (promoteNoteId) {
      // 4b. Fetch the note back (mirrors what the promote route does)
      const [fetchedNote] = await db
        .select()
        .from(agentNotes)
        .where(eq(agentNotes.id, promoteNoteId))
        .limit(1);

      assert('Promote note fetched from DB', !!fetchedNote);

      if (fetchedNote) {
        // 4c. Run the same parsing logic the promote route uses
        const parsed = promoteParseNote(fetchedNote);

        // 4d. Insert the proposal (mirrors routes.ts promote logic exactly)
        const [proposal] = await db
          .insert(selfSurgeryProposals)
          .values({
            targetTable: parsed.targetTable as any,
            proposedContent: parsed.proposedContent,
            reasoning: parsed.reasoning,
            triggerContext: `Promoted from procedure flag ${promoteNoteId}. Original session: ${parsed.sessionId || 'unknown'}`,
            status: 'pending',
            conversationId: parsed.sessionId,
            sessionMode: 'normal',
            targetLanguage: parsed.language,
            priority: 50,
            confidence: 70,
          })
          .returning();

        promoteProposalId = proposal?.id ?? null;
        assert('selfSurgeryProposals row created', !!promoteProposalId);

        if (proposal) {
          // 4e. Verify every field survived the round-trip
          assert(
            `proposal.targetTable = "${PROMOTE_TARGET_TABLE}"`,
            proposal.targetTable === PROMOTE_TARGET_TABLE,
            `got: "${proposal.targetTable}"`,
          );
          assert(
            'proposal.reasoning matches original',
            proposal.reasoning === PROMOTE_REASONING,
            `got: "${proposal.reasoning}"`,
          );
          assert(
            `proposal.conversationId = "${PROMOTE_SESSION_ID}"`,
            proposal.conversationId === PROMOTE_SESSION_ID,
            `got: "${proposal.conversationId}"`,
          );
          assert(
            `proposal.targetLanguage = "${PROMOTE_LANGUAGE}"`,
            proposal.targetLanguage === PROMOTE_LANGUAGE,
            `got: "${proposal.targetLanguage}"`,
          );
          assert(
            'proposal.proposedContent is the original JSON object (not corrupted)',
            JSON.stringify(proposal.proposedContent) === JSON.stringify(PROMOTE_PROPOSED_CONTENT),
            `got: ${JSON.stringify(proposal.proposedContent)}`,
          );
          assert(
            "proposal.status = 'pending'",
            proposal.status === 'pending',
            `got: "${proposal.status}"`,
          );
          assert(
            'proposal.triggerContext mentions the note id',
            typeof proposal.triggerContext === 'string' && proposal.triggerContext.includes(promoteNoteId),
            `got: "${proposal.triggerContext}"`,
          );
          assert(
            'proposal.triggerContext mentions the session id',
            typeof proposal.triggerContext === 'string' && proposal.triggerContext.includes(PROMOTE_SESSION_ID),
            `got: "${proposal.triggerContext}"`,
          );

          // 4f. Mark the note as reviewed (the promote route does this too)
          const [markedNote] = await db
            .update(agentNotes)
            .set({ readAt: new Date() })
            .where(eq(agentNotes.id, promoteNoteId))
            .returning();

          assert('Note marked as reviewed after promote', markedNote?.readAt !== null && markedNote?.readAt !== undefined);
        }
      }
    }

  } finally {
    // ── Cleanup: remove the test note so it does not pollute the real panel ──
    if (insertedId) {
      await db.delete(agentNotes).where(eq(agentNotes.id, insertedId));
      console.log(`\n  (cleaned up test note ${insertedId})`);
    }
    if (promoteProposalId) {
      await db.delete(selfSurgeryProposals).where(eq(selfSurgeryProposals.id, promoteProposalId));
      console.log(`  (cleaned up test proposal ${promoteProposalId})`);
    }
    if (promoteNoteId) {
      await db.delete(agentNotes).where(eq(agentNotes.id, promoteNoteId));
      console.log(`  (cleaned up promote test note ${promoteNoteId})`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  sep();
  console.log(`\n${passed + failed} checks — ${G(String(passed) + ' passed')}${failed > 0 ? ', ' + R(String(failed) + ' failed') : ''}`);
  if (failed > 0) {
    console.error(R('\nSome procedure-flag checks FAILED.'));
    process.exit(1);
  } else {
    console.log(G('\nAll procedure-flag roundtrip checks passed ✓'));
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(R('\nUnhandled error:'), err);
    process.exit(1);
  });
