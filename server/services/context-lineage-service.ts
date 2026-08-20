import { createHash, randomUUID } from "node:crypto";

import {
  contextLineageEvents,
  contextLineageLinks,
  type InsertContextLineageEvent,
  type InsertContextLineageLink,
} from "@shared/schema";

/**
 * The ledger deliberately names facts rather than compliance judgments.
 * `receipt_unknown` is the correct result for a Gemini Live send when the SDK
 * exposes no per-message acknowledgement.
 */
export type ContextLineageDeliveryStatus =
  | "observed"
  | "attempted"
  | "queued"
  | "consumed"
  | "discarded"
  | "failed"
  | "unknown";

export type ContextLineageLinkType =
  | "caused_by"
  | "derived_from"
  | "queued_from"
  | "sent_with"
  | "consumed_by"
  | "superseded_by"
  | "produced_response";

export interface ContextLineageSession {
  sessionId: string;
  conversationId?: string | null;
  userId?: string | null;
}

export interface ContextLineageEventInput {
  traceId?: string;
  modelTurnId?: string | null;
  studentTurnEpoch?: number | null;
  sourceRoute: string;
  eventType: string;
  deliveryChannel?: string | null;
  deliveryStatus?: ContextLineageDeliveryStatus;
  payloadText?: string | null;
  payloadJson?: Record<string, unknown> | null;
  privacyClassification?: string;
  observedAt?: Date;
}

export interface ContextLineageLinkInput {
  traceId: string;
  fromEventId: string;
  toEventId: string;
  linkType: ContextLineageLinkType;
  metadata?: Record<string, unknown> | null;
  observedAt?: Date;
}

export type RecordedContextLineageEvent = InsertContextLineageEvent & {
  id: string;
};

export type RecordedContextLineageLink = InsertContextLineageLink & {
  id: string;
};

export interface ContextLineageSink {
  appendEvent(event: RecordedContextLineageEvent): Promise<void>;
  appendLink(link: RecordedContextLineageLink): Promise<void>;
}

export interface ContextLineageHealth {
  state: "healthy" | "degraded";
  pendingWrites: number;
  failedWrites: number;
  firstUnrecordedSequenceNumber: number | null;
  lastError: string | null;
}

type PendingWrite =
  | { kind: "event"; value: RecordedContextLineageEvent; attempts: number }
  | { kind: "link"; value: RecordedContextLineageLink; attempts: number };

export interface ContextLineageRecorderOptions {
  sink: ContextLineageSink;
  retryDelayMs?: number;
  onHealthChange?: (health: ContextLineageHealth) => void;
}

/**
 * Session-local shadow writer for the immutable context ledger.
 *
 * Calls allocate their event IDs and sequence numbers synchronously, then write
 * in source order on a background queue. Gemini Live call sites must never
 * await this recorder: an unavailable database becomes a visible diagnostic
 * gap, not audio latency or a swallowed fact.
 */
export class ContextLineageRecorder {
  private readonly sink: ContextLineageSink;
  private readonly retryDelayMs: number;
  private readonly onHealthChange?: (health: ContextLineageHealth) => void;
  private readonly session: ContextLineageSession;
  private nextSequenceNumber = 0;
  private readonly pending: PendingWrite[] = [];
  private flushing = false;
  private retryTimer: NodeJS.Timeout | null = null;
  private failedWrites = 0;
  private firstUnrecordedSequenceNumber: number | null = null;
  private lastError: string | null = null;
  private stopped = false;

  constructor(session: ContextLineageSession, options: ContextLineageRecorderOptions) {
    this.session = session;
    this.sink = options.sink;
    this.retryDelayMs = options.retryDelayMs ?? 1_000;
    this.onHealthChange = options.onHealthChange;
  }

  beginTrace(): string {
    return randomUUID();
  }

  recordEvent(input: ContextLineageEventInput): RecordedContextLineageEvent {
    const payloadText = input.payloadText ?? null;
    const payloadJson = input.payloadJson ?? null;
    const rawPayload = payloadText ?? (payloadJson ? JSON.stringify(payloadJson) : "");
    const event: RecordedContextLineageEvent = {
      id: randomUUID(),
      traceId: input.traceId ?? this.beginTrace(),
      sessionId: this.session.sessionId,
      conversationId: this.session.conversationId ?? null,
      userId: this.session.userId ?? null,
      modelTurnId: input.modelTurnId ?? null,
      studentTurnEpoch: input.studentTurnEpoch ?? null,
      sequenceNumber: ++this.nextSequenceNumber,
      sourceRoute: input.sourceRoute,
      eventType: input.eventType,
      deliveryChannel: input.deliveryChannel ?? null,
      deliveryStatus: input.deliveryStatus ?? "observed",
      payloadText,
      payloadJson,
      payloadSha256: rawPayload ? sha256(rawPayload) : null,
      privacyClassification: input.privacyClassification ?? "diagnostic",
      observedAt: input.observedAt ?? new Date(),
    };

    this.pending.push({ kind: "event", value: event, attempts: 0 });
    this.emitHealth();
    this.scheduleFlush();
    return event;
  }

  recordLink(input: ContextLineageLinkInput): RecordedContextLineageLink {
    const link: RecordedContextLineageLink = {
      id: randomUUID(),
      traceId: input.traceId,
      sessionId: this.session.sessionId,
      fromEventId: input.fromEventId,
      toEventId: input.toEventId,
      linkType: input.linkType,
      metadata: input.metadata ?? null,
      observedAt: input.observedAt ?? new Date(),
    };

    this.pending.push({ kind: "link", value: link, attempts: 0 });
    this.emitHealth();
    this.scheduleFlush();
    return link;
  }

  getHealth(): ContextLineageHealth {
    return {
      state: this.firstUnrecordedSequenceNumber === null ? "healthy" : "degraded",
      pendingWrites: this.pending.length,
      failedWrites: this.failedWrites,
      firstUnrecordedSequenceNumber: this.firstUnrecordedSequenceNumber,
      lastError: this.lastError,
    };
  }

  /**
   * Tests and orderly session shutdowns can await currently queued writes.
   * It does not discard an unrecorded fact when the sink remains unavailable.
   */
  async flushNow(): Promise<void> {
    await this.flush();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private scheduleFlush(): void {
    if (this.stopped || this.flushing || this.retryTimer) return;
    void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.stopped || this.flushing) return;
    this.flushing = true;

    try {
      while (!this.stopped && this.pending.length > 0) {
        const pending = this.pending[0];
        try {
          if (pending.kind === "event") {
            await this.sink.appendEvent(pending.value);
          } else {
            await this.sink.appendLink(pending.value);
          }
          this.pending.shift();
          if (this.pending.length === 0) {
            this.firstUnrecordedSequenceNumber = null;
            this.lastError = null;
          }
          this.emitHealth();
        } catch (error) {
          pending.attempts += 1;
          this.failedWrites += 1;
          this.firstUnrecordedSequenceNumber ??= pending.kind === "event"
            ? pending.value.sequenceNumber
            : this.firstUnrecordedSequenceNumber;
          this.lastError = error instanceof Error ? error.message : String(error);
          this.emitHealth();
          this.scheduleRetry();
          return;
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  private scheduleRetry(): void {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.flush();
    }, this.retryDelayMs);
  }

  private emitHealth(): void {
    this.onHealthChange?.(this.getHealth());
  }
}

/**
 * Production sink. Dynamic DB import keeps hermetic recorder tests independent
 * of database environment configuration.
 */
export function createDatabaseContextLineageSink(): ContextLineageSink {
  return {
    async appendEvent(event) {
      const { getMonitoringDb } = await import("../db");
      await getMonitoringDb().insert(contextLineageEvents).values(event);
    },
    async appendLink(link) {
      const { getMonitoringDb } = await import("../db");
      await getMonitoringDb().insert(contextLineageLinks).values(link);
    },
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}