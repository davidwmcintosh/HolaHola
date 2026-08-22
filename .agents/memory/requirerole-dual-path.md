---
name: requireRole dual-path auth fix
description: requireRole middleware was OIDC-only, blocking all admin endpoints for agent/AI-browser sessions. Fix pattern.
---

# requireRole dual-path fix

**Problem:** `requireRole` checked only `req.user?.claims?.sub` (Replit OIDC format). Agent sessions, AI-browser sessions, and password login set `session.userId` directly, not `req.user.claims.sub`. They passed `isAuthenticated` but then hit a 401 at `requireRole`.

**Fix:** Add the session.userId path before the OIDC check — mirrors the existing `requireFounder` dual-path pattern (which had already been fixed):

```typescript
// Password auth / agent session path
const sessionUserId = (req.session as any)?.userId;
if (sessionUserId) {
  if (!req.authenticatedUser) return res.status(500)...;
  const userRole = req.authenticatedUser.role as UserRole;
  if (roleHierarchy[userRole] < roleHierarchy[minRole]) return res.status(403)...;
  return next();
}
// OIDC / Replit Auth path
if (!req.user?.claims?.sub) return res.status(401)...;
```

**Why:** `requireFounder` already had this fix; `requireRole` didn't. Any new admin endpoint that uses `requireRole` will work correctly for all auth methods after this fix.

**How to apply:** If an agent session hits 401 on any admin endpoint, check if the middleware chain includes `requireRole` or `requireFounder`. The fix pattern above is the correct one. `isAuthenticated` alone is not enough for admin routes.
