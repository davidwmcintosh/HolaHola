import type { Request, Response, NextFunction } from "express";
import type { User } from "../../shared/schema";

// Role hierarchy: admin > developer > teacher > student
const roleHierarchy = {
  student: 0,
  teacher: 1,
  developer: 2,
  admin: 3,
};

type UserRole = keyof typeof roleHierarchy;

// Extended Express Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: {
    claims: {
      sub: string; // User ID
      email?: string;
    };
  };
  authenticatedUser?: User; // Full user object with role
}

/**
 * Middleware to require a minimum role level
 * Usage: app.get('/api/admin/users', requireRole('admin'), handler)
 */
export function requireRole(minRole: UserRole) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // User must be authenticated
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get full user object with role
      if (!req.authenticatedUser) {
        return res.status(500).json({ error: "User data not loaded. Ensure loadAuthenticatedUser middleware runs first." });
      }

      const userRole = req.authenticatedUser.role as UserRole;

      // Check if user's role meets minimum requirement
      if (roleHierarchy[userRole] < roleHierarchy[minRole]) {
        return res.status(403).json({ 
          error: "Insufficient permissions",
          required: minRole,
          current: userRole
        });
      }

      next();
    } catch (error) {
      console.error("[RBAC] Error in requireRole middleware:", error);
      return res.status(500).json({ error: "Authorization check failed" });
    }
  };
}

/**
 * Middleware to allow specific roles (OR condition)
 * Usage: app.get('/api/content', allowRoles(['teacher', 'admin']), handler)
 */
export function allowRoles(allowedRoles: UserRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // User must be authenticated
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get full user object with role
      if (!req.authenticatedUser) {
        return res.status(500).json({ error: "User data not loaded" });
      }

      const userRole = req.authenticatedUser.role as UserRole;

      // Check if user's role is in allowed list
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          error: "Insufficient permissions",
          allowed: allowedRoles,
          current: userRole
        });
      }

      next();
    } catch (error) {
      console.error("[RBAC] Error in allowRoles middleware:", error);
      return res.status(500).json({ error: "Authorization check failed" });
    }
  };
}

/**
 * Middleware to load authenticated user data into request
 * Should run after isAuthenticated middleware
 * This populates req.authenticatedUser with full user object including role
 */
export function loadAuthenticatedUser(storage: any) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Skip if not authenticated
      if (!req.user?.claims?.sub) {
        return next();
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Attach full user object to request
      req.authenticatedUser = user;

      next();
    } catch (error) {
      console.error("[RBAC] Error loading authenticated user:", error);
      return res.status(500).json({ error: "Failed to load user data" });
    }
  };
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User | undefined): boolean {
  return user?.role === 'admin';
}

/**
 * Check if user is developer or above
 */
export function isDeveloperOrAbove(user: User | undefined): boolean {
  if (!user) return false;
  const userRole = user.role as UserRole;
  return roleHierarchy[userRole] >= roleHierarchy.developer;
}

/**
 * Check if user is teacher or above
 */
export function isTeacherOrAbove(user: User | undefined): boolean {
  if (!user) return false;
  const userRole = user.role as UserRole;
  return roleHierarchy[userRole] >= roleHierarchy.teacher;
}

/**
 * Check if user has permission to perform an action
 * Admins can do everything, developers can read everything but not mutate strategic configs
 */
export function hasPermission(user: User | undefined, action: 'read' | 'write' | 'delete', resourceType: string): boolean {
  if (!user) return false;
  
  const userRole = user.role as UserRole;
  
  // Admin can do everything
  if (userRole === 'admin') return true;
  
  // Developer can read everything
  if (userRole === 'developer' && action === 'read') return true;
  
  // Teachers can manage their own classes and assignments
  if (userRole === 'teacher') {
    if (resourceType === 'class' || resourceType === 'assignment') {
      return true; // Additional owner check required at route level
    }
  }
  
  return false;
}

/**
 * Check if impersonation is active for current request
 */
export function isImpersonating(user: User | undefined): boolean {
  if (!user) return false;
  return !!(user.impersonatedBy && user.impersonationExpiresAt && new Date(user.impersonationExpiresAt) > new Date());
}

/**
 * Get original admin ID if impersonating
 */
export function getOriginalAdminId(user: User | undefined): string | null {
  if (!user || !isImpersonating(user)) return null;
  return user.impersonatedBy || null;
}
