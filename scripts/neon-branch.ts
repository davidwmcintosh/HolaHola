/**
 * Shared Neon branch lifecycle tool — the one place every interface (Claude
 * Code, Replit, Cursor, Antigravity, or a human) creates/uses/deletes Neon
 * branches, so the procedure is identical everywhere instead of each tool
 * growing its own habit. Design: docs/superpowers/specs/2026-08-30-neon-branch-migration-workflow-design.md
 *
 * Subcommands:
 *   create <name> [--parent <name|id>] [--expires-at <duration|ISO>] [--schema-only]
 *   connection-string <name|id> [--pooled]
 *   list
 *   delete <name|id> [--hard]
 *   gate [--expires-at <duration|ISO>] [--keep-on-failure]
 *
 * Talks to the Neon Management API directly (not the `neon` CLI) so it has
 * nothing to install across Windows, Codespace Linux, and Replit's container
 * alike — same reasoning that already led scripts/neon-schema-push.ts to call
 * @neondatabase/serverless directly instead of wrapping a CLI.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

// Replit/Codespace inject secrets directly into the process environment, no
// .env file involved. A local checkout (this repo's own convention, see
// .env.template) needs one loaded explicitly. loadEnvFile never overrides a
// variable that's already set, so this is a safe no-op wherever ambient env
// vars are already present.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const API_BASE = 'https://console.neon.tech/api/v2';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} — add it to .env (see .env.template) before running scripts/neon-branch.ts`);
  }
  return value;
}

// The database and role names are never assumed. A past incident (see the
// Claude Code test environment design doc) had a generated connection string
// silently point at the wrong database within the right branch. Every
// connection string this tool hands out is resolved from the branch's own
// database list, matched against the real app database name — never guessed.
function appDatabaseName(): string {
  const sharedUrl = requireEnv('NEON_SHARED_DATABASE_URL');
  const parsed = new URL(sharedUrl);
  const name = parsed.pathname.replace(/^\//, '');
  if (!name) {
    throw new Error(`Could not parse a database name out of NEON_SHARED_DATABASE_URL (${sharedUrl})`);
  }
  return name;
}

async function neonApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = requireEnv('NEON_API_KEY');
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Neon API ${init.method ?? 'GET'} ${path} failed: ${res.status} ${res.statusText} ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

interface NeonBranch {
  id: string;
  name: string;
  parent_id?: string;
  default: boolean;
  protected: boolean;
  current_state: 'init' | 'creating' | 'ready' | 'archived' | string;
}

interface NeonDatabase {
  id: number;
  name: string;
  owner_name: string;
  branch_id: string;
}

async function listBranches(): Promise<NeonBranch[]> {
  const projectId = requireEnv('NEON_PROJECT_ID');
  const data = await neonApi<{ branches: NeonBranch[] }>(`/projects/${projectId}/branches`);
  return data.branches;
}

async function resolveBranch(nameOrId: string): Promise<NeonBranch> {
  const branches = await listBranches();
  const byId = branches.find((b) => b.id === nameOrId);
  if (byId) return byId;
  const byName = branches.find((b) => b.name === nameOrId);
  if (byName) return byName;
  throw new Error(`No branch found matching "${nameOrId}"`);
}

async function resolveParentBranchId(nameOrId: string): Promise<string> {
  const branches = await listBranches();
  const byId = branches.find((b) => b.id === nameOrId);
  if (byId) return byId.id;
  const byName = branches.find((b) => b.name === nameOrId);
  if (byName) return byName.id;
  if (nameOrId === 'production') {
    const def = branches.find((b) => b.default);
    if (def) return def.id;
  }
  throw new Error(`No parent branch found matching "${nameOrId}"`);
}

function parseExpiresAt(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const shorthand = /^(\d+)(m|h|d)$/.exec(value);
  if (!shorthand) {
    // Assume it's already an ISO 8601 timestamp; let the API reject it if not.
    return value;
  }
  const amount = Number(shorthand[1]);
  const unitMs = { m: 60_000, h: 3_600_000, d: 86_400_000 }[shorthand[2] as 'm' | 'h' | 'd'];
  return new Date(Date.now() + amount * unitMs).toISOString();
}

async function waitUntilReady(branchId: string, timeoutMs = 60_000): Promise<void> {
  const projectId = requireEnv('NEON_PROJECT_ID');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { branch } = await neonApi<{ branch: NeonBranch }>(`/projects/${projectId}/branches/${branchId}`);
    if (branch.current_state === 'ready') return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Branch ${branchId} did not become ready within ${timeoutMs}ms`);
}

async function resolveDatabaseAndRole(branchId: string): Promise<{ database: string; role: string }> {
  const projectId = requireEnv('NEON_PROJECT_ID');
  const target = appDatabaseName();
  const { databases } = await neonApi<{ databases: NeonDatabase[] }>(
    `/projects/${projectId}/branches/${branchId}/databases`,
  );
  const match = databases.find((db) => db.name === target);
  if (!match) {
    throw new Error(
      `Branch ${branchId} has no database named "${target}" (found: ${databases.map((d) => d.name).join(', ') || 'none'}) — refusing to guess`,
    );
  }
  return { database: match.name, role: match.owner_name };
}

async function fetchConnectionUri(branchId: string, pooled: boolean): Promise<string> {
  const projectId = requireEnv('NEON_PROJECT_ID');
  const { database, role } = await resolveDatabaseAndRole(branchId);
  const params = new URLSearchParams({
    database_name: database,
    role_name: role,
    branch_id: branchId,
    pooled: String(pooled),
  });
  const { uri } = await neonApi<{ uri: string }>(`/projects/${projectId}/connection_uri?${params}`);
  return uri;
}

async function createBranch(opts: {
  name: string;
  parent: string;
  expiresAt?: string;
  schemaOnly: boolean;
}): Promise<NeonBranch> {
  const projectId = requireEnv('NEON_PROJECT_ID');
  const parentId = await resolveParentBranchId(opts.parent);
  const { branch } = await neonApi<{ branch: NeonBranch }>(`/projects/${projectId}/branches`, {
    method: 'POST',
    body: JSON.stringify({
      branch: {
        name: opts.name,
        parent_id: parentId,
        expires_at: opts.expiresAt,
        ...(opts.schemaOnly ? { init_source: 'schema-only' } : {}),
      },
      endpoints: [{ type: 'read_write' }],
    }),
  });
  await waitUntilReady(branch.id);
  return branch;
}

async function deleteBranch(branchId: string, hard: boolean): Promise<void> {
  const projectId = requireEnv('NEON_PROJECT_ID');
  const params = hard ? '?hard_delete=true' : '';
  await neonApi(`/projects/${projectId}/branches/${branchId}${params}`, { method: 'DELETE' });
}

function runCommand(command: string, env: NodeJS.ProcessEnv): Promise<{ code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: 'inherit',
      env,
    });
    child.on('error', () => resolve({ code: 1 }));
    child.on('close', (code) => resolve({ code }));
  });
}

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, inlineValue] = arg.slice(2).split('=');
      if (inlineValue !== undefined) {
        flags[key] = inlineValue;
      } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

async function cmdCreate(positional: string[], flags: Record<string, string | boolean>) {
  const name = positional[0] ?? flags.name;
  if (!name || typeof name !== 'string') {
    throw new Error('Usage: neon-branch.ts create <name> [--parent <name|id>] [--expires-at <duration>] [--schema-only]');
  }
  const parent = (flags.parent as string) ?? 'production';
  const expiresAt = parseExpiresAt((flags['expires-at'] as string) ?? '14d');
  const branch = await createBranch({ name, parent, expiresAt, schemaOnly: Boolean(flags['schema-only']) });
  const pooled = await fetchConnectionUri(branch.id, true);
  const direct = await fetchConnectionUri(branch.id, false);
  console.log(`Created branch "${branch.name}" (${branch.id}), expires ${expiresAt ?? 'never'}`);
  console.log(`Pooled connection string (general app/dev-server use):\n  ${pooled}`);
  console.log(`Direct connection string (migrations, drizzle-kit):\n  ${direct}`);
  console.log(`\nPoint your environment's NEON_SHARED_DATABASE_URL at the pooled string above to use this branch.`);
  console.log(`Delete it when done: npx tsx scripts/neon-branch.ts delete ${branch.name}`);
}

async function cmdConnectionString(positional: string[], flags: Record<string, string | boolean>) {
  const nameOrId = positional[0];
  if (!nameOrId) {
    throw new Error('Usage: neon-branch.ts connection-string <name|id> [--pooled]');
  }
  const branch = await resolveBranch(nameOrId);
  const uri = await fetchConnectionUri(branch.id, Boolean(flags.pooled));
  console.log(uri);
}

async function cmdList() {
  const branches = await listBranches();
  for (const b of branches) {
    console.log(`${b.default ? '*' : ' '} ${b.name}\t${b.id}\t${b.current_state}${b.protected ? '\t[protected]' : ''}`);
  }
}

async function cmdDelete(positional: string[], flags: Record<string, string | boolean>) {
  const nameOrId = positional[0];
  if (!nameOrId) {
    throw new Error('Usage: neon-branch.ts delete <name|id> [--hard]');
  }
  const branch = await resolveBranch(nameOrId);
  if (branch.default) {
    throw new Error(`Refusing to delete "${branch.name}" — it is the project's default branch`);
  }
  if (branch.protected) {
    throw new Error(`Refusing to delete "${branch.name}" — it is marked protected in Neon`);
  }
  await deleteBranch(branch.id, Boolean(flags.hard));
  console.log(`Deleted branch "${branch.name}" (${branch.id})`);
}

// Flow B: prove a pending drizzle migration on a disposable branch before it
// ever reaches NEON_SHARED_DATABASE_URL. Always deletes the branch itself on
// both pass and fail — nothing ephemeral survives past this run except
// through the --expires-at backstop, in case the process is killed mid-way.
async function cmdGate(flags: Record<string, string | boolean>) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const branchName = `test/migration-${timestamp}`;
  const expiresAt = parseExpiresAt((flags['expires-at'] as string) ?? '6h');

  console.log(`[gate] Creating branch "${branchName}" from production...`);
  const branch = await createBranch({ name: branchName, parent: 'production', expiresAt, schemaOnly: false });
  const directUrl = await fetchConnectionUri(branch.id, false);

  // Deliberately never printed: unlike create/connection-string, this
  // command's stdout can end up in CI/agent logs. The child processes below
  // only ever see the URL via their own env, never via a logged argument.
  const branchEnv: NodeJS.ProcessEnv = { ...process.env, NEON_SHARED_DATABASE_URL: directUrl };
  // Never inherit CI=true here — run-ci-test-steps.mjs requires
  // CI_DATABASE_URL to be a localhost Postgres service when CI is true, and
  // this branch's URL is intentionally a real Neon host, not that service.
  delete branchEnv.CI;

  let failureReason: string | null = null;

  console.log('[gate] Applying migration to the branch...');
  const migrate = await runCommand('npx drizzle-kit migrate', branchEnv);
  if (migrate.code !== 0) {
    failureReason = `drizzle-kit migrate exited ${migrate.code}`;
  }

  if (!failureReason) {
    for (const group of ['test:ci:unit', 'test:ci:guards', 'test:ci:episodes']) {
      console.log(`[gate] Running npm run ${group} against the branch...`);
      const result = await runCommand(`npm run ${group}`, branchEnv);
      if (result.code !== 0) {
        failureReason = `npm run ${group} exited ${result.code}`;
        break;
      }
    }
  }

  if (!flags['keep-on-failure'] || !failureReason) {
    console.log(`[gate] Deleting branch "${branchName}"...`);
    await deleteBranch(branch.id, false).catch((err) =>
      console.error(`[gate] WARNING: failed to delete branch ${branch.name} (${branch.id}): ${err.message}`),
    );
  } else {
    console.log(`[gate] --keep-on-failure set: leaving "${branchName}" (${branch.id}) for inspection.`);
  }

  if (failureReason) {
    console.error(`[gate] FAILED: ${failureReason}`);
    console.error('[gate] Migration was NOT applied to NEON_SHARED_DATABASE_URL.');
    process.exitCode = 1;
    return;
  }

  console.log('[gate] READY_TO_PROMOTE — migration passed on an isolated branch.');
  console.log('[gate] Run `npx drizzle-kit migrate` now to apply it for real.');
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseFlags(rest);

  switch (subcommand) {
    case 'create':
      return cmdCreate(positional, flags);
    case 'connection-string':
      return cmdConnectionString(positional, flags);
    case 'list':
      return cmdList();
    case 'delete':
      return cmdDelete(positional, flags);
    case 'gate':
      return cmdGate(flags);
    default:
      console.error('Usage: neon-branch.ts <create|connection-string|list|delete|gate> [options]');
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
