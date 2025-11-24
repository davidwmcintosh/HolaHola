import { useUser } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Array<'student' | 'teacher' | 'developer' | 'admin'>;
  redirectTo?: string;
}

export function RoleGuard({ children, allowedRoles, redirectTo = "/" }: RoleGuardProps) {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user && !allowedRoles.includes(user.role as any)) {
      setLocation(redirectTo);
    }
  }, [user, isLoading, allowedRoles, redirectTo, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user || !allowedRoles.includes(user.role as any)) {
    return null;
  }

  return <>{children}</>;
}
