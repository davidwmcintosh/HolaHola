import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildHistoricalAttributionReleaseCheck } from './build-historical-attribution-release-check.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const receipts = [
  'episode-34-attribution-repair-evidence.json',
  'episode-34-attribution-repair-backfill-evidence.json',
];
const success = 'Historical attribution release approvals verified (both pinned receipts).';

test('release image explicitly carries both approval files and executes the bundled probe', async () => {
  const dockerfile = await readFile(join(root, 'Dockerfile'), 'utf8');
  const runtime = dockerfile.split(/^FROM .* AS runtime\s*$/m)[1];
  assert.ok(runtime, 'Dockerfile must have an independently verified runtime stage');
  for (const file of receipts) {
    // Explicit COPY fails Docker packaging if .dockerignore removes the file.
    // Broad COPY . . alone must not satisfy this release contract.
    assert.ok(runtime.split('\n').includes(`COPY docs/${file} ./docs/${file}`),
      `Runtime image needs an explicit required COPY for ${file}`);
  }
  const probe = 'RUN node dist/check-historical-attribution-release.mjs';
  assert.ok(runtime.split('\n').includes(probe), 'Runtime stage must execute the real approval loader');
  assert.ok(runtime.indexOf(probe) > runtime.indexOf('COPY --from=build /app/dist ./dist'));
  for (const file of receipts) {
    assert.ok(runtime.indexOf(probe) > runtime.indexOf(`COPY docs/${file}`));
  }
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.build.split(/\s+&&\s+/).includes('node scripts/build-historical-attribution-release-check.mjs'),
    'Non-Docker release builds must also bundle and execute the probe');
});

test('packaged probe loads relocated approvals and rejects each absent or changed file', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'historical-release-'));
  try {
    const workspace = join(temporary, 'relocated-release');
    const unrelatedCwd = join(temporary, 'unrelated-working-directory');
    await mkdir(unrelatedCwd);
    for (const dir of ['server', 'shared', 'docs', 'dist']) {
      await mkdir(join(workspace, dir), { recursive: true });
    }
    // Only required project markers and the approved receipts are packaged.
    // No rolling episode, database module, node_modules, or source overlay is
    // available to this fresh Node process.
    for (const file of ['package.json', 'drizzle.config.ts', 'shared/schema.ts']) {
      await copyFile(join(root, file), join(workspace, file));
    }
    const bytes = new Map();
    for (const file of receipts) {
      bytes.set(file, await readFile(join(root, 'docs', file)));
      await copyFile(join(root, 'docs', file), join(workspace, 'docs', file));
      assert.deepEqual(await readFile(join(workspace, 'docs', file)), bytes.get(file));
    }
    const bundled = join(workspace, 'dist/check-historical-attribution-release.mjs');
    await buildHistoricalAttributionReleaseCheck(bundled);
    const run = (configured = true) => spawnSync(process.execPath, [bundled], {
      cwd: configured ? unrelatedCwd : workspace,
      // Deliberately no inherited Replit workspace or database credentials.
      env: { NODE_ENV: 'production', ...(configured ? { HOLAHOLA_WORKSPACE_ROOT: workspace } : {}) },
      encoding: 'utf8',
      timeout: 15_000,
    });
    const assertSuccess = result => {
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.stdout.includes(success), result.stdout);
    };
    assertSuccess(run()); // explicit relocated root from an unrelated cwd
    assertSuccess(run(false)); // production WORKDIR fallback, no REPL_HOME

    for (const file of receipts) {
      const destination = join(workspace, 'docs', file);
      await rm(destination);
      const missing = run();
      assert.ifError(missing.error);
      assert.equal(missing.status, 1, missing.stderr);
      assert.match(missing.stderr, /ENOENT/);
      assert.ok(missing.stderr.includes(file));
      assert.ok(!missing.stdout.includes(success));
      // Valid JSON with identical semantics is still unapproved changed bytes.
      await writeFile(destination, Buffer.concat([bytes.get(file), Buffer.from('\n')]));
      const changed = run();
      assert.ifError(changed.error);
      assert.equal(changed.status, 1, changed.stderr);
      assert.match(changed.stderr, /not explicitly approved for these bytes/);
      assert.ok(!changed.stdout.includes(success));
      await writeFile(destination, bytes.get(file));
      assertSuccess(run()); // each independent case gets a fresh loader cache
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});