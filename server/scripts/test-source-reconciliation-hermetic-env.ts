/**
 * Regression guard: prove that source-reconciliation-service.ts's default
 * `validateCandidate` implementation actually runs candidate checks with
 * database credentials and other secrets stripped from its subprocess env,
 * and that reintroducing an eager (non-type-only) import of a DB-touching
 * module into this service or its dependency chain breaks that guarantee
 * loudly instead of silently.
 *
 * Background: a prior eager import of SourceControlService (which
 * transitively imports server/db.ts) made every reconciliation candidate
 * fail validation with a database-fatal error, regardless of what was
 * actually being merged, because the hermetic subprocess env has no
 * NEON_SHARED_DATABASE_URL. It was fixed with a type-only import plus a lazy
 * dynamic import, but nothing previously caught a repeat automatically. See
 * .agents/memory/reconciliation-hermetic-env-import-coupling.md.
 *
 * Usage:
 *   npx tsx server/scripts/test-source-reconciliation-hermetic-env.ts
 *     Runs the real reconciliation self-check (test-source-reconciliation-service.ts)
 *     under the exact same stripped env `validateCandidate` uses, and asserts
 *     it currently passes.
 *
 *   npx tsx server/scripts/test-source-reconciliation-hermetic-env.ts --self-check
 *     Temporarily reintroduces the historical eager-import regression into
 *     source-reconciliation-service.ts, proves the hermetic run then fails
 *     with a DB-specific error (not just "something failed"), and restores
 *     the original file byte-for-byte in a `finally` block.
 */
import assert from 'node:assert/strict';
import { execFile as nodeExecFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { reconciliationHermeticEnv, reconciliationSelfCheckCommand } from '../services/source-reconciliation-service';

const execFile = promisify(nodeExecFile);
const root = resolve(import.meta.dirname, '../..');
const servicePath = resolve(root, 'server/services/source-reconciliation-service.ts');

// The exact string server/db.ts throws at module-load time when it has no
// database URL to connect to. Asserting on this (not just a non-zero exit
// code) is what makes the self-check failure "name the DB-dependency
// problem" instead of looking like an unrelated broken candidate check.
const DB_FATAL_PATTERN = /\[DB\] FATAL: NEON_SHARED_DATABASE_URL is required/;

async function runHermeticSelfCheck(): Promise<{ code: number; output: string }> {
  const home = await mkdtemp(join(tmpdir(), 'reconciliation-hermetic-env-'));
  try {
    const env = reconciliationHermeticEnv(home);
    const command = reconciliationSelfCheckCommand(root);
    try {
      const { stdout, stderr } = await execFile(command.executable, command.args, {
        cwd: command.cwd,
        env,
        maxBuffer: 8 * 1024 * 1024,
      });
      return { code: 0, output: `${stdout}${stderr}` };
    } catch (error: any) {
      const code = typeof error?.code === 'number' ? error.code : 1;
      const output = `${error?.stdout || ''}${error?.stderr || ''}${error?.message || ''}`;
      return { code, output };
    }
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

async function assertHermeticSelfCheckPasses(): Promise<void> {
  const result = await runHermeticSelfCheck();
  assert.equal(
    result.code,
    0,
    'Reconciliation self-check failed with database credentials and other secrets ' +
      'stripped from its subprocess env (PATH/HOME/CI/NODE_ENV/GIT_TERMINAL_PROMPT only). ' +
      'This usually means an eager (non-type-only) import of a DB-touching module was ' +
      'reintroduced into source-reconciliation-service.ts or its dependency chain -- see ' +
      `.agents/memory/reconciliation-hermetic-env-import-coupling.md. Output:\n${result.output}`,
  );
  console.log(
    '[reconciliation-hermetic-env] PASS: the reconciliation self-check succeeds with no ' +
      'database credentials or other secrets in its subprocess env',
  );
}

async function selfCheck(): Promise<void> {
  const originalBytes = readFileSync(servicePath);
  const originalSource = originalBytes.toString('utf8');

  const oldImport = "import type { SourceControlService } from './source-control-service';";
  const newImport = "import { SourceControlService } from './source-control-service';";
  assert.equal(
    originalSource.split(oldImport).length - 1,
    1,
    'Expected exactly one type-only SourceControlService import to mutate -- update this self-check if the import was intentionally restructured',
  );

  const oldGetSourceControl = `  private async getSourceControl(): Promise<Pick<SourceControlService, 'acquireReconciliationLease' | 'runReconciliationGit'>> {
    if (!this.sourceControl) {
      const { SourceControlService: ConcreteSourceControlService } = await import('./source-control-service');
      this.sourceControl = new ConcreteSourceControlService({ rootDir: this.root });
    }
    return this.sourceControl;
  }`;
  const newGetSourceControl = `  private async getSourceControl(): Promise<Pick<SourceControlService, 'acquireReconciliationLease' | 'runReconciliationGit'>> {
    if (!this.sourceControl) {
      this.sourceControl = new SourceControlService({ rootDir: this.root });
    }
    return this.sourceControl;
  }`;
  assert.equal(
    originalSource.split(oldGetSourceControl).length - 1,
    1,
    'Expected exactly one lazy getSourceControl() body to mutate -- update this self-check if it was intentionally restructured',
  );

  // Reproduce the historical regression exactly: a plain (non-type-only) top-level
  // import combined with an eager, directly-constructed fallback. Stripping only the
  // `type` keyword is not sufficient by itself -- tsx/esbuild elide an import that is
  // never used in a value position regardless of the `type` keyword, so the mutation
  // must also give SourceControlService a genuine value-position usage to force the
  // import (and therefore server/db.ts's eager module-load throw) to actually execute.
  const mutantSource = originalSource
    .replace(oldImport, newImport)
    .replace(oldGetSourceControl, newGetSourceControl);
  assert.notEqual(mutantSource, originalSource, 'Mutation did not change source-reconciliation-service.ts');

  try {
    writeFileSync(servicePath, mutantSource);
    const result = await runHermeticSelfCheck();
    assert.notEqual(
      result.code,
      0,
      'Reintroducing an eager SourceControlService import unexpectedly still passed the hermetic reconciliation self-check',
    );
    assert.match(
      result.output,
      DB_FATAL_PATTERN,
      `Mutation failed for the wrong reason (expected server/db.ts's specific fatal-env error):\n${result.output}`,
    );
    console.log(
      '[reconciliation-hermetic-env] SELF-CHECK PASS: reintroducing an eager SourceControlService ' +
        'import correctly fails the hermetic reconciliation self-check with a DB-specific error',
    );
  } finally {
    writeFileSync(servicePath, originalBytes);
    assert.deepEqual(
      readFileSync(servicePath),
      originalBytes,
      'Failed to restore source-reconciliation-service.ts byte-for-byte after mutation',
    );
  }
}

const isSelfCheck = process.argv.includes('--self-check');
(isSelfCheck ? selfCheck() : assertHermeticSelfCheckPasses()).catch((error) => {
  console.error(error);
  process.exit(1);
});
