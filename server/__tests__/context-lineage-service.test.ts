import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ContextLineageRecorder,
  type ContextLineageSink,
  type RecordedContextLineageEvent,
  type RecordedContextLineageLink,
} from "../services/context-lineage-service";

class RecordingSink implements ContextLineageSink {
  readonly events: RecordedContextLineageEvent[] = [];
  readonly links: RecordedContextLineageLink[] = [];
  failNextWrites = 0;

  async appendEvent(event: RecordedContextLineageEvent): Promise<void> {
    if (this.failNextWrites > 0) {
      this.failNextWrites -= 1;
      throw new Error("simulated ledger outage");
    }
    this.events.push(event);
  }

  async appendLink(link: RecordedContextLineageLink): Promise<void> {
    this.links.push(link);
  }
}

describe("ContextLineageRecorder", () => {
  it("allocates a stable trace, preserves raw payloads, and writes events in source order", async () => {
    const sink = new RecordingSink();
    const recorder = new ContextLineageRecorder(
      { sessionId: "session-a", conversationId: "conversation-a", userId: "user-a" },
      { sink, retryDelayMs: 1 },
    );
    const traceId = recorder.beginTrace();

    const source = recorder.recordEvent({
      traceId,
      studentTurnEpoch: 7,
      sourceRoute: "gemini-live",
      eventType: "student_turn_assembled",
      payloadText: "¿Recuerdas nuestro juego?",
    });
    const queued = recorder.recordEvent({
      traceId,
      studentTurnEpoch: 7,
      sourceRoute: "archive-guardian",
      eventType: "context_queued",
      deliveryStatus: "queued",
      payloadText: "Use the remembered counting game.",
    });
    recorder.recordLink({
      traceId,
      fromEventId: source.id,
      toEventId: queued.id,
      linkType: "derived_from",
    });

    await recorder.flushNow();

    assert.deepEqual(
      sink.events.map((event) => event.sequenceNumber),
      [1, 2],
    );
    assert.equal(sink.events[0].traceId, traceId);
    assert.equal(sink.events[0].studentTurnEpoch, 7);
    assert.equal(sink.events[0].payloadText, "¿Recuerdas nuestro juego?");
    assert.match(sink.events[0].payloadSha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(sink.links.length, 1);
    assert.equal(sink.links[0].fromEventId, source.id);
    assert.equal(sink.links[0].toEventId, queued.id);
    assert.equal(recorder.getHealth().state, "healthy");
    recorder.stop();
  });

  it("keeps a failed event at the head of the queue and exposes a degraded interval until retry succeeds", async () => {
    const sink = new RecordingSink();
    sink.failNextWrites = 1;
    const healthStates: string[] = [];
    const recorder = new ContextLineageRecorder(
      { sessionId: "session-b" },
      {
        sink,
        retryDelayMs: 1,
        onHealthChange: (health) => healthStates.push(health.state),
      },
    );

    const failedFirst = recorder.recordEvent({
      sourceRoute: "gemini-live",
      eventType: "tool_response_send_attempted",
      deliveryStatus: "attempted",
      payloadText: "exact response body",
    });
    recorder.recordEvent({
      sourceRoute: "gemini-live",
      eventType: "generation_completed",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const degraded = recorder.getHealth();
    assert.equal(degraded.state, "degraded");
    assert.equal(degraded.firstUnrecordedSequenceNumber, failedFirst.sequenceNumber);
    assert.equal(degraded.pendingWrites, 2);

    await new Promise((resolve) => setTimeout(resolve, 10));
    await recorder.flushNow();

    assert.deepEqual(
      sink.events.map((event) => event.sequenceNumber),
      [1, 2],
      "a later fact may not leapfrog the first unrecorded fact",
    );
    assert.equal(recorder.getHealth().state, "healthy");
    assert.ok(healthStates.includes("degraded"));
    recorder.stop();
  });

  it("does not turn an attempted Live send into an invented receipt", async () => {
    const sink = new RecordingSink();
    const recorder = new ContextLineageRecorder(
      { sessionId: "session-c" },
      { sink, retryDelayMs: 1 },
    );

    recorder.recordEvent({
      sourceRoute: "gemini-live",
      eventType: "client_content_send_attempted",
      deliveryChannel: "sendClientContent",
      deliveryStatus: "unknown",
      payloadText: "quiet context",
    });
    await recorder.flushNow();

    assert.equal(sink.events[0].deliveryStatus, "unknown");
    assert.equal(sink.events[0].eventType, "client_content_send_attempted");
    recorder.stop();
  });
});