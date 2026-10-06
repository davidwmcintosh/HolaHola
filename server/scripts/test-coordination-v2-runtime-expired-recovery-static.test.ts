import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { runtimeEvidenceDigest } from '../services/coordination-v2-runtime-evidence-canonicalization';

const source = readFileSync('scripts/hola-coordinator.ps1', 'utf8');
const registry = readFileSync('scripts/run-ci-test-steps.mjs', 'utf8');
function fn(text: string, name: string) {
  const start = text.indexOf(`function ${name} {`);
  assert.ok(start >= 0, name);
  const next = text.indexOf('\nfunction ', start + 1);
  return text.slice(start, next < 0 ? undefined : next);
}
// These are actual-source structural/mutation checks, not native Windows proof.
function oracle(text: string) {
  assert.match(fn(text, 'ConvertTo-CanonicalJson'), /param\(\[Parameter\(Mandatory = \$true\)\]\[AllowNull\(\)\]\$Value\)/);
  const intake = fn(text, 'Assert-RuntimeRecoveryEvidence');
  assert.match(intake, /Assert-RuntimeManifestShape -Envelope \$Envelope -AllowExpired/);
  assert.match(intake, /Envelope\.payload\.hostKeyFingerprint -cne \[string\]\$Identity\.fingerprint/);
  assert.match(intake, /Envelope\.payload\.requestKeyDigest -cne \(Get-RuntimeRecoveryDigest -Value \$RequestKey\)/);
  assert.match(intake, /Envelope\.canonicalResponseDigest -cne \(Get-RuntimeRecoveryDigest -Value \$Envelope\.payload\)/);
  assert.match(intake, /signature\.Length -ne 64/);
  assert.match(intake, /Envelope\.keyFingerprint -cne \$fingerprint/);
  assert.match(intake, /expiresAt\)\.ToUniversalTime\(\) -le \[DateTime\]::UtcNow/);
  const journal = fn(text, 'Save-RuntimeExpiredEvidence');
  assert.match(journal, /Assert-RuntimeRecoveryEvidence/);
  assert.match(journal, /Write-RuntimeRecoveryDpapi -Path \$path -Value \$record -CreateOnce/);
  assert.match(journal, /successorRequestKey = \$\(if \(\$ObserveOnly\) \{ '' \}/);
  assert.match(journal, /runtime_recovery_record_conflict/);
  const resume = fn(text, 'Resume-RuntimeRecovery');
  assert.match(resume, /if \(\$parents\.Count -gt 1\) \{ Fail-Safe 'runtime_recovery_ambiguous' \}/);
  assert.match(resume, /requestKey = \[string\]\$record\.successorRequestKey/);
  assert.match(resume, /Get-RuntimeRecoveryBaseline/);
  assert.match(resume, /runtime_recovery_state_conflict/);
  assert.match(resume, /Assert-RuntimeRecoveryEvidence -Envelope \$State\.manifest/);
  assert.match(resume, /runtime-bootstrap-recovery-\*\.dpapi/);
  assert.match(resume, /runtime-bootstrap-expired-\*\.dpapi/);
  assert.match(resume, /Write-RuntimeRecoveryDpapi -Path \$RuntimeRequestPath -Value \$State/);
  assert.ok(resume.indexOf('Write-RuntimeRecoveryDpapi -Path $RuntimeRequestPath') <
    resume.indexOf('Remove-RuntimeRecoveryStage -Record $record'));
  const writer = fn(text, 'Write-RuntimeRecoveryDpapi');
  assert.match(writer, /\$stream\.Flush\(\$true\)/);
  assert.match(writer, /\[IO\.File\]::Move\(\$temporary, \$full\)/);
  assert.match(writer, /\[IO\.File\]::Replace\(\$temporary, \$full, \$null\)/);
  assert.match(writer, /ProtectedData\]::Unprotect/);
  assert.match(writer, /runtime_recovery_roundtrip_invalid/);
  assert.match(writer, /Assert-PrivatePath -Path \$full -Root \$RuntimeBootstrapRoot/);
  assert.doesNotMatch(writer, /Move-Item.*-Force/);
  const init = fn(text, 'Initialize-HolaCoordinatorRuntime');
  assert.ok(init.indexOf('Resume-RuntimeRecovery') < init.indexOf('$savedExpiry'));
  assert.match(init, /\$issueAttempt -lt 2;/);
  assert.match(init, /if \(\$generationRotations -ge 1\)/);
  assert.match(init, /-Identity \$identity -ObserveOnly \| Out-Null\s+Fail-Safe 'runtime_recovery_rotation_limit'/);
  assert.ok(init.indexOf('Save-RuntimeExpiredEvidence -State') <
    init.indexOf('$resumed = Resume-RuntimeRecovery', init.indexOf('$issuePath')));
  assert.match(init, /\$requestKeyDigest = Get-RuntimeRecoveryDigest -Value \(\[string\]\$requestState\.requestKey\)/);
  assert.match(init, /Assert-RuntimeManifestShape -Envelope \$issueResponse\r?\n/);
  assert.match(init, /Assert-FullyInstalledRuntimeGeneration -Manifest \$manifest -EnvelopePath \$RuntimeManifest\s/);
  assert.match(init, /Invoke-PinnedManifestVerifier/);
  assert.match(init, /Install-RuntimeGenerationAtomic/);
  assert.doesNotMatch(init, /Write-DpapiJsonAtomic -Path \$RuntimeRequestPath/);
  assert.doesNotMatch(init, /Invoke-HolaCoordinator\s|Set-ExecutionPolicy|host-material\.dpapi|host-private-key\.dpapi/);
  const baseline = fn(text, 'Get-RuntimeRecoveryBaseline');
  assert.match(baseline, /Assert-FullyInstalledRuntimeGeneration -Manifest \$baseline -EnvelopePath \$RuntimeManifest -AllowExpired/);
  assert.match(text, /if \(!crypto\.verify\(null, Buffer\.from\(canonicalPayload\), key, Buffer\.from\(envelope\.signature, "base64"\)\)\) fail\("manifest_signature"\)/);
}

test('expired recovery preserves the approved source-level authority and crash boundaries', () => oracle(source));
test('request binding uses the server canonical-string digest, not the raw UTF-8 digest', () => {
  const key = 'e1eb3224-41b8-4ba7-a099-867c6b46f15b';
  assert.equal(runtimeEvidenceDigest(key), runtimeEvidenceDigest(JSON.parse(JSON.stringify(key))));
  assert.match(fn(source, 'Get-RuntimeRecoveryDigest'), /ConvertTo-CanonicalJson -Value \$Value/);
  assert.match(readFileSync('server/services/coordination-v2-runtime-bootstrap-service.ts', 'utf8'),
    /createHash\('sha256'\)\.update\(canonicalJson\(value\), 'utf8'\)/);
});
test('recovery structural checks are registered in the CI command registry', () => {
  assert.ok(registry.includes('npx tsx --test server/scripts/test-coordination-v2-runtime-expired-recovery-static.test.ts'));
});
test('native fixture is isolated, gated, and exercises actual DPAPI rather than Linux mocks', () => {
  const fixture = readFileSync('scripts/test-hola-coordinator-runtime-recovery.ps1', 'utf8');
  assert.match(fixture, /PublicationGatesVerified/);
  assert.match(fixture, /before loading the changed launcher/);
  assert.match(fixture, /https:\/\/runtime-fixture\.invalid/);
  assert.match(fixture, /Save-RuntimeExpiredEvidence/);
  assert.match(fixture, /Resume-RuntimeRecovery/);
  assert.match(fixture, /Read-DpapiJson/);
  assert.doesNotMatch(fixture, /function (?:Assert-SidAcl|Assert-NoReparse|Write-RuntimeRecoveryDpapi|Read-DpapiJson)\s*\{/);
});

test('PowerShell parser accepts the launcher and native fixture on Linux, not native Windows proof', (context) => {
  if (process.platform === 'win32') { context.skip('Windows execution requires separate publication gates'); return; }
  const probe = spawnSync('pwsh', ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
    encoding: 'utf8', timeout: 15_000,
  });
  if (probe.error && (probe.error as NodeJS.ErrnoException).code === 'ENOENT') {
    context.skip('PowerShell is unavailable; structural checks still run'); return;
  }
  assert.equal(probe.status, 0, probe.stderr);
  const result = spawnSync('pwsh', ['-NoLogo', '-NoProfile', '-Command',
    '$t=$null;$e=$null;[void][Management.Automation.Language.Parser]::ParseFile("scripts/hola-coordinator.ps1",[ref]$t,[ref]$e);' +
    'if($e.Count -ne 0){throw "launcher_parse_failed"};' +
    '[void][Management.Automation.Language.Parser]::ParseFile("scripts/test-hola-coordinator-runtime-recovery.ps1",[ref]$t,[ref]$e);' +
    'if($e.Count -ne 0){throw "fixture_parse_failed"};[Console]::WriteLine("PowerShell parse checks passed")'], {
    encoding: 'utf8', timeout: 15_000,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /PowerShell parse checks passed/);
});

const mutations: Array<[string, string, string]> = [
  ['expired intake removed', 'Assert-RuntimeManifestShape -Envelope $Envelope -AllowExpired', 'Assert-RuntimeManifestShape -Envelope $Envelope'],
  ['host binding bypassed', 'Envelope.payload.hostKeyFingerprint -cne [string]$Identity.fingerprint', 'Envelope.payload.hostKeyFingerprint -cne [string]$Envelope.payload.hostKeyFingerprint'],
  ['request binding bypassed', 'Envelope.payload.requestKeyDigest -cne (Get-RuntimeRecoveryDigest -Value $RequestKey)', 'Envelope.payload.requestKeyDigest -cne $Envelope.payload.requestKeyDigest'],
  ['digest binding bypassed', 'Envelope.canonicalResponseDigest -cne (Get-RuntimeRecoveryDigest -Value $Envelope.payload)', 'Envelope.canonicalResponseDigest -cne $Envelope.canonicalResponseDigest'],
  ['create-once removed', 'Write-RuntimeRecoveryDpapi -Path $path -Value $record -CreateOnce', 'Write-RuntimeRecoveryDpapi -Path $path -Value $record'],
  ['successor reuse removed', 'requestKey = [string]$record.successorRequestKey', "requestKey = [Guid]::NewGuid().ToString()"],
  ['persist before POST removed', 'Write-RuntimeRecoveryDpapi -Path $RuntimeRequestPath -Value $State', '$null = $State'],
  ['null record values rejected', 'param([Parameter(Mandatory = $true)][AllowNull()]$Value)', 'param([Parameter(Mandatory = $true)]$Value)'],
  ['rotation bound removed', '$issueAttempt -lt 2', '$issueAttempt -lt 200'],
  ['ambiguous successor accepted', "if ($parents.Count -gt 1) { Fail-Safe 'runtime_recovery_ambiguous' }", '$null = $parents'],
  ['installed baseline proof removed', 'Assert-FullyInstalledRuntimeGeneration -Manifest $baseline -EnvelopePath $RuntimeManifest -AllowExpired', '$null = $baseline'],
  ['fresh expiry bypassed', 'Assert-RuntimeManifestShape -Envelope $issueResponse\n', 'Assert-RuntimeManifestShape -Envelope $issueResponse -AllowExpired\n'],
  ['fresh signature bypassed', 'if (!crypto.verify(null, Buffer.from(canonicalPayload), key, Buffer.from(envelope.signature, "base64"))) fail("manifest_signature");', '/* bypassed signature */'],
];
for (const [label, needle, replacement] of mutations) {
  test(`actual-source mutation fails closed: ${label}`, () => {
    assert.equal(source.split(needle).length, 2, `${label}: mutation must hit once`);
    assert.throws(() => oracle(source.replace(needle, replacement)), { name: 'AssertionError' });
  });
}
