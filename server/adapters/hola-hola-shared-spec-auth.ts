import type { Request } from "express";
import type { SharedSpecActorAuthenticator } from "../services/shared-spec-auth";

/**
 * Temporary HolaHola deployment adapter.  It is intentionally outside the
 * portable core and router: other hosts can supply any authenticator.
 *
 * Tokens use `actor:secret` so identity remains explicit and never depends on
 * Replit runtime headers or environment variables.
 */
export class HolaHolaCoordinationTokenAuthenticator implements SharedSpecActorAuthenticator {
  constructor(private readonly tokens: ReadonlyMap<string, { actorId: string; capabilities?: readonly ("reviewer" | "policy_admin")[] }>) {}

  async authenticate(request: Request) {
    const header = request.header("x-shared-spec-token");
    if (!header) return undefined;
    const match = this.tokens.get(header);
    return match ? { actorId: match.actorId, capabilities: match.capabilities } : undefined;
  }
}

/** Builds an adapter without coupling generic API code to process.env. */
export function holaHolaTokenBindings(token: string, actorId: string, policyAdmin = false) {
  if (!token || !actorId) throw new Error("Shared-spec token and actor ID are required");
  // Copy the externally supplied secret as a map key; comparison is performed
  // by the host adapter's bounded lookup and no framework identity is used.
  return new Map([[token, { actorId, capabilities: policyAdmin ? ["policy_admin"] as const : undefined }]]);
}