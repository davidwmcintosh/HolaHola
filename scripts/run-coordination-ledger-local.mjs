import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { Pool } from 'pg';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const suppliedUrl = process.env.COORDINATION_TEST_POSTGRES_URL;
let clusterDirectory;
let postgresProcess;
let adminUrl;
let testDatabaseName;

function checked(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status ?? 'without a status'}`);
  }
}

function postgresBinary(name) {
  const fromPath = spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' }).stdout.trim();
  if (fromPath) return fromPath;
  const found = spawnSync(
    'sh',
    [
      '-c',
      `for root in /usr/lib/postgresql /nix/store; do ` +
        `[ -d "$root" ] && find "$root" -path '*/bin/${name}' -type f 2>/dev/null; ` +
      `done | head -n 1`,
    ],
    { encoding: 'utf8' },
  ).stdout.trim();
  if (!found) throw new Error(`PostgreSQL command "${name}" is required`);
  return found;
}

async function unusedPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForPostgres(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 200 });
    try {
      await pool.query('SELECT 1');
      await pool.end();
      return;
    } catch {
      await pool.end().catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Temporary PostgreSQL server did not become ready');
}

async function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code ?? signal}`));
    });
  });
}

async function cleanup() {
  if (adminUrl && testDatabaseName) {
    const pool = new Pool({ connectionString: adminUrl });
    try {
      await pool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [testDatabaseName],
      );
      await pool.query(`DROP DATABASE IF EXISTS "${testDatabaseName.replaceAll('"', '""')}"`);
    } finally {
      await pool.end().catch(() => {});
    }
  }
  if (postgresProcess) {
    if (postgresProcess.exitCode === null && postgresProcess.signalCode === null) {
      postgresProcess.kill('SIGTERM');
      await new Promise(resolve => postgresProcess.once('exit', resolve));
    }
  }
  if (clusterDirectory) await rm(clusterDirectory, { recursive: true, force: true });
}

try {
  if (suppliedUrl) {
    const parsed = new URL(suppliedUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !LOCAL_HOSTS.has(parsed.hostname)) {
      throw new Error('COORDINATION_TEST_POSTGRES_URL must target a local PostgreSQL server');
    }
    adminUrl = parsed.toString();
  } else {
    clusterDirectory = await mkdtemp(join(tmpdir(), 'holahola-coordination-postgres-'));
    const dataDirectory = join(clusterDirectory, 'data');
    const port = await unusedPort();
    checked(postgresBinary('initdb'), ['-D', dataDirectory, '-A', 'trust', '-U', 'postgres', '--no-locale']);
    postgresProcess = spawn(
      postgresBinary('postgres'),
      ['-D', dataDirectory, '-h', '127.0.0.1', '-k', clusterDirectory, '-p', String(port)],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
    adminUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`;
    await waitForPostgres(adminUrl);
  }

  testDatabaseName = `holahola_coordination_${process.pid}_${Date.now()}`;
  const adminPool = new Pool({ connectionString: adminUrl });
  await adminPool.query(`CREATE DATABASE "${testDatabaseName}"`);
  await adminPool.end();

  const testUrl = new URL(adminUrl);
  testUrl.pathname = `/${testDatabaseName}`;
  const env = {
    ...process.env,
    CI: 'true',
    CI_DATABASE_URL: testUrl.toString(),
    NEON_SHARED_DATABASE_URL: testUrl.toString(),
    COORDINATION_INBOX_DISPOSABLE_BRANCH_ID: `local-${testDatabaseName}`,
  };

  console.log('[coordination-local] applying migrations to a disposable local database');
  await run('npx', ['drizzle-kit', 'migrate'], env);
  console.log('[coordination-local] seeding coordination fixtures and materializing the inbox');
  await run('npx', ['tsx', 'server/scripts/setup-ci-test-database.ts'], env);
  console.log('[coordination-local] running the full coordination validation');
  await run('npm', ['run', 'test:coordination-ledger:run'], env);
} finally {
  await cleanup();
  console.log('[coordination-local] removed the disposable database state');
}