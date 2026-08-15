/**
 * test-gl-greeting-single-fire.ts
 *
 * CI check: verifies the one-shot greeting guard that prevents Daniela from
 * repeating the same greeting three times when a GL voice session starts.
 *
 * Background (Task 1178, Aug 2026):
 *   Three retry paths can each re-fire the greeting —
 *     1. client 8s retry timer (streamingVoiceClient.requestGreeting)
 *     2. client fast-retry on an empty GL turn (sentences=0)
 *     3. server silent-greeting auto-retry (gemini-live-session turnComplete)
 *   greetingPhaseActive clears at first audio/turnComplete, so late retries
 *   slipped past the old guard and produced the triple-repeat greeting. The
 *   hasStudentInputSinceLastResponse guard suppressed the audio on spurious
 *   generations but the transcript still flushed (silent third repeat).
 *
 * The fix is a session-level ONE-SHOT guard in GeminiLiveSession:
 *   - `greetingTriggerFired` arms on every dispatch path (spoken, buffered at
 *     setupComplete, silent prime)
 *   - all external sendGreetingTrigger calls are BLOCKED once armed
 *   - only the internal silent-greeting auto-retry (which verified NO audio
 *     was produced) may bypass via opts.internalRetry
 *
 * This is a source-code scan — no DB or GL connection required.
 *
 * Run:
 *   npx tsx server/scripts/test-gl-greeting-single-fire.ts
 *   npx tsx server/scripts/test-gl-greeting-single-fire.ts --self-check
 *
 * --self-check mode: simulates removal of the guard (strips the guard lines
 * from an in-memory copy of the source) and verifies this check FAILS against
 * the mutated source. Proves the check is live, not vacuously green.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

const GL_SESSION_PATH = 'server/services/gemini-live-session.ts';

interface Assertion {
  substring: string;
  description: string;
}

const ASSERTIONS: Assertion[] = [
  {
    substring: 'private greetingTriggerFired = false;',
    description: 'One-shot flag `greetingTriggerFired` is declared on GeminiLiveSession',
  },
  {
    substring: 'if (this.greetingTriggerFired && !opts?.internalRetry) {',
    description: 'sendGreetingTrigger blocks external duplicates once the flag is armed (internalRetry-only bypass)',
  },
  {
    substring: 'sendGreetingTrigger BLOCKED — one-shot guard',
    description: 'BLOCKED log line present in the duplicate-rejection branch',
  },
  {
    substring: "'gl_greeting_duplicate_blocked'",
    description: 'Telemetry event fires when a duplicate greeting is blocked',
  },
  {
    substring: 'opts?: { internalRetry?: boolean }',
    description: 'sendGreetingTrigger signature accepts the internalRetry opts flag',
  },
  {
    substring: 'p.studentProfile, { internalRetry: true })',
    description: 'Silent-greeting auto-retry passes internalRetry:true (only sanctioned re-fire path)',
  },
];

// The flag must be armed on BOTH dispatch paths: the direct sendGreetingTrigger
// path and the buffered pendingGreetingTrigger path fired at setupComplete.
// Count occurrences of the arming statement — must be >= 2.
const ARM_STATEMENT = 'this.greetingTriggerFired = true;';
const ARM_MIN_COUNT = 2;

function runAssertions(source: string, verbose = true): number {
  let failed = 0;
  for (const { substring, description } of ASSERTIONS) {
    if (source.includes(substring)) {
      if (verbose) console.log(`  ${G('✓')} ${description}`);
    } else {
      if (verbose) {
        console.log(`  ${R('✗')} MISSING: ${description}`);
        console.log(`       Expected to find: ${JSON.stringify(substring)}`);
      }
      failed++;
    }
  }
  const armCount = source.split(ARM_STATEMENT).length - 1;
  if (armCount >= ARM_MIN_COUNT) {
    if (verbose) console.log(`  ${G('✓')} Guard is armed on ${armCount} dispatch paths (need ≥ ${ARM_MIN_COUNT}: direct + buffered-at-setupComplete)`);
  } else {
    if (verbose) console.log(`  ${R('✗')} Guard armed on only ${armCount} dispatch path(s) — need ≥ ${ARM_MIN_COUNT} (direct + buffered-at-setupComplete)`);
    failed++;
  }
  return failed;
}

function loadSource(): string {
  const fullPath = join(process.cwd(), GL_SESSION_PATH);
  if (!existsSync(fullPath)) {
    console.error(R(`✗ Source file not found: ${GL_SESSION_PATH}`));
    process.exit(1);
  }
  return readFileSync(fullPath, 'utf8');
}

function selfCheck(): void {
  sep();
  console.log(B('SELF-CHECK: verifying this CI check fails when the guard is removed'));
  sep();

  const original = loadSource();

  // Sanity: the check must PASS against the real source first.
  const realFailures = runAssertions(original, false);
  if (realFailures > 0) {
    console.error(R(`✗ Self-check aborted — the check already fails against the REAL source (${realFailures} failures). Fix the guard first.`));
    process.exit(1);
  }
  console.log(G('✓ Baseline: check passes against the real source'));

  // Mutation scenarios: each simulates a way the guard could be broken.
  const mutations: Array<{ label: string; mutate: (src: string) => string }> = [
    {
      label: 'Guard early-return branch removed from sendGreetingTrigger',
      mutate: (src) => src.replace('if (this.greetingTriggerFired && !opts?.internalRetry) {', 'if (false) {'),
    },
    {
      label: 'Flag declaration removed',
      mutate: (src) => src.replace('private greetingTriggerFired = false;', ''),
    },
    {
      label: 'internalRetry no longer passed by the auto-retry (retry becomes blockable)',
      mutate: (src) => src.replace('p.studentProfile, { internalRetry: true })', 'p.studentProfile)'),
    },
    {
      label: 'Flag arming stripped from one dispatch path',
      mutate: (src) => src.replace('this.greetingTriggerFired = true;', ''),
    },
  ];

  let selfCheckFailed = 0;
  for (const { label, mutate } of mutations) {
    const mutated = mutate(original);
    if (mutated === original) {
      console.log(`  ${R('✗')} Mutation "${label}" did not change the source — needle out of sync with code`);
      selfCheckFailed++;
      continue;
    }
    const failures = runAssertions(mutated, false);
    if (failures > 0) {
      console.log(`  ${G('✓')} Check correctly FAILS when: ${label} (${failures} assertion(s) tripped)`);
    } else {
      console.log(`  ${R('✗')} Check still PASSES when: ${label} — the check is NOT protecting this guard`);
      selfCheckFailed++;
    }
  }

  sep();
  if (selfCheckFailed === 0) {
    console.log(G('\n✓ Self-check passed: removing the guard (any of 4 ways) makes this CI check fail.\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗ Self-check FAILED: ${selfCheckFailed} mutation(s) were not caught.\n`));
    process.exit(1);
  }
}

function main(): void {
  if (process.argv.includes('--self-check')) {
    selfCheck();
    return;
  }

  sep();
  console.log(B('GL Greeting Single-Fire Guard CI Check'));
  console.log(B('Verifies the one-shot guard that prevents the triple-repeat greeting'));
  console.log(B(`Target: ${GL_SESSION_PATH}`));
  sep();

  const source = loadSource();
  console.log('');
  const failed = runAssertions(source);

  sep();
  if (failed === 0) {
    console.log(G('\n✓ All assertions passed — greeting can fire at most once per GL session open;'));
    console.log(G('  only the internal silent-greeting auto-retry may re-fire.\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗ ${failed} assertion(s) failed — the one-shot greeting guard is missing or drifted.`));
    console.log(R('  Without it, client/server retry paths can replay the greeting up to 3 times.\n'));
    process.exit(1);
  }
}

main();
