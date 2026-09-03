// Replit Auth Integration
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { linkOrCreateOAuthUser, type OAuthProfile } from "./services/oauth-account-linking";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.NEON_SHARED_DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',  // Only require HTTPS in production
      sameSite: 'lax',  // Required for OAuth callback to work
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

// Converts Replit's raw OIDC claims into the provider-agnostic profile shape
// server/services/oauth-account-linking.ts expects. The role/is_test_account
// extraction here is Replit-specific (its test-flow claims) -- Google/GitHub/
// Apple profiles won't carry these, so they're kept local to this adapter
// rather than in the shared helper.
function claimsToOAuthProfile(claims: any): OAuthProfile {
  type UserRole = 'admin' | 'developer' | 'teacher' | 'student';
  let roleToSet: UserRole | undefined;
  if (claims["roles"] && Array.isArray(claims["roles"])) {
    const claimedRoles = claims["roles"] as string[];
    // Priority order: admin > developer > teacher > student
    if (claimedRoles.includes('admin')) roleToSet = 'admin';
    else if (claimedRoles.includes('developer')) roleToSet = 'developer';
    else if (claimedRoles.includes('teacher')) roleToSet = 'teacher';
    else if (claimedRoles.includes('student')) roleToSet = 'student';
  }

  return {
    provider: 'replit',
    subjectId: claims["sub"],
    email: typeof claims["email"] === "string" ? claims["email"] : undefined,
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
    role: roleToSet,
    isTestAccount: claims["is_test_account"] === true,
  };
}

export async function setupAuth(app: Express, authLimiter?: any) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Same pattern as googleAuth.ts's missing-credentials guard: without a
  // REPL_ID, OIDC discovery throws and previously crashed the entire boot.
  // Skipping gracefully lets local dev run with the bypass off (needed to
  // exercise other providers' real OAuth flows) without a real Replit app.
  if (!process.env.REPL_ID) {
    console.warn("[ReplitAuth] REPL_ID not set -- Replit login routes disabled.");
    return;
  }

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    const claims = tokens.claims();
    const canonicalId = await linkOrCreateOAuthUser(claimsToOAuthProfile(claims));
    updateUserSession(user, tokens);
    // Every downstream consumer (getRequestUserId, /api/auth/user,
    // isAuthenticated, requireRole, ...) reads req.user.claims.sub as the
    // session identity. Overwriting it here, once, means the canonical-id
    // resolution above applies everywhere without touching those call sites.
    user.claims.sub = canonicalId;
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Apply rate limiter to login endpoint
  const loginHandlers = authLimiter ? [authLimiter] : [];
  loginHandlers.push((req: any, res: any, next: any) => {
    ensureStrategy(req.hostname);
    // No `prompt` override — this is inherited Replit scaffold boilerplate
    // that forced BOTH re-authentication and re-consent on every single
    // login, even for a user with an active Replit session who already
    // granted consent. Omitting it lets the OIDC provider's own default
    // apply: skip screens the user doesn't need to see again, still show
    // them when actually required (first-ever login, expired/revoked
    // session or consent). Only ~1 real user account currently depends on
    // this login path (founder's own), so verify by actually logging in
    // again rather than assuming this doesn't change refresh-token behavior.
    passport.authenticate(`replitauth:${req.hostname}`, {
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });
  app.get("/api/login", ...loginHandlers);

  // Apply rate limiter to callback endpoint
  const callbackHandlers = authLimiter ? [authLimiter] : [];
  callbackHandlers.push((req: any, res: any, next: any) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });
  app.get("/api/callback", ...callbackHandlers);

  // Apply rate limiter to logout endpoints
  const logoutHandler = authLimiter ? [authLimiter] : [];
  logoutHandler.push((req: any, res: any) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
  app.get("/api/logout", ...logoutHandler);

  const logoutPostHandler = authLimiter ? [authLimiter] : [];
  logoutPostHandler.push((req: any, res: any) => {
    req.logout((err: any) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.status(200).json({ success: true });
    });
  });
  app.post("/api/logout", ...logoutPostHandler);
}

export function getRequestUserId(req: any): string {
  // Password auth stores userId directly in session
  if (req.session?.userId) {
    return req.session.userId;
  }
  // Replit Auth / OIDC stores in passport.user.claims.sub
  if (req.user?.claims?.sub) {
    return req.user.claims.sub;
  }
  return '';
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Check for password auth first (userId stored directly in session)
  const sessionUserId = (req.session as any)?.userId;
  if (sessionUserId) {
    const dbUser = await storage.getUser(sessionUserId);
    if (dbUser) {
      (req as any).resolvedUserId = sessionUserId;
      return next();
    }
  }
  
  // Check for Replit Auth (claims.sub in user object)
  const user = req.user as any;
  const claimsSub = user?.claims?.sub;
  if (claimsSub) {
    const dbUser = await storage.getUser(claimsSub);
    if (dbUser) {
      (req as any).resolvedUserId = claimsSub;
      return next();
    }
  }

  // Neither auth method succeeded via fast paths — fall through to OIDC session check
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Stamp the OIDC user ID now so downstream handlers can rely on it
  const oidcUserId = user?.claims?.sub || user?.sub;
  if (oidcUserId) {
    (req as any).resolvedUserId = oidcUserId;
  }
  
  // If expires_at is not set (OIDC didn't provide exp claim), allow through
  if (!user.expires_at) {
    return next();
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    (req as any).resolvedUserId = (req.user as any)?.claims?.sub;
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
