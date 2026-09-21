import assert from "node:assert/strict";
import test from "node:test";
import { HolaHolaSharedSpecNotificationSink } from "./shared-spec-notifications";

const event = {
  idempotencyKey: "shared-spec:review_requested:review-1",
  kind: "review_requested" as const,
  initiatingActorId: "luca-replit",
  documentId: "document-1", revisionId: "revision-1", contentHash: "a".repeat(64),
  reviewId: "review-1", recipientActorId: "reviewer-1",
  summary: "Shared spec review requested: document-1/revision-1",
};

test("HolaHola notifications contain identity only and retain deterministic idempotency", async () => {
  const sent: any[] = [];
  const sink = new HolaHolaSharedSpecNotificationSink({ create: async input => { sent.push(input); return { deliveryState: "queued" }; } });
  assert.equal((await sink.deliver(event)).state, "delivered");
  assert.equal(sent[0].idempotencyKey, event.idempotencyKey);
  assert.equal(sent[0].initiatingActorId, "luca-replit");
  assert.equal(sent[0].createInboxDelivery, true);
  assert.deepEqual(sent[0].sourceReference, { type: "design_spec", provider: "shared-spec", identifier: "document-1/revision-1", digest: "a".repeat(64) });
  assert.doesNotMatch(JSON.stringify(sent[0]), /markdown|# /i);
});

test("failed delivery remains explicit so an idempotent lifecycle retry can enqueue again", async () => {
  const sink = new HolaHolaSharedSpecNotificationSink({ create: async () => ({ deliveryState: "failed" }) });
  const result = await sink.deliver(event);
  assert.deepEqual(result, { state: "failed", retryable: true, error: "Coordination inbox delivery failed" });
});

test("note_shared notifications use normal priority and the same identity-only contract", async () => {
  const sent: any[] = [];
  const sink = new HolaHolaSharedSpecNotificationSink({ create: async input => { sent.push(input); return { deliveryState: "queued" }; } });
  const noteEvent = {
    idempotencyKey: "shared-spec:note_shared:v1:revision-2:luca-replit",
    kind: "note_shared" as const,
    initiatingActorId: "luca-replit",
    documentId: "document-2", revisionId: "revision-2", contentHash: "b".repeat(64),
    recipientActorId: "luca-claude-code",
    summary: "Shared note created: notes/finding.md",
  };
  assert.equal((await sink.deliver(noteEvent)).state, "delivered");
  assert.equal(sent[0].priority, "normal");
  assert.deepEqual(sent[0].sourceReference, { type: "design_spec", provider: "shared-spec", identifier: "document-2/revision-2", digest: "b".repeat(64) });
});