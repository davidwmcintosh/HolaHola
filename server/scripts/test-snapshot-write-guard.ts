/**
 * test-snapshot-write-guard.ts
 *
 * CI check: verifies that the three sync scripts that could potentially touch
 * conversation_memories rows all contain an explicit guard that blocks writes
 * to the sealed Episode 28 snapshot ID.
 *
 * Snapshot DB ID : 28000000-0001-4000-8000-000000000028
 *   Arc          : HolaHola Episode Snapshots (read-only after sealing)
 *   Sealed       : August 12 2026
 *
 * This is a source-code scan — no DB connection required.  It reads each
 * script and verifies:
 *   1. The snapshot ID constant is present in the source.
 *   2. A rejection / block branch references that constant.
 *
 * If any guard is missing this check exits 1, which blocks CI.
 *
 * Run:
 *   npx tsx server/scripts/test-snapshot-write-guard.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// The sealed snapshot ID that must never be targeted by write operations.
const SNAPSHOT_ID = '28000000-0001-4000-8000-000000000028';

interface ScriptGuardSpec {
  /** Human-readable label for output. */
  label: string;
  /** Path relative to project root. */
  path: string;
  /**
   * Substrings that must ALL be present in the source to confirm the guard
   * exists.  Each entry is checked independently so failure output pinpoints
   * the missing piece.
   */
  requiredSubstrings: Array<{ substring: string; description: string }>;
}

const SCRIPTS: ScriptGuardSpec[] = [
  {
    label: 'restore-episode-28-from-db.ts',
    path: 'server/scripts/restore-episode-28-from-db.ts',
    requiredSubstrings: [
      {
        substring: SNAPSHOT_ID,
        description: `Snapshot ID constant (${SNAPSHOT_ID}) must be declared`,
      },
      {
        substring: 'SNAPSHOT_ID as string)',
        description: 'Guard expression: (EPISODE_ID as string) === (SNAPSHOT_ID as string)',
      },
      {
        substring: 'BLOCKED',
        description: 'BLOCKED rejection message must be present',
      },
    ],
  },
  {
    label: 'restore-rolling-episodes-from-db.ts',
    path: 'server/scripts/restore-rolling-episodes-from-db.ts',
    requiredSubstrings: [
      {
        substring: SNAPSHOT_ID,
        description: `Snapshot ID constant (${SNAPSHOT_ID}) must be declared`,
      },
      {
        substring: 'id === SNAPSHOT_WRITE_GUARD_ID',
        description: 'Guard expression: id === SNAPSHOT_WRITE_GUARD_ID (in forcePushMdToDb)',
      },
      {
        substring: 'BLOCKED: forcePushMdToDb was called with the sealed snapshot ID',
        description: 'BLOCKED message in forcePushMdToDb',
      },
      {
        substring: 'BLOCKED: checkAndRestore was called with the sealed snapshot ID',
        description: 'BLOCKED message in checkAndRestore',
      },
    ],
  },
  {
    label: 'sync-episode-28-to-db.ts',
    path: 'server/scripts/sync-episode-28-to-db.ts',
    requiredSubstrings: [
      {
        substring: SNAPSHOT_ID,
        description: `Snapshot ID constant (${SNAPSHOT_ID}) must be declared`,
      },
      {
        substring: 'SNAPSHOT_ID as string)',
        description: 'Guard expression: (EPISODE_28_ID as string) === (SNAPSHOT_ID as string)',
      },
      {
        substring: 'BLOCKED',
        description: 'BLOCKED rejection message must be present',
      },
    ],
  },
];

function checkScript(spec: ScriptGuardSpec): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  const fullPath = join(process.cwd(), spec.path);

  if (!existsSync(fullPath)) {
    console.log(`  ${R('✗')} Script file not found: ${spec.path}`);
    failed++;
    return { passed, failed };
  }

  let source: string;
  try {
    source = readFileSync(fullPath, 'utf8');
  } catch (err: any) {
    console.log(`  ${R('✗')} Could not read ${spec.path}: ${err?.message ?? err}`);
    failed++;
    return { passed, failed };
  }

  for (const { substring, description } of spec.requiredSubstrings) {
    if (source.includes(substring)) {
      console.log(`  ${G('✓')} ${description}`);
      passed++;
    } else {
      console.log(`  ${R('✗')} MISSING: ${description}`);
      console.log(`       Expected to find: ${JSON.stringify(substring)}`);
      failed++;
    }
  }

  return { passed, failed };
}

async function main() {
  sep();
  console.log(B('Episode 28 Snapshot Write-Guard CI Check'));
  console.log(B(`Snapshot ID  : ${SNAPSHOT_ID}`));
  console.log(B('Verifying that all sync scripts contain explicit write-guards'));
  console.log(B('that prevent overwriting the sealed snapshot row.'));
  sep();

  let totalPassed = 0;
  let totalFailed = 0;

  for (const spec of SCRIPTS) {
    console.log('');
    console.log(Y(`Checking: ${spec.label}`));
    const { passed, failed } = checkScript(spec);
    totalPassed += passed;
    totalFailed += failed;
  }

  sep();
  const total = totalPassed + totalFailed;
  if (totalFailed === 0) {
    console.log(G(`\n✓  All ${total} assertions passed.`));
    console.log(G('   Every sync script has an explicit guard blocking writes to'));
    console.log(G(`   the sealed snapshot ID (${SNAPSHOT_ID}).\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${totalFailed} of ${total} assertions failed.`));
    console.log(R('   One or more sync scripts are MISSING the snapshot write-guard.'));
    console.log(R('   Add the guard before shipping to prevent silent snapshot corruption.\n'));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
});
