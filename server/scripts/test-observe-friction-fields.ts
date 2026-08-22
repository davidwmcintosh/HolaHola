/**
 * test-observe-friction-fields.ts
 *
 * CI guard: confirms that GET /api/admin/luca/observe always returns both
 * `frictionHistory` and `turnSummaries` fields. Task 674 added these fields;
 * this script prevents a future edit from silently dropping either one.
 *
 * Three parts:
 *
 *   PART 1 — Static: both field names appear in the observe handler inside
 *             server/routes.ts (the live response shape).
 *
 *   PART 2 — Mutation / self-check: temporarily strip `frictionHistory:` from
 *             a copy of routes.ts, run the Part-1 static check against the
 *             mutant, and assert the check exits non-zero.  A zero exit would
 *             mean the guard is too weak to catch the most obvious removal.
 *
 *   PART 3 — Same mutation test for `turnSummaries:`.
 *
 * Run: npx tsx server/scripts/test-observe-friction-fields.ts
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R  = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B  = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y  = (s: string) => `\x1b[33m${s}\x1b[0m`;
const D  = (s: string) => `\x1b[2m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n       ${R('→')} ${detail}` : ''}`);
    failed++;
  }
}

// ── File paths ────────────────────────────────────────────────────────────────
const ROUTES_FILE  = resolve(__dirname, '../routes.ts');
const MUTANT_FILE  = resolve(__dirname, '../routes.MUTANT_OBSERVE_FRICTION.ts');

// ── Shared static-analysis helper ────────────────────────────────────────────
/**
 * Returns true when BOTH frictionHistory and turnSummaries appear inside the
 * luca/observe handler block of the given source string.
 *
 * Strategy: find the handler line, then scan forward for both field names
 * within the first 400 lines of that handler.
 */
function checkObserveFields(src: string): { friction: boolean; turn: boolean } {
  const lines = src.split('\n');
  const handlerIdx = lines.findIndex(l => l.includes('luca/observe'));
  if (handlerIdx === -1) return { friction: false, turn: false };

  const window = lines.slice(handlerIdx, handlerIdx + 400).join('\n');
  return {
    friction: /frictionHistory\s*:/.test(window),
    turn:     /turnSummaries\s*:/.test(window),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Static check: both fields present in the real routes.ts
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Static: frictionHistory + turnSummaries in the observe response'));
sep();

function runPart1(): void {
  assert(
    'server/routes.ts exists',
    existsSync(ROUTES_FILE),
    'Cannot find server/routes.ts — check working directory',
  );

  const src = readFileSync(ROUTES_FILE, 'utf-8');
  const { friction, turn } = checkObserveFields(src);

  assert(
    '`frictionHistory:` key appears in the observe handler response',
    friction,
    'Missing: add `frictionHistory:` to the res.json({…}) inside GET /api/admin/luca/observe',
  );

  assert(
    '`turnSummaries:` key appears in the observe handler response',
    turn,
    'Missing: add `turnSummaries:` to the res.json({…}) inside GET /api/admin/luca/observe',
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Mutation: strip frictionHistory → static check must fail
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Mutation: strip `frictionHistory:` → static check must exit non-zero'));
sep();

function runPart2(): void {
  const src = readFileSync(ROUTES_FILE, 'utf-8');

  // Remove every line that contains "frictionHistory:" to simulate the field
  // being dropped from the observe response.
  const mutant = src
    .split('\n')
    .filter(l => !/frictionHistory\s*:/.test(l))
    .join('\n');

  const { friction: mutantFriction } = checkObserveFields(mutant);

  assert(
    '[Mutation self-check] frictionHistory is NOT found in the mutant source',
    !mutantFriction,
    'Unexpected: the field was still found after removal — the mutation did not apply correctly',
  );

  // Write mutant file and run the inline static check as a subprocess
  writeFileSync(MUTANT_FILE, mutant, 'utf-8');

  try {
    // Run a tiny inline script that imports our checkObserveFields logic and
    // exits 1 when frictionHistory is missing — mirrors what the real Part 1 does.
    const inlineScript = `
import { readFileSync } from 'fs';
const src = readFileSync(${JSON.stringify(MUTANT_FILE)}, 'utf-8');
const lines = src.split('\\n');
const handlerIdx = lines.findIndex(l => l.includes('luca/observe'));
const window = handlerIdx === -1 ? '' : lines.slice(handlerIdx, handlerIdx + 400).join('\\n');
const hasFriction = /frictionHistory\\s*:/.test(window);
if (!hasFriction) { console.log('CORRECTLY_MISSING'); process.exit(1); }
console.log('FIELD_STILL_PRESENT');
process.exit(0);
`;

    const scriptPath = resolve(__dirname, '_tmp_friction_mutant_check.mjs');
    writeFileSync(scriptPath, inlineScript, 'utf-8');

    const result = spawnSync(
      'node',
      ['--input-type=module'],
      {
        input: inlineScript,
        encoding: 'utf-8',
        timeout: 15_000,
        cwd: resolve(__dirname, '../../'),
      },
    );

    unlinkSync(scriptPath);

    const exitCode = result.status ?? -1;
    const stdout   = (result.stdout ?? '').trim();

    console.log(Y(`  ℹ  Mutant check exit code: ${exitCode}`));
    console.log(Y(`  ℹ  Mutant check stdout: ${stdout || '(empty)'}`));

    assert(
      '[Mutation self-check] Mutant exits non-zero when frictionHistory is missing',
      exitCode !== 0,
      exitCode === 0
        ? 'Exit code was 0 — the static check passes even with frictionHistory removed. Strengthen the guard.'
        : undefined,
    );

    assert(
      '[Mutation self-check] Mutant stdout contains CORRECTLY_MISSING',
      stdout.includes('CORRECTLY_MISSING'),
      stdout || '(no output)',
    );
  } finally {
    if (existsSync(MUTANT_FILE)) { try { unlinkSync(MUTANT_FILE); } catch { /* ignore */ } }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Mutation: strip turnSummaries → static check must fail
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Mutation: strip `turnSummaries:` → static check must exit non-zero'));
sep();

function runPart3(): void {
  const src = readFileSync(ROUTES_FILE, 'utf-8');

  // Remove every line that contains "turnSummaries:" to simulate the field
  // being dropped from the observe response.
  const mutant = src
    .split('\n')
    .filter(l => !/turnSummaries\s*:/.test(l))
    .join('\n');

  const { turn: mutantTurn } = checkObserveFields(mutant);

  assert(
    '[Mutation self-check] turnSummaries is NOT found in the mutant source',
    !mutantTurn,
    'Unexpected: the field was still found after removal — the mutation did not apply correctly',
  );

  // Write mutant file and run inline check via subprocess
  writeFileSync(MUTANT_FILE, mutant, 'utf-8');

  try {
    const inlineScript = `
import { readFileSync } from 'fs';
const src = readFileSync(${JSON.stringify(MUTANT_FILE)}, 'utf-8');
const lines = src.split('\\n');
const handlerIdx = lines.findIndex(l => l.includes('luca/observe'));
const window = handlerIdx === -1 ? '' : lines.slice(handlerIdx, handlerIdx + 400).join('\\n');
const hasTurn = /turnSummaries\\s*:/.test(window);
if (!hasTurn) { console.log('CORRECTLY_MISSING'); process.exit(1); }
console.log('FIELD_STILL_PRESENT');
process.exit(0);
`;

    const result = spawnSync(
      'node',
      ['--input-type=module'],
      {
        input: inlineScript,
        encoding: 'utf-8',
        timeout: 15_000,
        cwd: resolve(__dirname, '../../'),
      },
    );

    const exitCode = result.status ?? -1;
    const stdout   = (result.stdout ?? '').trim();

    console.log(Y(`  ℹ  Mutant check exit code: ${exitCode}`));
    console.log(Y(`  ℹ  Mutant check stdout: ${stdout || '(empty)'}`));

    assert(
      '[Mutation self-check] Mutant exits non-zero when turnSummaries is missing',
      exitCode !== 0,
      exitCode === 0
        ? 'Exit code was 0 — the static check passes even with turnSummaries removed. Strengthen the guard.'
        : undefined,
    );

    assert(
      '[Mutation self-check] Mutant stdout contains CORRECTLY_MISSING',
      stdout.includes('CORRECTLY_MISSING'),
      stdout || '(no output)',
    );
  } finally {
    if (existsSync(MUTANT_FILE)) { try { unlinkSync(MUTANT_FILE); } catch { /* ignore */ } }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
try {
  runPart1();
  runPart2();
  runPart3();
} catch (err: any) {
  if (existsSync(MUTANT_FILE)) { try { unlinkSync(MUTANT_FILE); } catch { /* ignore */ } }
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
}

sep();
const all = passed + failed;
if (failed === 0) {
  console.log(G(`\n✓  All ${all} assertions passed.\n`));
  console.log(D('   • frictionHistory: present in the live observe handler'));
  console.log(D('   • turnSummaries:   present in the live observe handler'));
  console.log(D('   • Mutation guard (frictionHistory) exits non-zero when the field is stripped'));
  console.log(D('   • Mutation guard (turnSummaries)   exits non-zero when the field is stripped\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗  ${failed} of ${all} assertion(s) failed — see output above.\n`));
  process.exit(1);
}
