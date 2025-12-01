// Replit Auth Integration
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

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
    conString: process.env.DATABASE_URL,
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

async function upsertUser(
  claims: any,
) {
  // Extract role from claims if present (for testing OIDC flow)
  // Only allow role upgrade (student -> teacher -> developer -> admin), never downgrade
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
  
  // Extract test account flag from claims (for developer testing)
  // Test accounts have their usage excluded from production analytics
  const isTestAccount = claims["is_test_account"] === true;
  
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
    role: roleToSet,
    isTestAccount: isTestAccount || undefined, // Only set if explicitly true
  });
}

export async function setupAuth(app: Express, authLimiter?: any) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
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
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
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

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
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
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
