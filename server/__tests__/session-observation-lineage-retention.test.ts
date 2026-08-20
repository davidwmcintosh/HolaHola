import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getContextLineageObservationAvailability,
  getObservation,
  observeContextLineageEvent,
  observeContextLineageHealth,
  observeSessionEnd,
  observeSessionStart,
} from "../services/session-observation-store";

describe("session observation lineage retention", () => {
  it("keeps bounded partial lineage evidence visible when a session closes during a recorder outage", () => {
    const conversationId = `lineage-retention-${Date.now()}`;
    observeSessionStart({
      conversationId,
      userId: "lineage-test-user",
      language: "spanish",
      actflLevel: null,
    });
    observeContextLineageEvent(conversationId, {
      id: "event-1",
      traceId: "trace-1",
      sequenceNumber: 1,
      sourceRoute: "gemini-live",
      eventType: "student_turn_started",
      deliveryChannel: null,
      deliveryStatus: "observed",
      studentTurnEpoch: 1,
      payloadSha256: "hash",
      observedAt: new Date().toISOString(),
    });
    observeContextLineageHealth(conversationId, {
      state: "degraded",
      pendingWrites: 1,
      failedWrites: 1,
      firstUnrecordedSequenceNumber: 2,
      lastError: "simulated ledger outage",
    });

    observeSessionEnd(conversationId, { preserveDegradedLineage: true });

    const retained = getObservation(conversationId);
    assert.ok(retained, "the bounded diagnostic projection remains available");
    assert.equal(
      getContextLineageObservationAvailability(retained.contextLineage).status,
      "degraded_partial",
    );

    observeSessionEnd(conversationId);
    assert.equal(getObservation(conversationId), null, "healthy/session-final cleanup still deletes the projection");
  });
});