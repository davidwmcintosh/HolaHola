import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/hola-coordinator.ps1", "utf8");
const factorySource = readFileSync("server/scripts/coordination-v2-http-factory.ts", "utf8");

function extractBoundary(script: string, name: string): string {
  const begin = `# BEGIN COORDINATION_${name}_BOUNDARY`;
  const end = `# END COORDINATION_${name}_BOUNDARY`;
  const start = script.indexOf(begin);
  const finish = script.indexOf(end, start + begin.length);
  assert.ok(start >= 0 && finish > start, `${name} boundary markers must be present and ordered`);
  return script.slice(start, finish);
}

function assertStaticBoundaryProof(script: string): void {
  assert.match(script, /Set-StrictMode\s+-Version\s+2\.0/);
  assert.match(script, /DataProtectionScope\]::CurrentUser/);

  const invoke = extractBoundary(script, "INVOKE");
  assert.match(invoke, /function\s+Invoke-HolaCoordinator/);
  assert.match(invoke, /ValidatePattern\('\^\[1-9\]\[0-9\]\*\$'\)/);
  assert.match(invoke, /ValidateSet\('text',\s*'json'\)/);
  assert.doesNotMatch(invoke, /ProtectedData|DataProtectionScope|CurrentUserScope/i);
  assert.doesNotMatch(invoke, /credential|secret|token|private[-_ ]?key/i);
  assert.doesNotMatch(invoke, /Register-HolaCoordinatorHost|host-enrollment|Invoke-RestMethod/i);
  assert.doesNotMatch(invoke, /Write-DpapiBase64Atomic|Start-Process|New-Item/i);
  assert.match(invoke, /ApprovedNode/);
  assert.match(invoke, /ApprovedTsx/);
  assert.match(invoke, /CoordinatorScript/);
  assert.match(invoke, /ApprovedWorktree/);
  assert.match(invoke, /@\(ApprovedTsx,\s*\$CoordinatorScript|'--task-ref'/);
  assert.match(invoke, /Test-SafeCliOutput/);
  assert.match(invoke, /host_child_unclassified_exit/);
  assert.match(invoke, /executableRole\s*=\s*'coordinator_cli'/);
  assert.match(invoke, /exitStatus\s*=\s*\$observedChildExit/);
  assert.match(invoke, /if\s*\(\$observedChildExit\s*-eq\s*0\)\s*\{\s*\$childExit\s*=\s*70\s*\}/);
  assert.doesNotMatch(invoke, /\$childExit\s*-ne\s*0\s*-and\s*-not\s*\(Test-SafeCliOutput/);
  assert.match(invoke, /ConvertTo-Json\s+-Compress/);
  assert.match(invoke, /2>\$null/);
  assert.doesNotMatch(invoke, /stderr\s*=/i);
  assert.doesNotMatch(invoke, /--import/);
  assert.doesNotMatch(invoke, /\$Mode\b|\$Url\b|\$Provider\b|\$Credential\b/);
  assert.doesNotMatch(invoke, /COORDINATION_RUNTIME_BOOTSTRAP_TOKEN/);
  assert.doesNotMatch(invoke, /--token|--secret|--password|--credential/i);
  assert.doesNotMatch(invoke, /Register-ScheduledTask|while\s*\(/i);
  assert.match(script, /ConvertFrom-Json/);

  const register = extractBoundary(script, "REGISTER");
  assert.match(register, /function\s+Register-HolaCoordinatorHost/);
  assert.match(register, /\$CurrentUserScope/);
  assert.match(register, /ProtectedData\]::Protect\s*\(/);
  assert.equal((register.match(/ProtectedData\]::Protect\s*\(/g) ?? []).length, 3,
    "only private-key, request, and host-material custody may call DPAPI Protect");
  assert.doesNotMatch(register, /ProtectedData\]::Unprotect\s*\(/);
  assert.doesNotMatch(register, /DataProtectionScope\]::(?:LocalMachine|Machine)/i);
  assert.doesNotMatch(register, /Set-Clipboard|Out-File|Write-Host|Write-Output|Console\./i);
  assert.match(register, /Write-DpapiBase64Atomic\s+-Path\s+\$privatePath\s+-Bytes\s+\$protected/);
  assert.match(register, /Write-DpapiBase64Atomic\s+-Path\s+\$requestPath\s+-Bytes\s+\$requestCipher/);
  assert.match(register, /Write-DpapiBase64Atomic\s+-Path\s+\(Join-Path\s+\$registrationRoot\s+'host-material\.dpapi'\)\s+-Bytes\s+\$materialCipher/);
  assert.doesNotMatch(register, /manual|copy|credential output|plaintext/i);
}

test("PowerShell function-scoped boundary is explicit and narrow", () => {
  assertStaticBoundaryProof(source);
});

test("static proof does not prove Windows/DPAPI execution", () => {
  assert.match(source, /windows_required/);
  assert.match(source, /dpapi_current_user_unavailable/);
  assert.match(source, /ProtectedData\]::Protect\s*\(/);
  assert.match(source, /DataProtectionScope\]::CurrentUser/);
});

test("Windows ACL inspection translates owner and ACE identities to SIDs and fails closed", () => {
  assert.match(factorySource, /WindowsIdentity\]\:\:GetCurrent\(\)\.User/);
  assert.match(factorySource, /NTAccount/);
  assert.match(factorySource, /Translate\(\[Security\.Principal\.SecurityIdentifier\]\)/);
  assert.match(factorySource, /S-1-5-18/);
  assert.match(factorySource, /S-1-5-32-544/);
  assert.match(factorySource, /S-1-1-0/);
  assert.match(factorySource, /reparseFree/);
  assert.match(factorySource, /return \{ exists: false, reparseFree: false, aclSafe: false \}/);
  assert.doesNotMatch(factorySource, /aclSafe:\s*true/);
});

test("boundary mutation self-check rejects ProtectedData in Invoke", () => {
  const mutated = source.replace(
    "    Assert-Host\n    $arguments =",
    "    [Security.Cryptography.ProtectedData]::Protect($bytes, $null, $CurrentUserScope)\n    Assert-Host\n    $arguments =",
  );
  assert.notEqual(mutated, source);
  assert.throws(() => assertStaticBoundaryProof(mutated));
});

test("boundary mutation self-check rejects weakened Register custody", () => {
  const mutated = source
    .replace(/\$CurrentUserScope/g, "[System.Security.Cryptography.DataProtectionScope]::LocalMachine")
    .replace(/ProtectedData\]::Protect/g, "NotProtectedData]::Protect");
  assert.throws(() => assertStaticBoundaryProof(mutated));
});