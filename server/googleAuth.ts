// Google OAuth Integration (Phase 5 of the Replit-auth replacement plan)
//
// Mirrors replitAuth.ts's openid-client + passport wiring, but deliberately
// does NOT reuse its session shape: authenticate() is called with
// { session: false } so passport only handles the OAuth handshake (redirect,
// token exchange, profile fetch) -- verify() resolves the canonical account
// via the shared oauth-account-linking helper (same identity-anchor logic
// proven for Replit), then the callback route sets req.session.userId /
// req.session.authProvider directly, exactly like password auth already
// does. Never call req.login() here -- that would re-introduce the
// req.user.claims session shape this migration is retiring.
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import type { Express } from "express";
import memoize from "memoizee";
import { linkOrCreateOAuthUser } from "./services/oauth-account-linking";

const getGoogleOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL("https://accounts.google.com"),
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!
    );
  },
  { maxAge: 3600 * 1000 }
);

export async function setupGoogleAuth(app: Express, authLimiter?: any) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn("[GoogleAuth] GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set -- Google login routes disabled.");
    return;
  }

  const config = await getGoogleOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = tokens.claims();
    if (!claims || typeof claims["sub"] !== "string") {
      return verified(new Error("Google did not return a subject claim"));
    }
    const canonicalId = await linkOrCreateOAuthUser({
      provider: "google",
      subjectId: claims["sub"],
      email: typeof claims["email"] === "string" ? claims["email"] : undefined,
      firstName: typeof claims["given_name"] === "string" ? claims["given_name"] : undefined,
      lastName: typeof claims["family_name"] === "string" ? claims["family_name"] : undefined,
      profileImageUrl: typeof claims["picture"] === "string" ? claims["picture"] : undefined,
    });
    // Passed through as req.user for the lifetime of this request only --
    // { session: false } below means passport never serializes this into the
    // session store. The callback route below reads it once to set
    // req.session.userId itself, matching the password-auth session shape.
    verified(null, { canonicalId });
  };

  // Google requires every redirect URI to be pre-registered in the Google
  // Cloud Console OAuth client -- it will reject anything not on that exact
  // allow-list, unlike replitAuth.ts's OIDC provider. That used to mean one
  // fixed callback URL (APP_URL / production), which broke Google sign-in
  // from any other real hostname this app is served on, e.g. the Replit dev
  // domain: the handshake ran on dev, but Google's callback always landed on
  // production, so dev never received a session and looked like a loop.
  //
  // Fix: register one strategy per hostname the request actually arrived on
  // (same per-domain-strategy shape as replitAuth.ts's ensureStrategy), so
  // each environment gets its own matching callback URL. This still requires
  // every real hostname -- production AND the current Replit dev domain --
  // to be added as an Authorized redirect URI in Google Cloud Console; that
  // registration is a manual step outside this codebase, and a future dev
  // domain change would need the same step repeated.
  const registeredStrategies = new Set<string>();
  const ensureStrategy = (domain: string) => {
    const strategyName = `google:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile",
          callbackURL: `https://${domain}/api/auth/google/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  const loginHandlers = authLimiter ? [authLimiter] : [];
  loginHandlers.push((req: any, res: any, next: any) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`google:${req.hostname}`, {
      scope: ["openid", "email", "profile"],
      session: false,
    })(req, res, next);
  });
  app.get("/api/auth/google", ...loginHandlers);

  const callbackHandlers = authLimiter ? [authLimiter] : [];
  callbackHandlers.push(
    (req: any, res: any, next: any) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`google:${req.hostname}`, {
        session: false,
        failureRedirect: "/login?error=google_auth_failed",
      })(req, res, next);
    },
    (req: any, res: any) => {
      const canonicalId = req.user?.canonicalId;
      if (!canonicalId) {
        return res.redirect("/login?error=google_auth_failed");
      }
      req.session.userId = canonicalId;
      req.session.authProvider = "google";
      res.redirect("/");
    },
  );
  app.get("/api/auth/google/callback", ...callbackHandlers);
}
