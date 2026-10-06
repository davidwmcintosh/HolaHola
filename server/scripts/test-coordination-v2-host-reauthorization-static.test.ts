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
    recovery.indexOf('function Restore-InternalHolaCoordinatorHostCredential'));
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

test("HTTP failure callers retain distinct enrollment and recovery reporting contracts", () => {
  assert.equal((recovery.match(/Get-HolaCoordinatorRecoveryFailureDetail -ErrorRecord \$_/g) ?? []).length, 4);
  assert.doesNotMatch(recovery, /Get-HolaCoordinatorTransportFailureDetail/);
  const enrollment = source.slice(0, start);
  assert.equal((enrollment.match(/Get-HolaCoordinatorTransportFailureDetail -ErrorRecord \$_/g) ?? []).length, 3);
  assert.equal((enrollment.match(/Fail-Safe 'enrollment_transport' -Detail \(Get-HolaCoordinatorTransportFailureDetail -ErrorRecord \$_\)/g) ?? []).length, 3);
  const wrapper = enrollment.slice(enrollment.indexOf("function Get-HolaCoordinatorTransportFailureDetail"),
    enrollment.indexOf("function Get-HolaCoordinatorEnrollmentGuidance"));
  assert.match(wrapper, /Get-InternalHolaCoordinatorHttpFailureDetail -ErrorRecord \$ErrorRecord -Context Enrollment/);
  assert.doesNotMatch(wrapper, /ReadToEnd|\.Message|response=|error=/);
  assert.match(recovery, /Get-InternalHolaCoordinatorHttpFailureDetail -ErrorRecord \$ErrorRecord -Context Recovery/);
});

test("shared HTTP diagnostics bound JSON and stream input and never echo error text", () => {
  const reporter = recovery.slice(recovery.indexOf("function Get-InternalHolaCoordinatorHttpFailureDetail"),
    recovery.indexOf("function New-InternalHolaCoordinatorReauthorizationDeclaration"));
  assert.match(reporter, /New-Object char\[\] 4097/);
  assert.match(reporter, /\$body\.Length -gt 4096/);
  assert.match(reporter, /\$reader\.Read\(\$buffer, \$count, \$buffer\.Length - \$count\)/);
  assert.match(reporter, /ConvertFrom-Json -InputObject \$body -ErrorAction Stop/);
  assert.match(reporter, /\$body\.TrimStart\(\)\.StartsWith\('\{', \[StringComparison\]::Ordinal\)/);
  assert.match(reporter, /StartsWith\('V2_HOST_', \[StringComparison\]::Ordinal\)/);
  assert.match(reporter, /Get-InternalHolaCoordinatorDiagnosticGuidance -Code \$code\.Value -Context \$Context/);
  assert.match(reporter, /TRANSPORT_TLS|TRANSPORT_TIMEOUT/);
  assert.doesNotMatch(reporter, /ReadToEnd|Exception\.Message|Write-Host|Write-Output|Console|return \$body|response='/);
  assert.doesNotMatch(reporter, /Write-Dpapi|Remove-Item|Invoke-RestMethod|Unprotect|FromXmlString/);
});

test("enrollment allowlist is ordinal and separate from recovery guidance", () => {
  const guidance = source.slice(source.indexOf("function Get-HolaCoordinatorEnrollmentGuidance"),
    source.indexOf("function Resolve-ApprovedNode"));
  assert.match(guidance, /StringComparer\]::Ordinal/);
  assert.match(guidance, /V2_HOST_BOOTSTRAP_CONSUMED/);
  assert.doesNotMatch(guidance, /V2_HOST_REAUTH_|Get-HolaCoordinatorRecoveryGuidance|Invoke-RestMethod|Write-Dpapi|Remove-Item/);
  const selector = recovery.slice(recovery.indexOf("function Get-InternalHolaCoordinatorDiagnosticGuidance"),
    recovery.indexOf("function Format-InternalHolaCoordinatorHttpFailureDetail"));
  assert.match(selector, /\$Context -ceq 'Enrollment'/);
  assert.match(selector, /Get-HolaCoordinatorEnrollmentGuidance -Code \$Code/);
  assert.match(selector, /Get-HolaCoordinatorRecoveryGuidance -Code \$Code/);
});

test("Windows CI retains the synthetic enrollment and recovery diagnostics fixture", () => {
  const fixture = readFileSync("scripts/test-hola-coordinator-reauthorization.ps1", "utf8");
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  assert.match(fixture, /^\s*& \(Join-Path \$PSScriptRoot 'test-hola-coordinator-recovery-diagnostics\.ps1'\)/m);
  assert.match(workflow, /shell: powershell\s+run: \.\\scripts\\test-hola-coordinator-reauthorization\.ps1/);
});

test("enrollment diagnostic mutation proof stays synthetic and checks specific failures", () => {
  const fixture = readFileSync("scripts/test-hola-coordinator-recovery-diagnostics.ps1", "utf8");
  const proof = readFileSync("scripts/test-hola-coordinator-enrollment-diagnostic-mutations.ps1", "utf8");
  assert.match(fixture, /param\(\[switch\]\$SkipMutationChecks\)/);
  assert.match(fixture, /if \(-not \$SkipMutationChecks\)[\s\S]*test-hola-coordinator-enrollment-diagnostic-mutations\.ps1/);
  assert.match(fixture, /Get-HolaCoordinatorEnrollmentGuidance -Code \$code\.ToLowerInvariant\(\)/);
  for (const name of ["raw-response", "raw-exception", "case-insensitive-guidance", "root-array", "unmodified"]) {
    assert.ok(proof.includes(`name = '${name}'`));
  }
  for (const failure of ["Enrollment secret reflected", "Enrollment guidance accepted case-insensitive reason",
    "Enrollment malformed root array accepted"]) {
    assert.ok(fixture.includes(failure) && proof.includes(failure));
  }
  assert.match(proof, /GetTempPath\(\)/);
  assert.match(proof, /-Command \$bootstrap/);
  assert.match(proof, /\$copy\.Replace[\s\S]*-SkipMutationChecks/);
  assert.match(proof, /\$exitCode -eq 0 -or -not \$output\.Contains\(\$mutation\.failure\)/);
  assert.match(proof, /finally[\s\S]*\[IO\.Directory\]::Delete\(\$root, \$true\)/);
  assert.doesNotMatch(proof, /-ExecutionPolicy|Invoke-RestMethod|Write-Dpapi|Initialize-HolaCoordinatorRuntime|Invoke-HolaCoordinator\b/);
});

test("public recovery sanitizes local errors while preserving recognized failure codes", () => {
  const wrapper = recovery.slice(recovery.indexOf("function Restore-HolaCoordinatorHostCredential"));
  assert.match(wrapper, /Restore-InternalHolaCoordinatorHostCredential -Endpoint \$Endpoint/);
  assert.match(wrapper, /Get-HolaCoordinatorRecoveryGuidance -Code \$code/);
  assert.match(wrapper, /Fail-Safe \$code -Detail/);
  assert.match(wrapper, /host_recovery_failed/);
  assert.match(wrapper, /\$message -ceq \('hola_coordinator_host_reauthorization_transport :: ' \+ \$detail\)/);
  assert.doesNotMatch(wrapper, /^\s*throw(?:\s|$)|Fail-Safe[^\n]*-Detail \$message|Write-Dpapi|Remove-Item/m);
});

test("native material fixtures match the strict JSON object boundary", () => {
  const fixture = readFileSync("scripts/test-hola-coordinator-reauthorization.ps1", "utf8");

  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  for (const name of ["expiredMaterial", "badMaterial", "futureMaterial"]) {
    assert.match(fixture, new RegExp(`\\$${name} = \\[pscustomobject\\]\\[ordered\\]@\\{`));
  }
});

  const selector = recovery.slice(recovery.indexOf("function Get-InternalHolaCoordinatorDiagnosticGuidance"),
    recovery.indexOf("function Format-InternalHolaCoordinatorHttpFailureDetail"));
