import assert from "node:assert/strict";
import test from "node:test";
import {
  runCoordinationWindowsPreflight,
  type PreflightDependencies,
} from "./coordination-windows-preflight";

const options = {
  approvedInstallationPath: "C:/Hola/install",
  approvedWorktreePath: "C:/Hola/worktree",
  launcherPath: "C:/Hola/launcher",
  launcherDigest: "a".repeat(64),
  runtimePath: "C:/Hola/runtime",
  runtimeDigest: "b".repeat(64),
  repositoryIdentity: "hola/repository",
  branch: "main",
  startingCommit: "c".repeat(40),
};

function dependencies(overrides: Partial<PreflightDependencies> = {}): PreflightDependencies {
  return {
    fs: {
      inspect: () => ({ exists: true, isDirectory: true, reparseFree: true, aclSafe: true }),
      inventory: () => ({ active: "generation-1", staged: [] }),
      ...overrides.fs,
    },
    process: {
      powershellVersion: () => ({ major: 5, minor: 1 }),
      currentUserContext: () => ({ available: true }),
      dpapiCurrentUser: () => true,
      signedDigest: (path) => ({ digest: path.endsWith("launcher") ? options.launcherDigest : options.runtimeDigest, signatureValid: true }),
      ...overrides.process,
    },
    repository: overrides.repository ?? (() => ({ identity: options.repositoryIdentity, branch: options.branch, clean: true, startingCommit: options.startingCommit })),
    network: overrides.network ?? (() => true),
    server: { protocolVersion: () => 1, enrollmentCompatible: () => true, ...overrides.server },
  };
}

test("preflight is read-only and aggregates independent failures", async () => {
  const calls: string[] = [];
  const before = JSON.stringify(options);
  const report = await runCoordinationWindowsPreflight(options, dependencies({
    fs: {
      inspect: (path) => { calls.push(`inspect:${path}`); return { exists: false, reparseFree: false, aclSafe: false }; },
      inventory: () => { calls.push("inventory"); return { active: null, staged: [] }; },
    },
    process: {
      powershellVersion: () => { calls.push("powershell"); return { major: 5, minor: 0 }; },
      currentUserContext: () => ({ available: false }),
      dpapiCurrentUser: () => false,
      signedDigest: () => ({ digest: "0".repeat(64), signatureValid: false }),
    },
    repository: () => ({ identity: "other", branch: "drift", clean: false, startingCommit: "d".repeat(40) }),
    network: () => false,
    server: { protocolVersion: () => 2, enrollmentCompatible: () => false },
  }));
  assert.equal(report.accepted, false);
  assert.ok(report.failures.length >= 8);
  assert.ok(report.failures.some((failure) => failure.code === "powershell_version"));
  assert.ok(report.failures.some((failure) => failure.code === "network_unreachable"));
  assert.notEqual(calls.length, 0);
  assert.equal(JSON.stringify(options), before);
  assert.equal(JSON.stringify(report).includes("secret"), false);
});

test("successful preflight is protocol-one and contains no identity username", async () => {
  const report = await runCoordinationWindowsPreflight(options, dependencies());
  assert.equal(report.accepted, true);
  assert.equal(report.protocolVersion, 1);
  assert.deepEqual(report.checks.currentUser, { contextAvailable: true, context: "CurrentUser" });
  assert.equal(Object.prototype.hasOwnProperty.call(report.checks.currentUser, "username"), false);
});
