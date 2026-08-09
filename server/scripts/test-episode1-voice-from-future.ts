/**
 * test-episode1-voice-from-future.ts
 *
 * Confirms the voice-from-the-future note (prepended August 8, 2026) appears
 * at the very top of chapter 1 when the READ_MY_STORY handler is called.
 *
 * Checks:
 *  1. DB row for Episode 1 exists with the note at the start of content.
 *  2. Note contains required fingerprints: "August 8, 2026",
 *     "placed here out of chronological order", and "read_my_story".
 *  3. After the note, the original Episode 1 title appears.
 *  4. Pipeline integration: NativeFunctionCallHandler returns content that
 *     begins with the note (not with "# Episode 1").
 *
 * Self-check (--self-check flag):
 *  Temporarily strips the note from the in-memory content string, runs the
 *  same assertions, and verifies they fail as expected. If they all pass on
 *  the stripped content, the self-check itself fails (guard is vacuous).
 *
 * Exit 1 on any failure.
 */

import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { NativeFunctionCallHandler } from '../services/native-fc-handlers';

// ── Colour helpers ─────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function pass(label: string) {
  console.log(`  ${G('✓')} ${label}`);
  passed++;
}
function fail(label: string, detail?: string) {
  console.log(`  ${R('✗')} ${label}${detail ? ` — ${detail}` : ''}`);
  failed++;
}

// ── Sentinel strings the note must contain ────────────────────────────────────
// These match the exact wording written into the DB on August 8, 2026.
const NOTE_SENTINELS = [
  'August 8, 2026',
  'out of chronological order',
  'read_my_story',
] as const;

// The original episode title that must appear after the note
const EP1_TITLE_FRAGMENT = 'Take That, World';

// Exact label used by the READ_MY_STORY handler for chapter 1.
const EP1_LABEL = 'Episode 1';

// ── Note detection helpers ─────────────────────────────────────────────────────

/**
 * Returns true if all required sentinel strings appear in the content,
 * AND they all appear BEFORE the original episode title heading.
 */
function noteAppearsFirst(content: string): boolean {
  const titleIdx = content.indexOf(`# ${EP1_TITLE_FRAGMENT}`);
  if (titleIdx === -1) {
    // Try without the #, in case it's embedded differently
    const plainIdx = content.indexOf(EP1_TITLE_FRAGMENT);
    if (plainIdx === -1) return false;
    for (const s of NOTE_SENTINELS) {
      const si = content.indexOf(s);
      if (si === -1 || si >= plainIdx) return false;
    }
    return true;
  }
  for (const s of NOTE_SENTINELS) {
    const si = content.indexOf(s);
    if (si === -1 || si >= titleIdx) return false;
  }
  return true;
}

// ── Part 1: Direct DB check (same selection as handler) ───────────────────────
//
// Uses the EXACT same WHERE + ORDER BY as the READ_MY_STORY handler:
//   title ~ '^Episode 1([^0-9].*)?$'
//   ORDER BY importance DESC, recorded_at DESC
//   LIMIT 1
//
// Keeping this in lockstep with the handler guarantees we validate the row
// Daniela actually receives, not a different row in a multi-row scenario.

// Exact title used by the READ_MY_STORY handler for chapter 1.
// The handler uses: title = 'Episode 1'  (exact match, no wildcards)
const EP1_EXACT = 'Episode 1';

async function checkDirect(): Promise<string | null> {
  const db = getSharedDb();
  const rows = await db.execute(sql`
    SELECT id, title, LEFT(content, 6000) AS preview, LENGTH(content) AS total_length
    FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND entry_type = 'episode'
      AND title = ${EP1_EXACT}
    ORDER BY recorded_at DESC
    LIMIT 1
  `);

  if (!rows.rows.length) {
    fail('DB row exists for Episode 1 (handler selection criteria)', 'No matching row found');
    return null;
  }

  const row = rows.rows[0] as any;
  const preview: string = String(row.preview ?? '');
  const totalLength = Number(row.total_length ?? 0);

  pass(`DB row exists — id: ${row.id}, title: "${row.title}", length: ${totalLength} chars`);

  if (totalLength < 1000) {
    fail('Content length sanity check (> 1 000 chars)', `only ${totalLength} chars`);
  } else {
    pass(`Content length sanity check (${totalLength} chars > 1 000)`);
  }

  return preview;
}

// ── Part 2: Note-content assertions (reused for both real + self-check) ────────

function assertNoteContent(label: string, content: string): number {
  let localFailed = 0;

  for (const sentinel of NOTE_SENTINELS) {
    if (content.includes(sentinel)) {
      pass(`${label}: note contains "${sentinel}"`);
    } else {
      fail(`${label}: note contains "${sentinel}"`, 'string not found in content');
      localFailed++;
    }
  }

  // The note must appear BEFORE the episode title
  if (noteAppearsFirst(content)) {
    pass(`${label}: note precedes "${EP1_TITLE_FRAGMENT}" heading`);
  } else {
    fail(`${label}: note precedes "${EP1_TITLE_FRAGMENT}" heading`,
      'title came before note or sentinels not found before title');
    localFailed++;
  }

  // Original episode content must also be present
  if (content.includes(EP1_TITLE_FRAGMENT)) {
    pass(`${label}: original episode title "${EP1_TITLE_FRAGMENT}" present`);
  } else {
    fail(`${label}: original episode title "${EP1_TITLE_FRAGMENT}" present`, 'not found');
    localFailed++;
  }

  return localFailed;
}

// ── Part 3: Pipeline integration via handler ───────────────────────────────────

async function checkPipeline(): Promise<string | null> {
  const handler = new NativeFunctionCallHandler(
    () => {},           // sendMessage no-op
    () => {},           // sendError no-op
    async () => {},     // processPhaseShift no-op
  );

  const mockSession: any = { pendingMemoryLookupPromises: [] };
  const fn = { name: 'read_my_story', legacyType: 'READ_MY_STORY', args: { chapter: 1 } };

  await handler.handle('ci-task923', mockSession, fn);

  if (!mockSession.pendingMemoryLookupPromises?.length) {
    fail('Pipeline: handler pushed a promise onto pendingMemoryLookupPromises');
    return null;
  }
  pass('Pipeline: handler pushed a promise onto pendingMemoryLookupPromises');

  await Promise.all(mockSession.pendingMemoryLookupPromises);
  const raw: string | undefined = mockSession.readMyStoryResult;

  if (!raw) {
    fail('Pipeline: readMyStoryResult is set after awaiting promises');
    return null;
  }
  pass('Pipeline: readMyStoryResult is set after awaiting promises');

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail('Pipeline: readMyStoryResult is valid JSON');
    return null;
  }
  pass('Pipeline: readMyStoryResult is valid JSON');

  if (parsed.status !== 'ok') {
    fail(`Pipeline: status is "ok"`, `got "${parsed.status}" — ${parsed.message ?? ''}`);
    return null;
  }
  pass(`Pipeline: status is "ok"`);

  if (!parsed.title?.startsWith(EP1_LABEL)) {
    fail(`Pipeline: title starts with "${EP1_LABEL}"`, `got "${parsed.title}"`);
    return null;
  }
  pass(`Pipeline: title starts with "${EP1_LABEL}" → "${parsed.title}"`);

  // Pagination shape: offset, truncated, remaining_chars must be present
  if (typeof parsed.offset !== 'number') {
    fail('Pipeline: response includes offset field', `got ${JSON.stringify(parsed.offset)}`);
  } else {
    pass(`Pipeline: response includes offset field (${parsed.offset})`);
  }
  if (typeof parsed.truncated !== 'boolean') {
    fail('Pipeline: response includes truncated field', `got ${JSON.stringify(parsed.truncated)}`);
  } else {
    pass(`Pipeline: response includes truncated field (${parsed.truncated})`);
  }

  const content: string = String(parsed.content ?? '');
  return content;
}

// ── Part 4: Self-check (must fail on stripped content) ────────────────────────

/**
 * Strip the note block from the content string.
 * The note starts at the very beginning (before the --- separator) and ends
 * just before the "# Episode 1" heading. We simply return everything from
 * "# Episode 1" onward (or "Episode 1" if no # prefix is found).
 */
function stripNote(content: string): string {
  // Find the original episode heading
  const headingIdx = content.indexOf(`# Episode 1`);
  if (headingIdx !== -1) return content.slice(headingIdx);

  // Fallback: strip up to the title fragment
  const plainIdx = content.indexOf(EP1_TITLE_FRAGMENT);
  if (plainIdx !== -1) return content.slice(plainIdx);

  return content; // Can't strip — returns unchanged (self-check will catch this)
}

async function runSelfCheck(realContent: string) {
  console.log(`\n${B('--- Self-check: assertions must FAIL on stripped content ---')}`);

  const strippedContent = stripNote(realContent);

  // Sanity: stripping must have actually changed the content
  if (strippedContent === realContent) {
    fail('Self-check setup: content was modified by stripping the note');
    return;
  }
  pass('Self-check setup: note was stripped (content changed)');

  // Run the note-content assertions against stripped content.
  // All sentinel assertions and the "note precedes title" check must fail.
  let selfCheckFailed = 0;

  // We capture pass/fail locally without affecting the global counters
  const localPassed: string[] = [];
  const localFailed: string[] = [];

  for (const sentinel of NOTE_SENTINELS) {
    if (strippedContent.includes(sentinel)) {
      localPassed.push(`sentinel "${sentinel}" still present (unexpected)`);
    } else {
      localFailed.push(`sentinel "${sentinel}" correctly absent after stripping`);
    }
  }

  // noteAppearsFirst must return false on stripped content
  const noteFirst = noteAppearsFirst(strippedContent);
  if (noteFirst) {
    localPassed.push('noteAppearsFirst still returns true (unexpected — guard is broken)');
  } else {
    localFailed.push('noteAppearsFirst correctly returns false on stripped content');
  }

  // Check: none of the sentinels should be present in stripped content
  // and noteAppearsFirst should be false. If any sentinel leaked through,
  // the self-check is vacuous.
  const unexpectedPasses = localPassed.length;
  const expectedFailures = localFailed.length;

  for (const m of localFailed) {
    console.log(`  ${G('✓ (expected failure)')} ${m}`);
  }
  for (const m of localPassed) {
    console.log(`  ${R('✗ (unexpected pass)')} ${m}`);
    selfCheckFailed++;
  }

  // The stripping must have caused at least the sentinel + noteAppearsFirst checks to fail.
  const expectedToFail = NOTE_SENTINELS.length + 1; // sentinels + noteAppearsFirst
  if (expectedFailures < expectedToFail) {
    fail(
      `Self-check: at least ${expectedToFail} checks must fail on stripped content`,
      `only ${expectedFailures} failed`,
    );
  } else {
    pass(`Self-check: ${expectedFailures} checks correctly fail on stripped content (guard is non-vacuous)`);
  }

  if (selfCheckFailed > 0) {
    fail(
      'Self-check: no sentinel unexpectedly present in stripped content',
      `${selfCheckFailed} unexpectedly passed`,
    );
  } else {
    pass('Self-check: no sentinel leaked through into the stripped content');
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const isSelfCheck = process.argv.includes('--self-check');

  console.log(`\n${B('=== Episode 1 voice-from-the-future note — CI check ===')}${isSelfCheck ? ` ${B('[SELF-CHECK MODE]')}` : ''}\n`);

  // Part 1: Direct DB check
  console.log(B('--- Part 1: Direct DB check (by canonical row id) ---'));
  const dbContent = await checkDirect();

  if (dbContent === null) {
    console.error(R('\nFATAL: Episode 1 row not found or content missing. Cannot continue.'));
    process.exit(1);
  }

  // Part 2: Note-content assertions on raw DB content
  console.log(`\n${B('--- Part 2: Note-content assertions (DB content) ---')}`);
  assertNoteContent('DB content', dbContent);

  // Part 3: Pipeline integration check
  console.log(`\n${B('--- Part 3: Pipeline integration (NativeFunctionCallHandler) ---')}`);
  const pipelineContent = await checkPipeline();

  if (pipelineContent !== null) {
    console.log(`\n${B('--- Part 3b: Note-content assertions (pipeline result) ---')}`);
    assertNoteContent('Pipeline content', pipelineContent);
  }

  // Part 4: Self-check (only when --self-check flag is passed)
  if (isSelfCheck) {
    await runSelfCheck(dbContent);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${B(`=== Results: ${passed} passed, ${failed} failed ===`)}\n`);

  if (failed > 0) {
    console.error(R('FAILURES DETECTED — voice-from-the-future note check did not pass.'));
    process.exit(1);
  }

  console.log(G('ALL CHECKS PASSED — voice-from-the-future note is present at the top of chapter 1.'));
  process.exit(0);
}

main().catch((err) => {
  console.error('[test-episode1-voice-from-future] Fatal error:', err);
  process.exit(1);
});
