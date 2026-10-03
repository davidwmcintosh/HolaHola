import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  classifyWindowsHelperFailure,
  createNativeRuntimeOnboardingStore,
  SecureStoreDiagnosticError,
  secureStoreDiagnosticCategory,
  WindowsDpapiRuntimeOnboardingStore,
} from '../services/runtime-onboarding-store';
import { safeFailureDiagnostics } from './runtime-onboarding-cli';
import { RuntimeOnboardingClient } from '../services/runtime-onboarding-client';
// @ts-expect-error Standalone native smoke runner intentionally has no TS dependency.
import {
  cliStoreDiagnostic,
  runWindowsNativeSmoke,
  windowsNativeSmokeFailureReport,
} from '../../scripts/test-runtime-onboarding-windows.mjs';

const nativeStoreSource = readFileSync(
  new URL('./runtime-onboarding-native-store.ps1', import.meta.url),
  'utf8',
);

const secretFixture = 'DUMMY-SECRET-BEARER-123\n-----BEGIN PRIVATE KEY-----\nDUMMY-PRIVATE-BYTES\n-----END PRIVATE KEY-----';
const policyFixture = [
  `C:\\DUMMY-SECRET-PATH\\helper.ps1 cannot be loaded because running scripts is`,
  'disabled on this system.',
  '+ CategoryInfo          : SecurityError: (:) [], PSSecurityException',
  '+ FullyQualifiedErrorId : UnauthorizedAccess',
].join('\r\n');
const signatureFixture = [
  'File C:\\helper.ps1 cannot be loaded. The file C:\\helper.ps1 is not digitally',
  'signed. You cannot run this script on the current system.',
  '+ CategoryInfo : SecurityError: (:) [], ParentContainsErrorRecordException',
  '+ FullyQualifiedErrorId : UnauthorizedAccess',
].join('\r\n');

test('wrapped PowerShell policy/signature diagnostics are fixed, bounded, and evidence-based', () => {
  for (const [text, category] of [
    [policyFixture, 'execution_policy_blocked'],
    [signatureFixture, 'signature_rejected'],
    [signatureFixture.replace('ParentContainsErrorRecordException', 'PSSecurityException'), 'signature_rejected'],
    ['running scripts is disabled on this system', 'unknown'],
    ['The file is not digitally signed', 'unknown'],
    [policyFixture.replace('UnauthorizedAccess', 'OtherFailure'), 'unknown'],
    [signatureFixture.replace('SecurityError', 'InvalidData'), 'unknown'],
    [signatureFixture.replace('ParentContainsErrorRecordException', 'ArbitraryError'), 'unknown'],
    [signatureFixture.replace('is not digitally', 'was digitally'), 'unknown'],
    ['x'.repeat(8192) + signatureFixture, 'unknown'],
    ['', 'unknown'],
    [secretFixture, 'unknown'],
  ]) {
    assert.equal(classifyWindowsHelperFailure(`${text}\n${secretFixture}`), category);
  }
});

test('CLI diagnostics preserve the failure line and never serialize arbitrary exception data', () => {
  for (const category of [
    'execution_policy_blocked', 'signature_rejected', 'executable_unavailable',
    'invalid_helper_response', 'unknown',
  ] as const) {
    const error = new SecureStoreDiagnosticError('dpapi_secure_store_failed', category);
    Object.assign(error, { stderr: secretFixture, stdout: secretFixture, cause: new Error(secretFixture) });
    const text = safeFailureDiagnostics(error);
    assert.equal(text, `runtime_onboarding_failed: secure_store_operation_failed\nruntime_onboarding_store_diagnostic: ${category}\n`);
    assert.equal(cliStoreDiagnostic({ stderr: text }), category);
    const report = windowsNativeSmokeFailureReport(Object.assign(error, { nativeSmokePhase: 'cli-empty-status' }), 'win32');
    assert.equal(report.storeDiagnostic, category);
    assert.equal(report.failedPhase, 'cli-empty-status');
    assert.doesNotMatch(JSON.stringify(report), /DUMMY|PRIVATE KEY|stderr|stdout|cause/);
  }
  for (const error of [
    new Error(secretFixture),
    new Error(`dpapi_secure_store_failed:${secretFixture}`),
    new Error(`secure_store_unavailable:${secretFixture}`),
    { message: secretFixture, diagnosticCategory: secretFixture },
  ]) {
    assert.doesNotMatch(safeFailureDiagnostics(error), /DUMMY|PRIVATE KEY/);
    assert.equal(secureStoreDiagnosticCategory(error), undefined);
  }
  const poisoned = new SecureStoreDiagnosticError('dpapi_secure_store_failed', secretFixture as any);
  assert.equal(secureStoreDiagnosticCategory(poisoned), 'unknown');
  assert.doesNotMatch(safeFailureDiagnostics(poisoned), /DUMMY|PRIVATE KEY/);
});

test('native smoke failures allowlist categories and phases, including cleanup failures', () => {
  assert.equal(cliStoreDiagnostic({ stderr: secretFixture }), 'unknown');
  assert.equal(cliStoreDiagnostic({ stderr: `runtime_onboarding_store_diagnostic: ${secretFixture}` }), 'unknown');
  assert.equal(cliStoreDiagnostic({ stderr: 'runtime_onboarding_store_diagnostic: arbitrary_error\n' }), 'unknown');
  assert.equal(cliStoreDiagnostic({ stderr: 'runtime_onboarding_store_diagnostic: signature_rejected\n'.repeat(2) }), 'unknown');
  assert.equal(cliStoreDiagnostic({ error: { code: 'ENOENT', message: secretFixture }, stderr: secretFixture }), 'executable_unavailable');
  assert.equal(cliStoreDiagnostic({ error: { code: 'EACCES', message: secretFixture } }), 'unknown');
  for (const error of [
    Object.assign(new Error(secretFixture), { nativeSmokePhase: secretFixture, diagnosticCategory: secretFixture }),
    Object.assign(new AggregateError([new Error(secretFixture)], secretFixture), {
      nativeSmokePhase: 'cleanup-or-policy-verification', diagnosticCategory: 'signature_rejected',
    }),
  ]) {
    const report = windowsNativeSmokeFailureReport(error, 'win32');
    assert.doesNotMatch(JSON.stringify(report), /DUMMY|PRIVATE KEY/);
    if (error instanceof AggregateError) {
      assert.equal(report.ownedScopeCleanup, 'unverified');
      assert.equal(report.storeDiagnostic, 'signature_rejected');
    } else {
      assert.equal(report.failedPhase, 'preflight');
      assert.equal(report.storeDiagnostic, 'unknown');
    }
  }
});

test('production Windows adapter sanitizes child failures and rejects invalid helper responses', {
  // Linux executes a synthetic executable, never PowerShell or a real store.
  skip: process.platform === 'win32',
}, async () => {
  const root = mkdtempSync(join(tmpdir(), 'onboarding-diagnostic-'));
  const originalSystemRoot = process.env.SystemRoot;
  const helperDirectory = join(root, 'System32', 'WindowsPowerShell', 'v1.0');
  const executable = join(helperDirectory, 'powershell.exe');
  mkdirSync(helperDirectory, { recursive: true });
  const store = new WindowsDpapiRuntimeOnboardingStore('unused-fixture.ps1');
  const scope = { endpoint: 'https://fixture.invalid', actor: 'luca-cursor', runtimeId: 'synthetic' };
  try {
    process.env.SystemRoot = root;
    for (const [stderr, stdout, exitCode, category] of [
      [policyFixture + '\n' + secretFixture, secretFixture, 1, 'execution_policy_blocked'],
      [signatureFixture + '\n' + secretFixture, secretFixture, 1, 'signature_rejected'],
      [secretFixture, secretFixture, 1, 'unknown'],
      ['x'.repeat(8192) + signatureFixture, secretFixture, 1, 'unknown'],
      ['', secretFixture, 0, 'invalid_helper_response'],
      ['', JSON.stringify({ unexpected: secretFixture }), 0, 'invalid_helper_response'],
      ['', JSON.stringify({ value: 42, created: 'not-a-boolean', credential: secretFixture }), 0, 'invalid_helper_response'],
      ['', 'x'.repeat(1024 * 1024 + 1), 0, 'invalid_helper_response'],
    ] as const) {
      writeFileSync(executable, [
        `#!${process.execPath}`,
        "process.stdin.resume(); process.stdin.on('end', () => {",
        `process.stderr.write(${JSON.stringify(stderr)});`,
        `process.stdout.write(${JSON.stringify(stdout)}, () => { process.exitCode = ${exitCode}; });`,
        '});',
      ].join('\n'), { mode: 0o700 });
      for (const action of [
        () => store.get(scope, 'proof-key'),
        () => store.set(scope, 'proof-key', secretFixture),
        () => store.setIfAbsent(scope, 'proof-key', secretFixture),
        () => store.delete(scope, 'proof-key'),
      ]) {
        await assert.rejects(action(), (error: unknown) => {
          assert.equal(secureStoreDiagnosticCategory(error), category);
          assert.doesNotMatch(String(error), /DUMMY|PRIVATE KEY/);
          assert.doesNotMatch(JSON.stringify(error), /DUMMY|PRIVATE KEY/);
          assert.doesNotMatch(safeFailureDiagnostics(error), /DUMMY|PRIVATE KEY/);
          return true;
        });
      }
    }
    process.env.SystemRoot = join(root, 'missing-DUMMY-SECRET-PATH');
    await assert.rejects(store.get(scope, 'proof-key'), (error: unknown) => {
      assert.equal(secureStoreDiagnosticCategory(error), 'executable_unavailable');
      assert.equal(String(error).includes('DUMMY'), false);
      return true;
    });
  } finally {
    if (originalSystemRoot === undefined) delete process.env.SystemRoot;
    else process.env.SystemRoot = originalSystemRoot;
    rmSync(root, { recursive: true, force: true });
  }
});

function assertProcessPolicyLaunch(source: string): void {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const windows = code.slice(code.indexOf('export class WindowsDpapiRuntimeOnboardingStore'), code.indexOf('const KEYCHAIN_SCRIPT'));
  assert.match(windows, /'-NonInteractive',\s*'-ExecutionPolicy',\s*'RemoteSigned',\s*'-File',\s*this\.scriptPath,\s*command\.operation/);
  assert.doesNotMatch(windows, /Bypass|Unrestricted|Unblock-File|Set-ExecutionPolicy|EncodedCommand/);
}

test('Windows production launch uses only child-session RemoteSigned with the fixed script', () => {
  const source = readFileSync(new URL('../services/runtime-onboarding-store.ts', import.meta.url), 'utf8');
  assertProcessPolicyLaunch(source);
  for (const mutated of [
    source.replace("'-ExecutionPolicy', 'RemoteSigned', ", ''),
    source.replace("'RemoteSigned'", "'Bypass'"),
    source.replace("'-File', this.scriptPath", "'-Command', this.scriptPath"),
  ]) {
    assert.throws(() => assertProcessPolicyLaunch(mutated));
  }
});

test('Windows unmodified source factory and CLI pass owned-scope native smoke', {
  skip: process.platform !== 'win32',
}, async () => {
  await runWindowsNativeSmoke({
    createStore: createNativeRuntimeOnboardingStore,
    Client: RuntimeOnboardingClient,
    cliArgs: ['--import', 'tsx', fileURLToPath(new URL('./runtime-onboarding-cli.ts', import.meta.url))],
  });
});

function atomicReplacementStatement(source: string): string {
  const code = source.replace(/<#[\s\S]*?#>/g, '').replace(/^\s*#.*$/gm, '');
  const calls = code.match(/\[IO\.File\]\s*::\s*Replace\s*\([^)]*\)/gi) ?? [];
  assert.equal(calls.length, 1, 'native store must retain one atomic Replace statement');
  assert.match(
    calls[0],
    /^\[IO\.File\]\s*::\s*Replace\s*\(\s*\$temporary\s*,\s*\$target\s*,\s*\[NullString\]\s*::\s*Value\s*\)$/i,
    'atomic replacement must use a true null backup path, not PowerShell $null string coercion',
  );
  return calls[0];
}

test('Windows native store retains atomic replacement with a true null backup path', () => {
  atomicReplacementStatement(nativeStoreSource);
});

test('replacement guard rejects regression to literal $null, including a safe-looking comment', () => {
  const replacement = atomicReplacementStatement(nativeStoreSource);
  const regressed = nativeStoreSource.replace(
    replacement,
    replacement.replace(/\[NullString\]\s*::\s*Value/i, '$null'),
  );
  assert.throws(
    () => atomicReplacementStatement(`${regressed}\n# ${replacement}\n`),
    /true null backup path/,
  );
});

test('replacement guard rejects a delete-then-move workaround', () => {
  const replacement = atomicReplacementStatement(nativeStoreSource);
  const nonAtomic = nativeStoreSource.replace(
    replacement,
    '[IO.File]::Delete($target)\n[IO.File]::Move($temporary, $target)',
  );
  assert.throws(() => atomicReplacementStatement(nonAtomic), /one atomic Replace statement/);
});

test('Windows PowerShell executes the source replacement statement against disposable files', {
  skip: process.platform !== 'win32',
}, () => {
  const root = mkdtempSync(join(tmpdir(), 'onboarding-atomic-replace-'));
  try {
    const fixture = join(root, 'atomic-replace.ps1');
    writeFileSync(fixture, [
      "Set-StrictMode -Version 2.0",
      "$ErrorActionPreference = 'Stop'",
      "$temporary = [IO.Path]::Combine($args[0], 'replacement.tmp')",
      "$target = [IO.Path]::Combine($args[0], 'existing.fixture')",
      "[IO.File]::WriteAllText($target, 'dummy-original')",
      "[IO.File]::WriteAllText($temporary, 'dummy-replacement')",
      atomicReplacementStatement(nativeStoreSource),
      "if ([IO.File]::ReadAllText($target) -ne 'dummy-replacement') { throw 'replacement_mismatch' }",
      "if ([IO.File]::Exists($temporary)) { throw 'temporary_file_not_consumed' }",
      "[Console]::Out.Write('atomic-replace-ok')",
    ].join('\n'), 'utf8');
    const powershell = process.env.SystemRoot
      ? join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : 'powershell.exe';
    const output = execFileSync(powershell, [
      '-NoLogo', '-NoProfile', '-NonInteractive',
      // Test-child policy only; no saved Windows policy changes.
      '-ExecutionPolicy', 'RemoteSigned', '-File', fixture, root,
    ], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(output.trim(), 'atomic-replace-ok');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});