import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import express from 'express';
import { closeDbConnections } from '../db';
import {
  getCoordinationV2RecoveryClock, CoordinationV2HostAuthError,
  validateCoordinationV2HostRecoveryContextSubmission,
} from '../services/coordination-v2-host-auth-service';
import { registerCoordinationV2HostAdminRoutes } from '../routes/coordination-v2-host-admin-routes';

test.after(async () => { await closeDbConnections(); });

test('diagnostic metadata mirrors the strict context time contract, without widening it', () => {
  const now = new Date('2026-10-05T12:00:00Z');
  const clock = getCoordinationV2RecoveryClock(now);
  assert.deepEqual(clock, {
    protocolVersion: 1, serverUnixMs: now.getTime(), resolutionMs: 1,
    futureAllowanceMs: 0, contextTtlMs: 120000,
  });
  // These time failures must occur before key validation or database access.
  for (const offsetMs of [1500, -clock.contextTtlMs, -clock.contextTtlMs - 1]) {
    const issuedAt = new Date(now.getTime() + offsetMs);
    assert.throws(() => validateCoordinationV2HostRecoveryContextSubmission({
      declaration: {
        kind: 'host_credential_recovery_context', contextKey: 'clock-fixture',
        protocolVersion: 1, hostId: 'TEST-HOST', keyFingerprint: 'a'.repeat(64),
        minimumGeneration: 1, issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(issuedAt.getTime() + clock.contextTtlMs).toISOString(),
      },
      signature: '', publicKey: '', keyFingerprint: 'a'.repeat(64), now,
    }), (error: unknown) => error instanceof CoordinationV2HostAuthError
      && error.code === 'V2_HOST_REAUTH_DECLARATION_INVALID');
  }
  const source = readFileSync('server/services/coordination-v2-host-auth-service.ts', 'utf8');
  assert.match(source, /contextTtlMs: CHALLENGE_TTL_MS/);
  assert.match(source, /issued > now \|\| expiry <= now/);
  assert.match(source, /issued > now \|\| expiry <= issued/);
});

test('clock GET has no authority, no caching, and a fixed bounded JSON shape', async () => {
  const app = express();
  let calls = 0;
  const forbidden = async (): Promise<never> => { calls++; throw new Error('authority invoked'); };
  registerCoordinationV2HostAdminRoutes(app, {
    founderMiddleware: [], submitEnrollmentRequest: forbidden,
    submitReauthorizationRequest: forbidden, getRecoveryContext: forbidden,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const start = Date.now();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/coordination/v2/host/recovery-clock`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const text = await response.text();
    assert.ok(Buffer.byteLength(text) < 512);
    const value = JSON.parse(text);
    assert.deepEqual(Object.keys(value).sort(), [
      'contextTtlMs', 'futureAllowanceMs', 'protocolVersion', 'resolutionMs', 'serverUnixMs',
    ]);
    assert.ok(value.serverUnixMs >= start && value.serverUnixMs <= Date.now());
    assert.equal(calls, 0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('PowerShell preflight executes real interval/custody tests, no policy override', (t) => {
  const binary = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const probe = spawnSync(binary, ['-NoProfile', '-NonInteractive', '-Command',
    '[Console]::WriteLine("ready")'], { timeout: 15000, encoding: 'utf8' });
  if (probe.error && 'code' in probe.error && probe.error.code === 'ENOENT') {
    t.skip('PowerShell absent here; native Windows CI step is mandatory');
    return;
  }
  assert.equal(probe.status, 0, 'PowerShell unavailable or timed out');
  // Nix's ambient module discovery may scan the entire store. Load only the
  // standard modules by exact PSHOME path, without altering execution policy.
  const command = '$PSModuleAutoLoadingPreference="None"; '
    + 'Import-Module "$PSHOME/Modules/Microsoft.PowerShell.Management/Microsoft.PowerShell.Management.psd1"; '
    + 'Import-Module "$PSHOME/Modules/Microsoft.PowerShell.Utility/Microsoft.PowerShell.Utility.psd1"; '
    + '& ./scripts/test-hola-coordinator-clock-preflight.ps1';
  const result = spawnSync(binary, ['-NoProfile', '-NonInteractive', '-Command', command], {
    timeout: 30000, encoding: 'utf8', maxBuffer: 8192,
    env: { ...process.env, LOCALAPPDATA: process.env.LOCALAPPDATA ?? '/tmp/hola-clock-fixture' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS: clock intervals/);
});

test('native sampling stays bounded and preflight precedes protected custody effects', () => {
  const source = readFileSync('scripts/hola-coordinator.ps1', 'utf8');
  const clock = source.slice(source.indexOf('function Get-InternalHolaCoordinatorClockSample'),
    source.indexOf('function Get-InternalHolaCoordinatorRecoveryGeneration'));
  assert.match(clock, /AllowAutoRedirect = \$false/);
  assert.match(clock, /WaitOne\(2000\)/);
  assert.match(clock, /WaitOne\(\$remaining\)/);
  assert.match(clock, /New-Object byte\[\] 513/);
  assert.match(clock, /\$index -lt 3/);
  assert.match(clock, /WaitForExit\(1000\)/);
  assert.doesNotMatch(clock, /w32tm|Set-Service|Start-Service|Set-ExecutionPolicy|Unprotect|Write-Dpapi|NewGuid|SignData/i);
  const restore = source.slice(source.indexOf('function Restore-InternalHolaCoordinatorHostCredential'));
  const gate = restore.indexOf('Assert-InternalHolaCoordinatorClockPreflight -Endpoint $endpointBase');
  assert.ok(gate >= 0 && gate < restore.indexOf('::Unprotect'));
  assert.ok(gate < restore.indexOf('Write-DpapiJsonAtomic'));
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /shell: powershell\s+run: \.\\scripts\\test-hola-coordinator-clock-preflight\.ps1/);
});
