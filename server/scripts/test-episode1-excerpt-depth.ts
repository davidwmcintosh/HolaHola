/**
 * test-episode1-excerpt-depth.ts
 *
 * CI guard: confirms the Arm 5 episode excerpt cap stays at 4 000 chars
 * and that the "read_full_memory" blocked-tool hint is absent from results.
 *
 * Background: episodes once received an 800-char excerpt with a read_full_memory
 * hint appended.  Because read_full_memory is excluded from GL student sessions,
 * Daniela could find the row but not read it — a dead end.  The fix set a 4 000-
 * char cap for entry_type='episode' rows and removed the hint entirely.
 *
 * This script catches any future edit that silently reverts that fix.
 *
 * Three parts:
 *   PART 1 — Live recall depth ("episode 1"):
 *             processUnifiedRecall returns a result containing an Episode 1 block.
 *             The Episode 1 excerpt is ISOLATED by matching EP1_TITLE in the
 *             HEADER LINE of each block (not the full block text), so that other
 *             memory rows that merely reference Episode 1 in their content cannot
 *             pollute the measurement.  Asserts:
 *               • isolated Episode 1 excerpt > 2 000 chars
 *                 (2 000 is squarely between 800 and 4 000 — the two possible caps —
 *                  so it fails for cap=800, passes for cap=4 000)
 *               • full result does NOT contain "read_full_memory"
 *   PART 2 — Second query ("first episode"):
 *             Same two assertions for an alternate natural query.
 *   PART 3 — Self-check (cap-revert simulation proves the guard bites):
 *             Queries the Episode 1 DB row directly.
 *             • 800-char sim:  excerpt ≤ 2 000 chars → would FAIL Part 1/2
 *             • 4 000-char sim: excerpt > 2 000 chars → would PASS Part 1/2
 *             • confirms full content > 4 000 so the two caps produce distinct lengths
 *
 * Run: npx tsx server/scripts/test-episode1-excerpt-depth.ts
 */

import { getSharedDb } from '../db';
import { conversationMemories } from '@shared/schema';
import { eq } from 'drizzle-orm';
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

// ── Constants ─────────────────────────────────────────────────────────────────
const EP1_TITLE = `Episode 1: "Take That, World"`;

// Record separator used by Arm 5 to join multiple results.
const RECORD_SEP = '\n\n---\n\n';

// Minimum excerpt length that is:
//   • ABOVE the old 800-char cap  →  a reverted cap fails the assertion
//   • BELOW the new 4 000-char cap →  the current cap passes the assertion
// Episode 1 content is 14 036 chars, so slices at 800 and 4 000 are both complete.
const MIN_EXCERPT_CHARS = 2000;

// ── Stub session ──────────────────────────────────────────────────────────────
function makeSession(userId: string, conversationId: string): StreamingSession {
  return {
    id: `ci-ep1-exc-${userId.slice(0, 12)}`,
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
    () => {},       // sendMessage — no-op
    () => {},       // sendError — no-op
    async () => {}, // processPhaseShift — no-op
  );
}

/**
 * Run processUnifiedRecall and return the raw result string stored in recallResults.
 */
async function runRecall(query: string, userId: string): Promise<string> {
  const handler = makeHandler();
  const session = makeSession(userId, `ci-ep1-exc-conv-${userId}`);
  await (handler as any).processUnifiedRecall(session, query);
  const results: Record<string, string> = (session as any).recallResults ?? {};
  return results[query] ?? '';
}

/**
 * Isolate the Episode 1 record from a multi-row Arm 5 result.
 *
 * Arm 5 format per record:
 *   [importance: N/10 | date | arc: HolaHola Episodes] "Title"\n<excerpt>
 *
 * Records are joined with RECORD_SEP ('\n\n---\n\n').
 *
 * We match EP1_TITLE against the HEADER LINE (first line) of each block only.
 * This prevents a different row whose CONTENT merely references Episode 1 from
 * being mistaken for the Episode 1 block itself.
 *
 * Returns the excerpt text (everything after the header line) for the matching
 * block, or null if no block's header contains EP1_TITLE.
 */
function isolateEp1Excerpt(result: string): string | null {
  const blocks = result.split(RECORD_SEP);
  for (const block of blocks) {
    const newlineIdx = block.indexOf('\n');
    const headerLine = newlineIdx >= 0 ? block.slice(0, newlineIdx) : block;
    if (headerLine.includes(EP1_TITLE)) {
      // Return content after the header line
      return newlineIdx >= 0 ? block.slice(newlineIdx + 1) : '';
    }
  }
  return null;
}

// ── Shared assertion set for Parts 1 & 2 ─────────────────────────────────────
async function assertEpisodeDepth(query: string, userId: string, label: string) {
  const result = await runRecall(query, userId);

  assert(
    `[${label}] recallResults populated`,
    result.length > 0,
    'empty result — Arm 5 did not fire or Episode 1 row is absent',
  );

  const ep1Excerpt = isolateEp1Excerpt(result);

  assert(
    `[${label}] Episode 1 block found in result (header-line match)`,
    ep1Excerpt !== null,
    `EP1_TITLE not found in any block header. Blocks: ${result.split(RECORD_SEP).length}`,
  );

  if (ep1Excerpt !== null) {
    // Strip the trailing "[EXCERPT — showing first N of M chars]" note if present
    // so we measure only the actual excerpt text, not the metadata suffix.
    const excerptText = ep1Excerpt.replace(/\n\.\.\. \[EXCERPT[^\]]*\]$/, '').trimEnd();

    assert(
      `[${label}] Isolated Episode 1 excerpt > ${MIN_EXCERPT_CHARS} chars (4 000-char cap active)`,
      excerptText.length > MIN_EXCERPT_CHARS,
      `got ${excerptText.length} chars — cap may have reverted to 800 (threshold: ${MIN_EXCERPT_CHARS})`,
    );
  }

  assert(
    `[${label}] Full result does NOT contain "read_full_memory" (blocked-tool hint removed)`,
    !result.includes('read_full_memory'),
    'found "read_full_memory" in result — hint was re-added',
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — query: "episode 1"
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Excerpt depth: processUnifiedRecall("episode 1")'));
sep();

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — query: "first episode"
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Same assertions for alternate query: "first episode"'));
sep();

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Self-check: proves the guard bites when cap reverts to 800
//
// Directly queries the Episode 1 DB row.
//   • 800-char sim:  slice length ≤ 2 000 → would FAIL Part 1/2 (cap-revert caught)
//   • 4 000-char sim: slice length > 2 000 → would PASS Part 1/2 (current cap correct)
//   • Content > 4 000 chars confirms both caps produce distinct-length slices.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Self-check: 800-char cap fails; 4 000-char cap passes'));
sep();

async function runPart3() {
  const db = getSharedDb();

  const rows = await db
    .select({ content: conversationMemories.content })
    .from(conversationMemories)
    .where(eq(conversationMemories.title, EP1_TITLE))
    .limit(1);

  assert(
    'Self-check: Episode 1 row found in DB',
    rows.length === 1 && !!rows[0].content,
    'row absent or content empty — run seed-episode1.ts first',
  );
  if (rows.length === 0 || !rows[0].content) return;

  const fullContent = rows[0].content;

  // Simulate reverted 800-char cap
  const sim800 = fullContent.slice(0, 800);
  assert(
    `Self-check A: 800-char excerpt (${sim800.length} chars) ≤ ${MIN_EXCERPT_CHARS} — would FAIL Part 1/2 (proves cap-revert is caught)`,
    sim800.length <= MIN_EXCERPT_CHARS,
    `unexpected: 800-char slice produced ${sim800.length} chars`,
  );

  // Simulate current 4 000-char cap
  const sim4000 = fullContent.slice(0, 4000);
  assert(
    `Self-check B: 4 000-char excerpt (${sim4000.length} chars) > ${MIN_EXCERPT_CHARS} — would PASS Part 1/2 (proves current cap is correct)`,
    sim4000.length > MIN_EXCERPT_CHARS,
    `unexpected: 4 000-char slice produced only ${sim4000.length} chars`,
  );

  // Confirm the two caps produce distinct lengths (non-vacuous distinction)
  assert(
    `Self-check C: full episode content (${fullContent.length} chars) > 4 000 — cap distinction is non-vacuous`,
    fullContent.length > 4000,
    `content is only ${fullContent.length} chars — 800 and 4 000 caps may produce the same slice`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
(async () => {
  try {
    await assertEpisodeDepth('episode 1',     'ci-ep1-exc-ep1user',    'episode 1');
    await assertEpisodeDepth('first episode', 'ci-ep1-exc-firstuser',  'first episode');
    await runPart3();
  } catch (err: any) {
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed — episode excerpt cap is at 4 000 chars, no read_full_memory hint.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
})();
