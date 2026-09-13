import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  createHostEnvelope,
  type HostEnvelope,
  type HostBinding,
} from "../services/coordination-host-protocol";
import {
  CoordinationHostFake,
} from "./coordination-host-fake";
import { applyCoordinationProviderFailure } from "../services/coordination-lifecycle-facade-service";
import {
  runCoordinationWindowsHost,
  type CoordinationWindowsExecutionJournal,
  type CoordinationWindowsLifecycleTransport,
} from "./coordination-windows-host";

const binding = (attemptId: string, operation = "execute"): HostBinding => ({
  policyVersionId: "policy-version",
  sessionId: "session",
  attemptId,
  enrolledHostId: "host",
  transportLeaseId: "lease",
  leaseEpoch: 1,
  holderInstanceId: "holder",
  operation,
  operationDigest: "a".repeat(64),
});

function claim(attemptId: string, operation = "execute") {
  return createHostEnvelope("operation_claim", { binding: binding(attemptId, operation) }, {
    requestId: `claim-${attemptId}`,
    correlationId: "session",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T00:30:00.000Z",
  });
}

function offer(attemptId: string, operation = "execute") {
  return Object.freeze({ offerId: `offer-${attemptId}`, attemptId, operation });
}

function transportFor(
  poll: CoordinationWindowsLifecycleTransport["poll"],
  result: CoordinationWindowsLifecycleTransport["result"],
): CoordinationWindowsLifecycleTransport {
  return {
    start: async () => ({ state: { lineage: "same" }, alreadyAcknowledged: true }),
    acquireLease: async ({ state }) => ({ state }),
    poll,
    claim: async ({ state, offer: offered }) => {
      if (!offered || typeof offered !== "object" || Array.isArray(offered)
        || typeof (offered as { attemptId?: unknown }).attemptId !== "string") {
        return { state };
      }
      const value = offered as { attemptId: string; operation?: string };
      return { state, claim: claim(value.attemptId, value.operation ?? "execute") };
    },
    result,
    cleanup: async () => ({ acknowledged: true }),
  };
}

const acceptedPreflight = async () => ({ accepted: true } as any);

function journal(): CoordinationWindowsExecutionJournal {
  const entries = new Map<string, HostEnvelope<"structured_result">>();
  const started = new Set<string>();
  return {
    begin: async (key) => {
      const completed = entries.get(key);
      if (completed) return { state: "completed", result: completed };
      if (started.has(key)) return { state: "started", fresh: false };
      started.add(key);
      return { state: "started", fresh: true };
    },
    complete: async (key, value) => { entries.set(key, value); },
  };
}

test("one fake-host command reaches verified completion and cleanup acknowledgement", async () => {
  let executed = 0;
  const host = new CoordinationHostFake({
    adapter: {
      execute: async () => {
        executed += 1;
        return { accepted: true };
      },
    },
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
  });
  const response = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host,
    preflight: acceptedPreflight,
    executionJournal: journal(),
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
    transport: transportFor(
      async ({ state }) => ({ state, action: "operation_available", offer: offer("attempt-1") }),
      async ({ state }) => ({ state, terminalState: "succeeded" }),
    ),
  });
  assert.deepEqual(response.status, { state: "succeeded", cleanupAcknowledged: true });
  assert.equal(response.exitCode, 0);
  assert.equal(executed, 1);
});

test("lost poll and result acknowledgements replay exact request keys without duplicate execution", async () => {
  let polls = 0;
  let results = 0;
  let executed = 0;
  const pollKeys: string[] = [];
  const resultKeys: string[] = [];
  const host = new CoordinationHostFake({
    adapter: { execute: async () => { executed += 1; return { ok: true }; } },
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
  });
  const lostClaim = claim("attempt-lost-ack");
  const response = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host,
    preflight: acceptedPreflight,
    executionJournal: journal(),
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
    transport: transportFor(
      async ({ state, requestKey }) => {
        pollKeys.push(requestKey);
        polls += 1;
        if (polls === 1) throw new Error("lost-poll-ack");
        return { state, action: "operation_available", offer: offer("attempt-lost-ack") };
      },
      async ({ state, requestKey }) => {
        resultKeys.push(requestKey);
        results += 1;
        if (results === 1) throw new Error("lost-result-ack");
        return { state, terminalState: "succeeded" };
      },
    ),
  });
  assert.equal(response.exitCode, 0);
  assert.equal(executed, 1);
  assert.deepEqual(pollKeys, ["poll:0", "poll:0"]);
  assert.deepEqual(resultKeys, [`result:${lostClaim.digest}`, `result:${lostClaim.digest}`]);
});

test("restart replays a durable journal result and executes the claim once", async () => {
  let executions = 0;
  let firstResultBytes: string | undefined;
  let secondResultBytes: string | undefined;
  const results = new Map<string, HostEnvelope<"structured_result">>();
  const executionJournal: CoordinationWindowsExecutionJournal = {
    begin: async (key) => {
      const value = results.get(key);
      if (value) return { state: "completed", result: value };
      if (firstResultBytes !== undefined) return { state: "started", fresh: false };
      return { state: "started", fresh: true };
    },
    complete: (key, value) => { results.set(key, value); },
  };
  const host = new CoordinationHostFake({
    adapter: { execute: async () => { executions += 1; return { once: true }; } },
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
  });
  const firstTransport = transportFor(
    async ({ state }) => ({ state, action: "operation_available", offer: offer("attempt-restart") }),
    async ({ state, result }) => {
      firstResultBytes = JSON.stringify(result);
      throw new Error("report-ack-uncertain");
    },
  );
  const first = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host, executionJournal, preflight: acceptedPreflight, maxPolls: 1,
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
    transport: { ...firstTransport, maxRetries: 2 },
  });
  assert.equal(first.status.state, "host_unavailable");

  const secondTransport = transportFor(
    async ({ state }) => ({ state, action: "operation_available", offer: offer("attempt-restart") }),
    async ({ state, result }) => {
      secondResultBytes = JSON.stringify(result);
      return { state, terminalState: "succeeded" };
    },
  );
  const second = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host, executionJournal, preflight: acceptedPreflight, now: () => Date.parse("2026-01-01T00:01:00.000Z"),
    transport: secondTransport,
  });
  assert.equal(second.exitCode, 0);
  assert.equal(executions, 1);
  assert.equal(secondResultBytes, firstResultBytes);
});

test("crash after execute before journal completion reconciles without duplicate execution", async () => {
  let executions = 0;
  let completionAttempts = 0;
  const started = new Set<string>();
  const completed = new Map<string, HostEnvelope<"structured_result">>();
  let reconciledResult: HostEnvelope<"structured_result"> | undefined;
  const executionJournal: CoordinationWindowsExecutionJournal = {
    begin: async (key) => {
      const result = completed.get(key);
      if (result) return { state: "completed", result };
      const fresh = !started.has(key);
      // Write-ahead journal semantics: the claim is marked started before
      // begin returns and before the host is allowed to execute.
      started.add(key);
      return { state: "started", fresh };
    },
    complete: async (key, value) => {
      completionAttempts += 1;
      started.add(key);
      if (completionAttempts === 1) throw new Error("crash-after-execute");
      completed.set(key, value);
    },
  };
  // The protocol constructor validates resultDigest, so build the
  // authoritative envelope from the canonical result digest.
  executionJournal.reconcile = async ({ claim: operationClaim }) => {
    const binding = (operationClaim.payload as { binding: HostBinding }).binding;
    const result = { authoritative: true };
    const { createHash } = await import("node:crypto");
    const { canonicalJson } = await import("../services/coordination-runtime");
    const resultDigest = createHash("sha256").update(canonicalJson(result), "utf8").digest("hex");
    reconciledResult = createHostEnvelope("structured_result", { binding, result, resultDigest }, {
      requestId: `${operationClaim.requestId}:result`,
      correlationId: operationClaim.correlationId,
      issuedAt: "2026-01-01T00:01:00.000Z",
      expiresAt: "2026-01-01T00:30:00.000Z",
    });
    return reconciledResult;
  };
  const host = new CoordinationHostFake({
    adapter: { execute: async () => { executions += 1; return { authoritative: true }; } },
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
  });
  const makeTransport = (): CoordinationWindowsLifecycleTransport => transportFor(
    async ({ state }) => ({ state, action: "operation_available", offer: offer("attempt-crash") }),
    async ({ state, result }) => {
      assert.ok(reconciledResult);
      assert.deepEqual(result, reconciledResult);
      return { state, terminalState: "succeeded" };
    },
  );
  const first = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host, executionJournal, preflight: acceptedPreflight,
    now: () => Date.parse("2026-01-01T00:01:00.000Z"), transport: makeTransport(),
  });
  assert.equal(first.status.state, "host_unavailable");
  const second = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host, executionJournal, preflight: acceptedPreflight,
    now: () => Date.parse("2026-01-01T00:01:00.000Z"), transport: makeTransport(),
  });
  assert.equal(second.exitCode, 0);
  assert.equal(executions, 1);
});

test("started journal without reconciliation fails closed and never executes again", async () => {
  let executions = 0;
  let first = true;
  const executionJournal: CoordinationWindowsExecutionJournal = {
    begin: async () => {
      if (first) {
        first = false;
        return { state: "started", fresh: true };
      }
      return { state: "started", fresh: false };
    },
    complete: async () => { throw new Error("crash-after-execute"); },
  };
  const host = new CoordinationHostFake({
    adapter: { execute: async () => { executions += 1; return { once: true }; } },
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
  });
  const makeTransport = (): CoordinationWindowsLifecycleTransport => transportFor(
    async ({ state }) => ({ state, action: "operation_available", offer: offer("attempt-no-reconcile") }),
    async ({ state }) => ({ state, terminalState: "succeeded" }),
  );
  await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host, executionJournal, preflight: acceptedPreflight,
    now: () => Date.parse("2026-01-01T00:01:00.000Z"), transport: makeTransport(),
  });
  const second = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host, executionJournal, preflight: acceptedPreflight,
    now: () => Date.parse("2026-01-01T00:01:00.000Z"), transport: makeTransport(),
  });
  assert.equal(second.status.state, "host_unavailable");
  assert.equal(executions, 1);
});

test("a locally manufactured poll envelope cannot execute without server claim fence", async () => {
  let executions = 0;
  const response = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host: { execute: async () => { executions += 1; return {}; } },
    preflight: acceptedPreflight,
    executionJournal: journal(),
    transport: {
      ...transportFor(
        async ({ state }) => ({ state, action: "operation_available", offer: claim("attempt-unfenced") }),
        async ({ state }) => ({ state, terminalState: "succeeded" }),
      ),
      claim: async ({ state }) => ({ state }),
    },
  });
  assert.equal(response.status.state, "host_unavailable");
  assert.equal(executions, 0);
});

test("restart resumes transport-owned generation and lease lineage", async () => {
  const states: unknown[] = [];
  const lineage = { generation: "generation-1", lease: "lease-lineage-1" };
  const transport: CoordinationWindowsLifecycleTransport = {
    start: async () => ({ state: lineage, alreadyAcknowledged: true }),
    acquireLease: async ({ state }) => { states.push(state); return { state }; },
    poll: async ({ state }) => ({ state, action: "renew" as const, terminalState: "succeeded" }),
    claim: async ({ state, offer }) => ({ state, claim: offer }),
    result: async ({ state }) => ({ state }),
    cleanup: async ({ state }) => { states.push(state); return { acknowledged: true }; },
  };
  await runCoordinationWindowsHost({ taskRef: "9001" }, { transport, preflight: acceptedPreflight, executionJournal: journal(), host: { execute: async () => ({}) } });
  await runCoordinationWindowsHost({ taskRef: "9001" }, { transport, preflight: acceptedPreflight, executionJournal: journal(), host: { execute: async () => ({}) } });
  assert.equal(states[0], lineage);
  assert.equal(states[1], lineage);
  assert.equal(states[2], lineage);
  assert.equal(states[3], lineage);
});

test("all non-success server terminal outcomes clean up without changing outcome", async () => {
  const terminalStates = ["failed", "exhausted", "expired", "revoked"] as const;
  for (const terminalState of terminalStates) {
    let cleanups = 0;
    let cleanupRequestKey = "";
    const base = transportFor(
      async ({ state }) => ({ state, action: "renew" as const }),
      async ({ state }) => ({ state }),
    );
    const response = await runCoordinationWindowsHost({ taskRef: "9001" }, {
      host: { execute: async () => ({}) },
      preflight: acceptedPreflight,
      executionJournal: journal(),
      transport: {
        ...base,
        start: async () => ({ state: { terminalState }, terminalState }),
        cleanup: async ({ requestKey }) => {
          cleanups += 1;
          cleanupRequestKey = requestKey;
          return { acknowledged: true };
        },
      },
    });
    assert.deepEqual(response.status, { state: terminalState, cleanupAcknowledged: true });
    assert.equal(response.exitCode, 1);
    assert.equal(cleanups, 1);
    assert.equal(cleanupRequestKey, "cleanup:acknowledge");
  }
});

test("non-success terminal outcome is preserved when cleanup is unacknowledged", async () => {
  let cleanups = 0;
  const base = transportFor(
    async ({ state }) => ({ state, action: "renew" as const }),
    async ({ state }) => ({ state }),
  );
  const response = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host: { execute: async () => ({}) },
    preflight: acceptedPreflight,
    executionJournal: journal(),
    transport: {
      ...base,
      start: async () => ({ state: {}, terminalState: "failed" }),
      cleanup: async () => {
        cleanups += 1;
        return { acknowledged: false };
      },
    },
  });
  assert.deepEqual(response.status, { state: "failed", cleanupAcknowledged: false });
  assert.equal(response.exitCode, 1);
  assert.equal(cleanups, 1);
});

test("poll exhaustion invokes cleanup and preserves exhausted outcome", async () => {
  let cleanups = 0;
  let polls = 0;
  const base = transportFor(
    async ({ state }) => {
      polls += 1;
      return { state, action: "renew" as const };
    },
    async ({ state }) => ({ state }),
  );
  const response = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host: { execute: async () => ({}) },
    preflight: acceptedPreflight,
    executionJournal: journal(),
    maxPolls: 2,
    transport: {
      ...base,
      renew: async ({ state }) => ({ state }),
      cleanup: async () => {
        cleanups += 1;
        return { acknowledged: true };
      },
    },
  });
  assert.deepEqual(response.status, { state: "exhausted", cleanupAcknowledged: true });
  assert.equal(response.exitCode, 1);
  assert.equal(polls, 2);
  assert.equal(cleanups, 1);
});

test("server-directed fresh attempt and fallback stay outside host policy logic", async () => {
  const operations: string[] = [];
  let pollCount = 0;
  const host = new CoordinationHostFake({
    adapter: {
      execute: async ({ operation }) => {
        operations.push(operation);
        return { ok: true };
      },
    },
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
  });
  const transport = transportFor(
    async ({ state }) => {
      pollCount += 1;
      return pollCount === 1
        ? { state, action: "operation_available", offer: offer("attempt-1", "provider-a") }
        : { state, action: "operation_available", offer: offer("attempt-2", "provider-b") };
    },
    async ({ state }) => pollCount === 2 ? { state, terminalState: "succeeded" } : { state },
  );
  const response = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host, preflight: acceptedPreflight, executionJournal: journal(), now: () => Date.parse("2026-01-01T00:01:00.000Z"), transport,
  });
  assert.equal(response.exitCode, 0);
  assert.deepEqual(operations, ["provider-a", "provider-b"]);
  assert.equal(JSON.stringify(response).includes("provider"), false);
});

test("transport result applies revised provider failure facade and follows server fallback claim", async () => {
  let pollCount = 0;
  let resultCount = 0;
  let fallbackProvider = "";
  const host = new CoordinationHostFake({
    adapter: {
      execute: async ({ operation }) => ({ operation }),
    },
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
  });
  const transport = transportFor(
    async ({ state }) => {
      pollCount += 1;
      return {
        state,
        action: "operation_available",
        offer: offer(pollCount === 1 ? "attempt-provider-a" : "attempt-provider-b",
          pollCount === 1 ? "provider-a" : "provider-b"),
      };
    },
    async ({ state }) => {
      resultCount += 1;
      if (resultCount === 1) {
        await applyCoordinationProviderFailure({
          failure: { kind: "malformed_response" },
          sessionId: "internal-session",
          attemptId: "internal-attempt",
          actorId: "internal-actor",
          requestKey: "internal-result-request",
        }, {
          resolveProviderFailureAuthority: async () => ({
            sessionId: "internal-session",
            attemptId: "internal-attempt",
            policy: {
              providerOrder: ["provider-a", "provider-b"],
              totalAttemptBudget: 3,
              fallbackEligibleFailureClasses: ["malformed_response"],
            },
            currentProvider: {
              provider: "provider-a", model: "model-a", adapterVersion: "1",
            },
            nextProvider: {
              provider: "provider-b", model: "model-b", adapterVersion: "1",
            },
          } as any),
          services: {
            transitionCoordinationAttempt: async () => undefined,
            createFreshAttempt: async (input: { provider?: string }) => {
              fallbackProvider = input.provider ?? "";
            },
          } as any,
        });
        return { state };
      }
      return { state, terminalState: "succeeded" };
    },
  );
  const response = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host,
    preflight: acceptedPreflight,
    executionJournal: journal(),
    now: () => Date.parse("2026-01-01T00:01:00.000Z"),
    transport,
  });
  assert.equal(response.exitCode, 0);
  assert.equal(fallbackProvider, "provider-b");
  assert.equal(pollCount, 2);
  assert.equal(resultCount, 2);
});

test("server policy violation terminates without fallback", async () => {
  let polled = 0;
  let executed = 0;
  let cleanups = 0;
  const response = await runCoordinationWindowsHost({ taskRef: "9001" }, {
    host: { execute: async () => { executed += 1; return {}; } },
    preflight: acceptedPreflight,
    executionJournal: journal(),
    transport: {
      ...transportFor(
       async ({ state }) => { polled += 1; return { state, action: "renew" as const, terminalState: "failed" }; },
      async ({ state }) => ({ state }),
      ),
      cleanup: async () => {
        cleanups += 1;
        return { acknowledged: true };
      },
    },
  });
  assert.equal(response.status.state, "failed");
  assert.equal(polled, 1);
  assert.equal(executed, 0);
  assert.equal(cleanups, 1);
});

test("PowerShell boundary has fixed paths, CurrentUser DPAPI, and no internal controls", () => {
  const source = readFileSync("scripts/hola-coordinator.ps1", "utf8");
  assert.match(source, /function Invoke-HolaCoordinator/);
  assert.match(source, /DataProtectionScope\]::CurrentUser/);
  assert.match(source, /ApprovedTsx\s*=\s*'[^']+node_modules\\tsx\\dist\\cli\.mjs'/);
  assert.match(source, /coordination-v2-cli\.ts/);
  assert.match(source, /\$arguments\s*=\s*@\(\$ApprovedTsx,\s*\$CoordinatorScript/);
  assert.doesNotMatch(source, /--import(?:\s|['"])/);
  assert.match(source, /& \$ApprovedNode @arguments 2>\$null/);
  assert.doesNotMatch(source, /return \$childExit/);
  assert.match(source, /\$global:LASTEXITCODE\s*=\s*\$childExit/);
  assert.match(source, /\[Environment\]::ExitCode\s*=\s*\$childExit/);
  assert.doesNotMatch(source, /\$Mode\b|\$Url\b|\$Provider\b|\$Credential\b/);
  assert.doesNotMatch(source, /Invoke-HolaCoordinator\s+-Mode/);
});