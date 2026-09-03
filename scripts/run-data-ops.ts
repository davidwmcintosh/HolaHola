/**
 * Runs every data-operation script in scripts/data-ops/ against whatever
 * NEON_SHARED_DATABASE_URL currently resolves to -- a disposable gate branch
 * during `npm run db:branch -- gate`, or the real production database when
 * cross-tool-promote.yml applies gate-approved operations for real.
 *
 * This generalizes the exact pattern already proven for schema migrations
 * (drizzle-kit's own migrations table makes re-running a no-op) to arbitrary
 * data operations, which have no equivalent built-in tracking. The
 * substitute here is a hard requirement: every data-op script MUST be
 * idempotent -- check the state it cares about first, act only if still
 * needed, and report back whether it did anything. That's what makes it
 * safe to leave a script in this directory indefinitely and run it on every
 * future gate/promote without separate bookkeeping for "already applied."
 *
 * Contract for a script in scripts/data-ops/*.ts:
 *   export async function run(pool: Pool): Promise<DataOpResult>
 * The runner owns the Pool (one shared connection pool for the whole batch);
 * a script that needs transactional atomicity acquires its own client via
 * pool.connect() and manages BEGIN/COMMIT/ROLLBACK itself, same as every
 * other production-write script already written by hand in this repo this
 * session -- this just gives that existing habit a name and a gate.
 *
 * Usage: npx tsx --env-file-if-exists=.env scripts/run-data-ops.ts
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

export interface DataOpResult {
  applied: boolean;
  detail: string;
}

export interface DataOp {
  run(pool: Pool): Promise<DataOpResult>;
}

// This package is "type": "module", so __dirname doesn't exist natively —
// derive it from import.meta.url instead (fileURLToPath, not .pathname; see
// .agents/memory/ for why that distinction matters on Windows).
const DATA_OPS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data-ops');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} — add it to .env (see .env.template) before running scripts/run-data-ops.ts`);
  }
  return value;
}

async function main(): Promise<void> {
  let files: string[];
  try {
    files = readdirSync(DATA_OPS_DIR)
      .filter((f) => f.endsWith('.ts') && f !== 'README.md')
      .sort();
  } catch {
    console.log('[data-ops] scripts/data-ops/ does not exist — nothing to run.');
    return;
  }

  if (files.length === 0) {
    console.log('[data-ops] No data-op scripts found — nothing to run.');
    return;
  }

  const pool = new Pool({ connectionString: requireEnv('NEON_SHARED_DATABASE_URL') });
  let failed = false;

  try {
    for (const file of files) {
      const modulePath = join(DATA_OPS_DIR, file);
      console.log(`[data-ops] Running ${file}...`);
      let op: DataOp;
      try {
        // pathToFileURL, not the raw path — dynamic import() on Windows
        // rejects a bare "C:\..." path (wrong URL scheme); it needs a real
        // file:// URL, same class of Windows/ESM gotcha as __dirname above.
        op = await import(pathToFileURL(modulePath).href);
      } catch (err) {
        console.error(`[data-ops] FAILED to load ${file}: ${err instanceof Error ? err.message : err}`);
        failed = true;
        break;
      }
      if (typeof op.run !== 'function') {
        console.error(`[data-ops] FAILED: ${file} does not export an async run(pool) function`);
        failed = true;
        break;
      }
      try {
        const result = await op.run(pool);
        console.log(`[data-ops]   ${result.applied ? 'APPLIED' : 'no-op (already done)'} — ${result.detail}`);
      } catch (err) {
        console.error(`[data-ops] FAILED: ${file} threw: ${err instanceof Error ? err.message : err}`);
        failed = true;
        break;
      }
    }
  } finally {
    await pool.end();
  }

  if (failed) {
    console.error('[data-ops] One or more data-op scripts failed. Nothing further was applied to production.');
    process.exitCode = 1;
    return;
  }

  console.log(`[data-ops] All ${files.length} data-op script(s) completed successfully.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
