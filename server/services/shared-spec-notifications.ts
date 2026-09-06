/**
 * Optional, deliberately lossy notification boundary. The shared-spec core
 * never imports this module: delivery is an application concern, not a
 * prerequisite for a durable document transition.
 */
export type SharedSpecNotificationKind =
  | "review_requested"
  | "review_decided"
  | "publication_conflict"
  | "publication_merged";

export interface SharedSpecNotification {
  readonly idempotencyKey: string;
  readonly kind: SharedSpecNotificationKind;
  readonly initiatingActorId: string;
  readonly documentId: string;
  readonly revisionId: string;
  readonly contentHash: string;
  readonly reviewId?: string;
  readonly publicationId?: string;
  readonly pullRequestNumber?: number;
  readonly recipientActorId?: string;
  readonly summary: string;
}

export type SharedSpecNotificationDelivery =
  | { readonly state: "delivered"; readonly receipt?: string }
  | { readonly state: "failed"; readonly retryable: boolean; readonly error: string };

export interface SharedSpecNotificationSink {
  deliver(event: SharedSpecNotification): Promise<SharedSpecNotificationDelivery>;
}

/** Suitable for standalone installations and tests. It never implies receipt. */
export class NoopSharedSpecNotificationSink implements SharedSpecNotificationSink {
  async deliver(_event: SharedSpecNotification): Promise<SharedSpecNotificationDelivery> {
    return { state: "delivered", receipt: "notification-disabled" };
  }
}

export interface RecipientDeliveredCoordinationClient {
  create(input: {
    initiatingActorId: string;
    title: string;
    description: string;
    intendedRecipient: string;
    priority?: "low" | "normal" | "high" | "urgent";
    createInboxDelivery?: boolean;
    idempotencyKey: string;
    sourceReference?: { type: "design_spec"; provider: string; identifier: string; digest?: string };
  }): Promise<unknown>;
}

/**
 * HolaHola adapter boundary. `create` is a recipient-delivered coordination
 * operation; a comment is intentionally not accepted as evidence of receipt.
 * It serializes only lifecycle identity, never Markdown.
 */
export class HolaHolaSharedSpecNotificationSink implements SharedSpecNotificationSink {
  constructor(private readonly client: RecipientDeliveredCoordinationClient) {}

  async deliver(event: SharedSpecNotification): Promise<SharedSpecNotificationDelivery> {
    if (!event.recipientActorId) {
      return { state: "failed", retryable: false, error: "A recipient is required for coordination delivery" };
    }
    try {
      const result = await this.client.create({
        initiatingActorId: event.initiatingActorId,
        title: `Shared spec: ${event.kind}`,
        description: event.summary,
        intendedRecipient: event.recipientActorId,
        priority: event.kind === "review_requested" ? "high" : "normal",
        createInboxDelivery: true,
        idempotencyKey: event.idempotencyKey,
        sourceReference: {
          type: "design_spec", provider: "shared-spec",
          identifier: `${event.documentId}/${event.revisionId}`,
          digest: event.contentHash,
        },
      });
      if (result && typeof result === "object" && (result as { deliveryState?: unknown }).deliveryState === "failed") {
        return { state: "failed", retryable: true, error: "Coordination inbox delivery failed" };
      }
      return { state: "delivered" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { state: "failed", retryable: !/\b(400|401|403|404|validation|not allowed)\b/i.test(message), error: message };
    }
  }
}