import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const nativeStoreSource = readFileSync(
  new URL('./runtime-onboarding-native-store.ps1', import.meta.url),
  'utf8',
);

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
      // Test-child policy only; the production adapter's launch policy is unchanged.
      '-ExecutionPolicy', 'RemoteSigned', '-File', fixture, root,
    ], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(output.trim(), 'atomic-replace-ok');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});