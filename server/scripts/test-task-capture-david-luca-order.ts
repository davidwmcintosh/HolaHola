/**
 * test-task-capture-david-luca-order.ts
 *
 * Regression test: verifies that staging via .task_ref_pending (the path used by
 * POST /api/internal/task-capture-start and the companion-file write) produces a
 * David→Luca ordering in .chat_capture — both turns appended synchronously in a single
 * checkBuildSession() call, not in two separate drain batches.
 *
 * Self-check (--self-check): skips the staging step so .task_ref_pending is never
 * written, confirms only a Luca turn appears (David is absent), and exits 1.
 *
 * Run:
 *   npx tsx server/scripts/test-task-capture-david-luca-order.ts
 *   npx tsx server/scripts/test-task-capture-david-luca-order.ts --self-check
 */

import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  TASK_REF_PENDING_PATH,
  _loadTaskDescriptionText,
} from '../services/agent-session-autosave';
import {
  CHAT_TURN_START,
  CHAT_TURN_END,
  CHAT_BODY_SEP,
  appendChatCaptureTurn,
} from '../services/transcript-parser';

const WORKSPACE      = '/home/runner/workspace';
const TASKS_DIR      = join(WORKSPACE, '.local/tasks');
const DUMMY_REF      = '99991';
const DUMMY_TASK_PATH = join(TASKS_DIR, `task-${DUMMY_REF}.md`);
const COMMIT_MSG     = 'Test commit — David→Luca order regression test';
const TMP_CAPTURE    = join(WORKSPACE, '.local/.chat_capture_test_tmp');

const selfCheck = process.argv.includes('--self-check');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg: string): void {
  console.log(`PASS: ${msg}`);
}

function cleanUp(): void {
  for (const p of [DUMMY_TASK_PATH, TASK_REF_PENDING_PATH, TMP_CAPTURE]) {
    try { if (existsSync(p)) unlinkSync(p); } catch { /* ignore */ }
  }
}

/** Parse all turns from a capture file written via appendChatCaptureTurn. */
function parseTurns(filePath: string): Array<{ speaker: string; text: string }> {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, 'utf-8');
  const turns: Array<{ speaker: string; text: string }> = [];
  const blocks = raw.split(CHAT_TURN_START).filter(b => b.includes(CHAT_TURN_END));
  for (const block of blocks) {
    const endIdx = block.indexOf(CHAT_TURN_END);
    const inner  = block.slice(0, endIdx);
    const speakerMatch = inner.match(/^SPEAKER: (.+)/m);
    const sepIdx = inner.indexOf(`\n${CHAT_BODY_SEP}\n`);
    if (!speakerMatch || sepIdx === -1) continue;
    const speaker = speakerMatch[1].trim();
    const text    = inner.slice(sepIdx + CHAT_BODY_SEP.length + 2).trim();
    turns.push({ speaker, text });
  }
  return turns;
}

// Simulate what checkBuildSession() does when .task_ref_pending exists.
function simulateCheckBuildSession(commitMessage: string): void {
  if (existsSync(TASK_REF_PENDING_PATH)) {
    const rawRef = readFileSync(TASK_REF_PENDING_PATH, 'utf-8').trim();
    try { unlinkSync(TASK_REF_PENDING_PATH); } catch { /* ignore */ }
    const davidText = _loadTaskDescriptionText(rawRef);
    if (davidText) {
      appendChatCaptureTurn('David', davidText, TMP_CAPTURE);
    }
  }
  appendChatCaptureTurn('Luca Replit', commitMessage, TMP_CAPTURE);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log(`\n[test-task-capture-david-luca-order] mode=${selfCheck ? 'self-check' : 'normal'}\n`);

  if (!existsSync(TASKS_DIR)) mkdirSync(TASKS_DIR, { recursive: true });
  writeFileSync(DUMMY_TASK_PATH, [
    `# Task #${DUMMY_REF}: Regression test task`,
    '',
    'This is a synthetic task description for CI testing.',
    '',
    '## What & Why',
    'Ensures David→Luca ordering is preserved.',
  ].join('\n'), 'utf-8');

  // Ensure temp capture file is clean
  try { if (existsSync(TMP_CAPTURE)) unlinkSync(TMP_CAPTURE); } catch { /* ignore */ }

  try {
    if (selfCheck) {
      // Self-check: skip staging — .task_ref_pending is never written.
      // checkBuildSession sees no pending file → appends only the Luca turn.
      // Test MUST fail (David turn absent) → exit 1.
      simulateCheckBuildSession(COMMIT_MSG); // no .task_ref_pending written first

      const turns = parseTurns(TMP_CAPTURE);
      const davidIdx = turns.findIndex(t => t.speaker === 'David');
      if (davidIdx !== -1) {
        console.error('SELF-CHECK UNEXPECTED: David turn present even without staging — guard may be inverted');
        process.exit(1);
      }
      // Correct self-check outcome: David is absent
      console.error('SELF-CHECK PASS: David turn absent when staging is skipped → test exits 1 as expected');
      process.exit(1);
    }

    // ── Normal mode ──────────────────────────────────────────────────────────

    // Step 1: Validate task file is loadable and body is correct
    const davidText = _loadTaskDescriptionText(DUMMY_REF);
    if (!davidText) fail('_loadTaskDescriptionText returned null for dummy task file');
    if (!davidText.startsWith(`Task #${DUMMY_REF}:`)) fail('David text missing "Task #ref:" prefix');
    if (!davidText.includes('synthetic task description')) fail('David text missing task body');
    // Section headings must be preserved (only first heading is stripped)
    if (!davidText.includes('## What & Why')) fail('David text stripped section headings — only first heading should be removed');
    pass(`_loadTaskDescriptionText: "${davidText.slice(0, 80).replace(/\n/g, '↵')}..."`);

    // Step 2: Stage via .task_ref_pending (simulates both HTTP endpoint and companion-file paths)
    writeFileSync(TASK_REF_PENDING_PATH, DUMMY_REF, 'utf-8');
    if (!existsSync(TASK_REF_PENDING_PATH)) fail('.task_ref_pending was not created');
    pass(`.task_ref_pending staged with ref=${DUMMY_REF}`);

    // Step 3: Simulate checkBuildSession — should consume .task_ref_pending and write both turns
    simulateCheckBuildSession(COMMIT_MSG);

    if (existsSync(TASK_REF_PENDING_PATH)) fail('.task_ref_pending was not consumed by simulateCheckBuildSession');
    pass('.task_ref_pending consumed');

    // Step 4: Parse the turns from the temp capture file
    const turns = parseTurns(TMP_CAPTURE);
    if (turns.length < 2) fail(`Expected ≥2 turns, got ${turns.length}: ${JSON.stringify(turns)}`);

    // Step 5: Verify David→Luca ordering
    const davidIdx = turns.findIndex(t => t.speaker === 'David');
    const lucaIdx  = turns.findIndex(t => t.speaker === 'Luca Replit');
    if (davidIdx === -1) fail('No David turn found');
    if (lucaIdx  === -1) fail('No Luca Replit turn found');
    if (davidIdx >= lucaIdx) {
      fail(`Ordering wrong: David at ${davidIdx}, Luca Replit at ${lucaIdx} — expected David < Luca`);
    }
    pass(`David (idx=${davidIdx}) before Luca Replit (idx=${lucaIdx}) ✓`);

    // Step 6: Verify content
    if (!turns[davidIdx].text.includes(`Task #${DUMMY_REF}`)) {
      fail(`David turn missing task ref — got: ${turns[davidIdx].text.slice(0, 120)}`);
    }
    if (!turns[lucaIdx].text.includes(COMMIT_MSG)) {
      fail(`Luca turn missing commit message — got: ${turns[lucaIdx].text.slice(0, 120)}`);
    }
    pass('Turn content correct ✓');

    console.log('\n[test-task-capture-david-luca-order] ALL CHECKS PASSED ✓\n');
    process.exit(0);
  } finally {
    cleanUp();
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
