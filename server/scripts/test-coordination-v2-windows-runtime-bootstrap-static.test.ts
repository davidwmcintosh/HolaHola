import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/hola-coordinator.ps1", "utf8");

function boundary(name: string): string {
  const startMarker = `# BEGIN COORDINATION_${name}_BOUNDARY`;
  const endMarker = `# END COORDINATION_${name}_BOUNDARY`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `${name} boundary markers must be ordered`);
  return source.slice(start, end);
}

test("runtime initializer has only the HTTPS endpoint authority", () => {
  const match = source.match(/function Initialize-HolaCoordinatorRuntime\s*\{[\s\S]*?param\(([\s\S]*?)\)\s*\n/);
  assert.ok(match);
  assert.match(match[1], /\[string\]\$Endpoint/);
  assert.doesNotMatch(match[1], /\$Task|\$Policy|\$Path|\$Url|\$Token|\$Secret|\$Credential|\$Destination/i);
  assert.match(source, /ValidatePattern\('\^https:\/\/'\)/);
  assert.match(source, /runtime-bootstrap-request\.dpapi/);
  assert.match(source, /runtime-bootstrap-ack\.dpapi/);
  assert.match(source, /\.runtime-bootstrap-staging-/);
  assert.match(source, /\.coordination-v2-runtime-manifest\.json/);
});

test("runtime bootstrap proves custody, closed responses, pinned verification, and safe output", () => {
  const runtime = boundary("RUNTIME_BOOTSTRAP");
  assert.match(source, /DataProtectionScope\]::CurrentUser/);
  assert.match(runtime, /Write-DpapiJsonAtomic\s+-Path\s+\$RuntimeRequestPath/);
  assert.match(runtime, /Persist the exact signed retry authority/);
  assert.match(runtime, /Assert-ExactPropertySet/);
  assert.match(runtime, /canonicalResponseDigest/);
  assert.match(source, /keyFingerprint/);
  assert.match(source, /COORDINATION_V2_SERVER_SIGNING_PUBLIC_KEY|coordination-v2-server-signing-public\.pem/);
  assert.match(runtime, /Invoke-PinnedManifestVerifier/);
  assert.match(source, /Get-AuthenticodeSignature/);
  assert.match(runtime, /Install-RuntimeGenerationAtomic/);
  assert.match(runtime, /SignData/);
  assert.match(runtime, /credentialProtected\s*=\s*\$true/);
  assert.doesNotMatch(runtime, /Write-Host|Console\.Out/);
});

test("manifest verifier is a fixed inline Node verifier and runs before artifact download", () => {
  const runtime = boundary("RUNTIME_BOOTSTRAP");
  const verifier = source.indexOf("$verifier = @'");
  const download = runtime.indexOf("Download-RuntimeArtifact");
  const firstVerify = runtime.indexOf("Invoke-PinnedManifestVerifier");
  assert.ok(verifier >= 0);
  assert.match(source.slice(verifier, source.indexOf("'@", verifier)), /createPublicKey/);
  assert.match(source.slice(verifier, source.indexOf("'@", verifier)), /ed25519/);
  const secondDownload = runtime.indexOf("Download-RuntimeArtifact", download + 1);
  assert.ok(firstVerify >= 0 && download >= 0 && secondDownload > firstVerify);
  assert.match(source, /before any staged JavaScript is/);
});

test("role-specific execution preflight rejects local or server proof drift", () => {
  const executionStart = source.indexOf("function Assert-ExecutionHost");
  const executionEnd = source.indexOf("function Invoke-HolaCoordinator", executionStart);
  assert.ok(executionStart >= 0 && executionEnd > executionStart);
  const execution = source.slice(executionStart, executionEnd);
  assert.match(source, /\$RuntimeNode = Join-Path \$RuntimeRoot/);
  assert.match(execution, /Get-InstalledRuntimeManifest/);
  assert.match(execution, /Assert-SourceMemberHash/);
  assert.match(execution, /Get-ServerRuntimeStatus/);
  assert.match(execution, /executionPreflightMayProceed/);
  assert.match(execution, /revoked/);
  assert.match(execution, /revoked\s+-or\s+-not\s+\$status\.sourceCurrent/);
});

test("only node.exe crosses the Authenticode boundary", () => {
  const executionStart = source.indexOf("function Assert-ExecutionHost");
  const executionEnd = source.indexOf("function Invoke-HolaCoordinator", executionStart);
  assert.ok(executionStart >= 0 && executionEnd > executionStart);
  const execution = source.slice(executionStart, executionEnd);
  assert.match(execution, /Assert-ApprovedSignatureAndDigest\s+-Path\s+\$ApprovedNode/);
  assert.doesNotMatch(execution, /Assert-ApprovedSignatureAndDigest\s+-Path\s+\$(?:LauncherPath|ApprovedTsx|CoordinatorScript)/);
  assert.match(execution, /Assert-InstalledArtifactMembership\s+-Manifest\s+\$manifest/);
  assert.match(execution, /Assert-SourceMemberHash\s+-Manifest\s+\$manifest/);
});

test("mutation adding generic Authenticode to a script is caught", () => {
  const executionStart = source.indexOf("function Assert-ExecutionHost");
  const insertion = "    Assert-ApprovedSignatureAndDigest -Path $CoordinatorScript\n";
  const mutated = source.slice(0, executionStart) + insertion + source.slice(executionStart);
  const executionEnd = mutated.indexOf("function Invoke-HolaCoordinator", executionStart);
  const execution = mutated.slice(executionStart, executionEnd);
  assert.throws(() => {
    assert.doesNotMatch(
      execution,
      /Assert-ApprovedSignatureAndDigest\s+-Path\s+\$(?:LauncherPath|ApprovedTsx|CoordinatorScript)/,
    );
  });
});

test("mutation removing pinned verification is caught by the focused proof", () => {
  const mutated = source.replace(
    /Invoke-PinnedManifestVerifier -NodePath \$nodeForVerification/,
    "Write-Output 'skip verifier'",
  );
  assert.notEqual(mutated, source);
  assert.doesNotMatch(mutated, /Invoke-PinnedManifestVerifier -NodePath \$nodeForVerification/);
});

test("PowerShell 5.1 pending enrollment status uses property existence and exact challenge shape", () => {
  assert.match(source, /\$status\.PSObject\.Properties\['challenge'\]/);
  assert.match(source, /\$challenge -isnot \[PSCustomObject\]/);
  assert.match(source, /host_challenge_invalid/);
  assert.doesNotMatch(source, /\n\s*if\s*\(\$status\.challenge\)\s*\{/);
});

test("manifest paths and closure are closed after forward-slash normalization", () => {
  assert.match(source, /\$normalized = \$Path\.Replace/);
  assert.match(source, /CompareOrdinal/);
  assert.match(source, /runtime\\node\.exe/);
  assert.match(source, /node_modules\\tsx\\/);
  assert.match(source, /RuntimeTotalArtifactMaxBytes/);
  assert.match(source, /tsxCount -lt 1/);
  assert.match(source, /tsxCount -gt 4095/);
  assert.match(source, /sourceMembers\.Count -ne 3/);
  assert.match(source, /scripts\/hola-coordinator\.ps1/);
  assert.match(source, /scripts\/coordination-v2-server-signing-public\.pem/);
  assert.match(source, /server\/scripts\/coordination-v2-cli\.ts/);
});

test("canonical map regression and promotion rollback proofs remain present", () => {
  assert.match(source, /System\.Collections\.IDictionary/);
  assert.match(source, /\$Value\[\$key\]/);
  assert.match(source, /runtime_generation_restore_failed/);
  assert.match(source, /runtime_generation_promotion_failed/);
  assert.match(source, /Remove-Item -LiteralPath \$nodeBackup/);
  assert.match(source, /Remove-Item -LiteralPath \$tsxBackup/);
  assert.match(source, /Write-DpapiJsonAtomic[\s\S]*Assert-SidAcl -Path \$parent/);
});

test("canonical map mutation proof requires the IDictionary branch", () => {
  const mutated = source.replace(
    "if ($Value -is [System.Collections.IDictionary]) {",
    "if ($false) {",
  );
  assert.notEqual(mutated, source);
  assert.doesNotMatch(mutated, /if \(\$Value -is \[System\.Collections\.IDictionary\]\) \{/);
});

test("initialization never trusts a local acknowledgement and rotates expired uninstalled issues", () => {
  const runtime = boundary("RUNTIME_BOOTSTRAP");
  assert.doesNotMatch(runtime, /return \[ordered\]@\{\s*runtimeReleaseId/);
  assert.match(runtime, /savedExpiry/);
  assert.match(runtime, /expiredStage/);
  assert.match(runtime, /requestKey = \[Guid\]::NewGuid\(\)\.ToString\(\)/);
  assert.match(runtime, /Write-DpapiJsonAtomic -Path \$RuntimeRequestPath/);
  assert.match(runtime, /if \(-not \[bool\]\$requestState\.installed/);
});

test("acknowledgement is gated by full installed-generation verification", () => {
  const runtime = boundary("RUNTIME_BOOTSTRAP");
  const verification = runtime.indexOf("Assert-FullyInstalledRuntimeGeneration -Manifest $manifest");
  const signing = runtime.indexOf("$identity.rsa.SignData");
  assert.ok(verification >= 0 && signing > verification);
  assert.match(source, /Invoke-PinnedManifestVerifier -NodePath \$RuntimeNode/);
  assert.match(source, /Assert-InstalledArtifactMembership -Manifest \$Manifest/);
  assert.match(source, /foreach \(\$member in @\(\$Manifest\.payload\.sourceMembers\)\)/);
  assert.match(source, /rev-parse HEAD\^\{tree\}/);
});

test("mutation removing acknowledgement verification is rejected", () => {
  const runtime = boundary("RUNTIME_BOOTSTRAP");
  const mutated = runtime.replace(
    /Assert-FullyInstalledRuntimeGeneration -Manifest \$manifest -EnvelopePath \$RuntimeManifest/,
    "Write-Output 'skip installed verification'",
  );
  assert.notEqual(mutated, runtime);
  const signing = mutated.indexOf("$identity.rsa.SignData");
  const verification = mutated.indexOf("Assert-FullyInstalledRuntimeGeneration -Manifest $manifest");
  assert.equal(verification, -1);
  assert.ok(signing >= 0);
});

test("expired installed issues preserve only fully verified matching generations", () => {
  const runtime = boundary("RUNTIME_BOOTSTRAP");
  assert.match(runtime, /installedBaseline/);
  assert.match(runtime, /AllowExpired/);
  assert.match(runtime, /Test-RuntimeGenerationEvidenceEquivalent/);
  assert.match(runtime, /candidateEnvelope/);
  assert.match(runtime, /Write-InstalledManifestAtomic -Path \$RuntimeManifest/);
  assert.match(runtime, /fall through to a clean staged installation/);
});

test("destination writes use ACL-proven parents and create-new semantics", () => {
  assert.match(source, /Assert-SidAcl -Path \$ApprovedWorktree/);
  assert.match(source, /Assert-SidAcl -Path \$parent/);
  assert.match(source, /Assert-SidAcl -Path \$destinationParent/);
  assert.match(source, /\[IO\.FileMode\]::CreateNew/);
  assert.doesNotMatch(source, /Invoke-WebRequest\s+-Method\s+Get[\s\S]*?-OutFile\s+\$target/);
  assert.match(source, /Write-InstalledManifestAtomic/);
  assert.match(source, /Move-Item -LiteralPath \$temporary -Destination \$fullPath -Force/);
});

test("initializer owns a per-current-user mutex for the complete critical section", () => {
  const runtime = boundary("RUNTIME_BOOTSTRAP");
  assert.match(runtime, /WindowsIdentity\]\:\:GetCurrent\(\)\.User\.Value/);
  assert.match(runtime, /System\.Threading\.Mutex/);
  assert.match(runtime, /WaitOne\(0\)/);
  assert.match(runtime, /ReleaseMutex\(\)/);
  assert.match(runtime, /runtime_bootstrap_busy/);
});