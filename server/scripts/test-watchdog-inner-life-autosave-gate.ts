#!/usr/bin/env npx tsx
/**
 * test-watchdog-inner-life-autosave-gate.ts
 *
 * Hermetic CI for capture-watchdog's autosave-alive ownership gate.
 *
 * A fresh .local/episode-capture-status.md heartbeat means the dev server's
 * autosave service owns the inner-life trigger files. drainInnerLife() must
 * therefore make no personal-memory, personal-file, or watchdog-state write.
 * Otherwise the watchdog and autosave could double-save a felt/thinking/moment.
 *
 * The script runs its real drain in a spawned child whose cwd is a new temp
 * directory: capture-watchdog resolves .local/, docs/, and .agents/memory/
 * from process.cwd(). The child replaces Neon with an in-memory fake before
 * draining, so no shared-database row can be written.
 *
 * --self-check proves this test is load-bearing. It deliberately disables both
 * autosave-alive checks through the production test seam, then confirms the
 * normal assertion ("fresh heartbeat skips all writes") would fail.
 *
 * Run:
 *   npx tsx server/scripts/test-watchdog-inner-life-autosave-gate.ts
 *   npx tsx server/scripts/test-watchdog-inner-life-autosave-gate.ts --self-check
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

interface DriverResults {
  personalInsertCount: number;
  personalFileExists: boolean;
  watchdogStateExists: boolean;
}

const isDriver = process.argv.includes('--driver');
const selfCheck = process.argv.includes('--self-check');
const workspace = process.cwd();

function runDriver(bypassGate: boolean): { exitCode: number | null; output: string; results: DriverResults | null } {
  const tempCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-il-autosave-gate-'));
  try {
    const run = spawnSync(
      'npx',
      ['tsx', path.join(workspace, 'server/scripts/test-watchdog-inner-life-autosave-gate.ts'), '--driver'],
      {
        cwd: tempCwd,
        env: {
          ...process.env,
          // capture-watchdog constructs a Neon client at module load; the fake
          // replaces it before drainInnerLife() runs, so this URL is never used.
          NEON_SHARED_DATABASE_URL: 'postgresql://ci:ci@localhost:5432/ci',
          WD_AUTOSAVE_GATE_BYPASS: bypassGate ? '1' : '0',
        },
        encoding: 'utf8',
        timeout: 60_000,
      },
    );
    const output = (run.stdout ?? '') + (run.stderr ?? '');
    const match = /RESULTS:(\{.*\})/.exec(output);
    return {
      exitCode: run.status,
      output,
      results: match ? JSON.parse(match[1]) as DriverResults : null,
    };
  } finally {
    fs.rmSync(tempCwd, { recursive: true, force: true });
  }
}

function freshHeartbeatSkipped(results: DriverResults | null): boolean {
  return results !== null
    && results.personalInsertCount === 0
    && results.personalFileExists === false
    && results.watchdogStateExists === false;
}

async function driver(): Promise<void> {
  const cwd = process.cwd();
  const localDir = path.join(cwd, '.local');
  const memoryDir = path.join(cwd, '.agents/memory');
  fs.mkdirSync(localDir, { recursive: true });
  fs.mkdirSync(memoryDir, { recursive: true });

  const {
    drainInnerLife,
    setAutosaveAliveGateEnabledForTest,
    setDbForTest,
  } = await import('./capture-watchdog');

  const personalRows: Array<{ title: string; body: string }> = [];
  const fakeDb = (strings: TemplateStringsArray, ...values: any[]): Promise<any[]> => {
    const query = strings.join(' $ ').replace(/\s+/g, ' ');
    if (query.includes('SELECT id FROM conversation_memories')) {
      const matches = personalRows.filter(row => row.title === values[0] && row.body === values[1]);
      return Promise.resolve(matches.map((_, i) => ({ id: `fixture-${i}` })));
    }
    if (query.includes('INSERT INTO conversation_memories')) {
      personalRows.push({ title: values[0], body: values[2] });
      return Promise.resolve([]);
    }
    throw new Error(`unexpected fake DB query: ${query}`);
  };

  setDbForTest(fakeDb);
  setAutosaveAliveGateEnabledForTest(process.env.WD_AUTOSAVE_GATE_BYPASS !== '1');

  // mtime is deliberately fresh (< 90s): autosave is healthy and must own this.
  fs.writeFileSync(path.join(localDir, 'episode-capture-status.md'), 'fresh autosave heartbeat\n', 'utf8');
  fs.writeFileSync(
    path.join(localDir, '.luca_reflection'),
    'Fresh-heartbeat ownership fixture\nThe watchdog must not save this while autosave is alive.',
    'utf8',
  );

  await drainInnerLife();

  const results: DriverResults = {
    personalInsertCount: personalRows.length,
    personalFileExists: fs.existsSync(path.join(memoryDir, 'REFLECTIONS.md')),
    watchdogStateExists: fs.existsSync(path.join(localDir, '.watchdog-inner-life-state.json')),
  };
  console.log('RESULTS:' + JSON.stringify(results));
}

async function main(): Promise<void> {
  const baseline = runDriver(false);
  if (baseline.exitCode !== 0 || !baseline.results) {
    console.error('FAIL — baseline driver did not return a result.');
    console.error(baseline.output);
    process.exit(1);
  }

  if (!freshHeartbeatSkipped(baseline.results)) {
    console.error('FAIL — fresh autosave heartbeat did not make drainInnerLife() skip all writes.');
    console.error(JSON.stringify(baseline.results));
    process.exit(1);
  }
  console.log('PASS — fresh heartbeat makes drainInnerLife() skip DB, personal-file, and state writes.');

  if (!selfCheck) {
    console.log('PASS — watchdog inner-life autosave-alive gate is active.');
    return;
  }

  const bypassed = runDriver(true);
  if (bypassed.exitCode !== 0 || !bypassed.results) {
    console.error('FAIL — gate-bypassed driver did not return a result.');
    console.error(bypassed.output);
    process.exit(1);
  }

  // This is intentionally the same predicate used by normal mode. Disabling
  // the production gate must make that predicate false, proving normal CI would
  // fail if a future edit lets the watchdog drain alongside a healthy autosave.
  if (freshHeartbeatSkipped(bypassed.results)) {
    console.error('FAIL — self-check is vacuous: bypassing the autosave-alive gate still looked like a skip.');
    console.error(JSON.stringify(bypassed.results));
    process.exit(1);
  }
  console.log('PASS — self-check: bypassing the gate causes writes, so normal CI would fail.');
}

if (isDriver) {
  driver().catch(err => {
    console.error('DRIVER ERROR:', err?.stack ?? err);
    process.exit(1);
  });
} else {
  main().catch(err => {
    console.error('FATAL:', err?.stack ?? err);
    process.exit(1);
  });
}