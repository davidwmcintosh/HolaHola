import type { Request, Response, NextFunction } from "express";

/**
 * Returns true when the given User-Agent string looks like an infra health probe.
 *
 * This is the canonical probe-detection predicate.  The CI script
 * (server/scripts/test-health-check-probe-guard.ts) imports it directly so
 * any regression here immediately breaks CI.
 */
export function isHealthProbe(ua: string): boolean {
  return (
    ua === "" ||                             // no UA — most infra probers (Replit metasidecar)
    ua.startsWith("GoogleHC") ||             // Google Cloud Run health checker
    ua.startsWith("Go-http-client") ||       // raw Go net/http (Replit metasidecar)
    ua.toLowerCase().includes("health") ||   // generic health-checker UA
    ua.toLowerCase().includes("kube-probe")  // Kubernetes liveness probes
  );
}

/**
 * Express middleware: intercepts GET `/` requests that look like infra health
 * probes and returns 200 "OK" immediately — before any filesystem access, session
 * middleware, or route handlers run.
 *
 * Restricted to path `/` only because:
 *   - `/health` already has its own early handler in server/index.ts.
 *   - Broader interception would silently short-circuit authenticated GET API
 *     endpoints called from tools that omit a User-Agent header.
 */
export function healthProbeGuardMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.method !== "GET") return next();
  if (req.path !== "/") return next();
  const ua = (req.get("user-agent") || "").trim();
  if (isHealthProbe(ua)) {
    res.status(200).send("OK");
    return;
  }
  next();
}
