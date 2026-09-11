import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const launcherPath = 'scripts/antigravity-gate3.ps1';
const runbookPath = 'docs/antigravity-gate3-runbook.md';

const read = (path: string) => readFile(path, 'utf8');
const execFile = promisify(execFileCallback);

test('Windows DPAPI launcher has a fixed action and command boundary', async () => {
  const source = await read(launcherPath);

  assert.match(source, /ValidateSet\('initialize', 'prepare', 'run', 'status'\)/);
  assert.match(source, /\$ApprovedWorktree = 'C:\\Users\\David\\HolaHola-antigravity'/);
  assert.match(source, /\$startInfo\.FileName = \$script:ApprovedNodePath/);
  assert.match(source, /Get-AuthenticodeSignature -LiteralPath \$nodePath/);
  assert.match(source, /\$version\.ProductName -ne 'Node\.js'/);
  assert.match(source, /Assert-ApprovedNode -ExpectedPath/);
  assert.doesNotMatch(source, /\$startInfo\.FileName = ['"](?:node|npx)(?:\.exe|\.cmd)?['"]/i);
  assert.doesNotMatch(source, /node_modules\/tsx\/dist\/cli\.mjs/);
  assert.doesNotMatch(source, /Invoke-Expression|iex\b|Start-Job|ScriptBlock|EncodedCommand/i);
  assert.doesNotMatch(source, /\[(?:string|object)\]\s*\$(?:Command|Executable|ChildCommand|ArgumentsFromUser)\b/i);
});

test('Windows runtime loads System.Security before resolving ProtectedData', async () => {
  const source = await read(launcherPath);
  const start = source.indexOf('function Assert-WindowsRuntime');
  const end = source.indexOf('function Assert-NoFixedActorTokens', start);
  assert.ok(start >= 0 && end > start, 'Assert-WindowsRuntime must have a bounded source section');
  const runtimeGuard = source.slice(start, end);

  const assemblyLoadAt = runtimeGuard.indexOf('Add-Type -AssemblyName System.Security -ErrorAction Stop');
  const protectedDataCheckAt = runtimeGuard.indexOf(
    "'System.Security.Cryptography.ProtectedData' -as [type]",
  );
  assert.ok(assemblyLoadAt >= 0, 'must explicitly load the exact System.Security assembly');
  assert.ok(protectedDataCheckAt > assemblyLoadAt, 'assembly load must precede the ProtectedData type check');
  assert.match(
    runtimeGuard,
    /if \(\$PSVersionTable\.PSVersion\.Major -eq 5\)\s*\{\s*try\s*\{\s*Add-Type -AssemblyName System\.Security -ErrorAction Stop\s*\}\s*catch\s*\{\s*Fail 'dpapi_unavailable'\s*\}\s*\}/,
  );
});

test('source guard requires CurrentUser-protected ciphertext outside the repository', async () => {
  const source = await read(launcherPath);

  assert.match(source, /SpecialFolder\]::LocalApplicationData/);
  assert.match(source, /antigravity-bootstrap\.dpapi/);
  assert.match(source, /DataProtectionScope\]::CurrentUser/g);
  assert.match(source, /ProtectedData\]::Protect/);
  assert.match(source, /ProtectedData\]::Unprotect/);
  assert.match(source, /SetAccessRuleProtection\(\$true, \$false\)/);
  assert.match(source, /Get-CurrentUserSid/);
  assert.match(source, /ReparsePoint/);
  assert.match(source, /function Assert-NoReparseChain/);
  assert.doesNotMatch(source, /['"]\.env|WriteAllText\([^,]+,\s*\$bootstrap|Set-Clipboard/i);
});

test('source guard requires active ciphertext consumption before launch with no restore path', async () => {
  const source = await read(launcherPath);
  const run = source.slice(source.indexOf('function Run-BoundedDriver'));

  const moveAt = run.indexOf('[System.IO.File]::Move($ActiveStore, $InFlightStore)');
  const launchAt = run.indexOf('Start-ApprovedChild');
  const deleteAt = run.indexOf('[System.IO.File]::Delete($InFlightStore)');
  assert.ok(moveAt >= 0 && launchAt > moveAt, 'active ciphertext must move before child launch');
  assert.ok(deleteAt > launchAt, 'in-flight ciphertext must be deleted after the launch attempt');
  assert.doesNotMatch(run, /Move\(\$InFlightStore,\s*\$ActiveStore\)/);
});

test('approved entry-point bundles rebuild to the hashes pinned by the launcher', async () => {
  const source = await read(launcherPath);
  const expected = {
    prepare: source.match(/\$PrepareBundleSha256 = '([0-9a-f]{64})'/)?.[1],
    run: source.match(/\$RunBundleSha256 = '([0-9a-f]{64})'/)?.[1],
  };
  assert.ok(expected.prepare && expected.run);

  const directory = await mkdtemp(join(tmpdir(), 'gate3-dpapi-bundles-'));
  try {
    for (const item of [
      {
        name: 'prepare' as const,
        source: 'server/scripts/antigravity-provisioning-bundle-entry.ts',
      },
      {
        name: 'run' as const,
        source: 'server/scripts/antigravity-runtime-bundle-entry.ts',
      },
    ]) {
      const output = join(directory, `${item.name}.mjs`);
      await execFile('npx', [
        'esbuild',
        item.source,
        '--bundle',
        '--platform=node',
        '--format=esm',
        '--packages=bundle',
        `--outfile=${output}`,
      ]);
      const digest = createHash('sha256').update(await readFile(output)).digest('hex');
      assert.equal(digest, expected[item.name]);

      const execution = await execFile('node', [
        output,
        ...(item.name === 'prepare'
          ? ['--starting-commit', 'a'.repeat(40)]
          : []),
      ]).then(
        (result) => ({ code: 0, stderr: result.stderr }),
        (error: NodeJS.ErrnoException & { code?: number; stderr?: string }) => ({
          code: error.code,
          stderr: error.stderr ?? '',
        }),
      );
      assert.notEqual(execution.code, 0, `${item.name} bundle must execute its entrypoint`);
      assert.match(
        execution.stderr,
        item.name === 'prepare' ? /antigravity_provisioning_failed/ : /antigravity_runtime_failed/,
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('source guard requires a rebuilt child environment and bootstrap removal', async () => {
  const source = await read(launcherPath);

  assert.match(source, /EnvironmentVariables\.Clear\(\)/);
  assert.match(source, /EnvironmentVariables\['COORDINATION_RUNTIME_BOOTSTRAP_TOKEN'\] = \$Bootstrap/);
  assert.match(source, /EnvironmentVariables\.Remove\('COORDINATION_RUNTIME_BOOTSTRAP_TOKEN'\)/g);
  assert.match(source, /function Assert-NoFixedActorTokens/);
  assert.match(source, /Assert-NoFixedActorTokens\s*\n\s*switch \(\$Action\)/);
  for (const forbidden of [
    'COORDINATION_LUCA_GEMINI_CODE_TOKEN',
    'REPLIT_AGENT_TOKEN',
    'GITHUB_ACTIONS_DISPATCH_TOKEN',
    'NEON_SHARED_DATABASE_URL',
    'AI_INTEGRATIONS_GEMINI_API_KEY',
  ]) {
    assert.doesNotMatch(source, new RegExp(`EnvironmentVariables\\[['"]${forbidden}['"]\\]`));
  }
});

test('source guard permits only fixed non-secret output statements', async () => {
  const source = await read(launcherPath);
  const outputLines = source.match(/Write-(?:Output|Host|Verbose|Information|Warning|Error)[^\r\n]*/g) ?? [];
  assert.equal(outputLines.length, 4);
  for (const line of outputLines) {
    assert.doesNotMatch(line, /bootstrap|cipher|plainBytes|token|environment/i);
  }
  assert.doesNotMatch(source, /\b(?:echo|Out-Host|Out-String|Tee-Object)\b|\[Console\]::Write/i);
  assert.doesNotMatch(source, /Write-(?:Output|Host|Verbose|Information|Warning|Error)\s+\$(?:bootstrap|cipherBytes|plainBytes|raw|envelope)/i);
});

test('runbook selects DPAPI launcher and rejects a false Linux execution claim', async () => {
  const runbook = await read(runbookPath);

  assert.match(runbook, /antigravity-gate3\.ps1 initialize/);
  assert.match(runbook, /antigravity-gate3\.ps1 prepare/);
  assert.match(runbook, /antigravity-gate3\.ps1 run/);
  assert.match(runbook, /Windows PowerShell 5\.1/);
  assert.match(runbook, /does not prove that DPAPI executed on Windows/i);
  assert.doesNotMatch(runbook, /op run|op:\/\/|1Password item/i);
});