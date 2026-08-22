/**
 * test-luca-auto-capture-episode.ts
 *
 * CI check: confirms that a .luca_auto_capture exchange reaches the canonical
 * episode DB row first, then its exact Markdown replica.
 *
 * This check is deliberately hermetic. Each invocation owns a uniquely named
 * fixture episode row, fixture Markdown mirror, trigger, and status outputs.
 * It never reads, writes, snapshots, or cleans up the live rolling episode,
 * .local/.luca_auto_capture, or live capture-status files.
 *
 * Normal mode verifies:
 *   temp trigger → checkAutoCapture() → fixture conversation_memories row
 *   → exact fixture Markdown replica.
 *
 * Self-check mode disables the episode-routing seam, modeling removal of the
 * appendExchangeToEpisode() call. The sentinel must remain absent from both
 * fixture representations, proving the normal-mode assertions are load-bearing.
 *
 * Run:
 *   npx tsx server/scripts/test-luca-auto-capture-episode.ts
 *   npx tsx server/scripts/test-luca-auto-capture-episode.ts --self-check
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { sql } from 'drizzle-orm';

import { getUserDb } from '../db';
import {
  checkAutoCapture,
  setAutoCaptureDbEnabled,
  setAutoCaptureEpisodeEnabled,
  setAutoCaptureTriggerPathOverrideForTest,
  setCaptureStatusPathOverrideForTest,
  setInnerLifeReembedEnabled,
  setPinnedRollingEpisodeFilename,
  setStaleChannelAlertPathOverrideForTest,
} from '../services/agent-session-autosave';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

const WORKSPACE = process.cwd();
const DOCS_DIR = join(WORKSPACE, 'docs');
const ARC_NAME = 'HolaHola Episodes';
const selfCheckMode = process.argv.includes('--self-check');

let passed = 0;
let failed = 0;

function assert(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
    failed++;
  }
}

function removeOwnedFixtureMarkdownIfPresent(path: string, fixtureTag: string): void {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf-8');
  if (!content.includes(fixtureTag)) {
    throw new Error(`Refusing to remove unowned fixture path: ${path}`);
  }
  unlinkSync(path);
}

function resetSeams(): void {
  setAutoCaptureDbEnabled(true);
  setAutoCaptureEpisodeEnabled(true);
  setAutoCaptureTriggerPathOverrideForTest(null);
  setCaptureStatusPathOverrideForTest(null);
  setInnerLifeReembedEnabled(true);
  setPinnedRollingEpisodeFilename(null);
  setStaleChannelAlertPathOverrideForTest(null);
}

async function run(): Promise<void> {
  const mode = selfCheckMode ? 'SELF-CHECK' : 'NORMAL';
  console.log(B(`\n━━━ test-luca-auto-capture-episode [${mode}] ━━━`));
  console.log(Y('  Fixture DB row + temp trigger only; the live episode and trigger are untouched.\n'));

  const db = getUserDb();
  const runId = `${Date.now()}-${process.pid}-${randomUUID().slice(0, 8)}`;
  const runTag = `CI-AUTO-CAPTURE-${runId}`;
  const fixtureTag = `ci-auto-capture-episode-fixture-${runId}`;
  const fixtureTitle = `ci-auto-capture-${runId}`;
  const fixtureFile = `${fixtureTitle}.md`;
  const fixtureMdPath = join(DOCS_DIR, fixtureFile);
  const initialContent = [
    `# ${fixtureTitle}`,
    '',
    `<!-- ${fixtureTag} -->`,
    'Owned fixture for test-luca-auto-capture-episode.ts.',
    '',
  ].join('\n');
  const triggerPath = join(tmpdir(), `.luca-auto-capture-${runId}.json`);
  const captureStatusPath = join(tmpdir(), `.luca-auto-capture-status-${runId}.md`);
  const staleAlertPath = join(tmpdir(), `.luca-auto-capture-alert-${runId}.md`);
  let fixtureRowId = '';

  try {
    sep();
    console.log(B('STEP 1 — Create owned fixture episode'));
    sep();

    mkdirSync(DOCS_DIR, { recursive: true });

    const inserted = await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
      VALUES (
        gen_random_uuid(),
        ${fixtureTitle},
        'CI fixture — auto-capture episode routing',
        ${initialContent},
        'Luca + CI',
        ARRAY[${fixtureTag}]::text[],
        3,
        NOW(),
        'episode',
        ${ARC_NAME}
      )
      RETURNING id
    `);
    const row = (inserted as any).rows?.[0] ?? (inserted as any)[0];
    fixtureRowId = row?.id ?? '';
    assert('Fixture episode row inserted', Boolean(fixtureRowId));

    writeFileSync(fixtureMdPath, initialContent, 'utf-8');
    assert('Fixture Markdown mirror created', existsSync(fixtureMdPath));

    sep();
    console.log(B('STEP 2 — Route a temp auto-capture trigger'));
    sep();

    const davidText = `[${runTag}] synthetic David turn`;
    const lucaText = `[${runTag}] synthetic Luca response`;
    const expectedExchange = `DAVID: ${davidText}\n\nLUCA [Replit]: ${lucaText}`;

    setAutoCaptureTriggerPathOverrideForTest(triggerPath);
    setCaptureStatusPathOverrideForTest(captureStatusPath);
    setStaleChannelAlertPathOverrideForTest(staleAlertPath);
    setPinnedRollingEpisodeFilename(fixtureFile);
    setAutoCaptureDbEnabled(false); // do not touch the shared chat-capture stream
    setInnerLifeReembedEnabled(false); // no embeddings for a disposable fixture row
    setAutoCaptureEpisodeEnabled(!selfCheckMode);

    writeFileSync(triggerPath, JSON.stringify({ david: davidText, luca: lucaText }), 'utf-8');
    await checkAutoCapture();

    assert('Owned temp trigger was consumed', !existsSync(triggerPath));

    const result = await db.execute(sql`
      SELECT content FROM conversation_memories WHERE id = ${fixtureRowId}
    `);
    const resultRow = (result as any).rows?.[0] ?? (result as any)[0];
    const dbContent = typeof resultRow?.content === 'string' ? resultRow.content : '';
    const mdContent = existsSync(fixtureMdPath) ? readFileSync(fixtureMdPath, 'utf-8') : '';
    const sentinelInDb = dbContent.includes(runTag);
    const sentinelInMd = mdContent.includes(runTag);

    sep();
    console.log(B('STEP 3 — Verify DB-first behavior'));
    sep();

    if (selfCheckMode) {
      assert(
        'Sentinel is absent from the fixture DB row when episode routing is disabled',
        !sentinelInDb,
        'SELF-CHECK BROKEN — the disabled episode route still changed canonical content.',
      );
      assert(
        'Fixture Markdown remains the original canonical content when routing is disabled',
        dbContent === initialContent && mdContent === initialContent,
        'Episode route changed the fixture despite the self-check seam.',
      );
      assert(
        'Normal-mode assertion would fail when episode routing is bypassed',
        !sentinelInMd,
        'Sentinel must be absent to prove normal mode would catch this regression.',
      );
    } else {
      assert(
        'Sentinel is persisted in the fixture episode DB row',
        sentinelInDb && dbContent.includes(expectedExchange),
        'Canonical fixture row did not receive the auto-capture exchange.',
      );
      assert(
        'Sentinel is projected into the fixture Markdown replica',
        sentinelInMd && mdContent.includes(expectedExchange),
        'Fixture Markdown did not receive the canonical exchange.',
      );
      assert(
        'Fixture Markdown exactly matches the canonical DB row',
        mdContent === dbContent,
        'The replica differs from canonical DB content.',
      );
      assert(
        'Capture status is written only to this run’s private path',
        existsSync(captureStatusPath),
        'The DB-first append did not use the private capture-status seam.',
      );
    }
  } finally {
    sep();
    console.log(B('CLEANUP — remove only owned fixture resources'));
    sep();

    resetSeams();

    try {
      if (existsSync(triggerPath)) unlinkSync(triggerPath);
      assert('Temp trigger removed', !existsSync(triggerPath));
    } catch (err: any) {
      assert('Remove temp trigger', false, err?.message ?? String(err));
    }

    try {
      if (existsSync(captureStatusPath)) unlinkSync(captureStatusPath);
      assert('Private capture-status output removed', !existsSync(captureStatusPath));
    } catch (err: any) {
      assert('Remove private capture-status output', false, err?.message ?? String(err));
    }
    try {
      if (existsSync(staleAlertPath)) unlinkSync(staleAlertPath);
      assert('Private stale-alert output removed', !existsSync(staleAlertPath));
    } catch (err: any) {
      assert('Remove private stale-alert output', false, err?.message ?? String(err));
    }

    try {
      removeOwnedFixtureMarkdownIfPresent(fixtureMdPath, fixtureTag);
      assert('Owned fixture Markdown removed', !existsSync(fixtureMdPath));
    } catch (err: any) {
      assert('Remove owned fixture Markdown', false, err?.message ?? String(err));
    }

    if (fixtureRowId) {
      try {
        await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${fixtureRowId}`);
        const verify = await db.execute(sql`SELECT 1 FROM conversation_memories WHERE id = ${fixtureRowId}`);
        const row = (verify as any).rows?.[0] ?? (verify as any)[0];
        assert('Fixture DB row deleted', !row);
      } catch (err: any) {
        assert('Delete fixture DB row', false, err?.message ?? String(err));
      }
    }

    try {
      const leak = await db.execute(sql`
        SELECT id FROM conversation_memories
        WHERE content LIKE ${'%' + runTag + '%'}
           OR title LIKE ${'%' + runTag + '%'}
        LIMIT 1
      `);
      const row = (leak as any).rows?.[0] ?? (leak as any)[0];
      assert(
        'No synthetic dialogue remains in conversation_memories',
        !row,
        'A sentinel escaped the disposable fixture row.',
      );
    } catch (err: any) {
      assert('Verify no synthetic dialogue leaked', false, err?.message ?? String(err));
    }
  }
}

run()
  .catch((err: any) => {
    console.error(R(`\nFATAL: ${err?.message ?? err}`));
    failed++;
  })
  .finally(() => {
    sep();
    const total = passed + failed;
    if (failed === 0) {
      console.log(G(`\n✓ All ${total} check(s) passed\n`));
      process.exit(0);
    }
    console.log(R(`\n✗ ${failed} of ${total} check(s) failed\n`));
    process.exit(1);
  });