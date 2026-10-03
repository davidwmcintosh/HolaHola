import { build } from 'esbuild';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));

export async function buildHistoricalAttributionReleaseCheck(output) {
  await build({
    absWorkingDir: root,
    entryPoints: ['server/scripts/check-historical-attribution-release.ts'],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = resolve(root, 'dist/check-historical-attribution-release.mjs');
  await buildHistoricalAttributionReleaseCheck(output);
  // Validate the build workspace as well as the independently checked runtime
  // image. Never let an ambient REPL_HOME redirect this packaging check.
  execFileSync(process.execPath, [output], {
    cwd: root,
    env: { ...process.env, HOLAHOLA_WORKSPACE_ROOT: root },
    stdio: 'inherit',
  });
}