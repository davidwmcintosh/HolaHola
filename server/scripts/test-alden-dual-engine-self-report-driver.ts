#!/usr/bin/env npx tsx
/**
 * Driver for test-alden-dual-engine-self-report.ts -- spawned as a fresh
 * process so it always reflects whatever alden-functions.ts currently
 * contains on disk (the parent test temporarily mutates it back to the
 * pre-fix behavior for --self-check, then restores it). Calls
 * get_current_engine with an explicit per-branch engine context, exactly as
 * generateAldenResponseAnthropic/generateAldenResponseGemini now do, and
 * prints RESULTS:<json> for the parent to assert on.
 *
 * Read-only: get_current_engine only SELECTs from alden_config, it never
 * writes, so this driver is safe to run against the live shared database.
 */
import { executeAldenTool } from '../services/alden-functions';

const requestedEngine = process.argv[2];
if (requestedEngine !== 'anthropic' && requestedEngine !== 'gemini') {
  console.error('[test-alden-dual-engine-self-report-driver] Usage: driver.ts <anthropic|gemini>');
  process.exit(1);
}

(async () => {
  const result = await executeAldenTool('get_current_engine', {}, { engine: requestedEngine });
  console.log('RESULTS:' + JSON.stringify(result.data));
  // get_current_engine opens a DB pool (server/db.ts) that does not unref
  // its idle timer/socket, so the event loop never drains on its own here --
  // exit explicitly rather than hang until the parent's spawnSync timeout
  // kills this process (see .agents/memory/pg-pool-idle-timeout-ci-hang.md).
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
