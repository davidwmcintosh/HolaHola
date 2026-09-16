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
  assert.match(recovery, /materialNames\.Count -ne 2[\s\S]*notcontains 'endpoint'[\s\S]*notcontains 'accessToken'/);
  assert.match(recovery, /host_credential_reauthorization_not_required/);
});

test("request state is persisted before submission and resumes exact generation", () => {
  const persist = recovery.indexOf("Write-DpapiJsonAtomic -Path $requestPath -Value $state");
  const submit = recovery.indexOf("/api/coordination/v2/host/reauthorization-requests'");
  assert.ok(persist >= 0 && submit > persist);
  assert.match(recovery, /'requestKey', 'requestId', 'generation', 'hostId'/);
  assert.match(recovery, /terminal = \$false/);
  assert.match(recovery, /completionAmbiguous = \$false/);
  assert.match(recovery, /nextGeneration = \[int\]\$state\.generation \+ 1/);
  assert.match(recovery, /requestGeneration = 1/);
  assert.match(recovery, /\[int\]\$challenge\.requestGeneration -ne \[int\]\$state\.generation/);
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
  const rollover = recovery.indexOf('$nextGeneration = [int]$state.generation + 1');
  assert.ok(rollover >= 0);
  assert.ok(recovery.indexOf('if ([bool]$state.terminal)') < rollover);
  assert.doesNotMatch(recovery.slice(rollover - 200, rollover), /completionAmbiguous/);
});

test("reauthorization body and status transport keep request keys out of URLs and results", () => {
  const bodyStarts = [...recovery.matchAll(/\$bodyObject = \[ordered\]@\{/g)].map((m) => m.index as number);
  assert.equal(bodyStarts.length, 2);
  for (const bodyStart of bodyStarts) {
    const bodyEnd = recovery.indexOf("\n            }", bodyStart);
    const body = recovery.slice(bodyStart, bodyEnd);
    assert.match(body, /declaration|publicKey|keyFingerprint|signature/);
    assert.doesNotMatch(body, /requestKey\s*=/);
  }
  assert.doesNotMatch(recovery, /reauthorization-requests\/[^']*\/status\?requestKey=/);
  assert.match(recovery, /x-hola-reauthorization-key/);
  assert.doesNotMatch(recovery, /return[\s\S]{0,300}requestKey\s*=/);
});

test("recovery never starts runtime lifecycle and never emits secrets", () => {
  assert.doesNotMatch(recovery, /Initialize-HolaCoordinatorRuntime|Invoke-HolaCoordinator/);
  assert.doesNotMatch(recovery, /Write-Host|Console\.Out|Write-Output/);
  assert.doesNotMatch(recovery, /accessToken\s*=\s*\[string\]\$issued\.accessToken[\s\S]{0,160}return/);
});