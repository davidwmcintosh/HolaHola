import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { hasAdminAccess, hasDeveloperAccess, hasTeacherAccess } from "@shared/permissions";

export function useUser() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  return {
    user: user || null,
    isLoading,
    error,
    isAuthenticated: !!user,
    isAdmin: hasAdminAccess(user?.role),
    isDeveloper: hasDeveloperAccess(user?.role),
    isTeacher: hasTeacherAccess(user?.role),
  };
}
