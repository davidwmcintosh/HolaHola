import type { Application } from "express";
import { registerSharedSpecRoutes } from "../routes/shared-spec-routes";
import type { SharedSpecActorAuthenticator } from "./shared-spec-auth";
import { SharedSpecCore } from "./shared-spec-core";
import { PostgresSharedSpecRepository } from "./shared-spec-postgres-repository";
import { PostgresSharedSpecPublicationStore } from "./shared-spec-postgres-publication-store";
import { SharedSpecPublicationService, type SpecPublicationProvider } from "./shared-spec-publication";
import { NoopSharedSpecNotificationSink, type SharedSpecNotificationSink } from "./shared-spec-notifications";

/** Host-neutral composition root; callers own database, identity, and Git provider wiring. */
export function registerPostgresSharedSpecApi(input: {
  app: Application;
  db: any;
  authenticator: SharedSpecActorAuthenticator;
  publicationProvider: SpecPublicationProvider;
  prefix?: string;
  notifications?: SharedSpecNotificationSink;
}): { core: SharedSpecCore; publications: SharedSpecPublicationService } {
  const core = new SharedSpecCore(new PostgresSharedSpecRepository(input.db));
  const publications = new SharedSpecPublicationService(
    core,
    new PostgresSharedSpecPublicationStore(input.db),
    input.publicationProvider,
  );
  registerSharedSpecRoutes(input.app, { core, authenticator: input.authenticator, publications, notifications: input.notifications ?? new NoopSharedSpecNotificationSink() }, input.prefix);
  return { core, publications };
}