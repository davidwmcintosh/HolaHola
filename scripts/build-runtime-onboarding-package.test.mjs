import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { buildRuntimeOnboardingPackage } from './build-runtime-onboarding-package.mjs';

test('standalone package is reproducible, hash-verifiable, and works without the V2 closure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'onboarding-package-'));
  try {
    await mkdir(join(root, 'server/scripts'), { recursive: true });
    await mkdir(join(root, 'server/services'), { recursive: true });
    await writeFile(join(root, '.gitignore'), '.local/\n');
    await writeFile(join(root, 'server/scripts/runtime-onboarding-cli.ts'),
      'process.stdout.write("setup status mcp: no V2 dependency\\\\n");\n');
    await writeFile(join(root, 'server/scripts/runtime-onboarding-native-store.ps1'),
      '# Native store fixture; no credential data.\n');
    await writeFile(join(root, 'server/services/runtime-onboarding-openai-sdk.ts'),
      'export function createRuntimeOpenAIResponsesClient() { return { fixture: true }; }\n');
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', [
      '-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Fixture',
      '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture',
    ], { cwd: root });
    const first = await buildRuntimeOnboardingPackage({ root, output: join(root, '.local/a'), release: true });
    const second = await buildRuntimeOnboardingPackage({ root, output: join(root, '.local/b'), release: true });
    assert.equal(first.manifestSha256, second.manifestSha256);
    assert.equal(first.sourceDirty, false);
    const manifest = JSON.parse(await readFile(join(first.output, 'manifest.json'), 'utf8'));
    assert.equal(manifest.entrypoint, 'bin/holahola-onboarding.mjs');
    assert.equal(manifest.sourceRevision, first.sourceRevision);
    for (const file of manifest.files) {
      const bytes = await readFile(join(first.output, file.path));
      assert.equal(bytes.length, file.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    }
    const stdout = execFileSync(process.execPath, [join(first.output, manifest.entrypoint)], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    });
    assert.match(stdout, /no V2 dependency/);
    const sdk = await import(pathToFileURL(join(first.output, 'lib/runtime-onboarding-sdk.mjs')).href);
    assert.equal(typeof sdk.createRuntimeOpenAIResponsesClient, 'function');
    await writeFile(join(root, 'unreviewed.txt'), 'uncommitted\n');
    await assert.rejects(
      buildRuntimeOnboardingPackage({ root, output: join(root, '.local/rejected'), release: true }),
      /onboarding_release_requires_reviewed_clean_source/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});