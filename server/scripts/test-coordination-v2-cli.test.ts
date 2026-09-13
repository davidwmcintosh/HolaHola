import assert from "node:assert/strict";
import test from "node:test";
import {
  createCoordinationV2CliUnclassifiedExit,
  isSafeCoordinationV2CliStatus,
  parseCoordinationV2CliArgs,
  runCoordinationV2Command,
  runCoordinationV2Cli,
  runCoordinationV2Entrypoint,
} from "./coordination-v2-cli";
import { createHostEnvelope } from "../services/coordination-host-protocol";
import { CoordinationHostFake } from "./coordination-host-fake";

test("CLI safe output is closed and child exits carry bounded provenance", () => {
  assert.equal(isSafeCoordinationV2CliStatus({
    state: "failed",
    cleanupAcknowledged: false,
  }), true);
  assert.equal(isSafeCoordinationV2CliStatus({
    state: "child_exit_1",
    cleanupAcknowledged: false,
  }), false);
  assert.equal(isSafeCoordinationV2CliStatus({
    state: "failed",
    cleanupAcknowledged: false,
    extra: "must not cross the boundary",
  }), false);
  assert.deepEqual(createCoordinationV2CliUnclassifiedExit(17), {
    state: "host_child_unclassified_exit",
    cleanupAcknowledged: false,
    executableRole: "coordinator_cli",
    exitStatus: 17,
  });
  assert.equal(createCoordinationV2CliUnclassifiedExit(-1073741510).exitStatus, -1073741510);
  assert.equal(createCoordinationV2CliUnclassifiedExit(0).exitStatus, 0);
  assert.throws(() => createCoordinationV2CliUnclassifiedExit(2_147_483_648));
});

function fakeClaim() {
  return createHostEnvelope("operation_claim", {
    binding: {
      policyVersionId: "policy",
      sessionId: "session-cli",
      attemptId: "attempt-cli",
      enrolledHostId: "host",
      transportLeaseId: "lease",
      leaseEpoch: 1,
      holderInstanceId: "holder",
      operation: "execute",
      operationDigest: "a".repeat(64),
    },
  }, {
    requestId: "claim-cli",
    correlationId: "session-cli",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T00:30:00.000Z",
  });
}

function fakeOffer() {
  return Object.freeze({ offerId: "opaque-offer-cli", nonce: "server-fence-required" });
}

test("CLI accepts only task reference, policy, and safe format", () => {
  assert.deepEqual(parseCoordinationV2CliArgs(["--task-ref", "9001"]), {
    taskRef: "9001", format: "text",
  });
  assert.deepEqual(parseCoordinationV2CliArgs(["9001", "--policy", "approved", "--format", "json"]), {
    taskRef: "9001", policySelector: "approved", format: "json",
  });
  for (const option of ["--id", "--digest", "--receipt", "--challenge", "--runtime",
    "--packet", "--window", "--claim", "--lease", "--path", "--command",
    "--provider", "--credential", "--unknown"]) {
    assert.throws(() => parseCoordinationV2CliArgs([option, "value"]));
  }
});

test("CLI has no input or output dependency on copied internal identifiers", async () => {
  const run = await runCoordinationV2Cli(["--task-ref", "9002", "--format", "json"], async (input) => {
    assert.deepEqual(input, { taskRef: "9002" });
    return { status: { state: "succeeded", cleanupAcknowledged: true }, exitCode: 0 };
  });
  assert.deepEqual(run.status, { state: "succeeded", cleanupAcknowledged: true });
  assert.equal(run.exitCode, 0);
});

test("exit status is closed and zero only after cleanup acknowledgement", async () => {
  const pending = await runCoordinationV2Cli(["--task-ref", "9001"], async () => ({
    state: "succeeded" as const, cleanupPending: true,
  }));
  assert.equal(pending.exitCode, 75);
  const failed = await runCoordinationV2Cli(["--task-ref", "9001"], async () => ({
    state: "failed" as const, cleanupPending: false,
  }));
  assert.equal(failed.exitCode, 1);
});

test("actual one-command composition runs fake host lifecycle through cleanup acknowledgement", async () => {
  let executions = 0;
  const results = new Map<string, any>();
  const started = new Set<string>();
  const host = new CoordinationHostFake({
    adapter: { execute: async () => { executions += 1; return { verified: true }; } },
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
  });
  const transport = {
    start: async () => ({ state: { opaque: "server-state" }, preparation: {} as any }),
    acquireLease: async ({ state }: { state: Record<string, unknown> }) => ({ state }),
    poll: async ({ state }: { state: Record<string, unknown> }) => ({
      state, action: "operation_available" as const, offer: fakeOffer(),
    }),
    claim: async ({ state, offer }: { state: Record<string, unknown>; offer: unknown }) => ({
      state, claim: offer === undefined ? undefined : fakeClaim(),
    }),
    result: async ({ state }: { state: Record<string, unknown> }) => ({ state, terminalState: "completed" }),
    cleanup: async () => ({ acknowledged: true }),
  };
  const run = await runCoordinationV2Command(["--task-ref", "9001", "--format", "json"], {
    transport,
    host,
    preflight: async () => ({ accepted: true } as any),
    prepare: async () => ({
      state: "acknowledged" as const,
      generationId: "generation",
      activeChanged: true,
      recoverable: false,
    }),
    executionJournal: {
      begin: async (key: string) => {
        if (results.has(key)) return { state: "completed" as const, result: results.get(key) };
        if (started.has(key)) return { state: "started" as const, fresh: false };
        started.add(key);
        return { state: "started" as const, fresh: true };
      },
      complete: async (key: string, value: unknown) => { results.set(key, value); },
    },
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
  });
  assert.deepEqual(run.status, { state: "succeeded", cleanupAcknowledged: true });
  assert.equal(run.exitCode, 0);
  assert.equal(executions, 1);
});

test("exported entrypoint composes injected lifecycle dependencies and defaults closed", async () => {
  const closed = await runCoordinationV2Entrypoint(["--task-ref", "9001", "--format", "json"]);
  assert.deepEqual(closed, {
    status: { state: "host_unavailable", cleanupAcknowledged: false },
    exitCode: 69,
    format: "json",
  });
  let called = false;
  const injected = await runCoordinationV2Entrypoint(
    ["--task-ref", "9001", "--format", "json"],
    async () => {
      called = true;
      const journal = new Map<string, any>();
      const started = new Set<string>();
      return {
        preflight: async () => ({ accepted: true } as any),
        transport: {
          start: async () => ({ state: {}, alreadyAcknowledged: true }),
          acquireLease: async ({ state }: any) => ({ state }),
          poll: async ({ state }: any) => ({ state, action: "operation_available" as const, offer: fakeOffer() }),
          claim: async ({ state, offer }: any) => ({ state, claim: offer === undefined ? undefined : fakeClaim() }),
          result: async ({ state }: any) => ({ state, terminalState: "succeeded" }),
          cleanup: async () => ({ acknowledged: true }),
        },
        host: new CoordinationHostFake({ adapter: { execute: async () => ({}) }, now: () => Date.parse("2026-01-01T00:01:00.000Z") }),
        executionJournal: {
          begin: async (key: string) => {
            if (journal.has(key)) return { state: "completed" as const, result: journal.get(key) };
            if (started.has(key)) return { state: "started" as const, fresh: false };
            started.add(key);
            return { state: "started" as const, fresh: true };
          },
          complete: async (key: string, value: any) => journal.set(key, value),
        },
        now: () => Date.parse("2026-01-01T00:01:00.000Z"),
      };
    },
  );
  assert.equal(called, true);
  assert.equal(injected.exitCode, 0);
});

test("ready is nonterminal and cannot exit zero", async () => {
  const run = await runCoordinationV2Cli(["--task-ref", "9002"], async () => ({
    state: "ready" as const,
    cleanupPending: false,
  }));
  assert.equal(run.exitCode, 1);
});