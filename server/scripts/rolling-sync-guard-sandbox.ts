/**
 * Own a fresh local PostgreSQL cluster and temporary capture workspace for the
 * rolling-sync integration test. Never inherit a development/production DB.
 */
import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname, resolve, delimiter } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { createServer } from 'net';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { getVerifiedCiDatabaseUrl } from '../ci-database';

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No fixture port allocated');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  return port;
}

export async function runRollingSyncSandbox(args: string[]): Promise<number> {
  const root = mkdtempSync(join(tmpdir(), 'rolling-sync-ci-'));
  const data = join(root, 'postgres');
  let pgCtl = '';
  let ciAdmin: Client | null = null;
  let ciDatabaseName = '';
  let fixtureDb: Client | null = null;
  try {
    let url: string;
    const verifiedCiUrl = getVerifiedCiDatabaseUrl();
    if (verifiedCiUrl) {
      // GitHub CI already owns a PostgreSQL service; do not require server
      // binaries on its host or share its migrated database/fixture namespace.
      ciAdmin = new Client({ connectionString: verifiedCiUrl });
      await ciAdmin.connect();
      ciDatabaseName = `rolling_sync_ci_${randomUUID().replace(/-/g, '')}`;
      await ciAdmin.query(`CREATE DATABASE "${ciDatabaseName}"`);
      const scopedUrl = new URL(verifiedCiUrl);
      scopedUrl.pathname = `/${ciDatabaseName}`;
      url = scopedUrl.toString();
    } else {
      const initDb = (process.env.PATH ?? '').split(delimiter)
        .map(dir => join(dir, 'initdb')).find(candidate => existsSync(candidate));
      if (!initDb) throw new Error('Rolling-sync CI requires local PostgreSQL initdb/pg_ctl tools or a verified CI service; no live-DB fallback is permitted');
      const bindir = dirname(initDb);
      pgCtl = join(bindir, 'pg_ctl');
      execFileSync(join(bindir, 'initdb'), [
        '-D', data, '-A', 'trust', '-U', 'fixture_owner', '--no-locale',
      ], { stdio: 'pipe', timeout: 30_000 });
      const port = await unusedPort();
      execFileSync(pgCtl, [
        '-D', data, '-l', join(root, 'postgres.log'), '-w', '-t', '20',
        '-o', `-h 127.0.0.1 -p ${port} -k ${root}`, 'start',
      ], { stdio: 'pipe', timeout: 30_000 });
      url = `postgresql://fixture_owner@127.0.0.1:${port}/postgres`;
    }
    fixtureDb = new Client({ connectionString: url });
    await fixtureDb.connect();
    await fixtureDb.query(`
      CREATE TABLE conversation_memories (
        id uuid PRIMARY KEY, title text NOT NULL, summary text, content text,
        importance integer, entry_type text, tags text[], arc_name text,
        created_at timestamptz DEFAULT now(),
        UNIQUE (arc_name, title)
      );
      INSERT INTO conversation_memories (id, title, content, tags, arc_name)
      VALUES ('99000000-0000-4000-8000-000000000099', 'Episode 99',
              'Existing episode must survive', ARRAY['episode'], 'HolaHola Episodes');
    `);

    mkdirSync(join(root, 'server'));
    mkdirSync(join(root, 'shared'));
    mkdirSync(join(root, 'docs'));
    mkdirSync(join(root, '.local'));
    writeFileSync(join(root, 'package.json'), '{}');
    writeFileSync(join(root, 'drizzle.config.ts'), 'export default {};');
    writeFileSync(join(root, 'shared/schema.ts'), 'export {};');
    writeFileSync(join(root, 'docs/episode-99.md'), 'Existing episode file must survive');
    const env = { ...process.env };
    // The test owns both destinations. Strip unrelated inherited credentials
    // before supplying the exact job-local pair required by ci-database.ts.
    for (const key of Object.keys(env)) {
      if (key.endsWith('DATABASE_URL') || key.includes('OPENAI') || key === 'REPL_HOME') delete env[key];
    }
    Object.assign(env, {
      CI: 'true', CI_DATABASE_URL: url, NEON_SHARED_DATABASE_URL: url,
      HOLAHOLA_WORKSPACE_ROOT: root,
    });
    const driverCommand = [
      require.resolve('tsx/cli'), '--tsconfig', join(projectRoot, 'tsconfig.json'),
      join(projectRoot, 'server/scripts/test-rolling-sync-guard.ts'),
      '--isolated-driver', ...args,
    ];
    for (const negative of [
      { name: 'unverified DB', cwd: root, env: { ...env, CI: 'false' } },
      { name: 'real checkout', cwd: projectRoot, env: { ...env, HOLAHOLA_WORKSPACE_ROOT: projectRoot } },
    ]) {
      const rejected = spawnSync(process.execPath, driverCommand, {
        cwd: negative.cwd, env: negative.env, encoding: 'utf8', timeout: 30_000,
      });
      if (rejected.status === null || rejected.status === 0 ||
          !rejected.stderr.includes('REFUSING TO RUN: rolling-sync driver requires')) {
        throw new Error(`Isolation guard did not refuse ${negative.name} before application imports`);
      }
      console.log(`PASS — rolling-sync isolation refuses ${negative.name}`);
    }
    const result = spawnSync(process.execPath, driverCommand, {
      cwd: root, env, stdio: 'inherit', timeout: 120_000,
    });
    if (result.error) throw result.error;
    if (result.status === null) throw new Error(`Fixture driver terminated by ${result.signal}`);
    const preserved = await fixtureDb.query(
      "SELECT content FROM conversation_memories WHERE title = 'Episode 99' AND arc_name = 'HolaHola Episodes'",
    );
    if (preserved.rows.length !== 1 || preserved.rows[0].content !== 'Existing episode must survive' ||
        readFileSync(join(root, 'docs/episode-99.md'), 'utf8') !== 'Existing episode file must survive') {
      throw new Error('Rolling-sync fixture touched the unrelated Episode 99 row or file');
    }
    console.log('PASS — existing Episode 99 row and file preserved in isolated fixture');
    return result.status;
  } finally {
    try {
      await fixtureDb?.end();
      if (ciAdmin) {
        try {
          if (ciDatabaseName) await ciAdmin.query(`DROP DATABASE IF EXISTS "${ciDatabaseName}" WITH (FORCE)`);
        } finally {
          await ciAdmin.end();
        }
      }
      if (pgCtl && existsSync(join(data, 'postmaster.pid'))) execFileSync(pgCtl, ['-D', data, '-m', 'immediate', '-w', 'stop'], {
        stdio: 'pipe', timeout: 30_000,
      });
      rmSync(root, { recursive: true, force: true });
    } catch (error) {
      // Keep the directory/logs if shutdown failed rather than deleting the
      // backing files of a PostgreSQL process that might still be running.
      throw error;
    }
  }
}