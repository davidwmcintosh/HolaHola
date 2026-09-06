import type { Request } from "express";
import type { ActorContext } from "./shared-spec-core";

/** HTTP-independent authentication boundary for the shared-spec API. */
export interface SharedSpecActorAuthenticator {
  authenticate(request: Request): Promise<ActorContext | undefined>;
}