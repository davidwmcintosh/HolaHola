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

// Founder user ID for founder-only endpoints
const FOUNDER_USER_ID = '49847136';

/**
 * Check if user is the founder
 */
export function isFounder(user: User | undefined): boolean {
  return user?.id === FOUNDER_USER_ID;
}

/**
 * Middleware to require founder access only
 * Usage: app.get('/api/admin/voice-health', requireFounder, handler)
 */
export function requireFounder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.claims?.sub) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    if (!req.authenticatedUser) {
      return res.status(500).json({ error: "User data not loaded. Ensure loadAuthenticatedUser middleware runs first." });
    }
    
    if (req.authenticatedUser.id !== FOUNDER_USER_ID) {
      return res.status(403).json({ error: "Founder access required" });
    }
    
    next();
  } catch (error) {
    console.error("[RBAC] Error in requireFounder middleware:", error);
    return res.status(500).json({ error: "Authorization check failed" });
  }
}

// ===== REPLIT AGENT AUTHENTICATION =====
// Dedicated token for Replit Agent (builders) to access Hive/Wren services
// Separate from ARCHITECT_SECRET to allow granular permission control

const REPLIT_AGENT_TOKEN = process.env.REPLIT_AGENT_TOKEN;

// Audit log for agent actions (in-memory ring buffer, persists to hiveSnapshots)
interface AgentAuditEntry {
  timestamp: Date;
  action: string;
  endpoint: string;
  success: boolean;
  details?: string;
}
const agentAuditLog: AgentAuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 100;

/**
 * Log an agent action for audit trail
 */
export function logAgentAction(action: string, endpoint: string, success: boolean, details?: string) {
  const entry: AgentAuditEntry = {
    timestamp: new Date(),
    action,
    endpoint,
    success,
    details
  };
  
  agentAuditLog.push(entry);
  
  // Ring buffer - keep last N entries
  if (agentAuditLog.length > MAX_AUDIT_ENTRIES) {
    agentAuditLog.shift();
  }
  
  console.log(`[AGENT-AUDIT] ${success ? '✓' : '✗'} ${action} on ${endpoint}${details ? ` - ${details}` : ''}`);
}

/**
 * Get recent agent audit entries
 */
export function getAgentAuditLog(limit = 50): AgentAuditEntry[] {
  return agentAuditLog.slice(-limit);
}

/**
 * Extended request type for agent-authenticated requests
 */
export interface AgentAuthenticatedRequest extends Request {
  agentId?: string; // Identifier for the agent (for future multi-agent support)
}

/**
 * Check if Replit Agent token is properly configured
 */
export function isAgentTokenConfigured(): boolean {
  return !!(REPLIT_AGENT_TOKEN && REPLIT_AGENT_TOKEN.length >= 32);
}

/**
 * Middleware to require Replit Agent token authentication
 * Usage: app.get('/api/agent/sprints', requireAgentToken, handler)
 * 
 * Authenticates via x-agent-token header
 * Provides read-only access to Wren services
 */
export function requireAgentToken(req: AgentAuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // Check if token is configured
    if (!isAgentTokenConfigured()) {
      console.warn('[RBAC] REPLIT_AGENT_TOKEN not configured or too short (min 32 chars)');
      logAgentAction('auth_attempt', req.path, false, 'Token not configured');
      return res.status(503).json({ error: 'Agent authentication not configured' });
    }
    
    // Get token from header
    const providedToken = req.headers['x-agent-token'] as string;
    
    if (!providedToken) {
      logAgentAction('auth_attempt', req.path, false, 'No token provided');
      return res.status(401).json({ error: 'Agent token required (x-agent-token header)' });
    }
    
    // Timing-safe comparison to prevent timing attacks
    const crypto = require('crypto');
    const tokenBuffer = Buffer.from(providedToken);
    const expectedBuffer = Buffer.from(REPLIT_AGENT_TOKEN!);
    
    if (tokenBuffer.length !== expectedBuffer.length || 
        !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
      logAgentAction('auth_attempt', req.path, false, 'Invalid token');
      return res.status(401).json({ error: 'Invalid agent token' });
    }
    
    // Token valid - set agent ID for tracking
    req.agentId = 'replit-agent-primary'; // Can be extended for multi-agent support
    
    logAgentAction('auth_success', req.path, true);
    next();
  } catch (error) {
    console.error('[RBAC] Error in requireAgentToken middleware:', error);
    logAgentAction('auth_error', req.path, false, String(error));
    return res.status(500).json({ error: 'Agent authorization check failed' });
  }
}
