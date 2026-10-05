import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/hola-coordinator.ps1", "utf8");
const start = source.indexOf("# BEGIN COORDINATION_REAUTHORIZATION_BOUNDARY");
const end = source.indexOf("# END COORDINATION_REAUTHORIZATION_BOUNDARY");
assert.ok(start >= 0 && end > start);
const recovery = source.slice(start, end);

test("reauthorization exposes only the approved HTTPS endpoint parameter", () => {
  const signature = recovery.match(/function Restore-HolaCoordinatorHostCredential[\s\S]*?param\(([\s\S]*?)\)\s*\n/);
  assert.ok(signature);
  assert.match(signature[1], /\[string\]\$Endpoint/);
  assert.match(signature[1], /ValidatePattern\('\^https:\/\/'\)/);
  assert.doesNotMatch(signature[1], /\$Token|\$Request|\$Nonce|\$KeyPath|\$Task|\$Policy|\$Destination/i);
});

test("legacy material is recovery-only and runtime requires future expiry", () => {
  assert.match(source, /host_credential_reauthorization_required/);
  assert.match(source, /Names @\('endpoint', 'accessToken', 'expiresAt'\)/);
  assert.match(source, /material\.expiresAt\)\.ToUniversalTime\(\) -le \[DateTime\]::UtcNow/);
  assert.match(recovery, /materialNames\.Count -eq 2[\s\S]*contains 'endpoint'[\s\S]*contains 'accessToken'/);
  assert.match(recovery, /materialNames\.Count -eq 3[\s\S]*contains 'expiresAt'/);
  assert.match(recovery, /\$expiry -gt \[DateTime\]::UtcNow[\s\S]*host_credential_reauthorization_not_required/);
  assert.match(recovery, /host_credential_expiry_invalid/);
  assert.match(recovery, /host_credential_reauthorization_not_required/);
});

test("request state is persisted before submission and resumes exact generation", () => {
  const persist = recovery.indexOf("Write-DpapiJsonAtomic -Path $requestPath -Value $state");
  const submit = recovery.indexOf("/api/coordination/v2/host/reauthorization-requests'");
  assert.ok(persist >= 0 && submit > persist);
  assert.match(recovery, /'requestKey', 'requestId', 'generation', 'hostId'/);
  assert.match(recovery, /terminal = \$false/);
  assert.match(recovery, /completionAmbiguous = \$false/);
  assert.match(recovery, /minimum = \[long\]\$state\.generation \+ 1/);
  assert.match(recovery, /requestGeneration = \$Generation/);
  assert.match(recovery, /nextGeneration = Get-InternalHolaCoordinatorRecoveryGeneration/);
  assert.doesNotMatch(recovery, /-Generation 1/);
  assert.match(recovery, /\[int\]\$challenge\.requestGeneration -ne \[int\]\$state\.generation/);
});

test("request timestamps share one captured instant and legacy rollover is exact", () => {
  assert.match(recovery, /\$capturedAt = \$Now\.ToUniversalTime\(\)/);
  assert.match(recovery, /issuedAt = \$capturedAt\.ToString\('o'\)/);
  assert.match(recovery, /expiresAt = \$capturedAt\.AddHours\(1\)\.ToString\('o'\)/);
  assert.doesNotMatch(recovery, /\[DateTime\]::UtcNow\.AddHours\(1\)/);
  assert.match(recovery, /Test-InternalHolaCoordinatorLegacyTwoClockRequest/);
  assert.match(recovery, /IsNullOrWhiteSpace\(\[string\]\$State\.requestId\)/);
  assert.match(recovery, /\$signedLifetimeMs -le 3600000/);
  assert.match(recovery, /\$signedLifetimeMs -gt 3660000/);
  assert.match(recovery, /\$expiresAt -ge \$Now\.ToUniversalTime\(\)/);
  assert.match(recovery, /\$Rsa\.VerifyData/);
  assert.match(recovery, /\$state\.terminal = \$true[\s\S]*Write-DpapiJsonAtomic -Path \$requestPath -Value \$state/);
});

test("challenge proof and replacement use exact bounded shapes", () => {
  assert.match(recovery, /kind = 'host_credential_reauthorization_challenge'/);
  assert.match(recovery, /ConvertTo-CanonicalJson -Value \$challengeValue/);
  assert.match(recovery, /Names @\('accessToken', 'expiresAt'\)/);
  assert.match(recovery, /requestKey = \[string\]\$state\.requestKey[\s\S]*challengeId[\s\S]*nonce = \[string\]\$challenge\.nonce[\s\S]*signature/);
  assert.match(recovery, /Names @\('endpoint', 'accessToken', 'expiresAt'\)/);
  assert.ok(recovery.indexOf("Write-DpapiJsonAtomic -Path $materialPath -Value $newMaterial") <
    recovery.indexOf("Read-DpapiJson -Path $materialPath -FailureCode 'host_credential_replacement_corrupted'"));
  assert.ok(recovery.indexOf("Read-DpapiJson -Path $materialPath -FailureCode 'host_credential_replacement_corrupted'") <
    recovery.indexOf("Remove-Item -LiteralPath $requestPath"));
});

test("wire declarations and status branches are exact and terminal-safe", () => {
  assert.match(recovery, /kind = 'host_credential_reauthorization'/);
  assert.doesNotMatch(recovery, /correlationId/);
  const declaration = recovery.slice(recovery.indexOf("kind = 'host_credential_reauthorization'"),
    recovery.indexOf("}", recovery.indexOf("kind = 'host_credential_reauthorization'")) + 1);
  assert.doesNotMatch(declaration, /hostEnrollmentId/);
  assert.match(recovery, /Names @\('requestId', 'status'\)/);
  assert.match(recovery, /challenge_unavailable/);
  const proofPersist = recovery.indexOf('$state.completionAmbiguous = $true');
  const proofCall = recovery.indexOf('/proof');
  assert.ok(proofPersist >= 0 && proofCall > proofPersist);
  assert.doesNotMatch(recovery.slice(proofPersist, proofCall), /\$state\.terminal\s*=\s*\$true/);
  assert.match(recovery, /Names @\(\s*'status', 'requestId', 'requestKey', 'challenge'/);
  assert.match(recovery, /hostEnrollmentId -notmatch '\^\[0-9a-fA-F-\]\{36\}\$'/);
  assert.match(recovery, /nonce -notmatch '\^\[A-Za-z0-9_-\]\{32,\}\$'/);
  assert.match(recovery, /host_reauthorization_transport/);
  assert.match(recovery, /host_reauthorization_challenge_expired/);
  const rollover = recovery.indexOf('$nextGeneration = Get-InternalHolaCoordinatorRecoveryGeneration');
  assert.ok(rollover >= 0);
  assert.ok(recovery.indexOf('if ($null -eq $state -or [bool]$state.terminal)') < rollover);
  assert.doesNotMatch(recovery.slice(rollover - 200, rollover), /completionAmbiguous/);
});

test("reauthorization body and status transport keep request keys out of URLs and results", () => {
  const restore = recovery.slice(recovery.indexOf("function Restore-HolaCoordinatorHostCredential"));
  const bodyStarts = [...recovery.matchAll(/\$bodyObject = \[ordered\]@\{/g)].map((m) => m.index as number);
  assert.equal(bodyStarts.length, 1);
  for (const bodyStart of bodyStarts) {
    const bodyEnd = recovery.indexOf("\n            }", bodyStart);
    const body = recovery.slice(bodyStart, bodyEnd);
    assert.match(body, /declaration|publicKey|keyFingerprint|signature/);
    assert.doesNotMatch(body, /requestKey\s*=/);
  }
  assert.doesNotMatch(recovery, /reauthorization-requests\/[^']*\/status\?requestKey=/);
  assert.match(recovery, /x-hola-reauthorization-key/);
  assert.match(recovery, /expectedApprovalPath = '\/coordination\/v2\/host-reauthorization-approval\?requestId='/);
  assert.match(recovery, /\$approvalUrl = \$endpointBase \+ \$expectedApprovalPath/);
  assert.doesNotMatch(recovery, /request\.approvalUrl -notmatch '\^https:\/\//);
  assert.doesNotMatch(restore, /return[\s\S]{0,300}requestKey\s*=/);
});

test("recovery never starts runtime lifecycle and never emits secrets", () => {
  assert.doesNotMatch(recovery, /Initialize-HolaCoordinatorRuntime|Invoke-HolaCoordinator/);
  assert.doesNotMatch(recovery, /Write-Host|Console\.Out|Write-Output/);
  assert.doesNotMatch(recovery, /accessToken\s*=\s*\[string\]\$issued\.accessToken[\s\S]{0,160}return/);
});

test("recovery context uses a separate signed two-minute purpose and no token authority", () => {
  const helper = recovery.slice(recovery.indexOf('function Get-InternalHolaCoordinatorRecoveryGeneration'),
    recovery.indexOf('function Restore-HolaCoordinatorHostCredential'));
  assert.match(helper, /kind = 'host_credential_recovery_context'/);
  assert.match(helper, /expiresAt = \$capturedAt\.AddMinutes\(2\)/);
  assert.match(helper, /minimumGeneration = \$MinimumGeneration/);
  assert.match(helper, /ConvertTo-CanonicalJson -Value \$declaration/);
  assert.match(helper, /\/api\/coordination\/v2\/host\/recovery-context/);
  assert.match(helper, /'contextKey', 'nextGeneration', 'issuedAt', 'expiresAt'/);
  assert.match(helper, /context\.contextKey -cne \[string\]\$declaration\.contextKey/);
  assert.match(helper, /context\.nextGeneration -gt \[int\]::MaxValue/);
  assert.doesNotMatch(helper, /accessToken|Write-Dpapi|Remove-Item|Authorization|v2h_/);
});