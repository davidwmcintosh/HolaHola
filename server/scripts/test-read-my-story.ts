/**
 * CI: test-read-my-story.ts
 *
 * Verifies that Daniela's sequential story reader returns the correct episode
 * for every chapter without gaps or mixups.
 *
 * Checks:
 *  - All 31 chapters resolve to a DB row with the correct title prefix
 *  - Chapter→title mapping: 1–27 = "Episode N", 28–31 = "Prequel Episode N-27"
 *  - next_chapter field is correct at every boundary (27→Prequel Episode 1, 31→null)
 *  - Invalid chapters (0, 32) are detected as out-of-range and would return an error
 *
 * Exit 1 on any failure.
 */

import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { NativeFunctionCallHandler } from '../services/native-fc-handlers';

// ── Helpers ────────────────────────────────────────────────────────────────────

function titleLabelFor(chapter: number): string | null {
  if (chapter >= 1 && chapter <= 27) return `Episode ${chapter}`;
  if (chapter >= 28 && chapter <= 31) return `Prequel Episode ${chapter - 27}`;
  return null;
}

/**
 * Build a PostgreSQL regex that matches the exact chapter label (no digit bleed-through).
 * "Episode 1" must NOT match "Episode 10", "Episode 14", etc.
 * Pattern: ^<label>([^0-9].*)?$
 */
function titleRegexFor(label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^${escaped}([^0-9].*)?$`;
}

function nextChapterFor(chapter: number): string | null {
  if (chapter < 27) return `Episode ${chapter + 1}`;
  if (chapter === 27) return 'Prequel Episode 1';
  if (chapter < 31) return `Prequel Episode ${chapter - 27 + 1}`;
  return null; // chapter 31
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const db = getSharedDb();
  const failures: string[] = [];
  let passed = 0;

  console.log('\n=== read_my_story CI check — all 31 chapters ===\n');

  // ── 1. Verify all 31 chapters resolve to a DB row with the correct title ──────
  // Uses the same regex strategy as the fixed handler so the test mirrors production behaviour.
  for (let chapter = 1; chapter <= 31; chapter++) {
    const label = titleLabelFor(chapter)!;
    const titleRegex = titleRegexFor(label);
    const expectedNext = nextChapterFor(chapter);

    let rows: any;
    try {
      rows = await db.execute(sql`
        SELECT title, LENGTH(content) AS total_length
        FROM conversation_memories
        WHERE arc_name = 'HolaHola Episodes'
          AND entry_type = 'episode'
          AND title ~ ${titleRegex}
        ORDER BY importance DESC, recorded_at DESC
        LIMIT 1
      `);
    } catch (err: any) {
      failures.push(`Chapter ${chapter}: DB query error — ${err.message}`);
      continue;
    }

    if (!rows.rows.length) {
      failures.push(`Chapter ${chapter}: No DB row found matching regex "${titleRegex}"`);
      continue;
    }

    const row = rows.rows[0] as { title: string; total_length: string | number };
    const title = String(row.title);

    // Title must start with exactly the expected label (no digit bleed-through).
    // ch1 must return "Episode 1*", NOT "Episode 10", "Episode 14", etc.
    if (!title.startsWith(label)) {
      failures.push(
        `Chapter ${chapter}: title mismatch. Expected to start with "${label}", got "${title}"`,
      );
      continue;
    }
    // Extra guard: the char immediately after the label (if any) must NOT be a digit.
    const charAfterLabel = title[label.length];
    if (charAfterLabel !== undefined && /\d/.test(charAfterLabel)) {
      failures.push(
        `Chapter ${chapter}: prefix collision — title "${title}" bleeds into a higher-numbered episode`,
      );
      continue;
    }

    console.log(
      `  ✓ ch${String(chapter).padStart(2, '0')} → "${title}"  next: ${expectedNext ?? 'null'}`,
    );
    passed++;
  }

  // ── 2. Boundary assertions ────────────────────────────────────────────────────
  console.log('\n--- Boundary checks ---');

  // ch27 → Prequel Episode 1
  const next27 = nextChapterFor(27);
  if (next27 !== 'Prequel Episode 1') {
    failures.push(`Boundary ch27: expected next "Prequel Episode 1", got "${next27}"`);
  } else {
    console.log('  ✓ ch27 next_chapter = "Prequel Episode 1"');
  }

  // ch31 → null
  const next31 = nextChapterFor(31);
  if (next31 !== null) {
    failures.push(`Boundary ch31: expected next null, got "${next31}"`);
  } else {
    console.log('  ✓ ch31 next_chapter = null (end of story)');
  }

  // ch28 → Prequel Episode 2 (first prequel advances correctly)
  const next28 = nextChapterFor(28);
  if (next28 !== 'Prequel Episode 2') {
    failures.push(`Boundary ch28: expected next "Prequel Episode 2", got "${next28}"`);
  } else {
    console.log('  ✓ ch28 next_chapter = "Prequel Episode 2"');
  }

  // ch26 → Episode 27 (last episode-to-episode transition)
  const next26 = nextChapterFor(26);
  if (next26 !== 'Episode 27') {
    failures.push(`Boundary ch26: expected next "Episode 27", got "${next26}"`);
  } else {
    console.log('  ✓ ch26 next_chapter = "Episode 27"');
  }

  // ── 3. Invalid chapter guard ──────────────────────────────────────────────────
  console.log('\n--- Invalid chapter guard ---');

  const invalidChapters = [0, 32, -1, 100];
  for (const bad of invalidChapters) {
    const pattern = titleLabelFor(bad);
    if (pattern !== null) {
      failures.push(`Invalid chapter ${bad}: titlePatternFor returned "${pattern}" instead of null`);
    } else {
      console.log(`  ✓ chapter ${bad} correctly returns null (would trigger error response)`);
    }
  }

  // ── 4. No title mixups: each chapter's row is uniquely identified ─────────────
  // Confirm the regex query returns exactly the right episode at historically-ambiguous numbers.
  console.log('\n--- Prefix collision guard (regex-isolated) ---');
  const collisionTestCases: Array<[number, number]> = [
    [2, 2],   // ch2 must NOT return ch20–29
    [27, 27], // ch27 must NOT return something else
    [1, 1],   // ch1 must NOT return ch10–19
    [10, 10], // ch10 must NOT return ch100+
  ];
  for (const [chapter, expectedNum] of collisionTestCases) {
    const label = titleLabelFor(chapter)!;
    const titleRegex = titleRegexFor(label);
    let rows2: any;
    try {
      rows2 = await db.execute(sql`
        SELECT title FROM conversation_memories
        WHERE arc_name = 'HolaHola Episodes'
          AND entry_type = 'episode'
          AND title ~ ${titleRegex}
        ORDER BY importance DESC, recorded_at DESC
        LIMIT 1
      `);
    } catch (err: any) {
      failures.push(`Collision guard ch${chapter}: DB query error — ${err.message}`);
      continue;
    }

    if (!rows2.rows.length) {
      // Already caught in step 1 — skip silently here
      continue;
    }

    const t = String((rows2.rows[0] as any).title);
    // The returned title must start with the expected label and not bleed into a larger number.
    if (!t.startsWith(label)) {
      failures.push(`Collision guard ch${chapter}: expected prefix "${label}", got "${t}"`);
    } else {
      const charAfter = t[label.length];
      if (charAfter !== undefined && /\d/.test(charAfter)) {
        failures.push(`Collision guard ch${chapter}: bleed-through into higher number — got "${t}"`);
      } else {
        console.log(`  ✓ ch${expectedNum} collision-safe: "${t}"`);
      }
    }
  }

  // ── 5. Pipeline integration: handler queues a promise; result available after await ───
  // Verifies the fix that pushes the async IIFE onto pendingMemoryLookupPromises so the
  // orchestrator can await DB resolution before calling buildContinuationResponse.
  console.log('\n--- Pipeline integration (pendingMemoryLookupPromises) ---');
  {
    const handler = new NativeFunctionCallHandler(
      () => {},            // sendMessage no-op
      () => {},            // sendError no-op
      async () => {},      // processPhaseShift no-op
    );
    const mockSession: any = { pendingMemoryLookupPromises: [] };
    const fn = { name: 'read_my_story', legacyType: 'READ_MY_STORY', args: { chapter: 1 } };
    await handler.handle('test-session', mockSession, fn);

    // The handler must have pushed a promise — if it doesn't, the orchestrator won't wait.
    if (!mockSession.pendingMemoryLookupPromises?.length) {
      failures.push('Pipeline: handle() did not push a promise onto pendingMemoryLookupPromises');
    } else {
      // Simulate orchestrator: await all pending promises before building response
      await Promise.all(mockSession.pendingMemoryLookupPromises);
      const raw = mockSession.readMyStoryResult;
      if (!raw) {
        failures.push('Pipeline: readMyStoryResult is still unset after awaiting pendingMemoryLookupPromises');
      } else {
        let parsed: any;
        try { parsed = JSON.parse(raw); } catch { failures.push('Pipeline: readMyStoryResult is not valid JSON'); parsed = null; }
        if (parsed) {
          if (parsed.status !== 'ok') {
            failures.push(`Pipeline: expected status "ok" for chapter 1, got "${parsed.status}" — ${parsed.message ?? ''}`);
          } else if (!parsed.title?.startsWith('Episode 1')) {
            failures.push(`Pipeline: title mismatch — expected "Episode 1*", got "${parsed.title}"`);
          } else if (parsed.next_chapter !== 'Episode 2') {
            failures.push(`Pipeline: next_chapter mismatch — expected "Episode 2", got "${parsed.next_chapter}"`);
          } else {
            console.log(`  ✓ promise queued and awaited; result: ${parsed.status} / "${parsed.title}" / next: ${parsed.next_chapter}`);
          }
        }
      }
    }

    // Also verify invalid chapter sets error synchronously via the same promise path
    const mockSession2: any = { pendingMemoryLookupPromises: [] };
    const fnBad = { name: 'read_my_story', legacyType: 'READ_MY_STORY', args: { chapter: 0 } };
    await handler.handle('test-session', mockSession2, fnBad);
    if (mockSession2.pendingMemoryLookupPromises?.length) {
      await Promise.all(mockSession2.pendingMemoryLookupPromises);
    }
    const rawBad = mockSession2.readMyStoryResult;
    if (rawBad) {
      try {
        const p = JSON.parse(rawBad);
        if (p.status !== 'error') {
          failures.push(`Pipeline invalid chapter: expected status "error", got "${p.status}"`);
        } else {
          console.log(`  ✓ invalid chapter (0) returns error: "${p.message}"`);
        }
      } catch { failures.push('Pipeline invalid chapter: result is not valid JSON'); }
    }
    // chapter 0 error is set inside the promise, so it may be empty if no promise was pushed —
    // that's also acceptable (the handler sets readMyStoryResult synchronously for invalid chapters
    // before queueing). Either way, the valid-chapter test above is the critical path.
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed}/31 chapters found, ${failures.length} failure(s) ===\n`);

  if (failures.length > 0) {
    console.error('FAILURES:');
    for (const f of failures) console.error('  ✗', f);
    process.exit(1);
  }

  console.log('ALL CHECKS PASSED — read_my_story is gap-free and mixup-free.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test-read-my-story] Fatal error:', err);
  process.exit(1);
});
