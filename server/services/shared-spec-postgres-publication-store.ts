import { and, desc, eq, sql } from "drizzle-orm";
import { sharedSpecPublicationAttempts, sharedSpecPublications } from "@shared/schema";
import type { SpecPublication, SpecPublicationStore } from "./shared-spec-publication";

type DrizzleDatabase = any;

const fromRow = (row: any): SpecPublication => ({
  id: row.id, documentId: row.documentId, revisionId: row.revisionId, reviewId: row.reviewId,
  contentHash: row.contentHash, repository: row.repository, baseRef: row.baseRef,
  expectedBaseCommit: row.expectedBaseCommit, destinationPath: row.destinationPath,
  expectedDestinationBlobHash: row.expectedDestinationBlobHash ?? undefined,
  expectedDestinationAbsent: row.expectedDestinationAbsent, state: row.state,
  requestedByActorId: row.requestedByActor, idempotencyKey: row.idempotencyKey, requestDigest: row.requestDigest,
  branchName: row.branchName ?? undefined, pullRequestNumber: row.pullRequestNumber ?? undefined,
  pullRequestUrl: row.pullRequestUrl ?? undefined, lastError: row.lastError ?? undefined,
});

/** Drizzle/PostgreSQL store for publication state and append-only audit attempts. */
export class PostgresSharedSpecPublicationStore implements SpecPublicationStore {
  constructor(private readonly db: DrizzleDatabase) {}

  async get(id: string): Promise<SpecPublication | undefined> {
    const [row] = await this.db.select().from(sharedSpecPublications).where(eq(sharedSpecPublications.id, id));
    return row ? fromRow(row) : undefined;
  }

  async getByRequest(requestedByActorId: string, idempotencyKey: string): Promise<(SpecPublication & {
    requestedByActorId: string; idempotencyKey: string; requestDigest: string;
  }) | undefined> {
    const [row] = await this.db.select().from(sharedSpecPublications).where(and(
      eq(sharedSpecPublications.requestedByActor, requestedByActorId),
      eq(sharedSpecPublications.idempotencyKey, idempotencyKey),
    ));
    return row ? fromRow(row) as SpecPublication & {
      requestedByActorId: string; idempotencyKey: string; requestDigest: string;
    } : undefined;
  }

  async create(input: SpecPublication): Promise<void> {
    await this.db.insert(sharedSpecPublications).values({
      id: input.id, documentId: input.documentId, revisionId: input.revisionId, reviewId: input.reviewId,
      contentHash: input.contentHash, repository: input.repository, baseRef: input.baseRef,
      expectedBaseCommit: input.expectedBaseCommit, destinationPath: input.destinationPath,
      expectedDestinationBlobHash: input.expectedDestinationBlobHash,
      expectedDestinationAbsent: input.expectedDestinationAbsent, requestedByActor: input.requestedByActorId,
      idempotencyKey: input.idempotencyKey, requestDigest: input.requestDigest, state: input.state,
    });
  }

  async update(publication: SpecPublication): Promise<void> {
    await this.db.update(sharedSpecPublications).set({
      state: publication.state, branchName: publication.branchName,
      pullRequestNumber: publication.pullRequestNumber, pullRequestUrl: publication.pullRequestUrl,
      lastError: publication.lastError, updatedAt: new Date(),
      openedAt: publication.state === "open" ? new Date() : undefined,
      mergedAt: publication.state === "merged" ? new Date() : undefined,
      closedAt: publication.state === "closed" ? new Date() : undefined,
    }).where(eq(sharedSpecPublications.id, publication.id));
  }

  async appendAttempt(input: {
    publicationId: string; operation: string; outcome: "started" | "succeeded" | "failed" | "conflict";
    errorDetail?: string; responseMetadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.transaction(async (tx: any) => {
      // Serializes per-publication attempt numbering without relying on a
      // process-local counter. The FK parent row remains locked until commit.
      await tx.execute(sql`select id from shared_spec_publications where id = ${input.publicationId} for update`);
      const rows = await tx.select({ attemptNumber: sharedSpecPublicationAttempts.attemptNumber })
        .from(sharedSpecPublicationAttempts).where(eq(sharedSpecPublicationAttempts.publicationId, input.publicationId))
        .orderBy(desc(sharedSpecPublicationAttempts.attemptNumber)).limit(1);
      await tx.insert(sharedSpecPublicationAttempts).values({
        publicationId: input.publicationId, attemptNumber: (rows[0]?.attemptNumber ?? 0) + 1,
        operation: input.operation, outcome: input.outcome, errorDetail: input.errorDetail,
        responseMetadata: input.responseMetadata,
      });
    });
  }
}