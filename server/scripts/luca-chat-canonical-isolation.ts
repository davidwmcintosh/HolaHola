import { existsSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, isAbsolute, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getVerifiedCiDatabaseUrl } from '../ci-database';

/** pg connection strings permit query arguments to override URL authority/path. */
export function assertCanonicalSaveDatabaseUrl(databaseUrl: string): void {
  const parsed = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname) ||
      [...parsed.searchParams.keys()].some(key => key !== 'sslmode')) {
    throw new Error('REFUSING TO RUN: canonical-save database transport must be unambiguous and job-local');
  }
}

/** Must run before application imports, HTTP requests, or database writes. */
export function assertCanonicalSaveIsolation(): { root: string; databaseUrl: string; runId: string } {
  const refusal = 'REFUSING TO RUN: canonical-save driver requires an owned canonical_save_ci database and temporary workspace';
  try {
    const databaseUrl = getVerifiedCiDatabaseUrl();
    const runId = process.env.CANONICAL_SAVE_RUN_ID ?? '';
    const databaseName = process.env.CANONICAL_SAVE_DATABASE_NAME ?? '';
    if (!databaseUrl || !/^[a-f0-9]{32}$/.test(runId) ||
        !/^canonical_save_ci_[a-f0-9]{32}$/.test(databaseName) ||
        new URL(databaseUrl).pathname !== `/${databaseName}`) throw new Error(refusal);
    assertCanonicalSaveDatabaseUrl(databaseUrl);
    const root = realpathSync(process.cwd());
    const sourceRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
    const insideTemp = relative(realpathSync(tmpdir()), root);
    if (!insideTemp || insideTemp === '..' || insideTemp.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
        isAbsolute(insideTemp) || root === sourceRoot ||
        realpathSync(process.env.HOLAHOLA_WORKSPACE_ROOT ?? '') !== root ||
        !existsSync(resolve(root, '.local/CANONICAL_SAVE_SANDBOX'))) throw new Error(refusal);
    return { root, databaseUrl, runId };
  } catch {
    throw new Error(refusal);
  }
}