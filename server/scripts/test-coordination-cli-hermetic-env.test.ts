/**
 * Regression guard: server/scripts/coordination-cli.ts is the HTTP-only tool
 * external, non-Replit coordination runtimes (e.g. a Claude Code Cloud
 * session) use to talk to the coordination server. It has no legitimate
 * reason to touch the database directly, and must run -- far enough to
 * validate its own arguments and configuration -- on a machine with no
 * database credential configured at all.
 *
 * Background (Task 1568): the CLI's import chain (coordination-cli.ts ->
 * coordination-actor-client.ts -> coordination-auth.ts ->
 * coordination-credential-broker.ts -> server/db.ts) used to pull in
 * server/db.ts as an eager, value-level import. server/db.ts throws
 * synchronously at module-load time when NEON_SHARED_DATABASE_URL is unset,
 * so the CLI crashed before it could even parse its own arguments on any
 * machine that (correctly) has no database credential -- confirmed live on
 * 2026-09-23 by a Claude Code Cloud session in a fresh container, which
 * worked around it by exporting a placeholder NEON_SHARED_DATABASE_URL.
 *
 * Fixed by making coordination-auth.ts's import of
 * coordination-credential-broker.ts type-only, and loading the two functions
 * that actually need the broker's real implementation
 * (resolveBrokerCredential, auditBrokerAccessDenied) with a dynamic import
 * inside resolveCoordinationCapability's broker-fallback branch -- the one
 * code path that ever needs them, and one the CLI itself never reaches (it
 * only performs outbound HTTP fetches via coordination-actor-client.ts).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile as execFileCallback } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

// The exact string server/db.ts throws at module-load time when it has no
// database URL to connect to. Asserting on its ABSENCE (not just a
// particular exit code) is what makes a failure here name the
// DB-dependency problem specifically, instead of merely proving some
// unrelated command failed.
const DB_FATAL_PATTERN = /\[DB\] FATAL: NEON_SHARED_DATABASE_URL is required/;

function hermeticEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Every credential/URL that could make server/db.ts's module-scope check
  // pass, or connect it to a real database if some other regression made it
  // load eagerly again. A machine running only this CLI (e.g. a fresh
  // external coordination runtime container) has none of these configured.
  delete env.NEON_SHARED_DATABASE_URL;
  delete env.CI_DATABASE_URL;
  delete env.CI;
  delete env.OLD_DATABASE_URL;
  delete env.PGHOST;
  delete env.PGUSER;
  delete env.PGPASSWORD;
  delete env.PGDATABASE;
  delete env.PGPORT;
  // The CLI's own configuration is deliberately left unset too, so a run
  // that gets past every eager import lands on the CLI's own, controlled
  // configuration validation instead of silently succeeding for an
  // unrelated reason.
  delete env.COORDINATION_API_URL;
  delete env.COORDINATION_ACTOR;
  return env;
}

async function runCli(args: string[]): Promise<{ code: number; output: string }> {
  try {
    const { stdout, stderr } = await execFile(
      'npx',
      ['tsx', 'server/scripts/coordination-cli.ts', ...args],
      { env: hermeticEnv(), timeout: 60_000 },
    );
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error: any) {
    const code = typeof error?.code === 'number' ? error.code : 1;
    return { code, output: `${error?.stdout ?? ''}${error?.stderr ?? ''}${error?.message ?? ''}` };
  }
}

// ── static shape of the fix ─────────────────────────────────────────────────

test('coordination-auth.ts imports the credential broker as a type only', () => {
  const source = readFileSync('server/middleware/coordination-auth.ts', 'utf8');
  const importLines = source
    .split('\n')
    .filter((line) => line.includes("from '../services/coordination-credential-broker'"));
  assert.ok(
    importLines.length > 0,
    'expected at least one import referencing coordination-credential-broker in coordination-auth.ts -- update this guard if the reference moved',
  );
  for (const line of importLines) {
    assert.match(
      line,
      /^\s*import type\b/,
      'coordination-auth.ts must import coordination-credential-broker.ts (and therefore server/db.ts) ' +
        `as a type only, never eagerly by value -- found: ${line.trim()}`,
    );
  }
});

test('resolveCoordinationCapability loads the broker implementation lazily', () => {
  const source = readFileSync('server/middleware/coordination-auth.ts', 'utf8');
  assert.match(
    source,
    /await import\(['"]\.\.\/services\/coordination-credential-broker['"]\)/,
    'resolveCoordinationCapability must dynamically import coordination-credential-broker.ts inside its ' +
      'broker-fallback branch rather than relying on a top-level value import',
  );
});

test('the CLI and its direct import graph never reference the live database module', () => {
  const files = [
    'server/scripts/coordination-cli.ts',
    'server/services/coordination-actor-client.ts',
    'server/middleware/coordination-auth.ts',
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /from\s+['"]\.\.?\/db['"]/, `${file} must not import the live database module`);
  }
});

// ── standalone execution (no database, no CLI configuration) ───────────────

test('the CLI prints its usage message with no database credential configured at all', async () => {
  const bare = await runCli([]);
  assert.notEqual(bare.code, 0, 'a bare invocation (missing command) is expected to fail');
  assert.doesNotMatch(
    bare.output,
    DB_FATAL_PATTERN,
    'coordination-cli.ts must not require a database credential just to print its usage message. ' +
      `Output:\n${bare.output}`,
  );
  assert.match(bare.output, /Commands: create, list/, 'expected the usage message');
});

test('the CLI reaches its own configuration validation with no database credential configured at all', async () => {
  const inbox = await runCli(['inbox']);
  assert.doesNotMatch(
    inbox.output,
    DB_FATAL_PATTERN,
    'coordination-cli.ts must not require a database credential to run the inbox command. This usually means ' +
      'an eager (non-type-only) import of a DB-touching module was reintroduced into coordination-auth.ts or ' +
      `its dependency chain. Output:\n${inbox.output}`,
  );
  assert.match(
    inbox.output,
    /COORDINATION_API_URL is required/,
    'expected the CLI to reach its own COORDINATION_API_URL validation, proving every import in its chain ' +
      `resolved and executed successfully with no database credential present. Output:\n${inbox.output}`,
  );
  assert.equal(
    inbox.code,
    64,
    `expected the CLI's own configuration-validation exit code, not a crash. Output:\n${inbox.output}`,
  );
});
