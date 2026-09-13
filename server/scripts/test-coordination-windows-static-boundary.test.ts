import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/hola-coordinator.ps1", "utf8");

test("PowerShell boundary is explicit and narrow", () => {
  assert.match(source, /Set-StrictMode\s+-Version\s+2\.0/);
  assert.match(source, /function\s+Invoke-HolaCoordinator/);
  assert.match(source, /ValidatePattern\('\^\[1-9\]\[0-9\]\*\$'\)/);
  assert.match(source, /ValidateSet\('text',\s*'json'\)/);
  assert.match(source, /DataProtectionScope\]::CurrentUser/);
  assert.match(source, /ProtectedData/);
  assert.match(source, /ApprovedNode/);
  assert.match(source, /ApprovedTsx/);
  assert.match(source, /CoordinatorScript/);
  assert.match(source, /ApprovedWorktree/);
  assert.match(source, /@\(ApprovedTsx,\s*\$CoordinatorScript|'--task-ref'/);
  assert.match(source, /Test-SafeCliOutput/);
  assert.match(source, /host_child_unclassified_exit/);
  assert.match(source, /executableRole\s*=\s*'coordinator_cli'/);
  assert.match(source, /exitStatus\s*=\s*\$observedChildExit/);
  assert.match(source, /if\s*\(\$observedChildExit\s*-eq\s*0\)\s*\{\s*\$childExit\s*=\s*70\s*\}/);
  assert.doesNotMatch(source, /\$childExit\s*-ne\s*0\s*-and\s*-not\s*\(Test-SafeCliOutput/);
  assert.match(source, /ConvertFrom-Json/);
  assert.match(source, /ConvertTo-Json\s+-Compress/);
  assert.match(source, /2>\$null/);
  assert.doesNotMatch(source, /stderr\s*=/i);
  assert.doesNotMatch(source, /--import/);
  assert.doesNotMatch(source, /\$Mode\b|\$Url\b|\$Provider\b|\$Credential\b/);
  assert.doesNotMatch(source, /COORDINATION_RUNTIME_BOOTSTRAP_TOKEN/);
  assert.doesNotMatch(source, /--token|--secret|--password|--credential/i);
  assert.doesNotMatch(source, /Start-Process|Register-ScheduledTask|while\s*\(/i);
});

test("static proof does not prove Windows/DPAPI execution", () => {
  assert.match(source, /CurrentUser/);
  assert.match(source, /windows_required/);
  assert.match(source, /dpapi_current_user_unavailable/);
  assert.doesNotMatch(source, /ProtectedData\]::(?:Protect|Unprotect)\s*\(/);
});
