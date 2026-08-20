/**
 * test-team-room-e2e.ts
 *
 * Integration check for the Team Room episode hook.  The route remains
 * server-owned: HTTP clients cannot choose an episode target.  This test invokes
 * the hook's existing in-process test seam with an old-dated fixture, then drives
 * the real trigger → autosave → DB-first append chain.
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import {
  checkEpisodeAppend,
  getRollingTagIsStaleForTest,
  setEpisodeAppendPathOverrideForTest,
  setRollingTagIsStaleForTest,
} from '../services/agent-session-autosave';
import { maybeAppendTeamRoomMessage } from '../services/team-room-episode-hook';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

const WORKSPACE = process.cwd();
const ARC_NAME = 'HolaHola Episodes';
const FIXTURE_ID = '99940000-0000-4000-8000-000000009994';
const FIXTURE_TITLE = 'Episode 9994';
const FIXTURE_FILE = 'episode-9994.md';
const FIXTURE_NAME = 'episode-9994';
const FIXTURE_TAG = 'ci-team-room-e2e-fixture';
const FIXTURE_PATH = join(WORKSPACE, 'docs', FIXTURE_FILE);
const FIXTURE_TRIGGER_PATH = join(WORKSPACE, '.local', `.episode_append-team-room-e2e-${process.pid}`);
// This models an independently queued real exchange. The fixture worker must
// never read, clear, or rewrite it while draining its own private queue.
const SIMULATED_LIVE_TRIGGER_PATH = join(WORKSPACE, '.local', `.episode_append-live-regression-${process.pid}`);
const FIXTURE_CONTENT =
  '# Episode 9994\n\n' +
  `<!-- ${FIXTURE_TAG} -->\n\n` +
  'Fixture baseline for the Team Room hook CI check.\n';

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

async function cleanupFixture(db: ReturnType<typeof getSharedDb>): Promise<void> {
  await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${FIXTURE_ID}`);
  if (existsSync(FIXTURE_PATH)) unlinkSync(FIXTURE_PATH);
  if (existsSync(FIXTURE_TRIGGER_PATH)) unlinkSync(FIXTURE_TRIGGER_PATH);
}

async function main(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log(B('  Team Room Hook → Fixture Episode — Integration CI Check'));
  console.log('═'.repeat(70));

  const db = getSharedDb();
  const sentinel = `CI-TEAMROOM-E2E-${Date.now()}`;
  const livePayload = JSON.stringify({
    exchange: '**LUCA [Replit]:** a real queued rolling exchange — must remain intact',
    episode: 'episode-live-regression',
  });
  const staleBefore = getRollingTagIsStaleForTest();

  try {
    // Keep the autosave reader and hook writer on an owned fixture queue. The
    // running server continues to own .local/.episode_append exclusively.
    setEpisodeAppendPathOverrideForTest(FIXTURE_TRIGGER_PATH);
    sep();
    console.log(B('STEP 1 — Create owned old-dated fixture episode'));
    sep();
    await cleanupFixture(db);
    writeFileSync(SIMULATED_LIVE_TRIGGER_PATH, livePayload, 'utf8');
    await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, importance, entry_type, tags, arc_name, created_at)
      VALUES (
        ${FIXTURE_ID},
        ${FIXTURE_TITLE},
        ${'CI fixture — Team Room episode hook'},
        ${FIXTURE_CONTENT},
        3,
        'episode',
        ARRAY['episode', 'rolling', ${FIXTURE_TAG}]::text[],
        ${ARC_NAME},
        '2020-01-01 00:00:00+00'
      )
    `);
    writeFileSync(FIXTURE_PATH, FIXTURE_CONTENT, 'utf8');
    assert('Fixture episode row and Markdown mirror created', existsSync(FIXTURE_PATH));
    console.log(Y(`  ℹ  ${FIXTURE_FILE} is created_at=2020-01-01; the active rolling episode is untouched`));

    sep();
    console.log(B('STEP 2 — Invoke Team Room hook through its in-process fixture seam'));
    sep();
    // This is intentionally not an HTTP header. The production route always
    // calls maybeAppendTeamRoomMessage(content) with no target override; only a
    // test process that imports this service may select its owned fixture.
    setRollingTagIsStaleForTest(false);
    await maybeAppendTeamRoomMessage(
      'prime Team Room hook mtime state',
      FIXTURE_NAME,
      FIXTURE_TRIGGER_PATH,
    );
    await checkEpisodeAppend();
    await maybeAppendTeamRoomMessage(
      `${sentinel} — safe to ignore`,
      FIXTURE_NAME,
      FIXTURE_TRIGGER_PATH,
    );
    await checkEpisodeAppend();

    sep();
    console.log(B('STEP 3 — Verify fixture DB and Markdown receive the exchange'));
    sep();
    const rows = await db.execute(sql`
      SELECT content FROM conversation_memories WHERE id = ${FIXTURE_ID}
    `);
    const dbContent = ((rows as any).rows?.[0] ?? (rows as any)[0])?.content ?? '';
    const mdContent = existsSync(FIXTURE_PATH) ? readFileSync(FIXTURE_PATH, 'utf8') : '';
    assert('Sentinel appears in fixture DB row', dbContent.includes(sentinel));
    assert('LUCA [HolaHola] attribution appears in fixture DB row', dbContent.includes('**LUCA [HolaHola]:**'));
    assert('Sentinel appears in fixture Markdown replica', mdContent.includes(sentinel));
    assert(
      'Independently queued live exchange is byte-for-byte intact',
      readFileSync(SIMULATED_LIVE_TRIGGER_PATH, 'utf8') === livePayload,
      'Fixture processing touched the live-trigger regression payload',
    );
  } catch (err: any) {
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    failed++;
  } finally {
    setRollingTagIsStaleForTest(staleBefore);
    setEpisodeAppendPathOverrideForTest(null);
    try {
      await cleanupFixture(db);
      if (existsSync(SIMULATED_LIVE_TRIGGER_PATH)) unlinkSync(SIMULATED_LIVE_TRIGGER_PATH);
      assert(
        'Fixture DB row, Markdown mirror, and private trigger removed',
        !existsSync(FIXTURE_PATH) && !existsSync(FIXTURE_TRIGGER_PATH) && !existsSync(SIMULATED_LIVE_TRIGGER_PATH),
      );
    } catch (err: any) {
      console.error(R(`  ✗ Fixture cleanup failed: ${err.message}`));
      failed++;
    }
  }

  sep();
  if (failed === 0) {
    console.log(G(`\n✓ All ${passed} assertions passed — Team Room fixture CI is hermetic.\n`));
    process.exit(0);
  }
  console.log(R(`\n✗ ${failed} of ${passed + failed} assertions failed.\n`));
  process.exit(1);
}

main().catch((err) => {
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
});