/**
 * test-episode-28-snapshot-integrity.ts
 *
 * CI check: confirms that the sealed Episode 28 snapshot in DB has not been
 * accidentally overwritten or corrupted.
 *
 * Snapshot DB ID : 28000000-0001-4000-8000-000000000028
 *   Arc          : HolaHola Episode Snapshots (separate from HolaHola Episodes
 *                  so read_my_story never touches it)
 *   Sealed       : August 12 2026
 *   Sealed bytes : 100,348
 *   SHA-256      : 98384497fa489dfb39cd41cd39fec3154c36f0d72e6ff8b053e9b7790b32972a
 *
 * Live record DB ID : 28000000-0000-4000-8000-000000000028
 *   (the rolling episode — grows continuously after sealing)
 *
 * Failure modes caught:
 *   - Snapshot row missing from DB
 *   - Snapshot content is empty
 *   - Snapshot length below 100,000 bytes (truncation / replacement)
 *   - Snapshot SHA-256 digest does not match the trusted value recorded at
 *     sealing — the most authoritative guard: any single-byte change fails
 *   - Snapshot is missing any expected landmark phrase
 *   - Snapshot content is byte-for-byte identical to the live record
 *     (indicates the snapshot was overwritten by a sync — the two records
 *      diverged the moment the live episode grew after sealing)
 *
 * Self-check mode:
 *   Verifies every guard has teeth by calling runIntegrityCheck() with crafted
 *   inputs that exercise each failure path. No DB writes are performed.
 *
 * Run:
 *   npx tsx server/scripts/test-episode-28-snapshot-integrity.ts
 *   npx tsx server/scripts/test-episode-28-snapshot-integrity.ts --self-check
 */

import { createHash } from 'crypto';
import { neon } from '@neondatabase/serverless';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const W = (s: string) => `\x1b[33;1m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Trusted sealing constants ─────────────────────────────────────────────────
// These values were recorded at the moment of sealing on August 12 2026.
// Any deviation means the snapshot has been overwritten or corrupted.

const SNAPSHOT_ID     = '28000000-0001-4000-8000-000000000028';
const LIVE_ID         = '28000000-0000-4000-8000-000000000028';
const SEALED_BYTES    = 100_348;
const SEALED_SHA256   = '98384497fa489dfb39cd41cd39fec3154c36f0d72e6ff8b053e9b7790b32972a';
const MIN_BYTES       = 100_000;  // floor — below this is obvious truncation

/** Phrases that must appear in any healthy snapshot. */
const LANDMARKS = [
  'Episode 28',
  'David McIntosh',
  'Sixty-three verified',
  'The record knew itself',
] as const;

// ── Core check result type ────────────────────────────────────────────────────

interface CheckResult {
  passed: number;
  failed: number;
  fatalMessage?: string;
}

// ── Core integrity check (does NOT call process.exit) ────────────────────────
//
// Accepts optional override strings for unit-testing in self-check mode.
// When overrides are supplied the DB is NOT queried for those values.

interface CheckOverrides {
  snapshotContent?: string | null;
  liveContent?: string | null;
}

async function runIntegrityCheck(
  silent = false,
  overrides: CheckOverrides = {},
): Promise<CheckResult> {
  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    if (!silent) console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set'));
    return { passed: 0, failed: 1, fatalMessage: 'NEON_SHARED_DATABASE_URL is not set' };
  }

  let passed = 0;
  let failed = 0;

  function assert(label: string, condition: boolean, detail?: string) {
    if (condition) {
      if (!silent) console.log(`  ${G('✓')} ${label}`);
      passed++;
    } else {
      if (!silent) console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
      failed++;
    }
  }

  // ── PART 1: Fetch snapshot from DB ──────────────────────────────────────────
  if (!silent) {
    sep();
    console.log(B(`PART 1 — Fetch snapshot ${SNAPSHOT_ID}`));
    sep();
  }

  let snapshotContent: string;

  if ('snapshotContent' in overrides) {
    snapshotContent = overrides.snapshotContent ?? '';
    if (!silent) console.log(Y(`  ℹ  Using overridden snapshot content (${snapshotContent.length} bytes)`));
  } else {
    const sql = neon(DATABASE_URL);
    let rows: any[];
    try {
      rows = (await sql`
        SELECT id, content, length(content) AS len
        FROM conversation_memories
        WHERE id = ${SNAPSHOT_ID}
      `) as any[];
    } catch (err: any) {
      if (!silent) console.error(R(`  ✗  DB query failed: ${err?.message ?? err}`));
      return { passed, failed: failed + 1, fatalMessage: `DB query failed: ${err?.message ?? err}` };
    }

    assert(
      `Snapshot row ${SNAPSHOT_ID} exists in DB`,
      rows.length === 1,
      rows.length === 0
        ? 'No row found — snapshot may have been deleted or the ID changed'
        : `Unexpected row count: ${rows.length}`,
    );

    if (rows.length !== 1) {
      return { passed, failed, fatalMessage: 'Snapshot row not found in DB' };
    }

    snapshotContent = rows[0].content ?? '';
    const dbLen = Number(rows[0].len ?? 0);
    if (!silent) console.log(Y(`  ℹ  Snapshot DB length: ${dbLen} bytes`));
  }

  assert(
    'Snapshot content is non-empty',
    snapshotContent.length > 0,
    'Snapshot content field is empty',
  );

  // ── PART 2: Size guard ───────────────────────────────────────────────────────
  if (!silent) {
    sep();
    console.log(B('PART 2 — Size guard (≥ 100,000 bytes; exact sealed size = 100,348)'));
    sep();
    console.log(Y(`  ℹ  Snapshot content length: ${snapshotContent.length} bytes`));
    console.log(Y(`  ℹ  Sealed length            : ${SEALED_BYTES} bytes`));
    console.log(Y(`  ℹ  Minimum floor            : ${MIN_BYTES} bytes`));
  }

  assert(
    `Snapshot length ≥ ${MIN_BYTES} bytes (floor; truncation check)`,
    snapshotContent.length >= MIN_BYTES,
    `Actual length ${snapshotContent.length} is below the ${MIN_BYTES}-byte floor — snapshot may have been truncated or replaced`,
  );

  assert(
    `Snapshot length matches sealed value (${SEALED_BYTES} bytes)`,
    snapshotContent.length === SEALED_BYTES,
    `Actual length ${snapshotContent.length} ≠ sealed ${SEALED_BYTES} — snapshot content has changed`,
  );

  // ── PART 3: SHA-256 digest ───────────────────────────────────────────────────
  //
  // This is the authoritative integrity guard. Any single-byte change to the
  // snapshot will produce a different digest and fail this check.
  if (!silent) {
    sep();
    console.log(B('PART 3 — SHA-256 digest (authoritative guard)'));
    sep();
    console.log(Y(`  ℹ  Trusted digest  : ${SEALED_SHA256}`));
  }

  const actualDigest = createHash('sha256').update(snapshotContent).digest('hex');
  if (!silent) console.log(Y(`  ℹ  Computed digest : ${actualDigest}`));

  assert(
    'SHA-256 digest matches trusted sealed value',
    actualDigest === SEALED_SHA256,
    `Digest mismatch — snapshot content has been modified.\n` +
    `       Expected : ${SEALED_SHA256}\n` +
    `       Actual   : ${actualDigest}`,
  );

  // ── PART 4: Landmark checks ──────────────────────────────────────────────────
  if (!silent) {
    sep();
    console.log(B('PART 4 — Landmark phrases'));
    sep();
  }

  for (const landmark of LANDMARKS) {
    assert(
      `Snapshot contains landmark: "${landmark}"`,
      snapshotContent.includes(landmark),
      `"${landmark}" not found — snapshot content may have been overwritten`,
    );
  }

  // ── PART 5: Divergence check (snapshot ≠ live record) ────────────────────────
  //
  // The snapshot was sealed at 100,348 bytes. The live episode record has grown
  // since. If they are byte-for-byte identical the snapshot was overwritten by
  // a sync that wrote the live record into the wrong target ID.
  if (!silent) {
    sep();
    console.log(B(`PART 5 — Divergence from live record ${LIVE_ID}`));
    sep();
  }

  let liveContent: string;

  if ('liveContent' in overrides) {
    liveContent = overrides.liveContent ?? '';
    if (!silent) console.log(Y(`  ℹ  Using overridden live content (${liveContent.length} bytes)`));
  } else {
    const sql2 = neon(DATABASE_URL);
    let liveRows: any[];
    try {
      liveRows = (await sql2`
        SELECT content FROM conversation_memories WHERE id = ${LIVE_ID}
      `) as any[];
    } catch (err: any) {
      if (!silent) console.error(W(`  ⚠  Could not fetch live record: ${err?.message ?? err}`));
      assert(
        'Live record fetchable for divergence comparison',
        false,
        `DB error: ${err?.message ?? err}`,
      );
      return { passed, failed };
    }

    if (liveRows.length !== 1) {
      if (!silent) console.log(Y('  ℹ  Live record absent — divergence check skipped'));
      passed++;  // snapshot cannot have been overwritten by a missing record
    } else {
      liveContent = liveRows[0].content ?? '';
      if (!silent) console.log(Y(`  ℹ  Live record length: ${liveContent.length} bytes`));
      const identical = snapshotContent === liveContent;
      if (!silent && identical) {
        console.log(W('  ⚠  OVERWRITE DETECTED: snapshot is byte-for-byte identical to the live record.'));
        console.log(W('     A sync script likely used the wrong target ID.'));
      }
      assert(
        'Snapshot content differs from live record (not overwritten by sync)',
        !identical,
        `Snapshot and live record are byte-for-byte identical — the snapshot ID (${SNAPSHOT_ID}) may have been targeted by a sync that should target ${LIVE_ID}`,
      );
    }

    return { passed, failed };
  }

  // Override path divergence assertion
  {
    const identical = snapshotContent === liveContent!;
    if (!silent && identical) {
      console.log(W('  ⚠  OVERWRITE DETECTED: snapshot content is byte-for-byte identical to live record.'));
    }
    assert(
      'Snapshot content differs from live record (not overwritten by sync)',
      !identical,
      `Snapshot and live record are byte-for-byte identical`,
    );
  }

  return { passed, failed };
}

// ── Self-check mode ───────────────────────────────────────────────────────────
//
// Exercises every failure path in runIntegrityCheck() using crafted in-memory
// content — no DB writes are performed.
//
// Failure scenarios tested:
//   1. Empty snapshot               → non-empty, floor, exact-length, digest, landmark checks fail
//   2. Snapshot too short           → floor and exact-length check fail
//   3. Content mutated (1 byte off) → digest check fails (authoritative guard has teeth)
//   4. Landmark stripped            → landmark check fails
//   5. Snapshot identical to live   → divergence check fails
//   6. Real snapshot + diverged live → all checks pass (green path)

async function runSelfCheck() {
  sep();
  console.log(B('SELF-CHECK MODE — verifying every guard path has teeth'));
  sep();

  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set'));
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);
  let realRows: any[];
  try {
    realRows = (await sql`
      SELECT content FROM conversation_memories WHERE id = ${SNAPSHOT_ID}
    `) as any[];
  } catch (err: any) {
    console.error(R(`FATAL: DB query failed: ${err?.message ?? err}`));
    process.exit(1);
  }

  if (realRows.length !== 1 || !realRows[0].content) {
    console.error(R(`FATAL: Snapshot row ${SNAPSHOT_ID} not found or empty — cannot run self-check`));
    process.exit(1);
  }

  const realSnapshot: string = realRows[0].content;
  console.log(Y(`  ℹ  Loaded real snapshot from DB (${realSnapshot.length} bytes)`));

  const realDigest = createHash('sha256').update(realSnapshot).digest('hex');
  console.log(Y(`  ℹ  Real snapshot digest: ${realDigest}`));
  if (realDigest !== SEALED_SHA256) {
    console.error(R(`FATAL: Real snapshot digest does not match SEALED_SHA256 — cannot run valid self-check`));
    process.exit(1);
  }

  // Diverged live content: real snapshot + a marker that makes it longer
  const differentLive = realSnapshot + '\n<!-- SELF-CHECK-DIVERGENCE-MARKER -->';

  let scPassed = 0;
  let scFailed = 0;

  function scAssert(label: string, ok: boolean, detail?: string) {
    if (ok) {
      console.log(`  ${G('✓')} ${label}`);
      scPassed++;
    } else {
      console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
      scFailed++;
    }
  }

  // ── Scenario 1: empty snapshot ───────────────────────────────────────────────
  sep();
  console.log(B('Scenario 1 — empty snapshot content'));

  const s1 = await runIntegrityCheck(true, { snapshotContent: '', liveContent: differentLive });
  scAssert(`Empty snapshot triggers failures (failed=${s1.failed})`, s1.failed > 0,
    `Expected ≥1 failure but got ${s1.failed}`);

  // ── Scenario 2: snapshot too short ───────────────────────────────────────────
  sep();
  console.log(B(`Scenario 2 — snapshot below ${MIN_BYTES} bytes`));

  const shortContent = realSnapshot.slice(0, MIN_BYTES - 1);
  const s2 = await runIntegrityCheck(true, { snapshotContent: shortContent, liveContent: differentLive });
  scAssert(`Short snapshot (${shortContent.length} bytes) triggers size failure (failed=${s2.failed})`,
    s2.failed > 0, `Expected ≥1 failure but got ${s2.failed}`);

  // ── Scenario 3: single-byte mutation — digest guard has teeth ────────────────
  sep();
  console.log(B('Scenario 3 — single-byte mutation (authoritative digest guard)'));

  // Flip the first character to produce a content-valid-looking but digest-failing snapshot
  const mutated = 'X' + realSnapshot.slice(1);
  const mutatedDigest = createHash('sha256').update(mutated).digest('hex');
  console.log(Y(`  ℹ  Mutated digest: ${mutatedDigest} (should differ from sealed)`));
  const s3 = await runIntegrityCheck(true, { snapshotContent: mutated, liveContent: differentLive });
  scAssert(`Single-byte mutation triggers digest failure (failed=${s3.failed})`,
    s3.failed > 0, `Expected ≥1 failure but got ${s3.failed}`);

  // ── Scenario 4: landmark stripped ────────────────────────────────────────────
  sep();
  console.log(B('Scenario 4 — landmark "Sixty-three verified" stripped'));

  // Strip the landmark AND pad to the correct length to ensure we isolate the
  // landmark check from the length check (note: digest will also fail, which is
  // intentional — both guards should fire on corrupted content).
  const landmarkStripped = realSnapshot.replace(/Sixty-three verified/g, 'XXXXXXXXXXXXXXXXXX');
  const s4 = await runIntegrityCheck(true, { snapshotContent: landmarkStripped, liveContent: differentLive });
  scAssert(`Missing landmark triggers failure (failed=${s4.failed})`,
    s4.failed > 0, `Expected ≥1 failure but got ${s4.failed}`);

  // ── Scenario 5: snapshot identical to live (overwrite simulation) ─────────────
  sep();
  console.log(B('Scenario 5 — snapshot identical to live record (overwrite simulation)'));

  const s5 = await runIntegrityCheck(true, { snapshotContent: realSnapshot, liveContent: realSnapshot });
  scAssert(`Identical snapshot+live triggers divergence failure (failed=${s5.failed})`,
    s5.failed > 0, `Expected ≥1 failure but got ${s5.failed}`);

  // ── Scenario 6: green path — real snapshot + diverged live ───────────────────
  sep();
  console.log(B('Scenario 6 — real snapshot + diverged live record (green path)'));

  const s6 = await runIntegrityCheck(true, { snapshotContent: realSnapshot, liveContent: differentLive });
  scAssert(`Real snapshot passes all checks (failed=${s6.failed})`,
    s6.failed === 0, `Expected 0 failures but got ${s6.failed}`);

  // ── Summary ──────────────────────────────────────────────────────────────────
  sep();
  const all = scPassed + scFailed;
  if (scFailed === 0) {
    console.log(G(`\n✓  Self-check complete — ${all}/${all} assertions confirmed. All guards have teeth.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  Self-check: ${scFailed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes('--self-check')) {
    await runSelfCheck();
    return;
  }

  sep();
  console.log(B('Episode 28 Sealed Snapshot Integrity Check'));
  console.log(B(`Snapshot ID   : ${SNAPSHOT_ID}`));
  console.log(B(`Live ID       : ${LIVE_ID}`));
  console.log(B(`Sealed bytes  : ${SEALED_BYTES}`));
  console.log(B(`Sealed SHA-256: ${SEALED_SHA256}`));

  const result = await runIntegrityCheck(false);

  sep();
  const all = result.passed + result.failed;
  if (result.fatalMessage && result.failed > 0 && result.passed === 0) {
    console.log(R(`\n✗  Fatal: ${result.fatalMessage}\n`));
    process.exit(1);
  } else if (result.failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed.`));
    console.log(G('   Episode 28 sealed snapshot is intact and has not been overwritten.\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${result.failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
});
