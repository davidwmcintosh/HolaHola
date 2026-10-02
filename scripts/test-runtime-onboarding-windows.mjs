import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const purposes = ['proof-key', 'attempt-state', 'access-credential'];

function assertNoLinks(path) {
  for (let current = resolve(path); ; current = dirname(current)) {
    if (existsSync(current)) assert.equal(lstatSync(current).isSymbolicLink(), false, 'unsafe cleanup path');
    if (current === parse(current).root) break;
  }
}

function powershell(command, input = '') {
  const executable = process.env.SystemRoot
    ? join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe';
  // Read-only policy/ACL inspection, not a substitute launch for the helper.
  return execFileSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
    input, encoding: 'utf8', timeout: 30_000,
  }).trim();
}

/** No network, invitations, policy writes, shared-directory removal, or V2 access. */
export async function runWindowsNativeSmoke({ createStore, Client, cliArgs }) {
  assert.equal(process.platform, 'win32', 'native Windows required; an emulated pass is not evidence');
  const policies = () => powershell('Get-ExecutionPolicy -List | Select-Object Scope,ExecutionPolicy | ConvertTo-Json -Compress');
  const beforePolicy = policies();
  const localAppData = powershell("[Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)");
  const root = join(localAppData, 'HolaHola', 'coordination-runtime-onboarding');
  assertNoLinks(root);
  const scope = { endpoint: 'https://native-smoke.invalid', actor: 'luca-cursor', runtimeId: `native-smoke-${randomUUID()}` };
  const paths = purposes.map((purpose) => join(root, createHash('sha256')
    .update(JSON.stringify([scope.endpoint, scope.actor, scope.runtimeId, purpose])).digest('hex') + '.dpapi'));
  for (const path of paths) assert.equal(existsSync(path), false, 'scope must be newly owned');
  const store = createStore(); // Default factory/path/launch: no patched or alternate helper.
  const checks = [];
  // Non-secret ownership evidence for recovery if the test is forcibly killed.
  console.log(JSON.stringify({ phase: 'native-smoke-start', scope, ownedFiles: paths }));
  let phase = 'cli-empty-status';
  const cli = () => spawnSync(process.execPath, [
    ...cliArgs, 'status', '--endpoint', scope.endpoint, '--actor', scope.actor, '--runtime-id', scope.runtimeId,
  ], { encoding: 'utf8', timeout: 30_000 });
  let failure;
  try {
    const initial = cli();
    assert.equal(initial.status, 0, 'unmodified CLI must launch the native helper');
    assert.deepEqual(JSON.parse(initial.stdout), { configured: false });
    checks.push('unmodified-cli-empty-status');
    phase = 'dpapi-roundtrip-and-acl';
    for (const [index, purpose] of purposes.entries()) {
      const dummy = `DUMMY-NOT-A-CREDENTIAL-${randomUUID()}`;
      assert.equal(await store.get(scope, purpose), null);
      assert.equal(await store.setIfAbsent(scope, purpose, dummy), dummy);
      assert.equal(await store.setIfAbsent(scope, purpose, 'DUMMY-LOSER'), dummy);
      assert.equal(await createStore().get(scope, purpose), dummy, 'read with a fresh adapter');
      await store.set(scope, purpose, `${dummy}-replacement`);
      assert.equal(await store.get(scope, purpose), `${dummy}-replacement`);
      const encrypted = readFileSync(paths[index], 'utf8');
      assert.equal(encrypted.includes(dummy), false);
      const envelope = JSON.parse(encrypted);
      assert.equal(envelope.protection, 'dpapi-current-user');
      assert.ok(Buffer.from(envelope.ciphertext, 'base64').length > 0);
      const acl = JSON.parse(powershell([
        "$p=[Console]::In.ReadToEnd()",
        "$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
        "$a=[IO.File]::GetAccessControl($p)",
        "$rules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))",
        "$bad=@($rules | Where-Object { $_.IdentityReference.Value -ne $sid -or $_.IsInherited -or $_.AccessControlType -ne 'Allow' -or ($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl })",
        "@{protected=$a.AreAccessRulesProtected;owner=($a.GetOwner([Security.Principal.SecurityIdentifier]).Value -eq $sid);count=$rules.Count;bad=$bad.Count} | ConvertTo-Json -Compress",
      ].join(';'), paths[index]));
      assert.equal(acl.protected, true);
      assert.equal(acl.owner, true);
      assert.ok(acl.count > 0);
      assert.equal(acl.bad, 0);
      await store.delete(scope, purpose);
      assert.equal(await store.get(scope, purpose), null);
    }
    checks.push('dpapi-roundtrip-first-write-atomic-replace-owner-only-acl-all-purposes');
    phase = 'client-cli-corrupt-state';
    const client = new Client({
      ...scope, store,
      fetchImpl: async () => { throw new Error('native_smoke_network_forbidden'); },
    });
    assert.deepEqual(await client.localStatus(), { configured: false });
    await store.set(scope, 'attempt-state', 'DUMMY-CORRUPT-ATTEMPT');
    await assert.rejects(client.localStatus(), /onboarding_local_attempt_state_corrupt/);
    const corrupt = cli();
    assert.equal(corrupt.status, 1);
    assert.match(corrupt.stderr, /onboarding_local_attempt_state_corrupt/);
    assert.equal(corrupt.stdout.trim(), '');
    assert.equal(corrupt.stderr.includes('DUMMY-CORRUPT-ATTEMPT'), false);
    await store.delete(scope, 'attempt-state');
    phase = 'corrupt-credential-and-envelope';
    await store.set(scope, 'access-credential', 'DUMMY-CORRUPT-CREDENTIAL');
    await assert.rejects(client.hasCredential(), /onboarding_local_credential/);
    const envelope = JSON.parse(readFileSync(paths[2], 'utf8'));
    envelope.ciphertext = 'not-base64!';
    writeFileSync(paths[2], JSON.stringify(envelope));
    await assert.rejects(store.get(scope, 'access-credential'), /dpapi_secure_store_failed/);
    checks.push('client-cli-corrupt-state-and-native-corruption-fail-closed');
    phase = 'unsafe-owned-file-acl';
    // Change only the already-owned dummy file. Both read and adapter delete
    // must reject the extra principal; finally must still remove this file.
    powershell([
      "$ErrorActionPreference='Stop'",
      "$p=[Console]::In.ReadToEnd()",
      "$a=[IO.File]::GetAccessControl($p)",
      "$sid=New-Object Security.Principal.SecurityIdentifier('S-1-5-32-545')",
      "$r=New-Object Security.AccessControl.FileSystemAccessRule($sid,[Security.AccessControl.FileSystemRights]::Read,[Security.AccessControl.AccessControlType]::Allow)",
      "$a.AddAccessRule($r)",
      "[IO.File]::SetAccessControl($p,$a)",
    ].join(';'), paths[2]);
    await assert.rejects(store.get(scope, 'access-credential'), /dpapi_secure_store_failed/);
    await assert.rejects(store.delete(scope, 'access-credential'), /dpapi_secure_store_failed/);
    checks.push('unsafe-owned-file-acl-read-delete-rejected');
  } catch (error) {
    failure = error;
    failure.nativeSmokePhase = phase;
  } finally {
    // Only three preflight-absent, randomly scoped files belong to this test.
    // Never enumerate/delete other entries, the namespace, or helper temp files.
    const cleanupFailures = [];
    for (const [index, purpose] of purposes.entries()) {
      try { await store.delete(scope, purpose); } catch { /* Owned-path fallback below. */ }
      try {
        assertNoLinks(root);
        if (existsSync(paths[index])) {
          assertNoLinks(paths[index]);
          unlinkSync(paths[index]);
        }
        assert.equal(existsSync(paths[index]), false);
      } catch (error) { cleanupFailures.push(error); }
    }
    try { assert.equal(policies(), beforePolicy, 'no execution-policy scope may change'); }
    catch (error) { cleanupFailures.push(error); }
    if (cleanupFailures.length) {
      const error = new AggregateError([...(failure ? [failure] : []), ...cleanupFailures], 'native smoke failed; owned-scope cleanup or policy verification failed');
      error.nativeSmokePhase = 'cleanup-or-policy-verification';
      throw error;
    }
  }
  if (failure) throw failure;
  return { platform: process.platform, checks, ownedScopeCleanup: true, executionPoliciesUnchanged: true };
}

async function main(packageDirectory) {
  assert.ok(packageDirectory, 'Usage: node scripts/test-runtime-onboarding-windows.mjs PACKAGE_DIRECTORY');
  assert.equal(process.platform, 'win32', 'Run this native smoke on Windows, not Linux');
  const root = resolve(packageDirectory);
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.format, 'holahola-runtime-onboarding-package/v1');
  assert.equal(manifest.entrypoint, 'bin/holahola-onboarding.mjs');
  const required = ['bin/holahola-onboarding.mjs', 'lib/runtime-onboarding-sdk.mjs', 'scripts/runtime-onboarding-native-store.ps1', 'package.json', 'README.txt'];
  assert.deepEqual(manifest.files.map((file) => file.path).sort(), required.sort());
  for (const file of manifest.files) {
    const bytes = readFileSync(join(root, file.path));
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
  const sdk = await import(pathToFileURL(join(root, 'lib/runtime-onboarding-sdk.mjs')).href);
  const result = await runWindowsNativeSmoke({
    createStore: sdk.createNativeRuntimeOnboardingStore,
    Client: sdk.RuntimeOnboardingClient,
    cliArgs: [join(root, manifest.entrypoint)],
  });
  console.log(JSON.stringify({
    ...result, sourceRevision: manifest.sourceRevision, sourceDirty: manifest.sourceDirty,
    release: manifest.release, manifestSha256: createHash('sha256').update(readFileSync(join(root, 'manifest.json'))).digest('hex'),
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2]).catch((error) => {
    // Never print credential/store bytes or arbitrary child diagnostics.
    const cleanupUnverified = error instanceof AggregateError;
    process.stderr.write(JSON.stringify({
      result: 'windows_native_smoke_failed',
      ownedScopeCleanup: cleanupUnverified ? 'unverified' : 'completed-or-store-not-started',
      nativeWindows: process.platform === 'win32',
      failedPhase: error.nativeSmokePhase ?? 'preflight',
      // No raw error: assertions can contain store values and child output.
    }) + '\n');
    process.exitCode = 1;
  });
}