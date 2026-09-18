import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const launcher = readFileSync('scripts/hola-coordinator.ps1', 'utf8');
const register = launcher.slice(
  launcher.indexOf('# BEGIN COORDINATION_REGISTER_BOUNDARY'),
  launcher.indexOf('# END COORDINATION_REGISTER_BOUNDARY'),
);

test('first-host enrollment persists exact retry authority before network submission', () => {
  const retryWrite = register.indexOf('Write-DpapiBase64Atomic -Path $requestPath -Bytes $requestCipher');
  const privateWrite = register.indexOf('Write-DpapiBase64Atomic -Path $privatePath -Bytes $protected');
  const submit = register.indexOf("'/api/coordination/v2/host-enrollment-requests'");
  assert.ok(retryWrite >= 0 && privateWrite > retryWrite && submit > privateWrite);
  assert.match(register, /body\s*=\s*\$body;\s*privateXml\s*=\s*\$rsa\.ToXmlString\(\$true\)/);
});

test('ambiguous enrollment retry preserves identity and resends bootstrap until confirmation', () => {
  assert.match(register, /if\s*\(\[string\]::IsNullOrWhiteSpace\(\[string\]\$requestState\.requestId\)\)/);
  assert.match(register, /-Body\s+\(\[string\]\$requestState\.body\)/);
  assert.match(register, /x-coordination-initial-bootstrap/);
  assert.ok(register.indexOf('$requestState.requestId = [string]$request.requestId')
    < register.indexOf('$env:COORDINATION_V2_HOST_BOOTSTRAP_SECRET = $null'));
});

test('retry recovery verifies RSA fingerprint and request identity before network use', () => {
  assert.match(register, /ProtectedData\]::Unprotect/);
  assert.match(register, /\$rsa\.FromXmlString\(\[string\]\$requestState\.privateXml\)/);
  assert.match(register, /\$derivedFingerprint\s+-ne\s+\[string\]\$requestState\.fingerprint/);
  assert.match(register, /\[string\]\$parsedBody\.publicKey\s+-ne\s+\$derivedPublicJson/);
  assert.match(register, /\[string\]\$parsedBody\.requestKey\s+-ne\s+\[string\]\$requestState\.requestKey/);
  assert.ok(register.indexOf('$derivedFingerprint -ne') < register.indexOf('Invoke-RestMethod -Method Post'));
});

test('credential custody completes before retry authority is removed', () => {
  const materialWrite = register.indexOf('Write-DpapiBase64Atomic -Path $materialPath -Bytes $materialCipher');
  const retryRemoval = register.indexOf('Remove-Item -LiteralPath $requestPath');
  assert.ok(materialWrite >= 0 && retryRemoval > materialWrite);
  assert.match(register, /\^v2h_\[A-Za-z0-9_-\]\{32,\}\$/);
});