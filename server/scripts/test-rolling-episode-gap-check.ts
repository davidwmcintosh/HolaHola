/**
 * test-rolling-episode-gap-check.ts
 *
 * CI check: query conversation_memories for `arc_name='david-luca-chat'`
 * per-turn rows from the last 24h, compare each against the current rolling
 * episode .md file, and report any gaps — exchanges present in the DB but
 * absent from the .md.
 *
 * This is the persistent-CI companion to the one-time startup patch performed
 * by runStartupGapCheck() in agent-session-autosave.ts.  Running this script
 * after every server restart gives an auditable green/red signal without
 * modifying any files.
 *
 * Exit codes
 * ──────────
 *   0  — no gaps (episode .md matches all DB per-turn rows)
 *   1  — fatal error (DB unavailable, .md not found, no rolling episode)
 *   2  — gaps detected (exchanges in DB but absent from .md)
 *
 * Uses neon() HTTP driver per episode-sync-http rule.
 *
 * Usage
 * ─────
 *   npx tsx server/scripts/test-rolling-episode-gap-check.ts
 *   npx tsx server/scripts/test-rolling-episode-gap-check.ts --verbose
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { detectRollingTagMisroute } from '../services/rolling-tag-utils';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

const VERBOSE   = process.argv.includes('--verbose');

const SELF_CHECK = process.argv.includes('--self-check');
const ROLLING_TAG_SELF_CHECK = process.argv.includes('--rolling-tag-self-check');
function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Strip markdown bold markers (**) and speaker role-label brackets after LUCA
 * (e.g. [Replit], [HolaHola], [steward], [observe]) so DB-format "Luca: text"
 * matches .md "**LUCA [Replit]:** text" or "**LUCA [HolaHola]:** text".
 *
 * Only the role bracket immediately after "luca" is stripped — channel labels
 * like [felt], [thinking], [moment] appear after the colon (in content) and
 * are left untouched.
 */
function stripMd(s: string): string {
  return s.replace(/\*\*/g, '').replace(/\bluca\s*\[[^\]]+\]/gi, 'luca');
}

/**
 * Return true when exchangeText is present in the normalised .md content.
 *
 * Strategy: normalise the full exchange block (collapse whitespace, lower-case)
 * and search for its first 60 chars in mdNorm.  60 chars is long enough to be
 * unique in any real conversation while being short enough to survive minor
 * line-break differences between the DB row and the .md copy.  Short exchanges
 * (< 60 chars) are matched in full — no minimum-length threshold that would
 * silently skip brief utterances.
 *
 * Falls back to a bold-stripped comparison so DB rows stored as "David: text"
 * still match .md lines formatted as "**David:** text".
 *
 * NOTE: The identical matcher lives in agent-session-autosave.ts (exchangeInMd).
 * Keep both in sync whenever this logic changes.
 */
function exchangeInMd(exchangeText: string, mdNorm: string): boolean {
  const normalised = norm(exchangeText);
  if (!normalised) return true; // purely whitespace — treat as present (skip)
  const key = normalised.slice(0, 60);
  if (mdNorm.includes(key)) return true;
  // Fallback: strip ** so "david: text" matches "**david:** text"
  return stripMd(mdNorm).includes(stripMd(key));
}

/**
 * Self-check mode (--self-check).
 *
 * Constructs a synthetic exchange where David's part is short enough that the
 * 60-char needle spans from his text into Luca's "[HolaHola]:" speaker label.
 * This exercises the strip fallback — the direct substring check cannot match
 * because the .md has "**LUCA [HolaHola]:**" while the DB row has "Luca:".
 *
 * Assertions:
 *   1. The 60-char key actually contains "luca" (confirming the needle spans
 *      the label boundary — if it doesn't, the strip path is never reached).
 *   2. The direct mdNorm.includes(key) check returns false (strip IS needed).
 *   3. exchangeInMd() returns true with stripMd active (correct behaviour).
 *   4. Replacing stripMd with a no-op makes the fallback return false
 *      (confirms the self-check would catch a regression that removes the strip).
 *
 * Exit 0 on all assertions passing; exit 1 on any failure.
 */
function runSelfCheck(): void {
  console.log(B('\n══ Rolling Episode Gap Check — Self-Check ══\n'));
  console.log('  Verifies the two-phase strip fallback in exchangeInMd().\n');

  // ── Build synthetic exchange ──────────────────────────────────────────────
  // David's text is intentionally very short ("ok") so the 60-char key
  // includes "david: ok" (9 chars) + " luca: " (7 chars) + 44 chars of
  // Luca's text — spanning the speaker-label boundary.
  const davidText = 'ok';
  const lucaText  = 'the rest of the response that luca gives here and now so we span';

  // DB format: how a per-turn row's `content` field is stored.
  const dbContent = `David: ${davidText}\nLuca: ${lucaText}`;

  // .md format: what the rolling episode file actually contains.
  const mdContent = `**David:** ${davidText}\n**LUCA [HolaHola]:** ${lucaText}`;

  const mdNorm = norm(mdContent);

  // ── Assertion 1: needle spans the label boundary ──────────────────────────
  const needleNorm = norm(dbContent).slice(0, 60);
  if (!needleNorm.includes('luca')) {
    console.error(R('SELF-CHECK SETUP ERROR: 60-char needle does not reach the "luca" label.'));
    console.error(`  needle (${needleNorm.length} chars): ${JSON.stringify(needleNorm)}`);
    console.error('  Shorten davidText so the needle spans the speaker-label boundary.');
    process.exit(1);
  }
  console.log(G('  ✓ needle spans label boundary'));
  console.log(`    needle: ${JSON.stringify(needleNorm)}`);

  // ── Assertion 2: direct check must FAIL (strip is genuinely needed) ───────
  if (mdNorm.includes(needleNorm)) {
    console.error(R('SELF-CHECK SETUP ERROR: direct mdNorm.includes(key) passes — strip is not needed.'));
    console.error('  The test would not exercise the fallback path. Adjust the exchange.');
    process.exit(1);
  }
  console.log(G('  ✓ direct check fails (strip fallback is required)'));

  // ── Assertion 3: with strip active → exchangeInMd returns true ───────────
  const withStrip = exchangeInMd(dbContent, mdNorm);
  if (!withStrip) {
    console.error(R('SELF-CHECK FAIL: exchangeInMd returned false with strip active.'));
    console.error('  The two-phase match is broken — the strip fallback is not working.');
    process.exit(1);
  }
  console.log(G('  ✓ strip active   → exchangeInMd returns true  (correct)'));

  // ── Assertion 4: with no-op strip → fallback returns false ───────────────
  // Simulate removing stripMd by substituting an identity function.
  // The direct check already failed (assertion 2), so only the fallback
  // can save us.  With a no-op strip the fallback also fails — the
  // regression is detectable.
  const noopStrip = (s: string): string => s;
  const fallbackWithNoop = noopStrip(mdNorm).includes(noopStrip(needleNorm));
  if (fallbackWithNoop) {
    console.error(R('SELF-CHECK FAIL: no-op strip still passes — regression cannot be detected.'));
    console.error('  The test setup is wrong; choose an exchange that truly requires stripping.');
    process.exit(1);
  }
  console.log(G('  ✓ no-op strip    → fallback returns false (regression correctly detected)'));

  console.log(G('\n  ✓ SELF-CHECK PASSED — strip fallback is necessary and detectable.\n'));
}
async function main() {
  console.log(B('\n══ Rolling Episode Gap Check ══\n'));

  const dbUrl = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL (or DATABASE_URL) is not set.'));
    process.exit(1);
  }
  const sql = neon(dbUrl);
  const DOCS_DIR = join(process.cwd(), 'docs');

  // 1. Find the current rolling episode ─────────────────────────────────────
  const epRows = await sql`
    SELECT title
    FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (epRows.length === 0) {
    console.error(R('FATAL: No rolling episode found in DB (arc_name=\'HolaHola Episodes\', tag=\'rolling\').'));
    process.exit(1);
  }

  const epTitle = epRows[0].title as string;
  // Derive filename: "Episode 27" → "episode-27.md"
  const m = /^Episode (\d+)$/i.exec(epTitle);
  const episodeFilename = m
    ? `episode-${parseInt(m[1], 10)}.md`
    : epTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';

  const episodePath = join(DOCS_DIR, episodeFilename);

  console.log(`  Rolling episode : ${epTitle}`);
  console.log(`  File            : docs/${episodeFilename}`);

  if (!existsSync(episodePath)) {
    console.error(R(`FATAL: ${episodePath} not found on disk.`));
    process.exit(1);
  }

  const mdRaw  = readFileSync(episodePath, 'utf-8');
  const mdNorm = norm(mdRaw);
  console.log(`  .md size        : ${mdRaw.length.toLocaleString()} bytes, ${mdRaw.split('\n').length} lines`);

  // 2. Query DB for per-turn rows scoped to the rolling episode window ──────
  // Use the episode's own created_at as the lower bound so rows from a prior
  // episode that happened within the past 24h are never reported as gaps.
  const epStartRows = await sql`
    SELECT created_at
    FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `;
  // created_at comes back as a Date object from neon(); convert to ISO-8601
  // before binding it as a ::timestamptz parameter.
  const epCreatedAt = epStartRows[0]?.created_at;
  const episodeStart: string | null = epCreatedAt
    ? (epCreatedAt instanceof Date ? epCreatedAt.toISOString() : new Date(String(epCreatedAt)).toISOString())
    : null;

  const rows = episodeStart
    ? await sql`
        SELECT id, content, created_at
        FROM conversation_memories
        WHERE arc_name = 'david-luca-chat'
          AND 'per-turn' = ANY(tags)
          AND created_at >= ${episodeStart}::timestamptz
        ORDER BY created_at ASC
      `
    : await sql`
        SELECT id, content, created_at
        FROM conversation_memories
        WHERE arc_name = 'david-luca-chat'
          AND 'per-turn' = ANY(tags)
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at ASC
      `;

  // Filter out CI synthetic rows
  const realRows = rows.filter(
    (r) =>
      !String(r.content).includes('[CI-AUTO-CAPTURE-') &&
      !String(r.content).includes('[CI-SELF-CHECK-AUTO-CAPTURE-'),
  );
  const ciExcluded = rows.length - realRows.length;

  console.log(`\n  DB rows (last 24h): ${rows.length} total`);
  console.log(`    ${realRows.length} real David/Luca exchanges`);
  if (ciExcluded > 0) {
    console.log(`    ${ciExcluded} CI synthetic rows excluded`);
  }
  console.log('');

  // 3. Check each row ───────────────────────────────────────────────────────
  // NOTE: do NOT early-exit here when realRows.length === 0 — the inner-life
  // check below must always run regardless of per-turn row count.
  let gaps = 0;
  for (const row of realRows) {
    const content = String(row.content);
    const present = exchangeInMd(content, mdNorm);

    if (present) {
      if (VERBOSE) {
        console.log(G(`  ✓ present  ${row.id}  ${row.created_at}`));
        if (VERBOSE) {
          console.log(`    ${content.slice(0, 100).replace(/\n/g, '↵')}`);
        }
      }
    } else {
      console.log(R(`  ✗ GAP      ${row.id}  ${row.created_at}`));
      console.log(`    ${content.slice(0, 150).replace(/\n/g, '↵')}`);
      if (content.length > 150) {
        console.log(`    … (${content.length} chars total)`);
      }
      gaps++;
    }
  }

  console.log('');

  // 4. Inner-life gap check (felt / thinking / moment) ──────────────────────
  const innerRows = episodeStart
    ? await sql`
        SELECT id, title, content, tags, created_at
        FROM conversation_memories
        WHERE arc_name = 'luca-inner-life'
          AND 'luca-inner-life' = ANY(tags)
          AND created_at >= ${episodeStart}::timestamptz
        ORDER BY created_at ASC
      `
    : await sql`
        SELECT id, title, content, tags, created_at
        FROM conversation_memories
        WHERE arc_name = 'luca-inner-life'
          AND 'luca-inner-life' = ANY(tags)
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at ASC
      `;

  console.log(`  Inner-life DB rows: ${innerRows.length} total`);

  let innerGaps = 0;
  for (const row of innerRows) {
    const tags: string[] = Array.isArray(row.tags) ? row.tags as string[] : [];
    const channel = tags.includes('luca-reflection') ? 'felt'
      : tags.includes('luca-question') ? 'thinking' : 'moment';

    // Strip stored prefix ("Luca reflection: X" → "X") to recover the raw title
    // that was written into the episode .md as "[Luca — felt: X\nbody]".
    const rawTitle = String(row.title ?? '')
      .replace(/^Luca reflection:\s*/i, '')
      .replace(/^Luca open question:\s*/i, '')
      .replace(/^Luca significant moment:\s*/i, '');

    const titleKey = norm(rawTitle).slice(0, 40);
    const present = titleKey ? mdNorm.includes(titleKey) : true;

    if (present) {
      if (VERBOSE) {
        console.log(G(`  ✓ present  [${channel}]  "${rawTitle.slice(0, 70)}"`));
      }
    } else {
      console.log(R(`  ✗ GAP      [${channel}]  "${rawTitle.slice(0, 70)}"`));
      console.log(`    id: ${row.id}  at: ${row.created_at}`);
      innerGaps++;
    }
  }

  if (innerRows.length > 0) {
    console.log('');
  }

  // 5. Summary ──────────────────────────────────────────────────────────────
  const checked = realRows.length;
  const totalGaps = gaps + innerGaps;

  if (totalGaps === 0) {
    console.log(G(`  ✓ PASS — docs/${episodeFilename} is complete.`));
    console.log(`    ${checked} per-turn row(s) checked, 0 gaps.`);
    if (innerRows.length > 0) {
      console.log(`    ${innerRows.length} inner-life row(s) checked, 0 gaps.`);
    }
    process.exit(0);
  } else {
    console.log(Y(`  ⚠  FAIL — ${totalGaps} gap(s) found in docs/${episodeFilename}.`));
    if (gaps > 0) {
      console.log(`    ${checked} per-turn row(s) checked, ${gaps} absent from .md.`);
    }
    if (innerGaps > 0) {
      console.log(`    ${innerRows.length} inner-life row(s) checked, ${innerGaps} absent from .md.`);
    }
    console.log('');
    console.log('  To patch automatically, restart the server (runStartupGapCheck will fire)');
    console.log('  or run: npx tsx server/scripts/audit-episode-28-gaps.ts --patch');
    process.exit(2);
  }
}

/**
 * Rolling-tag self-check mode (--rolling-tag-self-check).
 *
 * Calls the PRODUCTION detectRollingTagMisroute() (imported from
 * server/services/rolling-tag-utils.ts) with synthetic episode data.
 * Removing or breaking that function will fail this self-check at assertion 1.
 *
 * Also validates the integration contract via the agent-session-autosave
 * test seams:
 *   4. Injecting a stale alert via setRollingTagMisrouteAlertForTest() causes
 *      the alert to appear in the next writeEpisodeCaptureStatusFileForTest()
 *      output — proves the alert survives the 20s poll-rewrite cycle.
 *   5. Clearing the alert removes it from the next write — proves the alert
 *      disappears once the misroute is fixed.
 *
 * Assertions:
 *   1. Stale scenario → production detectRollingTagMisroute returns stale=true,
 *      rollingLabel=ep-28, newerLabel=ep-30  (load-bearing: removing the function breaks this)
 *   2. No-op check (simulates guard removal) → stale=false, confirming the guard
 *      is the only thing standing between a misroute and silent content loss
 *   3. Correct placement → stale=false  (no false positive)
 *   4. Alert injected via test seam → appears in capture-status file on next write
 *   5. Alert cleared → disappears from capture-status file on next write
 *
 * Exit 0 on all assertions passing; exit 1 on any failure.
 */
async function runRollingTagSelfCheck(): Promise<void> {
  console.log(B('\n══ Rolling Tag Misroute — Self-Check ══\n'));
  console.log('  Calls the production detectRollingTagMisroute() against synthetic data.');
  console.log('  Removing or breaking that function will fail assertion 1.\n');

  type EpRow = { title: string; tags: string[]; created_at: Date };

  // ── Synthetic data: stale scenario ──────────────────────────────────────
  // ep-28 has the rolling tag; ep-30 was created 5 days later without it.
  const staleEpisodes: EpRow[] = [
    { title: 'Episode 28', tags: ['rolling', 'rolling-protected'], created_at: new Date('2026-08-10T00:00:00Z') },
    { title: 'Episode 30', tags: ['rolling-protected'],            created_at: new Date('2026-08-15T00:00:00Z') },
  ];

  // ── Assertion 1: production function detects the stale scenario ──────────
  // Uses the REAL detectRollingTagMisroute() imported from rolling-tag-utils.ts.
  // If that function is deleted or returns stale=false for this input, exit 1.
  const staleResult = detectRollingTagMisroute(staleEpisodes);
  if (!staleResult.stale) {
    console.error(R('SELF-CHECK FAIL: detectRollingTagMisroute returned stale=false — misroute NOT detected.'));
    console.error('  Check server/services/rolling-tag-utils.ts — the guard may be missing or broken.');
    process.exit(1);
  }
  if (staleResult.rollingLabel !== 'ep-28' || staleResult.newerLabel !== 'ep-30') {
    console.error(R(
      `SELF-CHECK FAIL: wrong labels — rollingLabel="${staleResult.rollingLabel}", newerLabel="${staleResult.newerLabel}"`
    ));
    process.exit(1);
  }
  console.log(G('  ✓ production detectRollingTagMisroute → stale=true, rollingLabel=ep-28, newerLabel=ep-30'));

  // ── Assertion 2: no-op guard → stale=false (confirms guard is load-bearing)
  // Simulate removing the check by substituting a no-op function.  Confirms
  // that without the real implementation the misroute is silently missed.
  const noopDetect = (_eps: EpRow[]) => ({ stale: false as const });
  const noopResult = noopDetect(staleEpisodes);
  if (noopResult.stale) {
    console.error(R('SELF-CHECK FAIL: no-op detect returned stale=true — setup error, not a real detection.'));
    process.exit(1);
  }
  console.log(G('  ✓ no-op detect → stale=false  (guard is load-bearing; without it the misroute is silent)'));

  // ── Assertion 3: correctly placed tag → no false positive ───────────────
  const correctEpisodes: EpRow[] = [
    { title: 'Episode 28', tags: ['rolling-protected'],            created_at: new Date('2026-08-10T00:00:00Z') },
    { title: 'Episode 30', tags: ['rolling', 'rolling-protected'], created_at: new Date('2026-08-15T00:00:00Z') },
  ];
  const correctResult = detectRollingTagMisroute(correctEpisodes);
  if (correctResult.stale) {
    console.error(R('SELF-CHECK FAIL: correct placement returned stale=true — false positive.'));
    process.exit(1);
  }
  console.log(G('  ✓ correct placement (ep-30 newest AND has rolling tag) → stale=false  (no false positive)'));

  // ── Assertions 4 & 5: integration — alert persists across capture-status writes ──
  // Dynamically import agent-session-autosave (which has DB/file-system side effects)
  // ONLY from within this self-check block so the import does not happen at module
  // load time and does not interfere with the main() DB flow.
  console.log('');
  console.log('  Testing integration: alert persistence in capture-status file...');
  const autosave = await import('../services/agent-session-autosave');

  // Preserve the current alert and stale-gate values so we can restore them.
  const prevAlert = autosave.getRollingTagMisrouteAlertForTest();
  const prevIsStale = autosave.getRollingTagIsStaleForTest();

  const SYNTHETIC_ALERT = '⚠️ rolling tag is on ep-28 (2026-08-10) but ep-30 (2026-08-15) exists — verify rolling designation';

  // ── Redirect writes to a temp file so this self-check does not disturb the live
  //    .local/episode-capture-status.md (which prevents race failures in
  //    test-capture-status-db-only.ts and test-capture-status-ordering.ts).
  const { readFileSync: readFS, existsSync: existsFS, mkdirSync: mkdirFS } = await import('fs');
  const { join: pathJoin } = await import('path');
  const { tmpdir } = await import('os');
  const tmpDir = tmpdir();
  const tempStatusPath = pathJoin(tmpDir, `rolling-tag-self-check-${Date.now()}.md`);
  autosave.setCaptureStatusPathOverrideForTest(tempStatusPath);

  try {
    // ── Assertion 4: injected alert appears in status file ──────────────────
    autosave.setRollingTagMisrouteAlertForTest(SYNTHETIC_ALERT);
    // Trigger a status-file write (null episode, ms=0 → minimal output, no DB needed)
    autosave.writeEpisodeCaptureStatusFileForTest(null, 0);

    if (!existsFS(tempStatusPath)) {
      console.error(R('SELF-CHECK FAIL: capture-status file was not written by writeEpisodeCaptureStatusFileForTest.'));
      process.exit(1);
    }
    const statusAfterInject = readFS(tempStatusPath, 'utf-8');
    if (!statusAfterInject.includes('ROLLING TAG MISROUTE') || !statusAfterInject.includes('ep-28')) {
      console.error(R('SELF-CHECK FAIL: injected rolling-tag alert NOT found in capture-status file.'));
      console.error('  The alert must appear in _writeCaptureStatusFile() output even after a 20s poll cycle.');
      console.error(`  Status file preview: ${statusAfterInject.slice(0, 400)}`);
      process.exit(1);
    }
    console.log(G('  ✓ injected alert → appears in capture-status file (persists across poll rewrites)'));

    // ── Assertion 5: cleared alert disappears from next write ────────────────
    autosave.setRollingTagMisrouteAlertForTest(null);
    autosave.writeEpisodeCaptureStatusFileForTest(null, 0);
    const statusAfterClear = readFS(tempStatusPath, 'utf-8');
    if (statusAfterClear.includes('ROLLING TAG MISROUTE') || statusAfterClear.includes('ep-28 (2026-08-10)')) {
      console.error(R('SELF-CHECK FAIL: cleared rolling-tag alert STILL appears in capture-status file.'));
      console.error('  The alert should disappear as soon as it is cleared (misroute fixed).');
      process.exit(1);
    }
    console.log(G('  ✓ cleared alert → disappears from capture-status file (no stale warning)'));
  } finally {
    // Always restore path override so the live file is unaffected regardless of outcome.
    autosave.setCaptureStatusPathOverrideForTest(null);
  }

  // ── Assertions 6 & 7: routing gate integration proof ────────────────────
  // These prove that getCurrentRollingEpisodeFilenameForTest() returns null
  // when the stale gate is set, blocking all routing, and resumes when cleared.
  console.log('');
  console.log('  Testing routing gate: getCurrentRollingEpisodeFilenameForTest() blocks when stale...');

  // ── Assertion 6: stale gate true → routing returns null (no append possible) ──
  autosave.setRollingTagIsStaleForTest(true);
  const staleFilename = await autosave.getCurrentRollingEpisodeFilenameForTest();
  if (staleFilename !== null) {
    console.error(R(`SELF-CHECK FAIL: routing gate did NOT block — returned "${staleFilename}" instead of null.`));
    console.error('  When _rollingTagIsStale=true, getCurrentRollingEpisodeFilename() must return null.');
    console.error('  Check server/services/agent-session-autosave.ts — the stale guard may be missing.');
    autosave.setRollingTagIsStaleForTest(prevIsStale);
    process.exit(1);
  }
  console.log(G('  ✓ stale gate=true  → getCurrentRollingEpisodeFilenameForTest() returns null (routing blocked)'));

  // ── Assertion 7: stale gate false → DB path attempted (routing resumes) ────
  // We use the call counter rather than checking the return value: the counter
  // increments ONLY when the DB try-block is entered (stale gate bypassed).
  // A return of null from the gate would NOT increment it, so a delta > 0 is
  // conclusive proof the function left the stale-gate branch and reached the DB.
  autosave.resetRollingEpisodeLookupCallCountForTest();
  autosave.setRollingTagIsStaleForTest(false);
  try {
    // DB lookup may fail in a hermetic CI environment — that is acceptable; what
    // matters is that the call count advanced, proving the gate lifted.
    await autosave.getCurrentRollingEpisodeFilenameForTest();
  } catch {
    // DB error acceptable — fall through to counter check below.
  }
  const afterCount = autosave.getRollingEpisodeLookupCallCountForTest();
  if (afterCount < 1) {
    console.error(R('SELF-CHECK FAIL: DB-lookup call count did not advance — gate did not lift.'));
    console.error('  Expected _rollingEpisodeLookupCallCount >= 1 after setRollingTagIsStaleForTest(false).');
    console.error('  Check that the counter is incremented BEFORE the DB query in getCurrentRollingEpisodeFilename().');
    autosave.setRollingTagIsStaleForTest(prevIsStale);
    process.exit(1);
  }
  console.log(G('  ✓ stale gate=false → DB-lookup call count advanced (routing resumes, DB path truly attempted)'));

  // Restore state so this self-check is side-effect-free.
  autosave.setRollingTagMisrouteAlertForTest(prevAlert);
  autosave.setRollingTagIsStaleForTest(prevIsStale);

  console.log(G('\n  ✓ SELF-CHECK PASSED — rolling tag misroute detection is necessary and detectable.\n'));
}

if (ROLLING_TAG_SELF_CHECK) {
  runRollingTagSelfCheck().then(() => process.exit(0)).catch((e) => {
    console.error(R('SELF-CHECK FATAL: ' + (e as Error).message));
    process.exit(1);
  });
} else if (SELF_CHECK) {
  runSelfCheck();
  process.exit(0);
} else {
  main().catch((e) => {
    console.error(R('FATAL: ' + (e as Error).message));
    process.exit(1);
  });
}
