import { Router, type Application, type Request, type Response } from "express";
import {
  SharedSpecCore,
  SharedSpecDomainError,
  type SharedSpecDocumentKind,
} from "../services/shared-spec-core";
import type { SharedSpecActorAuthenticator } from "../services/shared-spec-auth";
import type { SharedSpecPublicationService } from "../services/shared-spec-publication";
import { NoopSharedSpecNotificationSink, type SharedSpecNotification, type SharedSpecNotificationSink } from "../services/shared-spec-notifications";

export interface SharedSpecRouterDependencies {
  readonly core: SharedSpecCore;
  readonly authenticator: SharedSpecActorAuthenticator;
  readonly publications?: SharedSpecPublicationService;
  readonly notifications?: SharedSpecNotificationSink;
}

const idempotencyKey = (request: Request): string | undefined => {
  const value = request.header("idempotency-key") ?? request.body?.idempotencyKey;
  return typeof value === "string" ? value : undefined;
};
const actor = async (request: Request, response: Response, authenticator: SharedSpecActorAuthenticator) => {
  const value = await authenticator.authenticate(request);
  if (!value) response.status(401).json({ error: "Authentication required", code: "UNAUTHENTICATED" });
  return value;
};
const sendError = (response: Response, error: unknown) => {
  if (error instanceof SharedSpecDomainError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403
      : error.code === "CONFLICT" || error.code === "IDEMPOTENCY_MISMATCH" ? 409 : 400;
    response.status(status).json({ error: error.message, code: error.code, details: error.details });
    return;
  }
  response.status(500).json({ error: "Shared-spec operation failed", code: "INTERNAL" });
};

/** Creates, but does not mount, the generic shared-spec HTTP API. */
export function createSharedSpecRouter({ core, authenticator, publications, notifications = new NoopSharedSpecNotificationSink() }: SharedSpecRouterDependencies): Router {
  const router = Router();
  const deliver = async (event: SharedSpecNotification) => {
    const delivery = await notifications.deliver(event);
    if (delivery.state === "failed") throw new Error(`Shared-spec transition was stored but notification delivery failed: ${delivery.error}`);
  };
  router.get("/documents", async (request, response) => {
    try { if (!await actor(request, response, authenticator)) return; response.json(await core.listDocuments()); } catch (error) { sendError(response, error); }
  });
  router.post("/documents", async (request, response) => {
    try {
      const current = await actor(request, response, authenticator); if (!current) return;
      const created = await core.createDocument(current, {
        title: request.body?.title, summary: request.body?.summary, kind: request.body?.kind as SharedSpecDocumentKind,
        repository: request.body?.repository, gitPath: request.body?.gitPath, markdown: request.body?.markdown,
        idempotencyKey: idempotencyKey(request) ?? "",
      });
      response.status(201).json(created);
    } catch (error) { sendError(response, error); }
  });
  router.get("/documents/:documentId", async (request, response) => {
    try { if (!await actor(request, response, authenticator)) return; response.json(await core.showDocument(request.params.documentId)); } catch (error) { sendError(response, error); }
  });
  router.get("/documents/:documentId/revisions", async (request, response) => {
    try { if (!await actor(request, response, authenticator)) return; response.json(await core.listRevisions(request.params.documentId)); } catch (error) { sendError(response, error); }
  });
  router.get("/revisions/compare", async (request, response) => {
    try {
      if (!await actor(request, response, authenticator)) return;
      if (typeof request.query.left !== "string" || typeof request.query.right !== "string") throw new SharedSpecDomainError("VALIDATION", "left and right revision IDs are required");
      response.json(await core.compareRevisions(request.query.left, request.query.right));
    } catch (error) { sendError(response, error); }
  });
  router.get("/revisions/:revisionId", async (request, response) => {
    try { if (!await actor(request, response, authenticator)) return; response.json(await core.readRevision(request.params.revisionId)); } catch (error) { sendError(response, error); }
  });
  router.post("/documents/:documentId/revisions", async (request, response) => {
    try {
      const current = await actor(request, response, authenticator); if (!current) return;
      response.status(201).json(await core.appendRevision(current, {
        documentId: request.params.documentId, baseRevisionId: request.body?.baseRevisionId,
        markdown: request.body?.markdown, idempotencyKey: idempotencyKey(request) ?? "",
      }));
    } catch (error) { sendError(response, error); }
  });
  router.post("/documents/:documentId/ready", async (request, response) => {
    try {
      const current = await actor(request, response, authenticator); if (!current) return;
      const review = await core.markRevisionReady(current, {
        documentId: request.params.documentId, revisionId: request.body?.revisionId,
        requestedReviewerActorId: request.body?.requestedReviewerActorId, idempotencyKey: idempotencyKey(request) ?? "",
      });
      const { document, currentRevision } = await core.showDocument(review.documentId);
      if (review.requestedReviewerActorId) await deliver({
        idempotencyKey: `shared-spec:review_requested:v2:${review.id}:${current.actorId}`, kind: "review_requested",
        initiatingActorId: current.actorId,
        documentId: document.id, revisionId: currentRevision.id, contentHash: currentRevision.contentHash,
        reviewId: review.id, recipientActorId: review.requestedReviewerActorId,
        summary: `Shared spec review requested: ${document.id}/${currentRevision.id}`,
      });
      response.status(201).json(review);
    } catch (error) { sendError(response, error); }
  });
  router.post("/reviews/:reviewId/claim", async (request, response) => {
    try {
      const current = await actor(request, response, authenticator); if (!current) return;
      response.json(await core.claimReview(current, request.params.reviewId, idempotencyKey(request) ?? ""));
    } catch (error) { sendError(response, error); }
  });
  router.post("/reviews/:reviewId/assign", async (request, response) => {
    try {
      const current = await actor(request, response, authenticator); if (!current) return;
      response.json(await core.assignReview(current, request.params.reviewId, request.body?.reviewerActorId, idempotencyKey(request) ?? ""));
    } catch (error) { sendError(response, error); }
  });
  for (const decision of ["approve", "reject"] as const) router.post(`/reviews/:reviewId/${decision}`, async (request, response) => {
    try {
      const current = await actor(request, response, authenticator); if (!current) return;
      const input = { reviewId: request.params.reviewId, rationale: request.body?.rationale,
        evidenceReferences: request.body?.evidenceReferences, idempotencyKey: idempotencyKey(request) ?? "" };
      const review = await (decision === "approve" ? core.approveReview(current, input) : core.rejectReview(current, input));
      const revision = await core.readRevision(review.revisionId);
      await deliver({
        idempotencyKey: `shared-spec:review_decided:v2:${review.id}:${review.state}:${current.actorId}`, kind: "review_decided",
        initiatingActorId: current.actorId,
        documentId: review.documentId, revisionId: review.revisionId, contentHash: revision.contentHash,
        reviewId: review.id, recipientActorId: review.requestedByActorId,
        summary: `Shared spec review ${review.state}: ${review.documentId}/${review.revisionId}`,
      });
      response.json(review);
    } catch (error) { sendError(response, error); }
  });
  router.get("/documents/:documentId/export", async (request, response) => {
    try {
      if (!await actor(request, response, authenticator)) return;
      const exported = await core.exportApprovedBytes(request.params.documentId, typeof request.query.revisionId === "string" ? request.query.revisionId : undefined);
      response.json({ document: exported.document, revision: exported.revision, review: exported.review, markdown: exported.bytes.toString("utf8") });
    } catch (error) { sendError(response, error); }
  });
  router.get("/documents/:documentId/export/raw", async (request, response) => {
    try {
      if (!await actor(request, response, authenticator)) return;
      const exported = await core.exportApprovedBytes(request.params.documentId, typeof request.query.revisionId === "string" ? request.query.revisionId : undefined);
      response.type("text/markdown").send(exported.bytes);
    } catch (error) { sendError(response, error); }
  });
  router.post("/policies", async (request, response) => {
    try {
      const current = await actor(request, response, authenticator); if (!current) return;
      response.status(201).json(await core.setReviewerPolicy(current, {
        actorId: request.body?.actorId, capability: request.body?.capability, active: request.body?.active,
        documentKind: request.body?.documentKind, provenance: request.body?.provenance, idempotencyKey: idempotencyKey(request) ?? "",
      }));
    } catch (error) { sendError(response, error); }
  });
  router.get("/publications/:publicationId", async (request, response) => {
    try {
      const current = await actor(request, response, authenticator); if (!current) return;
      if (!publications) throw new SharedSpecDomainError("NOT_FOUND", "Publication operations are not configured");
      response.json(await publications.status(current, request.params.publicationId));
    } catch (error) { sendError(response, error); }
  });
  router.post("/publications", async (request, response) => {
    try {
      const current = await actor(request, response, authenticator); if (!current) return;
      if (!publications) throw new SharedSpecDomainError("NOT_FOUND", "Publication operations are not configured");
      response.status(201).json(await publications.request(current, {
        documentId: request.body?.documentId, revisionId: request.body?.revisionId,
        reviewId: request.body?.reviewId, idempotencyKey: idempotencyKey(request) ?? "",
      }));
    } catch (error) { sendError(response, error); }
  });
  for (const operation of ["publish", "reconcile"] as const) router.post(`/publications/:publicationId/${operation}`, async (request, response) => {
    try {
      const current = await actor(request, response, authenticator); if (!current) return;
      if (!publications) throw new SharedSpecDomainError("NOT_FOUND", "Publication operations are not configured");
      const publication = await publications[operation](current, request.params.publicationId);
      const kind = publication.state === "conflict" ? "publication_conflict"
        : publication.state === "merged" ? "publication_merged" : undefined;
      if (kind) await deliver({
        idempotencyKey: `shared-spec:${kind}:v2:${publication.id}:${publication.state}:${current.actorId}`, kind,
        initiatingActorId: current.actorId,
        documentId: publication.documentId, revisionId: publication.revisionId, contentHash: publication.contentHash,
        reviewId: publication.reviewId, publicationId: publication.id, pullRequestNumber: publication.pullRequestNumber,
        recipientActorId: publication.requestedByActorId,
        summary: `Shared spec publication ${publication.state}: ${publication.documentId}/${publication.revisionId}`,
      });
      response.json(publication);
    } catch (error) { sendError(response, error); }
  });
  return router;
}

/** Optional mounting helper; applications opt in by supplying dependencies. */
export function registerSharedSpecRoutes(
  app: Application,
  dependencies: SharedSpecRouterDependencies,
  prefix = "/api/shared-spec",
): void {
  app.use(prefix, createSharedSpecRouter(dependencies));
}