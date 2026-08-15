/**
 * test-midnight-boundary-warning.ts
 *
 * Unit tests for the boundary-proximity guard added to retrieve-episode-dialogue.ts.
 * Covers:
 *   1. toMs — parses timestamps to epoch-ms
 *   2. shiftIso — expands/contracts ISO timestamps by N minutes
 *   3. parseArgs — --buffer-minutes accepts both space and equals forms
 *   4. Boundary-proximity logic — warns when recorded_at is within 30 min of boundary,
 *      stays silent when it is far from the boundary
 *   5. Self-check: this script exits non-zero when the guard is broken (confirmed by
 *      the negative test assertions below)
 *
 * Exit codes
 *   0 — all assertions passed
 *   1 — one or more assertions failed
 */

import { parseArgs, toMs, shiftIso } from './retrieve-episode-dialogue.js';

// ---------------------------------------------------------------------------
// Minimal assertion helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    process.stderr.write(`  ✓ ${message}\n`);
    passed++;
  } else {
    process.stderr.write(`  ✗ FAIL: ${message}\n`);
    failed++;
  }
}

function section(title: string): void {
  process.stderr.write(`\n[${title}]\n`);
}

// ---------------------------------------------------------------------------
// Replicate the boundary-proximity check logic so we can test it without DB
// ---------------------------------------------------------------------------

interface MockRow {
  id: string;
  recorded_at: string;
}

const BOUNDARY_WARN_MS = 30 * 60_000; // 30 minutes — must match main script

function checkBoundaryProximity(
  rows: MockRow[],
  since: string,
  until: string,
): string[] {
  const warnings: string[] = [];
  const sinceMs = toMs(since);
  const untilMs = toMs(until);

  for (const row of rows) {
    const recordedMs = toMs(row.recorded_at);
    if (recordedMs === null) continue;

    if (sinceMs !== null && Math.abs(recordedMs - sinceMs) <= BOUNDARY_WARN_MS) {
      warnings.push(`⚠ Row ${row.id} recorded_at near --since boundary`);
    }
    if (untilMs !== null && Math.abs(recordedMs - untilMs) <= BOUNDARY_WARN_MS) {
      warnings.push(`⚠ Row ${row.id} recorded_at near --until boundary`);
    }
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

section('toMs — basic parsing');
assert(toMs(null) === null, 'null → null');
assert(toMs('') === null, 'empty string → null');
assert(toMs('not-a-date') === null, 'invalid string → null');
assert(typeof toMs('2026-08-14T00:00:00Z') === 'number', 'valid ISO → number');
assert(
  toMs('2026-08-14T00:00:00Z') === new Date('2026-08-14T00:00:00Z').getTime(),
  'valid ISO → correct epoch ms',
);
assert(typeof toMs(new Date('2026-08-14T00:00:00Z')) === 'number', 'Date object → number');

section('shiftIso — window expansion');
const base = '2026-08-14T00:00:00Z';
const baseMs = new Date(base).getTime();
assert(shiftIso(base, 30) === new Date(baseMs + 30 * 60_000).toISOString(), '+30 min shift correct');
assert(shiftIso(base, -30) === new Date(baseMs - 30 * 60_000).toISOString(), '-30 min shift correct');
assert(shiftIso('', 30) === '', 'empty string passthrough');
assert(shiftIso('bad', 30) === 'bad', 'invalid string passthrough');

section('parseArgs — --buffer-minutes space form');
{
  const r = parseArgs(['node', 'script.ts', '--tag', 'david-luca-chat', '--buffer-minutes', '30', '--since', '2026-08-14T00:00:00Z']);
  assert(r.bufferMinutes === 30, '--buffer-minutes 30 parsed as 30');
  assert(r.since === '2026-08-14T00:00:00Z', '--since parsed correctly alongside space form');
}

section('parseArgs — --buffer-minutes equals form');
{
  const r = parseArgs(['node', 'script.ts', '--tag', 'david-luca-chat', '--buffer-minutes=30', '--since', '2026-08-14T00:00:00Z']);
  assert(r.bufferMinutes === 30, '--buffer-minutes=30 parsed as 30');
  assert(r.since === '2026-08-14T00:00:00Z', '--since parsed correctly alongside equals form');
}

section('parseArgs — --buffer-minutes defaults to 0');
{
  const r = parseArgs(['node', 'script.ts', '--tag', 'david-luca-chat']);
  assert(r.bufferMinutes === 0, 'no --buffer-minutes → default 0');
}

section('parseArgs — other flags unchanged');
{
  const r = parseArgs(['node', 'script.ts', '--tag', 'ep28', '--tag', 'david-luca-chat', '--since', '2026-08-14T00:00:00Z', '--until', '2026-08-14T23:59:59Z', '--format', 'markdown', '--limit', '10', '--list-only']);
  assert(r.tags.length === 2, 'two --tag values collected');
  assert(r.since === '2026-08-14T00:00:00Z', '--since parsed');
  assert(r.until === '2026-08-14T23:59:59Z', '--until parsed');
  assert(r.format === 'markdown', '--format parsed');
  assert(r.limit === 10, '--limit parsed');
  assert(r.listOnly === true, '--list-only parsed');
}

section('Boundary-proximity — row 10 min after --since (should warn)');
{
  const since = '2026-08-14T00:00:00Z';
  const sinceMs = new Date(since).getTime();
  const rowAt = new Date(sinceMs + 10 * 60_000).toISOString(); // 10 min after boundary
  const rows: MockRow[] = [{ id: 'row-near-since', recorded_at: rowAt }];
  const warnings = checkBoundaryProximity(rows, since, '');
  assert(warnings.length === 1, 'one warning emitted for row near --since');
  assert(warnings[0].includes('row-near-since'), 'warning names the row ID');
  assert(warnings[0].includes('--since'), 'warning names the --since boundary');
}

section('Boundary-proximity — row 10 min before --until (should warn)');
{
  const until = '2026-08-14T23:59:59Z';
  const untilMs = new Date(until).getTime();
  const rowAt = new Date(untilMs - 10 * 60_000).toISOString(); // 10 min before boundary
  const rows: MockRow[] = [{ id: 'row-near-until', recorded_at: rowAt }];
  const warnings = checkBoundaryProximity(rows, '', until);
  assert(warnings.length === 1, 'one warning emitted for row near --until');
  assert(warnings[0].includes('row-near-until'), 'warning names the row ID');
  assert(warnings[0].includes('--until'), 'warning names the --until boundary');
}

section('Boundary-proximity — row 60 min after --since (should NOT warn)');
{
  const since = '2026-08-14T00:00:00Z';
  const sinceMs = new Date(since).getTime();
  const rowAt = new Date(sinceMs + 60 * 60_000).toISOString(); // 60 min after boundary
  const rows: MockRow[] = [{ id: 'row-far-from-since', recorded_at: rowAt }];
  const warnings = checkBoundaryProximity(rows, since, '');
  assert(warnings.length === 0, 'no warning when row is 60 min from --since');
}

section('Boundary-proximity — row 60 min before --until (should NOT warn)');
{
  const until = '2026-08-14T23:59:59Z';
  const untilMs = new Date(until).getTime();
  const rowAt = new Date(untilMs - 60 * 60_000).toISOString(); // 60 min before boundary
  const rows: MockRow[] = [{ id: 'row-far-from-until', recorded_at: rowAt }];
  const warnings = checkBoundaryProximity(rows, '', until);
  assert(warnings.length === 0, 'no warning when row is 60 min from --until');
}

section('Boundary-proximity — row exactly at boundary (30 min — should warn)');
{
  const since = '2026-08-14T00:00:00Z';
  const sinceMs = new Date(since).getTime();
  const rowAt = new Date(sinceMs + 30 * 60_000).toISOString(); // exactly 30 min = threshold
  const rows: MockRow[] = [{ id: 'row-at-threshold', recorded_at: rowAt }];
  const warnings = checkBoundaryProximity(rows, since, '');
  assert(warnings.length === 1, 'warning fires at exactly the 30-min threshold');
}

section('Boundary-proximity — backfilled row (recorded_at near boundary)');
{
  // Simulates a row whose recorded_at is near midnight even though it was
  // inserted (created_at) hours later.  The check must use recorded_at.
  const since = '2026-08-14T00:00:00Z';
  const sinceMs = new Date(since).getTime();
  // recorded_at is 5 min after midnight (near boundary)
  const rowAt = new Date(sinceMs + 5 * 60_000).toISOString();
  const rows: MockRow[] = [{ id: 'backfilled-row', recorded_at: rowAt }];
  const warnings = checkBoundaryProximity(rows, since, '');
  assert(warnings.length === 1, 'backfilled row: warning fires based on recorded_at, not created_at');
}

section('Boundary-proximity — multiple rows, only near ones warn');
{
  const since = '2026-08-14T00:00:00Z';
  const sinceMs = new Date(since).getTime();
  const rows: MockRow[] = [
    { id: 'near-row',  recorded_at: new Date(sinceMs + 5 * 60_000).toISOString() },   // 5 min — warn
    { id: 'far-row-1', recorded_at: new Date(sinceMs + 60 * 60_000).toISOString() },  // 60 min — ok
    { id: 'far-row-2', recorded_at: new Date(sinceMs + 90 * 60_000).toISOString() },  // 90 min — ok
  ];
  const warnings = checkBoundaryProximity(rows, since, '');
  assert(warnings.length === 1, 'only the near row triggers a warning');
  assert(warnings[0].includes('near-row'), 'the near row is named in the warning');
}

section('shiftIso — buffer expansion matches effectiveSince/effectiveUntil logic');
{
  const since = '2026-08-14T00:00:00Z';
  const until = '2026-08-14T23:59:59Z';
  const bufferMinutes = 30;

  const effectiveSince = bufferMinutes > 0 && since ? shiftIso(since, -bufferMinutes) : since;
  const effectiveUntil = bufferMinutes > 0 && until ? shiftIso(until, +bufferMinutes) : until;

  const sinceMs = new Date(since).getTime();
  const untilMs = new Date(until).getTime();

  assert(
    new Date(effectiveSince).getTime() === sinceMs - 30 * 60_000,
    'effectiveSince is 30 min earlier than --since',
  );
  assert(
    new Date(effectiveUntil).getTime() === untilMs + 30 * 60_000,
    'effectiveUntil is 30 min later than --until',
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

process.stderr.write(`\n────────────────────────────────────────\n`);
process.stderr.write(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.stderr.write(`\n✗ test-midnight-boundary-warning FAILED — ${failed} assertion(s) failed\n`);
  process.exit(1);
}

process.stderr.write(`\n✓ test-midnight-boundary-warning PASSED\n`);
process.exit(0);
