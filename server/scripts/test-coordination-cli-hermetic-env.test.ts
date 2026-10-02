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
import { COORDINATION_ACTOR_IDS } from '@shared/schema';
import { COORDINATION_TOKEN_ENV_BY_ACTOR } from '../middleware/coordination-auth';

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
  // Every actor's dedicated legacy token, plus the broker runtime identity
  // and bootstrap token, so a test that DOES set COORDINATION_ACTOR (see the
  // allowlist-completeness test below) deterministically reaches
  // CoordinationActorClient's "authentication is not configured" error
  // instead of picking up this dev sandbox's own real operational
  // credentials, which are legitimately configured here for normal use.
  for (const tokenEnvName of Object.values(COORDINATION_TOKEN_ENV_BY_ACTOR)) {
    delete env[tokenEnvName];
  }
  delete env.COORDINATION_RUNTIME_ID;
  delete env.COORDINATION_RUNTIME_BOOTSTRAP_TOKEN;
  delete env.COORDINATION_RUNTIME_TOKEN_CACHE_PATH;
  return env;
}

async function runCli(
  args: string[],
  envOverrides: NodeJS.ProcessEnv = {},
): Promise<{ code: number; output: string }> {
  try {
    const { stdout, stderr } = await execFile(
      'npx',
      ['tsx', 'server/scripts/coordination-cli.ts', ...args],
      { env: { ...hermeticEnv(), ...envOverrides }, timeout: 60_000 },
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

// ── allowlist completeness (Task 1640) ──────────────────────────────────────
//
// coordination-cli.ts used to hand-maintain two separate array literals (one
// for COORDINATION_ACTOR in main(), one for --recipient in
// requiredRecipient()) that duplicated COORDINATION_ACTOR_IDS (shared/schema.ts)
// instead of deriving from it. Both silently fell out of sync with the
// canonical list: 'luca-antigravity' was fully wired into coordination auth,
// capabilities, and the actor-client type/permission checks yet still
// rejected by the CLI with a generic "Unsupported" error (Task #1636), and
// 'luca-gemini' had independently drifted out of the same two arrays by the
// time that was fixed.
//
// test-coordination-actor-clients.test.ts asserts the exported
// SUPPORTED_COORDINATION_ACTORS constant itself matches COORDINATION_ACTOR_IDS.
// This test is deliberately independent of that constant (it never imports
// it): it spawns the real CLI binary and drives it through argument parsing,
// command dispatch, and both allowlist checks end to end, so it still catches
// a regression even if a future change stops main()/requiredRecipient() from
// actually using that constant.
test('the CLI accepts every real coordination actor as both COORDINATION_ACTOR and --recipient', async () => {
  const interactiveActors = COORDINATION_ACTOR_IDS.filter((id) => id !== 'coordination-system');
  const outcomes = await Promise.all(interactiveActors.map(async (actor) => {
    // 'create' is the one command that exercises both checks in a single
    // invocation: COORDINATION_ACTOR is validated in main() before dispatch,
    // and --recipient is validated by requiredRecipient() inside the create
    // branch. Using the same actor for both keeps this to one spawn per
    // actor. COORDINATION_API_URL points at the IANA-reserved .invalid TLD
    // (RFC 2606), which never resolves, so the CLI always fails past both
    // allowlist checks -- either at credential exchange (no bootstrap token
    // configured) or at a role-specific action restriction (e.g. daniela
    // cannot 'create') -- and never performs a real network request.
    const result = await runCli(
      ['create', '--title', 't', '--description', 'd', '--recipient', actor, '--idempotency-key', 'k'],
      { COORDINATION_API_URL: 'http://coordination.invalid', COORDINATION_ACTOR: actor },
    );
    return { actor, result };
  }));
  for (const { actor, result } of outcomes) {
    assert.doesNotMatch(
      result.output,
      /Unsupported COORDINATION_ACTOR/,
      `COORDINATION_ACTOR=${actor} is declared in shared/schema.ts's COORDINATION_ACTOR_IDS and must be ` +
        `accepted by coordination-cli.ts, not rejected by a stale hand-maintained allowlist. Output:\n${result.output}`,
    );
    assert.doesNotMatch(
      result.output,
      /Unsupported --recipient/,
      `--recipient ${actor} is declared in shared/schema.ts's COORDINATION_ACTOR_IDS and must be accepted by ` +
        `coordination-cli.ts, not rejected by a stale hand-maintained allowlist. Output:\n${result.output}`,
    );
    assert.doesNotMatch(
      result.output,
      DB_FATAL_PATTERN,
      `COORDINATION_ACTOR=${actor} must not require a database credential. Output:\n${result.output}`,
    );
  }
});
