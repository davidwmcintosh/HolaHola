import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/hola-coordinator.ps1", "utf8");

test("PowerShell boundary is explicit and narrow", () => {
  assert.match(source, /Set-StrictMode\s+-Version\s+2\.0/);
  assert.match(source, /ValidateSet\('preflight',\s*'prepare'\)/);
  assert.match(source, /DataProtectionScope\]::CurrentUser/);
  assert.match(source, /ProtectedData/);
  assert.match(source, /ApprovedNode/);
  assert.match(source, /ApprovedWorktree/);
  assert.match(source, /Move-Item/);
  assert.match(source, /same.volume|same volume/i);
  assert.match(source, /M9 transport activation is intentionally absent/);
  assert.doesNotMatch(source, /Invoke-Transport|Start-Transport|activate.*transport/i);
  assert.doesNotMatch(source, /ValidateSet\([^)]*(?:run|initialize|status)/);
  assert.doesNotMatch(source, /COORDINATION_RUNTIME_BOOTSTRAP_TOKEN/);
  assert.doesNotMatch(source, /--token|--secret|--password|--credential/i);
  assert.doesNotMatch(source, /Start-Process|Register-ScheduledTask|while\s*\(/i);
});

test("static proof does not prove Windows/DPAPI execution", () => {
  assert.match(source, /CurrentUser/);
  assert.match(source, /windows_required/);
  assert.match(source, /dpapi_current_user_unavailable/);
});
