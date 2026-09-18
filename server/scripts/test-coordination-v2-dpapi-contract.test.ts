import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('PowerShell and Node use the same DPAPI custody file contract', () => {
  const launcher = readFileSync('scripts/hola-coordinator.ps1', 'utf8');
  const factory = readFileSync('server/scripts/coordination-v2-http-factory.ts', 'utf8');
  const fixture = JSON.stringify({ endpoint: 'https://coordinator.example.test', accessToken: `v2h_${'x'.repeat(32)}` });
  const powershellFile = Buffer.from(fixture, 'utf8').toString('base64');
  const nodeBytes = Buffer.from(powershellFile, 'base64').toString('utf8');
  assert.equal(nodeBytes, fixture);
  assert.match(launcher, /Write-DpapiBase64Atomic/);
  assert.match(launcher, /ToBase64String\(\$Bytes\)/);
  assert.match(factory, /readFile\(path, 'utf8'\)/);
  assert.match(factory, /FromBase64String/);
});