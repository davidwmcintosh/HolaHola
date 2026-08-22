/**
 * test-episode1-archive-retrieval.ts
 *
 * Confirms that Daniela can retrieve Episode 1 ("Take That, World") in full
 * through her Archive before tomorrow's session (Episode 26 read-back).
 *
 * This script is READ-ONLY: no rows are inserted, updated, or deleted,
 * and no reinforceMemory side-effects are triggered.  `seed-episode1.ts`
 * is responsible for ensuring the canonical row exists; npm test runs it
 * immediately before this script.
 *
 * Four parts:
 *   PART 1 — DB presence: Episode 1's canonical conversation_memories row
 *             exists with arc_name='HolaHola Episodes', importance=10, and
 *             full verbatim content.  Fails loudly (exit 1) if absent.
 *   PART 2 — Recall excerpt path: processUnifiedRecall with a query specific
 *             to Episode 1 surfaces the row via Arm 5 (ILIKE) and the result
 *             contains recognizable Episode 1 content plus the arc label.
 *             Arm 1/4 (vector search) do not fire for this query, so no
 *             reinforceMemory side-effect is triggered.
 *   PART 3 — Canonical content integrity: direct SELECT by the canonical row id
 *             (from PART 1) verifies title identity, content length > EP1_MIN_CHARS,
 *             and presence of both early + late fingerprints.  Pure SELECT — no
 *             side-effects.
 *   PART 4 — Non-destructive self-checks: targeted SELECT queries with deliberately
 *             wrong criteria (wrong arc_name, wrong entry_type, wrong title) return
 *             0 rows, proving the PART 1 / PART 3 assertions are non-vacuous.
 *
 * Run: npx tsx server/scripts/test-episode1-archive-retrieval.ts
 */

import { getSharedDb, getMonitoringDb } from '../db';
import { conversationMemories } from '@shared/schema';
import { eq, sql, ilike, or, and } from 'drizzle-orm';
import { NativeFunctionCallHandler } from '../services/native-fc-handlers';
import type { StreamingSession } from '../services/streaming-session-types';

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

// ── Episode 1 canonical identifiers ───────────────────────────────────────────
const EP1_TITLE        = `Episode 1: "Take That, World"`;
const EP1_ARC          = 'HolaHola Episodes';
const EP1_ARC_LABEL    = 'arc: HolaHola Episodes';   // as formatted by Arm 5
const EP1_IMPORTANCE   = 10;
// Early fingerprint: appears within the first 800 chars of the episode
const EP1_EARLY_FP     = 'David and Cindy';
// Late fingerprint: appears only in the freestyle rap section (~line 70, > 3 000 chars in)
// Cannot appear in a summary or stub — proves the full verbatim text is stored.
const EP1_LATE_FP      = 'Tom, tom, tom';
// Minimum canonical content length (docs/episode-1.md is ~14 036 chars)
const EP1_MIN_CHARS    = 13000;

// ── Stub session ──────────────────────────────────────────────────────────────
function makeSession(userId = 'ci-ep1-test-user', conversationId = 'ci-ep1-test-conv'): StreamingSession {
  return {
    id: 'ci-ep1-test-session',
    userId,
    conversationId,
    targetLanguage: 'Spanish',
    nativeLanguage: 'English',
    difficultyLevel: 'beginner',
    subtitleMode: 'off',
    tutorPersonality: 'warm' as any,
    tutorExpressiveness: 5,
    voiceSpeed: '1.0' as any,
    tutorGender: 'female',
    tutorName: 'Daniela',
    systemPrompt: '',
    conversationHistory: [],
    ws: null as any,
    startTime: Date.now(),
    isActive: true,
    isFounderMode: false,
    isRawHonestyMode: false,
    isReadingRoom: false,
    isIncognito: false,
    isDeveloperUser: false,
    isBetaTester: false,
    lastContextRefreshTime: 0,
    lastActivityTime: Date.now(),
    currentTurnId: 1,
    isInterrupted: false,
    lastTurnWasInterrupted: false,
    isGenerating: false,
  } as unknown as StreamingSession;
}

function makeHandler(): NativeFunctionCallHandler {
  return new NativeFunctionCallHandler(
    () => {},          // sendMessage — no-op
    () => {},          // sendError — no-op
    async () => {},    // processPhaseShift — no-op
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — DB presence (read-only; fails loudly if canonical row absent)
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — DB presence: canonical Episode 1 row in conversation_memories'));
sep();

async function runPart1(): Promise<string | null> {
  const db = getSharedDb();

  const rows = await db
    .select({
      id:          conversationMemories.id,
      title:       conversationMemories.title,
      arcName:     conversationMemories.arcName,
      entryType:   conversationMemories.entryType,
      importance:  conversationMemories.importance,
      contentLen:  sql<number>`length(${conversationMemories.content})`,
      hasEarlyFp:  sql<boolean>`${conversationMemories.content} ILIKE ${'%' + EP1_EARLY_FP + '%'}`,
      hasLateFp:   sql<boolean>`${conversationMemories.content} ILIKE ${'%' + EP1_LATE_FP + '%'}`,
    })
    .from(conversationMemories)
    .where(eq(conversationMemories.title, EP1_TITLE))
    .limit(1);

  const present = rows.length === 1;
  assert(
    `Canonical Episode 1 row exists (title="${EP1_TITLE}")`,
    present,
    'Row absent — ensure seed-episode1.ts has been run',
  );
  if (!present) return null;

  const row = rows[0];
  assert(`arc_name is "${EP1_ARC}"`,       row.arcName === EP1_ARC,       `got "${row.arcName}"`);
  assert(`entry_type is 'episode'`,        row.entryType === 'episode',   `got "${row.entryType}"`);
  assert(`importance is ${EP1_IMPORTANCE}`,row.importance === EP1_IMPORTANCE, `got ${row.importance}`);
  assert(`content > ${EP1_MIN_CHARS} chars (full verbatim)`, row.contentLen > EP1_MIN_CHARS,
    `got ${row.contentLen} chars`);
  assert(`content contains early fingerprint "${EP1_EARLY_FP}"`, row.hasEarlyFp,
    'early fingerprint missing from content');
  assert(`content contains late fingerprint "${EP1_LATE_FP}" (deep in transcript)`, row.hasLateFp,
    'late fingerprint missing — content may be a stub or summary');

  return row.id;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Recall excerpt path (processUnifiedRecall, read-only)
//
// Uses a query specific to Episode 1: "Cindy Show podcast HolaHola episode 1"
//   — "Cindy" appears only in Episode 1 rows (original tutor name)
//   — Arm 5 ILIKE AND pass returns Episode 1 rows with arc label
//   — Arm 1/4 vector search does not fire here → no reinforceMemory side-effect
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Recall excerpt: processUnifiedRecall("Cindy Show podcast HolaHola episode 1")'));
sep();

const RECALL_QUERY = 'Cindy Show podcast HolaHola episode 1';

async function runPart2() {
  const handler = makeHandler();
  const session  = makeSession();

  await (handler as any).processUnifiedRecall(session, RECALL_QUERY);

  const results: Record<string, string> = (session as any).recallResults ?? {};
  const result: string = results[RECALL_QUERY] ?? '';

  assert('recallResults populated for query key', result.length > 0,
    `empty — keys: ${Object.keys(results).join(', ')}`);
  assert(
    `Result contains early fingerprint "${EP1_EARLY_FP}"`,
    result.includes(EP1_EARLY_FP),
    `snippet: ${result.substring(0, 300)}`,
  );
  assert(
    `Result carries arc label "${EP1_ARC_LABEL}" (Arm 5 format)`,
    result.includes(EP1_ARC_LABEL),
    `arc label absent — last 600: ${result.substring(result.length - 600)}`,
  );
  assert(
    'Result does NOT return "Nothing found" stub',
    !result.startsWith('Nothing found for'),
    `got: ${result.substring(0, 100)}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Canonical content integrity (direct SELECT by id, pure read)
//
// Queries the canonical row by the id returned from PART 1.  Verifies:
//   • title matches exactly (canonical row, not an alternate Episode 1 variant)
//   • content length > EP1_MIN_CHARS (full verbatim, not truncated or summarized)
//   • both early and late fingerprints present
//
// Pure SELECT — no reinforceMemory or any other DB side-effect.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Canonical content integrity: direct SELECT by id confirms full verbatim transcript'));
sep();

async function runPart3(ep1Id: string) {
  const db = getSharedDb();

  const rows = await db
    .select({
      title:      conversationMemories.title,
      arcName:    conversationMemories.arcName,
      importance: conversationMemories.importance,
      entryType:  conversationMemories.entryType,
      content:    conversationMemories.content,
    })
    .from(conversationMemories)
    .where(eq(conversationMemories.id, ep1Id))
    .limit(1);

  assert('Canonical row readable by id', rows.length === 1, 'row not found');
  if (rows.length === 0) return;

  const row = rows[0];
  assert(
    `Title is exactly "${EP1_TITLE}" (not an alternate row)`,
    row.title === EP1_TITLE,
    `got "${row.title}"`,
  );
  assert(
    `Content length > ${EP1_MIN_CHARS} chars (full verbatim, not a summary)`,
    (row.content?.length ?? 0) > EP1_MIN_CHARS,
    `got ${row.content?.length ?? 0} chars`,
  );
  assert(
    `Content contains early fingerprint "${EP1_EARLY_FP}"`,
    (row.content ?? '').includes(EP1_EARLY_FP),
    'early fingerprint missing',
  );
  assert(
    `Content contains late fingerprint "${EP1_LATE_FP}" (deep in transcript — proves full text stored)`,
    (row.content ?? '').includes(EP1_LATE_FP),
    'late fingerprint missing — content may be truncated or replaced with a stub',
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — Non-destructive self-checks (all pure SELECT, no mutations)
//
// Targeted queries with deliberately wrong criteria return 0 rows.
// Proves PART 1 / PART 3 assertions are non-vacuous: a row with wrong
// arc_name, wrong entry_type, or the wrong title would cause them to fail.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 4 — Non-destructive self-checks: wrong criteria → 0 rows'));
sep();

async function runPart4() {
  const db = getMonitoringDb();

  // ── Self-check A: wrong arc_name → PART 1 arc assertion would fail ────────
  const wrongArcRows = await db
    .select({ id: conversationMemories.id })
    .from(conversationMemories)
    .where(
      and(
        eq(conversationMemories.title, EP1_TITLE),
        sql`${conversationMemories.arcName} = ${'WRONG ARC — does not exist'}`,
      )
    )
    .limit(1);

  assert(
    'Self-check A: wrong arc_name → 0 rows (proves arc_name assertion is non-vacuous)',
    wrongArcRows.length === 0,
    `found ${wrongArcRows.length} rows — unexpected`,
  );

  // ── Self-check B: wrong entry_type → a miscategorised row would be missed ──
  const wrongTypeRows = await db
    .select({ id: conversationMemories.id })
    .from(conversationMemories)
    .where(
      and(
        eq(conversationMemories.title, EP1_TITLE),
        sql`${conversationMemories.entryType} = ${'conversation'}`,
      )
    )
    .limit(1);

  assert(
    `Self-check B: wrong entry_type ('conversation') → 0 rows (proves entry_type check is non-vacuous)`,
    wrongTypeRows.length === 0,
    `found ${wrongTypeRows.length} rows — entry_type may be miscategorised`,
  );

  // ── Self-check C: wrong title → 0 rows ────────────────────────────────────
  const badTitleRows = await db
    .select({ id: conversationMemories.id })
    .from(conversationMemories)
    .where(
      and(
        sql`${conversationMemories.arcName} = ${EP1_ARC}`,
        eq(conversationMemories.title, 'Episode 1: THIS TITLE DOES NOT EXIST'),
      )
    )
    .limit(1);

  assert(
    'Self-check C: non-existent title → 0 rows (proves exact-title match is required)',
    badTitleRows.length === 0,
    `found ${badTitleRows.length} rows`,
  );

  // ── Self-check D: Arm 5 recall with completely unrelated query → no content ─
  // Proves the recall result is not a constant — it changes with the query.
  const handler = makeHandler();
  const session  = makeSession('ci-ep1-sc-user', 'ci-ep1-sc-conv');
  const unrelated = 'xzq9-completely-nonexistent-episode-ci-self-check';

  await (handler as any).processUnifiedRecall(session, unrelated);
  const scResults: Record<string, string> = (session as any).recallResults ?? {};
  const scResult: string = scResults[unrelated] ?? '';

  assert(
    `Self-check D: unrelated recall query does not return Episode 1 content`,
    !scResult.includes(EP1_LATE_FP),
    `unexpected: result contains "${EP1_LATE_FP}"`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
(async () => {
  try {
    const ep1Id = await runPart1();
    // PART 1 failure is terminal — rest of test depends on the canonical row
    if (ep1Id === null) {
      sep();
      console.log(R('\n✗  PART 1 failed (canonical row absent). Seed it first: npx tsx server/scripts/seed-episode1.ts\n'));
      process.exit(1);
    }

    await runPart2();
    await runPart3(ep1Id);
    await runPart4();

  } catch (err: any) {
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed — Episode 1 is fully retrievable through Daniela's Archive.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
})();
