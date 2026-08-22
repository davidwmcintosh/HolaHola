import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ContextLineageRecorder,
  getContextLineageAvailability,
  isFactualStreamProxyReference,
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
      deliveryStatus: "observed",
      payloadText: "quiet context",
    });
    await recorder.flushNow();

    assert.equal(sink.events[0].deliveryStatus, "attempted");
    assert.equal(sink.events[0].eventType, "client_content_send_attempted");
    recorder.stop();
  });

  it("keeps a factual stream proxy as provenance without upgrading a direct send to receipt", async () => {
    const sink = new RecordingSink();
    const recorder = new ContextLineageRecorder(
      { sessionId: "session-d" },
      { sink, retryDelayMs: 1 },
    );

    const traceId = recorder.beginTrace();
    const observedStreamEvent = recorder.recordEvent({
      traceId,
      sourceRoute: "gemini-live",
      eventType: "stream_event_observed",
      deliveryStatus: "observed",
      payloadJson: { sdkEvent: "client-content-stream" },
    });
    recorder.recordEvent({
      traceId,
      sourceRoute: "gemini-live",
      eventType: "tool_response_send_attempted",
      deliveryChannel: "sendToolResponse",
      deliveryStatus: "observed",
      payloadJson: { streamProxy: { eventId: observedStreamEvent.id } },
    });
    await recorder.flushNow();

    assert.equal(sink.events[1].deliveryStatus, "attempted");
    assert.equal(
      isFactualStreamProxyReference(
        sink.events[1],
        observedStreamEvent.id,
        sink.events[0],
      ),
      true,
    );
    recorder.stop();
  });

  it("does not treat an unlinked caller-supplied stream proxy label as a receipt", async () => {
    const sink = new RecordingSink();
    const recorder = new ContextLineageRecorder(
      { sessionId: "session-e" },
      { sink, retryDelayMs: 1 },
    );

    recorder.recordEvent({
      sourceRoute: "gemini-live",
      eventType: "client_content_send_attempted",
      deliveryChannel: "sendClientContent",
      deliveryStatus: "observed",
      payloadJson: { streamProxy: { eventId: "made-up-event-id", source: "not evidence" } },
    });
    await recorder.flushNow();

    assert.equal(sink.events[0].deliveryStatus, "attempted");
    recorder.stop();
  });

  it("separates disabled capture, pending evidence, and degraded persistence", () => {
    assert.equal(
      getContextLineageAvailability({
        captureEnabled: false,
        eventCount: 0,
        linkCount: 0,
      }).status,
      "capture_disabled",
    );
    assert.equal(
      getContextLineageAvailability({
        captureEnabled: true,
        eventCount: 0,
        linkCount: 0,
      }).status,
      "no_evidence_yet",
    );
    assert.equal(
      getContextLineageAvailability({
        captureEnabled: true,
        eventCount: 4,
        linkCount: 3,
        persistenceState: "degraded",
      }).status,
      "degraded_partial",
    );
  });

  it("requires a same-trace, earlier observed stream event before treating a proxy as factual", () => {
    const send = {
      id: "send",
      traceId: "trace-a",
      sequenceNumber: 8,
      eventType: "client_content_send_attempted",
      deliveryStatus: "unknown",
    };
    const validProxy = {
      id: "stream-1",
      traceId: "trace-a",
      sequenceNumber: 7,
      eventType: "stream_event_observed",
      deliveryStatus: "observed",
    };

    assert.equal(isFactualStreamProxyReference(send, validProxy.id, validProxy), true);
    assert.equal(
      isFactualStreamProxyReference(send, validProxy.id, { ...validProxy, sequenceNumber: 9 }),
      false,
      "a later stream event cannot explain an earlier send",
    );
    assert.equal(
      isFactualStreamProxyReference(send, validProxy.id, { ...validProxy, traceId: "trace-b" }),
      false,
      "a stream event from another trace cannot explain this send",
    );
  });

  it("retains an enabled Live grounding trace from factual callback through prepared context and direct dispatch", async () => {
    const sink = new RecordingSink();
    const recorder = new ContextLineageRecorder(
      { sessionId: "live-session-a", conversationId: "conversation-a" },
      { sink, retryDelayMs: 1 },
    );
    const traceId = recorder.beginTrace();
    const callback = recorder.recordEvent({
      traceId,
      studentTurnEpoch: 3,
      sourceRoute: "gemini-live-server",
      eventType: "stream_event_observed",
      payloadText: "¿Recuerdas nuestro juego?",
      payloadJson: { kind: "input_transcription" },
    });
    const input = recorder.recordEvent({
      traceId,
      studentTurnEpoch: 3,
      sourceRoute: "gemini-live",
      eventType: "student_turn_started",
      payloadText: "¿Recuerdas nuestro juego?",
    });
    const prepared = recorder.recordEvent({
      traceId,
      studentTurnEpoch: 3,
      sourceRoute: "archive-guardian",
      eventType: "context_prepared",
      deliveryStatus: "queued",
      payloadText: "The game was counting lanterns in the plaza.",
    });
    const send = recorder.recordEvent({
      traceId,
      studentTurnEpoch: 3,
      sourceRoute: "gemini-live",
      eventType: "tool_response_send_attempted",
      deliveryChannel: "sendToolResponse",
      deliveryStatus: "attempted",
      payloadText: "tool response with prepared context",
      payloadJson: { streamProxy: { eventId: callback.id } },
    });
    recorder.recordLink({
      traceId,
      fromEventId: callback.id,
      toEventId: input.id,
      linkType: "produced_response",
    });
    recorder.recordLink({
      traceId,
      fromEventId: input.id,
      toEventId: prepared.id,
      linkType: "caused_by",
    });
    recorder.recordLink({
      traceId,
      fromEventId: prepared.id,
      toEventId: send.id,
      linkType: "sent_with",
    });

    await recorder.flushNow();

    assert.equal(send.deliveryStatus, "attempted");
    assert.equal(sink.events.length, 4);
    assert.equal(sink.links.length, 3);
    assert.deepEqual(
      sink.links.map(link => link.linkType),
      ["produced_response", "caused_by", "sent_with"],
    );
    assert.equal(getContextLineageAvailability({
      captureEnabled: true,
      eventCount: sink.events.length,
      linkCount: sink.links.length,
      persistenceState: recorder.getHealth().state,
    }).status, "available");
    recorder.stop();
  });
});