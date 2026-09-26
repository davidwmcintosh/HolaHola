import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createHostEnvelope,
  type HostBinding,
} from "../services/coordination-host-protocol";
import { canonicalJson } from "../services/coordination-runtime";
import { runCoordinationV2InteractiveCli } from "./coordination-v2-interactive-cli";
import type {
  CoordinationWindowsBoundState,
  CoordinationWindowsHostDependencies,
} from "./coordination-windows-host";

// Independently reproduces the module's own digest so this test does not
// simply assert the implementation against itself.
function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

const SECRET_SESSION_TOKEN = "SECRET-session-token-must-never-print";
const SECRET_CLEANUP_TOKEN = "SECRET-cleanup-token-must-never-print";

function binding(attemptId: string, operation = "execute"): HostBinding {
  return {
    policyVersionId: "policy-version", sessionId: "session-1", attemptId,
    enrolledHostId: "host-1", transportLeaseId: "lease-1", leaseEpoch: 1,
    holderInstanceId: "holder-1", operation, operationDigest: "a".repeat(64),
  };
}

function claimEnvelope(attemptId: string, operation = "execute") {
  return createHostEnvelope("operation_claim", { binding: binding(attemptId, operation) }, {
    requestId: `claim-${attemptId}`, correlationId: "session-1",
    issuedAt: "2026-01-01T00:00:00.000Z", expiresAt: "2026-01-01T00:30:00.000Z",
  });
}

function boundState(extra: Record<string, unknown> = {}): CoordinationWindowsBoundState {
  return {
    sessionId: "session-1", reservationId: "reservation-1", generationId: "generation-1",
    policyVersionId: "policy-version", attemptId: "attempt-0", enrolledHostId: "host-1",
    leaseId: "lease-1", leaseEpoch: 1, holderInstanceId: "holder-1",
    binding: { sessionId: "session-1" },
    sessionToken: SECRET_SESSION_TOKEN,
    cleanupSessionToken: SECRET_CLEANUP_TOKEN,
    cleanupCredentialId: "cleanup-credential-1",
    ...extra,
  } as CoordinationWindowsBoundState;
}

const acknowledgedState = {
  sessionId: "session-1", reservationId: "reservation-1", generationId: "generation-1",
  policyVersionId: "policy-version", attemptId: "attempt-0", enrolledHostId: "host-1",
};

/** preflight/executionJournal must never be touched by the interactive CLI — only the automated runCoordinationWindowsHost loop uses them. */
function neverCalled(label: string) {
  return async () => { throw new Error(`interactive CLI must never call ${label}`); };
}

async function withRoot(fn: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "coordination-v2-interactive-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("interactive lifecycle: start -> poll -> claim -> submit-result -> cleanup persists state and redacts secrets across separate invocations", async () => {
  await withRoot(async (root) => {
    const calls: string[] = [];
    let submittedResult: unknown;
    const factory = async () => async () => ({
      transport: {
        start: async () => {
          calls.push("start");
          return { alreadyAcknowledged: true, state: acknowledgedState };
        },
        acquireLease: async () => { calls.push("acquireLease"); return { state: boundState() }; },
        poll: async ({ state }: any) => {
          calls.push("poll");
          return { state, action: "operation_available", offer: { attemptId: "attempt-1", operation: "execute" } };
        },
        claim: async ({ state, offer }: any) => {
          calls.push("claim");
          return { state, claim: claimEnvelope(offer.attemptId, offer.operation) };
        },
        result: async ({ state, result }: any) => {
          calls.push("result");
          submittedResult = result;
          return { state, terminalState: "succeeded" };
        },
        cleanup: async () => { calls.push("cleanup"); return { acknowledged: true }; },
      },
      prepare: neverCalled("prepare (start already acknowledged)"),
      preflight: neverCalled("preflight"),
      executionJournal: { begin: neverCalled("executionJournal.begin"), complete: neverCalled("executionJournal.complete") },
    }) satisfies Promise<(input: any) => Promise<CoordinationWindowsHostDependencies>>;

    const startOut = await runCoordinationV2InteractiveCli(["start", "--task-ref", "9001"], factory, { root });
    assert.equal(startOut.ok, true);
    assert.equal(startOut.sessionId, "session-1");
    assert.doesNotMatch(JSON.stringify(startOut), /SECRET-/);

    const pollOut = await runCoordinationV2InteractiveCli(["poll", "--task-ref", "9001"], factory, { root });
    assert.equal(pollOut.ok, true);
    assert.equal(pollOut.action, "operation_available");
    assert.deepEqual(pollOut.offer, { attemptId: "attempt-1", operation: "execute" });
    assert.doesNotMatch(JSON.stringify(pollOut), /SECRET-/);

    const claimOut = await runCoordinationV2InteractiveCli(["claim", "--task-ref", "9001"], factory, { root });
    assert.equal(claimOut.ok, true);
    assert.doesNotMatch(JSON.stringify(claimOut), /SECRET-/);

    const rawResult = { changedFiles: ["a.ts"], testsPassed: true };
    const resultOut = await runCoordinationV2InteractiveCli(
      ["submit-result", "--task-ref", "9001"],
      factory,
      { root, readStdin: async () => JSON.stringify(rawResult) },
    );
    assert.equal(resultOut.ok, true);
    assert.equal(resultOut.terminalState, "succeeded");
    assert.doesNotMatch(JSON.stringify(resultOut), /SECRET-/);

    // The inner envelope handed to transport.result must match
    // CoordinationHostFake.execute()'s own construction exactly: claim's
    // binding, a resultDigest matching the server's own recompute, and a
    // requestId chained off the claim.
    const inner = submittedResult as any;
    assert.equal(inner.kind, "structured_result");
    assert.deepEqual(inner.payload.result, rawResult);
    assert.equal(inner.payload.resultDigest, digest(rawResult));
    assert.deepEqual(inner.payload.binding, binding("attempt-1", "execute"));
    assert.equal(inner.requestId, "claim-attempt-1:result");
    assert.equal(inner.correlationId, "session-1");

    const cleanupOut = await runCoordinationV2InteractiveCli(["cleanup", "--task-ref", "9001"], factory, { root });
    assert.equal(cleanupOut.ok, true);
    assert.equal(cleanupOut.cleanupAcknowledged, true);

    // status after full cleanup: the session file is gone, must fail cleanly.
    const statusOut = await runCoordinationV2InteractiveCli(["status", "--task-ref", "9001"], factory, { root });
    assert.equal(statusOut.ok, false);

    assert.deepEqual(calls, ["start", "acquireLease", "poll", "claim", "result", "cleanup"]);
  });
});

test("start bundles a required preparation step through dependencies.prepare before leasing", async () => {
  await withRoot(async (root) => {
    let startCalls = 0;
    let prepareCalls = 0;
    const factory = async () => async () => ({
      transport: {
        start: async () => {
          startCalls += 1;
          if (startCalls === 1) return { preparation: { fake: true } as any };
          return { alreadyAcknowledged: true, state: acknowledgedState };
        },
        acquireLease: async () => ({ state: boundState() }),
        poll: neverCalled("poll"), claim: neverCalled("claim"),
        result: neverCalled("result"), cleanup: neverCalled("cleanup"),
      },
      prepare: async () => { prepareCalls += 1; return { state: "acknowledged" } as any; },
      preflight: neverCalled("preflight"),
      executionJournal: { begin: neverCalled("executionJournal.begin"), complete: neverCalled("executionJournal.complete") },
    }) satisfies Promise<(input: any) => Promise<CoordinationWindowsHostDependencies>>;

    const startOut = await runCoordinationV2InteractiveCli(["start", "--task-ref", "9002"], factory, { root });
    assert.equal(startOut.ok, true);
    assert.equal(prepareCalls, 1);
    assert.equal(startCalls, 2);
  });
});

test("status never constructs the dependency factory and fails cleanly with no session", async () => {
  await withRoot(async (root) => {
    let factoryCalls = 0;
    const throwingFactory = async () => {
      factoryCalls += 1;
      throw new Error("status must never need live credentials");
    };

    const missing = await runCoordinationV2InteractiveCli(["status", "--task-ref", "9003"], throwingFactory, { root });
    assert.equal(missing.ok, false);
    assert.equal(factoryCalls, 0);

    const factory = async () => async () => ({
      transport: {
        start: async () => ({ alreadyAcknowledged: true, state: acknowledgedState }),
        acquireLease: async () => ({ state: boundState() }),
        poll: neverCalled("poll"), claim: neverCalled("claim"), result: neverCalled("result"), cleanup: neverCalled("cleanup"),
      },
      prepare: neverCalled("prepare"), preflight: neverCalled("preflight"),
      executionJournal: { begin: neverCalled("executionJournal.begin"), complete: neverCalled("executionJournal.complete") },
    }) satisfies Promise<(input: any) => Promise<CoordinationWindowsHostDependencies>>;
    await runCoordinationV2InteractiveCli(["start", "--task-ref", "9003"], factory, { root });

    const present = await runCoordinationV2InteractiveCli(["status", "--task-ref", "9003"], throwingFactory, { root });
    assert.equal(present.ok, true);
    assert.equal(present.sessionId, "session-1");
    assert.equal(factoryCalls, 0);
  });
});

test("resuming steps before start fails closed instead of crashing", async () => {
  await withRoot(async (root) => {
    const factory = async () => async () => ({
      transport: {
        start: neverCalled("start"), acquireLease: neverCalled("acquireLease"),
        poll: neverCalled("poll"), claim: neverCalled("claim"), result: neverCalled("result"), cleanup: neverCalled("cleanup"),
      },
      preflight: neverCalled("preflight"),
      executionJournal: { begin: neverCalled("executionJournal.begin"), complete: neverCalled("executionJournal.complete") },
    }) satisfies Promise<(input: any) => Promise<CoordinationWindowsHostDependencies>>;

    for (const subcommand of ["poll", "claim", "renew", "submit-result", "cleanup"]) {
      const out = await runCoordinationV2InteractiveCli([subcommand, "--task-ref", "9004"], factory, { root });
      assert.equal(out.ok, false, `${subcommand} must fail closed with no prior start`);
      assert.equal(out.error, "interactive_session_not_found");
    }
  });
});

test("an unsupported subcommand or invalid task-ref fails closed without touching the dependency factory", async () => {
  await withRoot(async (root) => {
    let factoryCalls = 0;
    const factory = async () => { factoryCalls += 1; throw new Error("must not be constructed"); };

    const badSubcommand = await runCoordinationV2InteractiveCli(["obliterate", "--task-ref", "9005"], factory, { root });
    assert.equal(badSubcommand.ok, false);
    assert.equal(badSubcommand.error, "unsupported_subcommand");

    const badTaskRef = await runCoordinationV2InteractiveCli(["start", "--task-ref", "not-a-number"], factory, { root });
    assert.equal(badTaskRef.ok, false);
    assert.equal(badTaskRef.error, "invalid_argument");

    assert.equal(factoryCalls, 0);
  });
});
