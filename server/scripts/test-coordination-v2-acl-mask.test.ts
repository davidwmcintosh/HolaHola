import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Supplementary source/bitmask contract checks, NOT native Windows evidence.
const script = readFileSync("scripts/hola-coordinator.ps1", "utf8");
const guard = script.match(/function Assert-SidAcl \{([\s\S]*?)\r?\n\}/)?.[1];
assert.ok(guard, "production ACL guard must exist");
const mask = guard.match(/\$unsafeWriteMask\s*=\s*\[int\]\(([\s\S]*?)\r?\n\s*\)/)?.[1];
assert.ok(mask, "production mask must exist");
const primitiveRights = {
  WriteData: 2,
  AppendData: 4,
  WriteExtendedAttributes: 16,
  DeleteSubdirectoriesAndFiles: 64,
  WriteAttributes: 256,
  Delete: 65536,
  ChangePermissions: 262144,
  TakeOwnership: 524288,
};
// System.Security.AccessControl.FileSystemRights SDK values.
const sdkRights: Record<string, number> = {
  ...primitiveRights,
  ReadData: 1,
  ReadExtendedAttributes: 8,
  ExecuteFile: 32,
  ReadAttributes: 128,
  ReadPermissions: 131072,
  Synchronize: 1048576,
  Write: 278,
  Read: 131209,
  ReadAndExecute: 131241,
  Modify: 197055,
  FullControl: 2032127,
};
function parseMask(expression: string): number {
  const withoutComments = expression.replace(/#[^\r\n]*/g, "");
  const names = [...withoutComments.matchAll(/\[System\.Security\.AccessControl\.FileSystemRights\]::(\w+)/g)]
    .map((match) => match[1]);
  assert.ok(names.length > 0);
  const leftover = withoutComments
    .replace(/\[System\.Security\.AccessControl\.FileSystemRights\]::\w+/g, "")
    .replace(/-bor|`|\s/g, "");
  assert.equal(leftover, "", "mask must consist only of named enum values joined by -bor");
  return names.reduce((bits, name) => {
    assert.ok(Object.hasOwn(sdkRights, name), `unknown SDK right ${name}`);
    return bits | sdkRights[name];
  }, 0);
}
function assertMaskContract(expression: string): void {
  const bits = parseMask(expression);
  for (const [name, value] of Object.entries(primitiveRights)) {
    assert.equal(bits & value, value, `missing mutating right ${name}`);
  }
  for (const name of ["ReadData", "ReadExtendedAttributes", "ExecuteFile", "ReadAttributes",
    "ReadPermissions", "Synchronize", "Read", "ReadAndExecute"]) {
    assert.equal(bits & sdkRights[name], 0, `read-only right rejected: ${name}`);
  }
  for (const name of ["Write", "Modify", "FullControl"]) {
    assert.notEqual(bits & sdkRights[name], 0, `composite mutation permitted: ${name}`);
  }
}

test("production mask contains exactly the eight primitive mutating rights", () => {
  const names = [...mask.matchAll(/FileSystemRights\]::(\w+)/g)].map((match) => match[1]);
  assert.deepEqual(names.sort(), Object.keys(primitiveRights).sort());
  assertMaskContract(mask);
  const readExecuteSync = sdkRights.ReadAndExecute | sdkRights.Synchronize;
  assert.equal(parseMask(mask) & readExecuteSync, 0);
  assert.notEqual(parseMask(mask) & (readExecuteSync | sdkRights.WriteData), 0);
});

test("mask contract detects composite over-rejection and every omitted primitive", () => {
  assert.throws(() => assertMaskContract(`${mask} -bor [System.Security.AccessControl.FileSystemRights]::FullControl`),
    /read-only right rejected/);
  for (const omitted of Object.keys(primitiveRights)) {
    const incomplete = Object.keys(primitiveRights).filter((name) => name !== omitted)
      .map((name) => `[System.Security.AccessControl.FileSystemRights]::${name}`).join(" -bor ");
    assert.throws(() => assertMaskContract(incomplete), new RegExp(`missing mutating right ${omitted}`));
  }
});

test("owner and trusted-writer policy and both conservative rejection branches stay intact", () => {
  assert.match(guard, /\$allowedOwners = @\(\$currentSid, 'S-1-5-18', 'S-1-5-32-544'\)/);
  assert.match(guard, /if \(\$allowedOwners -notcontains \$ownerSid\) \{ Fail-Safe 'acl_owner_unsafe' \}/);
  assert.match(guard, /if \(\(\$rights -band \$unsafeWriteMask\) -ne 0 -and \$allowedOwners -notcontains \$sid\)/);
  assert.match(guard, /Fail-Safe 'acl_write_unsafe'/);
  assert.match(guard, /if \(\(\$rights -band \$unsafeWriteMask\) -ne 0\) \{ Fail-Safe 'acl_untrusted_write' \}/);
  assert.doesNotMatch(guard, /AccessControlType|PropagationFlags/);
  for (const sid of ["S-1-1-0", "S-1-5-32-545", "S-1-5-32-546", "S-1-5-11"]) {
    assert.ok(guard.includes(`$sid -eq '${sid}'`));
  }
});

test("native ACL fixtures are wired to the existing Windows PowerShell job", () => {
  const entry = readFileSync("scripts/test-hola-coordinator-reauthorization.ps1", "utf8");
  assert.match(entry, /^& \(Join-Path \$PSScriptRoot 'test-hola-coordinator-acl\.ps1'\)\r?$/m);
  const ci = readFileSync(".github/workflows/ci.yml", "utf8");
  assert.match(ci, /test-windows-powershell:[\s\S]*?shell: powershell\s+run: \.\\scripts\\test-hola-coordinator-reauthorization\.ps1/);
  const native = readFileSync("scripts/test-hola-coordinator-acl.ps1", "utf8");
  assert.match(native, /Set-Acl -LiteralPath \$path -AclObject \$acl/);
  assert.match(native, /Set-MutantMask -Expression/);
  assert.doesNotMatch(native, /Invoke-HolaCoordinator|Initialize-HolaCoordinatorRuntime|Restore-HolaCoordinatorHostCredential/);
});
