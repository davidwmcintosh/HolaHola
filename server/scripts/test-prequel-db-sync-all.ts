/**
 * test-prequel-db-sync-all.ts
 *
 * Combined CI gate: runs all prequel episode DB sync checks in sequence.
 * A single failure aborts the run and exits non-zero.
 *
 * Run: npx tsx server/scripts/test-prequel-db-sync-all.ts
 *
 * To add a new prequel episode, append its script path to CHECKS below.
 */

import { execSync } from 'child_process';
import { join } from 'path';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '═'.repeat(70));

/** List of prequel episode sync scripts to run in order. */
const CHECKS: Array<{ label: string; script: string }> = [
  {
    label: 'Prequel Episode 1 — The Room Before the Room',
    script: 'server/scripts/test-prequel-episode-1-db-sync.ts',
  },
  {
    label: 'Prequel Episode 2 — The Engine and the Drift',
    script: 'server/scripts/test-prequel-episode-2-db-sync.ts',
  },
];

function runCheck(label: string, scriptPath: string): boolean {
  sep();
  console.log(B(`▶  ${label}`));
  console.log(Y(`   Script: ${scriptPath}`));
  sep();

  try {
    execSync(`npx tsx ${join(process.cwd(), scriptPath)}`, {
      stdio: 'inherit',
      env: process.env,
    });
    return true;
  } catch {
    return false;
  }
}

function main() {
  console.log(B('\n╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(B('║          PREQUEL DB SYNC — COMBINED CI GATE                         ║'));
  console.log(B('╚══════════════════════════════════════════════════════════════════════╝'));
  console.log(Y(`  Running ${CHECKS.length} prequel episode sync checks…\n`));

  let allPassed = true;
  const results: Array<{ label: string; passed: boolean }> = [];

  for (const { label, script } of CHECKS) {
    const passed = runCheck(label, script);
    results.push({ label, passed });
    if (!passed) {
      allPassed = false;
      // Keep running the rest so the operator sees the full picture.
    }
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  sep();
  console.log(B('\n  SUMMARY'));
  sep();
  for (const { label, passed } of results) {
    const icon = passed ? G('✓') : R('✗');
    console.log(`  ${icon}  ${label}`);
  }

  if (allPassed) {
    console.log(G(`\n✓  All ${CHECKS.length} prequel episode sync checks passed.\n`));
    process.exit(0);
  } else {
    const failCount = results.filter(r => !r.passed).length;
    console.log(R(`\n✗  ${failCount} of ${CHECKS.length} prequel episode sync checks FAILED.\n`));
    process.exit(1);
  }
}

main();
