import type { Application, Request } from "express";
import { getSharedDb } from "../db";
import {
  COORDINATION_ACTOR_IDS,
  type CoordinationActorId,
} from "@shared/schema";
import { resolveCoordinationActor } from "../middleware/coordination-auth";
import type { SharedSpecActorAuthenticator } from "../services/shared-spec-auth";
import { registerPostgresSharedSpecApi } from "../services/shared-spec-bootstrap";
import {
  GitHubSpecPublisher,
  type GitHubSpecPublisherConfig,
} from "../services/github-spec-publisher";
import type {
  SpecPublication,
  SpecPublicationProvider,
} from "../services/shared-spec-publication";
import { createCoordinationThread } from "../services/coordination-ledger-service";
import { HolaHolaSharedSpecNotificationSink } from "../services/shared-spec-notifications";

type HostEnvironment = Record<string, string | undefined>;

const actorIds = new Set<string>(COORDINATION_ACTOR_IDS);

function readHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
}

export class HolaHolaSharedSpecAuthenticator
  implements SharedSpecActorAuthenticator
{
  private readonly policyAdmins: ReadonlySet<string>;

  constructor(private readonly environment: HostEnvironment = process.env) {
    this.policyAdmins = new Set(
      (environment.SHARED_SPEC_POLICY_ADMIN_ACTORS ?? "david,luca-replit")
        .split(",")
        .map((actor) => actor.trim())
        .filter(Boolean),
    );
  }

  async authenticate(request: Request) {
    const credential =
      readHeader(request, "x-shared-spec-token") ??
      readHeader(request, "x-coordination-token");
    const resolution = resolveCoordinationActor(
      credential,
      undefined,
      this.environment,
    );
    if (!resolution.ok || !actorIds.has(resolution.actor)) return undefined;
    return {
      actorId: resolution.actor,
      capabilities: this.policyAdmins.has(resolution.actor)
        ? (["policy_admin"] as const)
        : undefined,
    };
  }
}

class UnavailablePublicationProvider implements SpecPublicationProvider {
  private unavailable(): never {
    throw new Error(
      "Shared-spec GitHub publication is not configured; drafting, review, approval, and export remain available",
    );
  }

  async prepare(): Promise<never> {
    return this.unavailable();
  }

  async publish(): Promise<never> {
    return this.unavailable();
  }

  async reconcile(
    _publication: SpecPublication,
  ): Promise<Pick<SpecPublication, "state" | "pullRequestNumber" | "pullRequestUrl">> {
    return this.unavailable();
  }
}

function publicationProvider(
  environment: HostEnvironment,
): SpecPublicationProvider {
  const repository = environment.SHARED_SPEC_GITHUB_REPOSITORY?.trim();
  const token = environment.SHARED_SPEC_GITHUB_TOKEN?.trim();
  if (!repository || !token) return new UnavailablePublicationProvider();

  const config: GitHubSpecPublisherConfig = {
    repository,
    token,
    baseRef: environment.SHARED_SPEC_GITHUB_BASE_REF?.trim() || "main",
    destinationPrefix: "docs/superpowers/specs/",
  };
  return new GitHubSpecPublisher(config);
}

function notificationSink(): HolaHolaSharedSpecNotificationSink {
  return new HolaHolaSharedSpecNotificationSink({
    create: ({ initiatingActorId, ...input }) => {
      if (!actorIds.has(initiatingActorId)) {
        throw new Error("Shared-spec notification initiating actor is invalid");
      }
      return createCoordinationThread({
        ...input,
        actor: initiatingActorId as CoordinationActorId,
        intendedRecipient: input.intendedRecipient as CoordinationActorId,
        createInboxDelivery: true,
      });
    },
  });
}

/**
 * HolaHola's host composition. The shared-spec core remains portable: this is
 * the only layer that knows the current app database and coordination auth.
 */
export function registerHolaHolaSharedSpecApi(
  app: Application,
  environment: HostEnvironment = process.env,
): void {
  registerPostgresSharedSpecApi({
    app,
    db: getSharedDb(),
    authenticator: new HolaHolaSharedSpecAuthenticator(environment),
    publicationProvider: publicationProvider(environment),
    notifications: notificationSink(),
  });
}
