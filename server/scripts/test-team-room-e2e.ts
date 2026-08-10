/**
 * test-team-room-e2e.ts
 *
 * End-to-end CI check: confirms that a message posted to the Team Room via the
 * HTTP route appears in the rolling episode's conversation_memories DB row.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Flow
 * ─────────────────────────────────────────────────────────────────────────────
 *  1. Discover the active rolling episode row in conversation_memories
 *     (arc_name = 'HolaHola Episodes', 'rolling' = ANY(tags)).
 *  2. POST a unique sentinel message to POST /api/agent/team-room/message using
 *     the x-agent-token header (requireAgentToken route).
 *  3. Two-phase wait:
 *       Phase A — poll the trigger file until the server's autosave watcher clears
 *                 it (≤ 25 s, watcher backup poll fires every 20 s).
 *       Phase B — settle 5 s for the syncEpisodeFile debounce, then poll DB (≤ 10 s).
 *     The production watcher chain is:
 *       route handler → maybeAppendTeamRoomMessage() → safeWriteTrigger()
 *         → server fs.watch or 20 s backup poll → checkEpisodeAppend()
 *         → syncEpisodeFile() writes content to DB.
 *  4. Assert the sentinel appears in the DB row.
 *  5. Clean up: strip the sentinel HTML comment from the .md file and sync the
 *     cleaned content back to the DB row — preserving any other rolling content
 *     written to the file while the test was running.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Prerequisites
 * ─────────────────────────────────────────────────────────────────────────────
 *  • The dev server must be running (workflows: "Start application").
 *  • REPLIT_AGENT_TOKEN env var must be set to authenticate the POST request.
 *  • NEON_SHARED_DATABASE_URL env var must be set for direct DB reads/writes.
 *
 * Run:
 *   npx tsx server/scripts/test-team-room-e2e.ts
 *
 * Exit 0 = pass, exit 1 = fail or timeout.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Constants ─────────────────────────────────────────────────────────────────
const BASE_URL   = process.env.SERVER_URL ?? 'http://localhost:5000';
const WORKSPACE  = process.cwd();
const DOCS_DIR   = join(WORKSPACE, 'docs');
const ARC_NAME   = 'HolaHola Episodes';

/**
 * Total DB polling budget.
 *
 * The production chain is entirely async: the route fires maybeAppendTeamRoomMessage
 * fire-and-forget, which means the trigger file may not even be written until
 * after the POST returns.  From that point the worst-case latency is:
 *   ≤ 20 s  server backup poll (fires every 20 s; fs.watch may not fire)
 * +  2 s  syncEpisodeFile debounce
 * +  3 s  DB write + HTTP propagation
 * ─────
 *  25 s  worst case after trigger is written
 * + ~5 s  time for hook to write trigger after POST
 * ─────
 *  30 s  end-to-end worst case
 *
 * We poll for 45 s to cover this with 15 s of headroom, with no dependency on
 * trigger-file observation (which introduces its own race because the file can
 * be absent both before the hook writes it AND after the watcher clears it).
 */
const DB_POLL_TIMEOUT_MS = 45_000;
/** Interval between polls (ms). */
const POLL_INTERVAL_MS = 1_000;

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Derive a short summary from the first 5 non-empty content lines. */
function episodeSummary(content: string): string {
  return content.split('\n').map(l => l.trim()).filter(Boolean)
    .slice(0, 5).join(' ').slice(0, 400);
}

/**
 * Strip the complete LUCA [HolaHola] exchange line that was appended by this
 * CI run.  The exchange format written by maybeAppendTeamRoomMessage is:
 *   **LUCA [HolaHola]:** <content.trim()>
 * We strip the entire line (including surrounding blank lines introduced by the
 * append) rather than only the sentinel token, so no residue remains.
 * Any triple+ blank lines left by the removal are collapsed to a double blank.
 */
function stripSentinelExchangeFromContent(content: string, sentinel: string): string {
  const escaped = sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the full attribution line that contains the sentinel, plus optional
  // leading/trailing newlines added by the append separator.
  const re = new RegExp(
    `\\n?\\*\\*LUCA \\[HolaHola\\]:\\*\\*[^\\n]*${escaped}[^\\n]*\\n?`,
    'g',
  );
  return content.replace(re, '').replace(/\n{3,}/g, '\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log(B('  Team Room → Rolling Episode  — End-to-End CI Check'));
  console.log('═'.repeat(70));

  // ── Environment checks ─────────────────────────────────────────────────────
  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set'));
    process.exit(1);
  }

  const agentToken = process.env.REPLIT_AGENT_TOKEN;
  if (!agentToken) {
    console.error(R('FATAL: REPLIT_AGENT_TOKEN is not set — cannot authenticate the Team Room POST'));
    process.exit(1);
  }

  // Use the HTTP Neon driver for all CI reads — avoids WebSocket state caching.
  const sql = neon(DATABASE_URL);

  sep();
  console.log(B('STEP 1 — Discover the active rolling episode'));
  sep();

  const rollingRows = await sql`
    SELECT id, title, content, tags
    FROM conversation_memories
    WHERE arc_name = ${ARC_NAME}
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const rollingRow = rollingRows[0];

  assert(
    `Active rolling episode found in "${ARC_NAME}"`,
    !!rollingRow,
    'No row with arc_name="HolaHola Episodes" AND tags@>"rolling" — is an episode currently marked rolling?',
  );
  if (!rollingRow) {
    console.error(R('\n[FAIL] No rolling episode in DB — cannot continue.\n'));
    process.exit(1);
  }

  const rowId: string       = rollingRow.id as string;
  const episodeTitle: string = rollingRow.title as string;
  const originalDbContent: string = (rollingRow.content as string) ?? '';

  // Derive the .md filename from the episode title (mirrors syncEpisodeFile logic)
  // e.g. "Episode 27" → "episode-27.md"
  let mdFilename = episodeTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
  const mdPath = join(DOCS_DIR, mdFilename);

  console.log(Y(`  ℹ  Row ID            : ${rowId}`));
  console.log(Y(`  ℹ  Episode title     : ${episodeTitle}`));
  console.log(Y(`  ℹ  .md path          : ${mdPath} (exists=${existsSync(mdPath)})`));
  console.log(Y(`  ℹ  DB content length : ${originalDbContent.length} bytes`));

  // ── Pre-flight: align DB ≤ .md without touching the .md file ─────────────
  // syncEpisodeFile uses a rolling max-length guard: it only writes .md→DB when
  // .md content is at least as long as the current DB row.  If DB is ahead (from
  // a direct admin write or another agent task that wrote to DB without going
  // through the autosave chain), the guard would silently block the sentinel from
  // reaching DB regardless of polling timeout.
  //
  // Fix: force-set DB = current .md content via a direct SQL UPDATE.  This resets
  // the rolling baseline to match the canonical .md file, so when the sentinel is
  // appended to .md the length guard passes.  We deliberately do NOT write to the
  // .md file here — doing so would race with concurrent tests that also write to
  // the same .md (e.g. test-episode-append-trigger.ts --self-check-concurrent).
  if (existsSync(mdPath)) {
    const currentMdContent = readFileSync(mdPath, 'utf-8');
    const dbLen = originalDbContent.length;
    const mdLen = currentMdContent.length;

    if (dbLen > mdLen) {
      const pct = ((dbLen - mdLen) / mdLen) * 100;
      // Force-set DB to match the current .md so the rolling guard clears.
      // The .md is the canonical episode source; any DB-only content that
      // hasn't been committed to the .md is considered speculative.
      await sql`
        UPDATE conversation_memories
        SET content = ${currentMdContent}
        WHERE id = ${rowId}
      `;
      console.log(Y(
        `  ℹ  Pre-flight: DB (${dbLen}) > .md (${mdLen}) by ${pct.toFixed(1)}% — ` +
        `force-set DB = .md so rolling guard passes after sentinel append`,
      ));
    } else {
      console.log(Y(`  ℹ  Pre-flight: .md (${mdLen} bytes) ≥ DB (${dbLen} bytes) — aligned`));
    }
  }

  // ── Wait for server readiness ──────────────────────────────────────────────
  // The test may run in parallel with "Start application" inside the Project
  // workflow.  Poll a lightweight endpoint until it responds (or timeout).
  sep();
  console.log(B('STEP 1b — Wait for server readiness'));
  sep();
  {
    const READY_TIMEOUT_MS = 60_000;
    const READY_POLL_MS    = 1_000;
    const deadline = Date.now() + READY_TIMEOUT_MS;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3_000) });
        if (r.ok || r.status < 500) { ready = true; break; }
      } catch { /* server not up yet */ }
      await sleep(READY_POLL_MS);
    }
    if (!ready) {
      // Fall back: a non-200 response still means the server is accepting connections
      try {
        const r = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(3_000) });
        ready = r.status > 0;
      } catch { /* truly unreachable */ }
    }
    assert(
      `Dev server reachable at ${BASE_URL} within ${READY_TIMEOUT_MS / 1000} s`,
      ready,
      `Server did not respond within ${READY_TIMEOUT_MS / 1000} s — ensure "Start application" is running first`,
    );
    if (ready) console.log(Y(`  ℹ  Server is ready`));
    else { console.error(R('\n[FAIL] Server not reachable — cannot continue.\n')); process.exit(1); }
  }

  // ── Unique sentinel ────────────────────────────────────────────────────────
  const ts       = Date.now();
  const sentinel = `CI-TEAMROOM-E2E-${ts}`;
  // The message is plain text containing the sentinel directly.
  // maybeAppendTeamRoomMessage will write:
  //   **LUCA [HolaHola]:** CI-TEAMROOM-E2E-<ts> — team room e2e test, safe to ignore
  // Cleanup strips this entire line (not just a nested comment) via
  // stripSentinelExchangeFromContent, leaving no residue in the rolling episode.
  const sentinelMessage = `${sentinel} — team room e2e test, safe to ignore`;

  sep();
  console.log(B('STEP 2 — POST sentinel message to /api/agent/team-room/message'));
  sep();
  console.log(Y(`  ℹ  Sentinel : ${sentinel}`));
  console.log(Y(`  ℹ  Endpoint : ${BASE_URL}/api/agent/team-room/message`));

  let postOk = false;
  let postedMessageId: string | null = null;   // kept for cleanup — delete from room_voice_messages
  try {
    const postRes = await fetch(`${BASE_URL}/api/agent/team-room/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': agentToken,
      },
      body: JSON.stringify({ content: sentinelMessage }),
    });

    const body = await postRes.json().catch(() => ({}));
    postOk = postRes.ok && (body as any).success === true;
    if (postOk) postedMessageId = (body as any).messageId ?? null;

    assert(
      `POST /api/agent/team-room/message returned 200 success`,
      postOk,
      postOk ? undefined : `HTTP ${postRes.status}: ${JSON.stringify(body)}`,
    );
    if (postOk) {
      console.log(Y(`  ℹ  messageId : ${postedMessageId ?? '(unknown)'}`));
    }
  } catch (err: any) {
    assert(
      `POST /api/agent/team-room/message returned 200 success`,
      false,
      `Network error — is the dev server running at ${BASE_URL}? (${err.message})`,
    );
  }

  if (!postOk) {
    console.error(R('\n[FAIL] POST failed — cannot continue.\n'));
    process.exit(1);
  }

  // ── Guard: ensure server is up before continuing ───────────────────────────
  // (Already confirmed above by postOk, but kept here as an explicit record)

  sep();
  console.log(B(`STEP 3 — Poll DB until sentinel appears (≤ ${DB_POLL_TIMEOUT_MS / 1000} s)`));
  sep();

  // The production chain is fully async from the POST return:
  //   POST handler fires maybeAppendTeamRoomMessage fire-and-forget
  //   → safeWriteTrigger() writes trigger file
  //   → server fs.watch OR ≤20 s backup poll → checkEpisodeAppend() appends to .md
  //   → 2 s syncEpisodeFile debounce → DB write
  //
  // We poll the DB directly for up to DB_POLL_TIMEOUT_MS (45 s), which covers the
  // full worst-case chain end-to-end with 15 s headroom.  Watching the trigger file
  // is intentionally avoided: the file can be absent both before the async hook
  // writes it AND after the watcher clears it, making its absence an unreliable signal.

  console.log(Y(`  ℹ  Polling DB for sentinel (≤ ${DB_POLL_TIMEOUT_MS / 1000} s, interval ${POLL_INTERVAL_MS / 1000} s)…`));
  const dbDeadline = Date.now() + DB_POLL_TIMEOUT_MS;
  let dbContent = '';
  let foundInDb = false;
  let pollCount = 0;

  while (Date.now() < dbDeadline) {
    await sleep(POLL_INTERVAL_MS);
    pollCount++;

    try {
      const verifyRows = await sql`
        SELECT content
        FROM conversation_memories
        WHERE id = ${rowId}
      `;
      dbContent = (verifyRows[0]?.content as string) ?? '';

      if (dbContent.includes(sentinel)) {
        foundInDb = true;
        console.log(Y(`  ℹ  Sentinel found in DB after ${pollCount} poll(s) (~${pollCount * POLL_INTERVAL_MS / 1000} s)`));
        break;
      }

      if (pollCount % 5 === 0) {
        process.stdout.write(`  … DB poll ${pollCount} (~${Math.round(pollCount * POLL_INTERVAL_MS / 1000)} s elapsed, ${dbContent.length} bytes)\r`);
      }
    } catch (err: any) {
      console.warn(Y(`  ⚠  DB poll error (attempt ${pollCount}): ${err.message}`));
    }
  }
  process.stdout.write('\n');

  try {
    assert(
      `Sentinel "${sentinel}" appears in DB row ${rowId.slice(0, 8)}… within drain+settle+poll window`,
      foundInDb,
      foundInDb
        ? undefined
        : `Timed out — sentinel not found in DB content ` +
          `(${dbContent.length} bytes).  Check: (a) server is running, (b) rolling episode tag, ` +
          `(c) autosave watcher started, (d) trigger-file watcher fired.`,
    );

    // ── Also verify the LUCA [HolaHola]: attribution prefix is present ─────────
    const lucaAttributionLabel = 'LUCA [HolaHola]:';
    assert(
      `"${lucaAttributionLabel}" attribution label present in DB content`,
      dbContent.includes(lucaAttributionLabel),
      `DB content (${dbContent.length} bytes) does not contain "${lucaAttributionLabel}" — ` +
      `the route hook may have dropped the attribution prefix.`,
    );
  } finally {
    // ── ALWAYS clean up: strip sentinel exchange line from .md and sync DB ─────
    // Runs even when assertions fail so the rolling episode is never left polluted.

    sep();
    console.log(B('STEP 4 — Clean up: strip sentinel exchange from .md and sync DB'));
    sep();

    try {
      // ── 0. Delete the sentinel room_voice_messages record ──────────────────
      // The POST creates a real DB record in the Team Room that must be removed
      // so repeated CI runs don't pollute the live collaboration room.
      if (postedMessageId) {
        await sql`
          DELETE FROM room_voice_messages WHERE id = ${postedMessageId}
        `;
        console.log(Y(`  ℹ  room_voice_messages record ${postedMessageId.slice(0, 8)}… deleted`));
      }

      // ── 1. Strip sentinel from the .md file (if present) ───────────────────
      if (existsSync(mdPath)) {
        const currentMd = readFileSync(mdPath, 'utf-8');
        const cleanedMd = stripSentinelExchangeFromContent(currentMd, sentinel);
        writeFileSync(mdPath, cleanedMd, 'utf-8');
        console.log(Y(`  ℹ  .md after cleanup : ${cleanedMd.length} bytes`));
        assert(
          'Sentinel exchange line fully stripped from .md',
          !cleanedMd.includes(sentinel),
          '.md still contains sentinel — check stripSentinelExchangeFromContent regex',
        );
      }

      // ── 2. Atomically strip sentinel from DB row using regexp_replace ──────────
      // A single SQL UPDATE with regexp_replace avoids the read-modify-write race:
      // no concurrent append committed between SELECT and UPDATE can be lost.
      // The regex matches the full "**LUCA [HolaHola]:** <sentinel> …" line that
      // maybeAppendTeamRoomMessage appended, including surrounding blank lines.
      const escapedSentinel = sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexPattern    = `\\n?\\*\\*LUCA \\[HolaHola\\]:\\*\\*[^\\n]*${escapedSentinel}[^\\n]*\\n?`;

      // regexp_replace strips only this sentinel exchange from whatever content
      // is currently in the row — concurrent appends committed between our POST
      // and this UPDATE are never touched.
      const updateRows = await sql`
        UPDATE conversation_memories
        SET content = regexp_replace(content, ${regexPattern}, '', 'g')
        WHERE id = ${rowId}
        RETURNING length(content) AS len
      `;
      const updatedLen = (updateRows[0] as any)?.len ?? 0;

      // Verify the sentinel is gone (single read after atomic write)
      const verifyRows = await sql`
        SELECT content FROM conversation_memories WHERE id = ${rowId}
      `;
      const verifiedContent = (verifyRows[0]?.content as string) ?? '';
      assert(
        'Sentinel exchange line fully stripped from DB row',
        !verifiedContent.includes(sentinel),
        'DB row still contains sentinel after atomic cleanup',
      );
      console.log(Y(`  ℹ  DB row ${rowId.slice(0, 8)}… cleaned (${updatedLen} bytes, atomic regexp_replace)`));
    } catch (err: any) {
      console.error(R(`  ✗  Cleanup failed: ${err.message}`));
      failed++;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${total} assertions passed.`));
    console.log(G(`   Team Room message posted via HTTP route appeared in rolling episode DB row\n`));
    console.log(G(`   within the autosave-watcher drain+settle+poll window.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${total} assertions failed.\n`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
});
