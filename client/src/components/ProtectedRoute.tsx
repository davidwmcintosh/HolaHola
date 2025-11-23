import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: 'teacher' | 'admin' | 'student';
  fallbackPath?: string;
}

export function ProtectedRoute({ children, requireRole, fallbackPath = "/" }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user && requireRole) {
      const userRole = user.role;
      const hasAccess = requireRole === 'teacher' 
        ? (userRole === 'teacher' || userRole === 'admin')
        : userRole === requireRole;

      if (!hasAccess) {
        setLocation(fallbackPath);
      }
    }
  }, [user, isLoading, requireRole, fallbackPath, setLocation]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (requireRole && user) {
    const userRole = user.role;
    const hasAccess = requireRole === 'teacher' 
      ? (userRole === 'teacher' || userRole === 'admin')
      : userRole === requireRole;

    if (!hasAccess) {
      return null;
    }
  }

  return <>{children}</>;
}
