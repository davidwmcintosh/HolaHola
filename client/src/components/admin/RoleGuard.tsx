import { useUser } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useMemo } from "react";

const FOUNDER_USER_ID = '49847136';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Array<'student' | 'teacher' | 'developer' | 'admin' | 'founder'>;
  redirectTo?: string;
}

export function RoleGuard({ children, allowedRoles, redirectTo = "/" }: RoleGuardProps) {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  const hasAccess = useMemo(() => {
    if (!user) return false;
    
    if (allowedRoles.includes('founder')) {
      if (user.id === FOUNDER_USER_ID) return true;
    }
    
    return allowedRoles.includes(user.role as any);
  }, [user, allowedRoles]);

  useEffect(() => {
    if (!isLoading && user && !hasAccess) {
      setLocation(redirectTo);
    }
  }, [user, isLoading, hasAccess, redirectTo, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user || !hasAccess) {
    return null;
  }

  return <>{children}</>;
}
