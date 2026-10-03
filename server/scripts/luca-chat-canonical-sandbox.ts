/**
 * Hermetic owner for the Luca canonical-save integration fixture.
 *
 * All writes are confined to a freshly-created PostgreSQL database and a
 * temporary workspace.  No inherited database/provider credentials reach any
 * child process.
 */
import { spawn, spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { delimiter, dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import { assertCanonicalSaveDatabaseUrl } from './luca-chat-canonical-isolation';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs');
const drizzleCli = resolve(projectRoot, 'node_modules/drizzle-kit/bin.cjs');
const refusalMessage = 'REFUSING TO RUN: canonical-save driver requires an owned canonical_save_ci database and temporary workspace';
const fileSentinel = 'canonical-save Episode 99 preservation fixture';

function childEnvironment(databaseUrl: string, databaseName: string, workspace: string, runId: string, token: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  // Keep only ordinary OS/runtime variables needed by Node and PostgreSQL
  // executables. In particular, never spread process.env into a child.
  for (const key of [
    'PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT', 'WINDIR',
    'LANG', 'LC_ALL', 'TZ', 'USER', 'LOGNAME', 'SHELL',
  ]) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  Object.assign(environment, {
    CI: 'true',
    CI_DATABASE_URL: databaseUrl,
    NEON_SHARED_DATABASE_URL: databaseUrl,
    CANONICAL_SAVE_RUN_ID: runId,
    CANONICAL_SAVE_DATABASE_NAME: databaseName,
    HOLAHOLA_WORKSPACE_ROOT: workspace,
    COORDINATION_LUCA_REPLIT_TOKEN: token,
    ANTHROPIC_API_KEY: 'canonical-save-dummy-anthropic-key',
    USER_OPENAI_API_KEY: 'canonical-save-dummy-openai-key',
  });
  return environment;
}

async function unusedPort(): Promise<number> {
  const net = await import('net');
  const server = net.createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a loopback PostgreSQL port');
  const port = address.port;
  await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  return port;
}

async function waitForDatabase(url: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 1_000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      try { await client.end(); } catch { /* not connected */ }
      await new Promise(resolveWait => setTimeout(resolveWait, 300));
    }
  }
  throw new Error(`Owned PostgreSQL database did not become ready: ${String(lastError)}`);
}

function runMigrations(workspace: string, environment: NodeJS.ProcessEnv, migrationConfig: string): void {
  if (!existsSync(drizzleCli)) {
    throw new Error(`Cannot run full project migrations: Drizzle CLI not found at ${drizzleCli}`);
  }
  const result = spawnSync(process.execPath, [
    drizzleCli, 'migrate', '--config', migrationConfig,
  ], {
    cwd: workspace,
    env: environment,
    encoding: 'utf8',
    timeout: 180_000,
  });
  if (result.error || result.status !== 0) {
    const detail = [
      result.error ? `spawn error: ${result.error.message}` : '',
      result.signal ? `signal: ${result.signal}` : '',
      `exit status: ${String(result.status)}`,
      result.stdout ? `stdout:\n${result.stdout}` : '',
      result.stderr ? `stderr:\n${result.stderr}` : '',
    ].filter(Boolean).join('\n');
    throw new Error(`Full project migration failed on the owned database (${environment.CANONICAL_SAVE_DATABASE_NAME}). Exact migration output follows:\n${detail}`);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

async function installPreservationSentinels(client: Client): Promise<void> {
  await client.query(`
    INSERT INTO conversation_memories
      (id, title, summary, content, tags, importance, entry_type, arc_name, episode_order)
    VALUES
      ('canonical-save-sentinel-memory', 'Canonical sandbox unrelated memory',
       'Must remain untouched', 'canonical-save unrelated memory sentinel',
       ARRAY['canonical-save-preservation'], 7, 'episode', 'canonical-save-preservation', 99)
  `);
  await client.query(`
    INSERT INTO agent_notes
      (id, from_agent, to_agent, subject, body, source_message_key)
    VALUES
      ('canonical-save-sentinel-note', 'david', 'luca',
       '[CANONICAL-SAVE-PRESERVE] unrelated note sentinel',
       'canonical-save unrelated note sentinel',
       'canonical-save-preservation-sentinel')
  `);
  const vector = Array.from({ length: 768 }, (_, index) => index === 0 ? 1 : 0);
  await client.query(`
    INSERT INTO memory_embeddings
      (id, memory_type, memory_id, embedding, content_hash, importance)
    VALUES
      ('canonical-save-sentinel-embedding', 'conversation_memory',
       'canonical-save-sentinel-memory', $1::jsonb,
       'canonical-save-preservation-sentinel-hash', 7)
  `, [JSON.stringify(vector)]);

}

async function verifyPreservation(client: Client, workspace: string): Promise<void> {
  const memory = await client.query(
    `SELECT content FROM conversation_memories WHERE id = $1`,
    ['canonical-save-sentinel-memory'],
  );
  const note = await client.query(
    `SELECT body FROM agent_notes WHERE id = $1`,
    ['canonical-save-sentinel-note'],
  );
  const embedding = await client.query(
    `SELECT memory_type, memory_id, content_hash, jsonb_array_length(embedding) AS dimensions
       FROM memory_embeddings WHERE id = $1`,
    ['canonical-save-sentinel-embedding'],
  );
  const expectedFile = `${fileSentinel}\n`;
  if (memory.rows.length !== 1 || memory.rows[0].content !== 'canonical-save unrelated memory sentinel' ||
      note.rows.length !== 1 || note.rows[0].body !== 'canonical-save unrelated note sentinel' ||
      embedding.rows.length !== 1 || embedding.rows[0].memory_id !== 'canonical-save-sentinel-memory' ||
      embedding.rows[0].content_hash !== 'canonical-save-preservation-sentinel-hash' ||
      Number(embedding.rows[0].dimensions) !== 768 ||
      readFileSync(join(workspace, '.local/docs/server/shared/episode-99.md'), 'utf8') !== expectedFile ||
      readFileSync(join(workspace, 'docs/episode-99.md'), 'utf8') !== expectedFile) {
    throw new Error('The canonical-save driver changed an unrelated memory, note, embedding, or Episode 99 fixture');
  }
  console.log('PASS — unrelated memory/note/embedding sentinels and Episode 99 files are preserved');
}

function runDriver(
  workspace: string,
  environment: NodeJS.ProcessEnv,
  args: string[],
  timeoutMs: number,
  driverName = 'test-luca-chat-canonical-save.ts',
  expectedFailureMarker?: string,
): number {
  if (!existsSync(tsxCli)) throw new Error(`tsx CLI not found at ${tsxCli}`);
  const driver = resolve(projectRoot, 'server/scripts', driverName);
  const command = [
    tsxCli, '--tsconfig', resolve(projectRoot, 'tsconfig.json'), driver,
    '--isolated-driver', ...args,
  ];
  for (const negative of [
    {
      label: 'wrong database URL',
      cwd: workspace,
      env: (() => {
        const altered = { ...environment };
        const url = new URL(String(environment.CI_DATABASE_URL));
        url.pathname = '/postgres';
        altered.CI_DATABASE_URL = url.toString();
        altered.NEON_SHARED_DATABASE_URL = url.toString();
        return altered;
      })(),
    },
    {
      label: 'real checkout cwd',
      cwd: projectRoot,
      env: { ...environment, HOLAHOLA_WORKSPACE_ROOT: projectRoot },
    },
    ...[
      { label: 'unverified CI target', env: { ...environment, CI: 'false' } },
      ...['host', 'database'].map(key => {
        const url = new URL(environment.CI_DATABASE_URL!);
        url.searchParams.set(key, key === 'host' ? 'shared.example.invalid' : 'postgres');
        return {
          label: `connection-string ${key} override`,
          env: { ...environment, CI_DATABASE_URL: url.toString(), NEON_SHARED_DATABASE_URL: url.toString() },
        };
      }),
      { label: 'mismatched database pair', env: { ...environment, NEON_SHARED_DATABASE_URL: 'postgresql://shared.example.invalid/shared' } },
    ].map(negative => ({ ...negative, cwd: workspace })),
  ]) {
    const rejected = spawnSync(process.execPath, command, {
      cwd: negative.cwd,
      env: negative.env,
      encoding: 'utf8',
      timeout: 30_000,
    });
    const diagnostic = `${rejected.stdout ?? ''}\n${rejected.stderr ?? ''}`;
    if (rejected.error || rejected.status === null || rejected.status === 0 ||
        !diagnostic.includes(refusalMessage) || diagnostic.includes('[DB]')) {
      throw new Error(`Isolation guard did not refuse ${negative.label} with the required diagnostic. Output:\n${diagnostic}`);
    }
    console.log(`PASS — canonical-save driver refuses ${negative.label}`);
  }

  const result = spawnSync(process.execPath, command, {
    cwd: workspace,
    env: environment,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status === null) {
    throw new Error(`Canonical-save driver exceeded ${timeoutMs}ms and was terminated by ${result.signal}`);
  }
  if (expectedFailureMarker) {
    if (result.status === 0 || !`${result.stdout}${result.stderr}`.includes(expectedFailureMarker)) {
      throw new Error('Episode driver did not reach the intentional post-write failure');
    }
    console.log('PASS — episode sandbox observed real post-write failure; preservation and teardown follow');
    return 0;
  }
  return result.status;
}

interface FixtureChild extends ReturnType<typeof spawn> {
  stdoutText?: string;
}

async function startFixtureServer(workspace: string, environment: NodeJS.ProcessEnv): Promise<{ child: FixtureChild; port: number }> {
  const child = spawn(process.execPath, [
    tsxCli, '--tsconfig', resolve(projectRoot, 'tsconfig.json'),
    resolve(projectRoot, 'server/scripts/luca-chat-canonical-fixture-server.ts'),
  ], {
    cwd: workspace,
    env: environment,
    stdio: ['ignore', 'pipe', 'inherit'],
  }) as FixtureChild;

  try {
    const readiness = await new Promise<{ port: number }>((resolveReady, reject) => {
      let buffered = '';
      const timeout = setTimeout(() => reject(new Error('Fixture server did not report readiness within 30 seconds')), 30_000);
      child.once('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', (code, signal) => {
        clearTimeout(timeout);
        reject(new Error(`Fixture server exited before readiness (code=${code}, signal=${signal})`));
      });
      child.stdout?.on('data', (chunk: Buffer) => {
        buffered += chunk.toString();
        const lines = buffered.split(/\r?\n/);
        buffered = lines.pop() ?? '';
        for (const line of lines) {
          try {
            const message = JSON.parse(line);
            if (message.type === 'canonical-save-ready' &&
                message.nonce === environment.CANONICAL_SAVE_RUN_ID &&
                Number.isInteger(message.port) && message.port > 0) {
              clearTimeout(timeout);
              resolveReady({ port: message.port });
              return;
            }
          } catch { /* Non-readiness stdout is diagnostic only. */ }
        }
      });
    });
    return { child, port: readiness.port };
  } catch (error) {
    await stopFixtureServer(child);
    throw error;
  }
}

async function stopFixtureServer(child: FixtureChild): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>(resolveStop => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolveStop();
    }, 8_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolveStop();
    });
    child.kill('SIGTERM');
  });
}

async function createOwnedDatabase(
  root: string,
  environment: NodeJS.ProcessEnv,
  ownership: { admin: Client | null; name: string; pgCtl: string; dataDir: string; createdDatabase: boolean },
): Promise<{ scopedUrl: string; name: string; admin: Client; pgCtl: string; dataDir: string }> {
  const databaseName = `canonical_save_ci_${randomUUID().replace(/-/g, '')}`;
  ownership.name = databaseName;
  const verifiedUrl = getVerifiedCiDatabaseUrl();
  let adminUrl: string;
  let pgCtl = '';
  const dataDir = join(root, 'postgres-data');

  if (verifiedUrl) {
    assertCanonicalSaveDatabaseUrl(verifiedUrl);
    adminUrl = verifiedUrl;
  } else {
    const initDb = (process.env.PATH ?? '').split(delimiter)
      .map(path => join(path, 'initdb')).find(candidate => existsSync(candidate));
    if (!initDb) {
      throw new Error('Canonical-save sandbox requires local PostgreSQL initdb/pg_ctl discovered through PATH or a verified job-local CI PostgreSQL service; live-database fallback is forbidden');
    }
    const bindir = dirname(initDb);
    const localPgCtl = join(bindir, 'pg_ctl');
    if (!existsSync(localPgCtl)) throw new Error(`PostgreSQL initdb exists at ${initDb}, but matching pg_ctl was not found at ${localPgCtl}`);
    ownership.dataDir = dataDir;
    ownership.pgCtl = localPgCtl;
    const init = spawnSync(initDb, [
      '-D', dataDir, '-A', 'trust', '-U', 'canonical_save_owner', '--no-locale',
    ], { cwd: root, env: environment, encoding: 'utf8', timeout: 30_000 });
    if (init.error || init.status !== 0) {
      throw new Error(`Could not initialize owned local PostgreSQL cluster. ${init.stderr || init.stdout || init.error?.message || `status ${init.status}`}`);
    }
    const port = await unusedPort();
    const start = spawnSync(localPgCtl, [
      '-D', dataDir, '-l', join(root, 'postgres.log'), '-w', '-t', '25',
      '-o', `-h 127.0.0.1 -p ${port} -k ${root}`,
      'start',
    ], { cwd: root, env: environment, encoding: 'utf8', timeout: 35_000 });
    if (start.error || start.status !== 0) {
      throw new Error(`Could not start owned local PostgreSQL cluster. ${start.stderr || start.stdout || start.error?.message || `status ${start.status}`}`);
    }
    pgCtl = localPgCtl;
    adminUrl = `postgresql://canonical_save_owner@127.0.0.1:${port}/postgres`;
  }

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  ownership.admin = admin;
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  ownership.createdDatabase = true;
  const scopedUrl = new URL(adminUrl);
  scopedUrl.pathname = `/${databaseName}`;
  // Only the transport's SSL policy can survive the strict URL guard above.
  const finalUrl = scopedUrl.toString();
  return { scopedUrl: finalUrl, name: databaseName, admin, pgCtl, dataDir };
}

export async function runCanonicalSaveSandbox(
  args: string[],
  driverKind: 'canonical-save' | 'episode-concurrency' = 'canonical-save',
): Promise<number> {
  const root = mkdtempSync(join(tmpdir(), 'canonical-save-ci-'));
  const runId = randomUUID().replace(/-/g, '');
  const privateToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  let admin: Client | null = null;
  let sentinelDb: Client | null = null;
  let ownedName = '';
  let pgCtl = '';
  let dataDir = '';
  let fixtureChild: FixtureChild | null = null;
  let nativeClusterStarted = false;
  let sentinelsInstalled = false;
  let collisionSnapshot: string | undefined;
  const ownership = { admin: null as Client | null, name: '', pgCtl: '', dataDir: '', createdDatabase: false };
  const sandboxSelfCheck = args.includes('--sandbox-self-check');
  let exitCode = 1;

  try {
    const osEnvironment: NodeJS.ProcessEnv = {};
    for (const key of [
      'PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT', 'WINDIR',
      'LANG', 'LC_ALL', 'TZ', 'USER', 'LOGNAME', 'SHELL',
    ]) {
      if (process.env[key] !== undefined) osEnvironment[key] = process.env[key];
    }
    mkdirSync(join(root, 'server/shared'), { recursive: true });
    mkdirSync(join(root, 'shared'), { recursive: true });
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, '.local/docs/server/shared'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{"type":"module"}\n');
    writeFileSync(join(root, '.local/CANONICAL_SAVE_SANDBOX'), 'owned temporary workspace\n');
    writeFileSync(join(root, '.local/docs/server/shared/episode-99.md'), `${fileSentinel}\n`);
    writeFileSync(join(root, 'docs/episode-99.md'), `${fileSentinel}\n`);

    const owned = await createOwnedDatabase(root, osEnvironment, ownership);
    admin = owned.admin;
    ownedName = owned.name;
    pgCtl = owned.pgCtl;
    dataDir = owned.dataDir;
    nativeClusterStarted = Boolean(pgCtl);
    const environment = childEnvironment(owned.scopedUrl, ownedName, root, runId, privateToken);
    await waitForDatabase(owned.scopedUrl);

    // Drizzle applies the project's complete journaled SQL migration set,
    // against this named disposable database only.
    const migrationConfig = join(root, 'canonical-save-drizzle.config.ts');
    writeFileSync(migrationConfig, [
      `export default {`,
      `  out: ${JSON.stringify(resolve(projectRoot, 'migrations'))},`,
      `  schema: ${JSON.stringify(resolve(projectRoot, 'shared/schema.ts'))},`,
      `  dialect: 'postgresql',`,
      `  dbCredentials: { url: process.env.NEON_SHARED_DATABASE_URL },`,
      `};`,
      '',
    ].join('\n'));
    runMigrations(root, environment, migrationConfig);
    sentinelDb = new Client({ connectionString: owned.scopedUrl });
    await sentinelDb.connect();
    await installPreservationSentinels(sentinelDb);
    const sharedDir = join(root, '.local/docs/server/shared');
    mkdirSync(sharedDir, { recursive: true });
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, '.local/CANONICAL_SAVE_SANDBOX'), 'owned temporary workspace\n');
    writeFileSync(join(sharedDir, 'episode-99.md'), `${fileSentinel}\n`);
    writeFileSync(join(root, 'docs/episode-99.md'), `${fileSentinel}\n`);
    sentinelsInstalled = true;

    if (driverKind === 'episode-concurrency') {
      // The canonical-save HTTP fixture creates these project markers before
      // importing capture services. This database-only driver must do the same.
      writeFileSync(join(root, 'drizzle.config.ts'), '// Owned test workspace marker.\n');
      writeFileSync(join(root, 'shared/schema.ts'), '// Owned test workspace marker.\n');
      // Reproduce the old title/ID/file collisions ONLY in the owned database
      // and workspace. Snapshot every column, not just the source dialogue.
      for (const [number, id] of [
        [9997, '99970000-0000-4000-8000-000000009997'],
        [9998, '99980000-0000-4000-8000-000000009998'],
      ] as const) {
        await sentinelDb.query(`
          INSERT INTO conversation_memories
            (id, title, summary, content, importance, entry_type, tags, arc_name)
          VALUES ($1, $2, 'unrelated collision preservation fixture', $3, 9,
                  'episode', ARRAY['episode', 'rolling'], 'HolaHola Episodes')
        `, [id, `Episode ${number}`, `Unrelated Episode ${number} — preserve exact bytes.\n`]);
        writeFileSync(join(root, 'docs', `episode-${number}.md`),
          `Unrelated Episode ${number} — preserve exact bytes.\n`, { flag: 'wx' });
      }
      collisionSnapshot = JSON.stringify((await sentinelDb.query(
        `SELECT * FROM conversation_memories WHERE title IN ('Episode 9997', 'Episode 9998') ORDER BY title`,
      )).rows);
      const marker = sandboxSelfCheck ? 'EPISODE_CONCURRENT_EXPECTED_DRIVER_FAILURE' : undefined;
      exitCode = runDriver(root, environment, [
        ...args.filter(arg => arg !== '--sandbox-self-check'),
        ...(sandboxSelfCheck ? ['--inject-post-write-failure'] : []),
      ], 150_000, 'test-episode-concurrent-write.ts', marker);
    } else {
    const fixture = await startFixtureServer(root, environment);
    fixtureChild = fixture.child;
    const driverEnvironment = {
      ...environment,
      CANONICAL_SAVE_SERVER_PORT: String(fixture.port),
    };
    const fixtureUrl = `http://127.0.0.1:${fixture.port}`;
    const fixtureFetch = (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      // spawnSync pauses this event loop long enough for a pooled HTTP socket
      // to expire. Do not reuse a stale keep-alive connection after the driver.
      headers.set('Connection', 'close');
      return fetch(`${fixtureUrl}${path}`, { ...init, headers, signal: AbortSignal.timeout(10_000) });
    };
    const before = await (await fixtureFetch('/fixture-status')).json() as any;
    if (before.canonicalSaveRunId !== runId || !before.forbiddenFetchRejected) {
      throw new Error('Fixture ownership or outbound-fetch guard verification failed');
    }
    const refusedHeaders: Record<string, string>[] = [{}, { 'x-coordination-token': 'invalid-fixture-credential' }];
    for (const headers of refusedHeaders) {
      const response = await fixtureFetch('/api/admin/luca/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ message: 'Unauthorized fixture request must not be saved' }),
      });
      await response.arrayBuffer();
      if (response.status !== 401 && response.status !== 403) {
        throw new Error(`Real auth middleware failed to reject unauthorized POST (${response.status})`);
      }
    }
    const wrongNonce = (runId[0] === '0' ? '1' : '0') + runId.slice(1);
    const rejectedServer = spawnSync(process.execPath, [
      tsxCli, '--tsconfig', resolve(projectRoot, 'tsconfig.json'),
      resolve(projectRoot, 'server/scripts/test-luca-chat-canonical-save.ts'), '--isolated-driver',
    ], {
      cwd: root, env: { ...driverEnvironment, CANONICAL_SAVE_RUN_ID: wrongNonce },
      encoding: 'utf8', timeout: 20_000,
    });
    const rejectionOutput = `${rejectedServer.stdout ?? ''}${rejectedServer.stderr ?? ''}`;
    if (rejectedServer.status === null || rejectedServer.status === 0 ||
        !rejectionOutput.includes('REFUSING TO RUN: canonical-save server is not owned by this invocation') ||
        rejectionOutput.includes('[DB]')) {
      throw new Error('Canonical-save driver did not reject the foreign server before application imports');
    }
    const after = await (await fixtureFetch('/fixture-status')).json() as any;
    if (JSON.stringify(after.writes) !== JSON.stringify(before.writes) ||
        after.completionCalls !== 0 || after.embeddingCalls !== 0) {
      throw new Error('Refused requests caused a database write or provider call');
    }
    console.log('PASS — missing/wrong credentials and foreign server identity are refused without writes');
    if (sandboxSelfCheck) {
      const failedChild = spawnSync(process.execPath, [
        tsxCli, '--tsconfig', resolve(projectRoot, 'tsconfig.json'),
        resolve(projectRoot, 'server/scripts/test-luca-chat-canonical-save.ts'), '--isolated-driver',
      ], {
        cwd: root,
        env: { ...driverEnvironment, CANONICAL_SAVE_INJECT_FAILURE: 'after-post' },
        encoding: 'utf8',
        timeout: 60_000,
      });
      if (failedChild.error || failedChild.status === null || failedChild.status === 0 ||
          !`${failedChild.stdout}${failedChild.stderr}`.includes('CANONICAL_SAVE_EXPECTED_DRIVER_FAILURE')) {
        throw new Error('Real driver did not reach the intentional failure after its persisted POST');
      }
      console.log('PASS — sandbox self-check observed real post-write driver failure; owned-resource cleanup follows');
      exitCode = 0;
    } else {
      exitCode = runDriver(root, driverEnvironment, args.filter(arg => arg !== '--sandbox-self-check'), 150_000);
      const providerStatus = await (await fixtureFetch('/fixture-status')).json() as any;
      if (providerStatus.completionCalls !== 1 || providerStatus.embeddingCalls < 3 ||
          !providerStatus.forbiddenFetchRejected) {
        throw new Error('Production completion/embedding transports did not use the local HTTP fixture');
      }
      console.log('PASS — real production completion and embedding transports used the private HTTP fixture');
    }
    }
  } catch (error) {
    console.error('[canonical-save-sandbox] FATAL:', error instanceof Error ? error.message : error);
    exitCode = 1;
  } finally {
    if (fixtureChild) {
      try { await stopFixtureServer(fixtureChild); }
      catch (error) {
        console.error('[canonical-save-sandbox] Fixture shutdown failed:', error);
        exitCode = 1;
      }
    }
    if (sentinelsInstalled && sentinelDb) {
      try { await verifyPreservation(sentinelDb, root); }
      catch (error) {
        console.error('[canonical-save-sandbox] Preservation verification failed:', error);
        exitCode = 1;
      }
    }
    if (collisionSnapshot !== undefined && sentinelDb) {
      try {
        const after = JSON.stringify((await sentinelDb.query(
          `SELECT * FROM conversation_memories WHERE title IN ('Episode 9997', 'Episode 9998') ORDER BY title`,
        )).rows);
        if (after !== collisionSnapshot || [9997, 9998].some(number =>
          readFileSync(join(root, 'docs', `episode-${number}.md`), 'utf8') !==
          `Unrelated Episode ${number} — preserve exact bytes.\n`)) {
          throw new Error('Episode driver changed a pre-existing collision record or replica');
        }
        console.log('PASS — pre-existing Episode 9997/9998 whole rows and files preserved');
      } catch (error) {
        console.error('[episode-concurrency-sandbox] Preservation verification failed:', error);
        exitCode = 1;
      }
    }
    try { await sentinelDb?.end(); } catch (error) {
      console.error('[canonical-save-sandbox] Fixture DB connection shutdown failed:', error);
      exitCode = 1;
    }
    admin = ownership.admin;
    ownedName = ownership.name;
    pgCtl = ownership.pgCtl;
    dataDir = ownership.dataDir;
    nativeClusterStarted = Boolean(pgCtl);
    if (admin) {
      try {
        if (ownedName && ownership.createdDatabase) {
          await admin.query(`DROP DATABASE IF EXISTS "${ownedName}" WITH (FORCE)`);
          if (sandboxSelfCheck) {
            const remaining = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [ownedName]);
            if (remaining.rows.length !== 0) {
              console.error(`[canonical-save-sandbox] Self-check failed to drop owned database ${ownedName}`);
              exitCode = 1;
            } else {
              console.log('PASS — self-check confirmed the owned database was dropped');
            }
          }
        }
      } catch (error) {
        console.error(`[canonical-save-sandbox] Could not drop owned database ${ownedName}:`, error);
        exitCode = 1;
      } finally {
        try { await admin.end(); } catch (error) {
          console.error('[canonical-save-sandbox] Admin connection shutdown failed:', error);
          exitCode = 1;
        }
      }
    }
    let removeWorkspace = true;
    if (nativeClusterStarted && pgCtl && existsSync(join(dataDir, 'postmaster.pid'))) {
      const stop = spawnSync(pgCtl, ['-D', dataDir, '-m', 'immediate', '-w', 'stop'], {
        cwd: root,
        env: childEnvironment('postgresql://canonical_save_owner@127.0.0.1/postgres', ownedName, root, runId, privateToken),
        encoding: 'utf8',
        timeout: 30_000,
      });
      if (stop.error || stop.status !== 0) {
        console.error('[canonical-save-sandbox] Could not stop owned PostgreSQL cluster:', stop.stderr || stop.stdout || stop.error);
        exitCode = 1;
        removeWorkspace = false;
      }
    }
    try { if (removeWorkspace) rmSync(root, { recursive: true, force: true }); }
    catch (error) {
      console.error(`[canonical-save-sandbox] Could not remove temporary workspace ${root}:`, error);
      exitCode = 1;
    }
    if (sandboxSelfCheck && removeWorkspace) {
      if (existsSync(root)) {
        console.error('[canonical-save-sandbox] Self-check found the temporary workspace still exists after cleanup');
        exitCode = 1;
      } else {
        console.log('PASS — self-check confirmed the temporary workspace was removed');
      }
    }
  }
  return exitCode;
}