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
import { isDevBypass } from "./middleware/rbac";
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

function googleCallbackURL(): string {
  // Fixed callback URL from APP_URL, deliberately not replitAuth.ts's
  // per-request ensureStrategy(req.hostname) pattern -- Google requires an
  // exact pre-registered redirect URI, not an arbitrary runtime hostname.
  const appUrl = process.env.APP_URL || "https://getholahola.com";
  return `${appUrl}/api/auth/google/callback`;
}

export async function setupGoogleAuth(app: Express, authLimiter?: any) {
  // Same startup-time skip as replitAuth.ts -- no OIDC discovery in local dev
  // bypass mode, consistent with the per-request auth bypass.
  if (isDevBypass()) {
    return;
  }

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

  const strategy = new Strategy(
    {
      name: "google",
      config,
      scope: "openid email profile",
      callbackURL: googleCallbackURL(),
    },
    verify,
  );
  passport.use(strategy);

  const loginHandlers = authLimiter ? [authLimiter] : [];
  loginHandlers.push(
    passport.authenticate("google", { scope: ["openid", "email", "profile"], session: false }),
  );
  app.get("/api/auth/google", ...loginHandlers);

  const callbackHandlers = authLimiter ? [authLimiter] : [];
  callbackHandlers.push(
    passport.authenticate("google", {
      session: false,
      failureRedirect: "/login?error=google_auth_failed",
    }),
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
