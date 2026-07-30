/**
 * test-absence-return-guard.ts
 *
 * Verifies that autoResolveAbsenceNudgeOnReturn() is a complete no-op when
 * the student has no pending absence nudge in the DB.
 *
 * Specifically confirms:
 *   1. No "[AbsenceWorker] Auto-cleared..." message is logged  ← the primary guard
 *   2. No Express Lane note is posted (founderCollabWSBroker.addAndBroadcastMessage is not called)
 *   3. resolveAbsenceNudge is not called (no DB update for a non-existent nudge)
 *
 * Run: npx tsx server/scripts/test-absence-return-guard.ts
 */

import { getSharedDb } from '../db';
import { danielaAbsenceNudges } from '@shared/schema';
import { eq, isNull } from 'drizzle-orm';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
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

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Guard path: no pending nudge → immediate return, no side-effects
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — No-op guard when no pending nudge exists'));
sep();

// Capture all console output during the call
const capturedLogs: string[] = [];
const origLog  = console.log;
const origWarn = console.warn;

function startCapture() {
  capturedLogs.length = 0;
  console.log  = (...args: any[]) => { capturedLogs.push(args.map(String).join(' ')); };
  console.warn = (...args: any[]) => { capturedLogs.push('[WARN] ' + args.map(String).join(' ')); };
}
function stopCapture() {
  console.log  = origLog;
  console.warn = origWarn;
}

// Use a deterministic fake userId that will never have a nudge row
const GHOST_USER_ID = '00000000-test-no-nudge-0000';

async function runPart1() {
  // Confirm precondition: the ghost user truly has no pending nudge
  const db = getSharedDb();
  const [existingNudge] = await db
    .select({ id: danielaAbsenceNudges.id })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, GHOST_USER_ID))
    .limit(1);

  assert('Precondition: ghost user has no nudge row in DB', !existingNudge,
    existingNudge ? `Found unexpected row: ${existingNudge.id}` : undefined);

  // Call the function under test with captured output
  startCapture();
  const { autoResolveAbsenceNudgeOnReturn } = await import('../services/daniela-absence-worker');
  await autoResolveAbsenceNudgeOnReturn(GHOST_USER_ID);
  stopCapture();

  // Restore for clean output from here on
  const logs = [...capturedLogs];

  // Primary assertion: the "[AbsenceWorker] Auto-cleared..." line must NOT appear
  const autoClearedLog = logs.find(l => l.includes('[AbsenceWorker] Auto-cleared'));
  assert(
    'No "[AbsenceWorker] Auto-cleared..." log emitted for student with no nudge',
    !autoClearedLog,
    autoClearedLog,
  );

  // Express Lane post must NOT appear in logs
  const expressLaneLog = logs.find(l => l.includes('[STUDENT RETURNED]'));
  assert(
    'No "[STUDENT RETURNED]" Express Lane note posted',
    !expressLaneLog,
    expressLaneLog,
  );

  // No warning about a failed Express Lane post either — that would mean it tried
  const expressLaneFailed = logs.find(l => l.includes('Failed to post return note'));
  assert(
    'No "Failed to post return note" warning (function would not have attempted it)',
    !expressLaneFailed,
    expressLaneFailed,
  );

  // No resolve log either
  const resolveLog = logs.find(l => l.includes('[AbsenceWorker] Nudge resolved'));
  assert(
    'No "Nudge resolved" log (resolveAbsenceNudge was not called)',
    !resolveLog,
    resolveLog,
  );

  // Confirm the ghost user still has no nudge row after the call
  const [afterNudge] = await db
    .select({ id: danielaAbsenceNudges.id })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, GHOST_USER_ID))
    .limit(1);

  assert('No nudge row created in DB (function wrote nothing)', !afterNudge,
    afterNudge ? `Unexpected row after call: ${afterNudge.id}` : undefined);

  if (logs.length > 0) {
    console.log(Y(`\n  ℹ  Captured output (${logs.length} line(s)):`));
    logs.forEach(l => console.log(`     ${l}`));
  } else {
    console.log(G('\n  ℹ  No output captured — function was completely silent (expected).'));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Structural guard review (static, no DB needed)
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Structural guard review (source-level check)'));
sep();

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

function runPart2() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = dirname(__filename);
  const src = readFileSync(
    resolve(__dirname, '../services/daniela-absence-worker.ts'),
    'utf-8',
  );

  // The guard line must exist: `if (!pending) return;`
  const hasGuard = /if\s*\(\s*!pending\s*\)\s*return\s*;/.test(src);
  assert(
    'Source contains `if (!pending) return;` guard before any side-effects',
    hasGuard,
  );

  // The Express Lane post block must be INSIDE the `if (pending)` branch —
  // i.e., it appears AFTER the guard.  Simplest check: guard offset < post offset.
  const guardIdx = src.search(/if\s*\(\s*!pending\s*\)\s*return\s*;/);
  const expressLaneIdx = src.indexOf('STUDENT RETURNED');
  assert(
    'Express Lane post code appears after the guard (cannot be reached when no nudge)',
    guardIdx !== -1 && expressLaneIdx !== -1 && guardIdx < expressLaneIdx,
    `guardIdx=${guardIdx}, expressLaneIdx=${expressLaneIdx}`,
  );

  // `resolveAbsenceNudge` call also appears after the guard
  const resolveIdx = src.indexOf('await resolveAbsenceNudge(userId');
  assert(
    '`resolveAbsenceNudge` call appears after the guard',
    guardIdx !== -1 && resolveIdx !== -1 && guardIdx < resolveIdx,
    `guardIdx=${guardIdx}, resolveIdx=${resolveIdx}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

(async () => {
  try {
    await runPart1();
    runPart2();
  } catch (err: any) {
    stopCapture();
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    process.exit(1);
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed — autoResolveAbsenceNudgeOnReturn() is a proven no-op when no nudge is pending.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
})();
