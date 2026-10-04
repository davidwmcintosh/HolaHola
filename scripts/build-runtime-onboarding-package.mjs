import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRegularPath, PAYLOADS } from './runtime-onboarding-package-integrity.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** This is a standalone coordination helper, not the V2 execution closure. */
export async function buildRuntimeOnboardingPackage(options = {}) {
  const workspace = options.root ?? root;
  const output = resolve(options.output ?? resolve(workspace, '.local/runtime-onboarding-package'));
  const release = options.release === true;
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: workspace, encoding: 'utf8',
  }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
    cwd: workspace, encoding: 'utf8',
  }).trim().length > 0;
  if (release && dirty) throw new Error('onboarding_release_requires_reviewed_clean_source');
  // Never overwrite a signed/finalized package or retain unrelated leftovers.
  await assertRegularPath(output, true, true);
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length) throw new Error('onboarding_output_requires_empty_directory');
  await mkdir(resolve(output, 'bin'), { recursive: true });
  await mkdir(resolve(output, 'lib'), { recursive: true });
  await mkdir(resolve(output, 'scripts'), { recursive: true });
  await build({
    absWorkingDir: workspace,
    entryPoints: ['server/scripts/runtime-onboarding-cli.ts'],
    outfile: resolve(output, 'bin/holahola-onboarding.mjs'),
    platform: 'node',
    target: 'node20',
    format: 'esm',
    bundle: true,
    sourcemap: false,
    logLevel: 'silent',
    banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
  });
  await build({
    absWorkingDir: workspace,
    entryPoints: ['server/services/runtime-onboarding-openai-sdk.ts'],
    outfile: resolve(output, 'lib/runtime-onboarding-sdk.mjs'),
    platform: 'node',
    target: 'node20',
    format: 'esm',
    bundle: true,
    sourcemap: false,
    logLevel: 'silent',
    banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
  });
  await copyFile(
    resolve(workspace, 'server/scripts/runtime-onboarding-native-store.ps1'),
    resolve(output, 'scripts/runtime-onboarding-native-store.ps1'),
  );
  await writeFile(resolve(output, 'package.json'), JSON.stringify({
    name: 'holahola-runtime-onboarding',
    private: true,
    type: 'module',
    engines: { node: '>=20' },
    bin: { 'holahola-onboarding': 'bin/holahola-onboarding.mjs' },
    exports: { '.': './lib/runtime-onboarding-sdk.mjs' },
  }, null, 2) + '\n');
  await writeFile(resolve(output, 'README.txt'), [
    'HolaHola coordination runtime onboarding helper',
    '',
    'This package does not install or replace the Coordinator V2 execution runtime.',
    'Use an independently installed, trusted Node.js 20+ runtime.',
    'Verify the package/source revision through your approved source publication.',
    'A manifest from the same untrusted download is not an independent trust anchor.',
    'A development package with sourceDirty=true is not an approved release.',
    '',
    'Run: node bin/holahola-onboarding.mjs --help',
    'SDK: import { createRuntimeOpenAIResponsesClient } from "./lib/runtime-onboarding-sdk.mjs".',
    'Supply your own already-authorized OpenAI SDK instance; this helper never supplies its API key.',
    'Commands and arguments contain only endpoint and non-secret runtime references.',
    'No credential-export command exists. Do not add secrets to shell commands.',
    'Windows credential/key custody uses the scripts/ helper and DPAPI CurrentUser.',
    'Windows helper child uses RemoteSigned only for that process; no saved policy changes.',
    'Organizational Group Policy and downloaded-script restrictions remain enforced.',
    'Blocked helpers fail closed; do not use Bypass or automatically unblock files.',
    'Keep the bin/ and scripts/ directories together.',
    '',
    'The OS secret store must be available. Unsupported stores fail closed.',
    'No script is downloaded and evaluated at setup time.',
    '',
  ].join('\n'));
  const files = await Promise.all(PAYLOADS.map(async (path) => {
    const bytes = await readFile(resolve(output, path));
    return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
  const manifest = {
    format: 'holahola-runtime-onboarding-package/v1',
    sourceRevision,
    sourceDirty: dirty,
    release,
    nodeMinimum: 20,
    entrypoint: 'bin/holahola-onboarding.mjs',
    files,
  };
  const manifestBytes = JSON.stringify(manifest, null, 2) + '\n';
  await writeFile(resolve(output, 'manifest.json'), manifestBytes);
  return {
    output,
    sourceRevision,
    sourceDirty: dirty,
    release,
    manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    files: files.length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  if ((outputIndex >= 0 && (!args[outputIndex + 1] || args[outputIndex + 1].startsWith('--')))
    || args.some((arg, index) => !['--release', '--output'].includes(arg)
    && !(outputIndex >= 0 && index === outputIndex + 1))) {
    process.stderr.write('Usage: node scripts/build-runtime-onboarding-package.mjs [--release] [--output PATH]\n');
    process.exitCode = 64;
  } else {
    buildRuntimeOnboardingPackage({
      release: args.includes('--release'),
      output: outputIndex >= 0 ? args[outputIndex + 1] : undefined,
    }).then((status) => {
      process.stdout.write(JSON.stringify(status) + '\n');
    }).catch((error) => {
      process.stderr.write(error.message.startsWith('onboarding_')
        ? `${error.message}\n` : 'onboarding_package_build_failed\n');
      process.exitCode = 1;
    });
  }
}