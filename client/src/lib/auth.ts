import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useUser() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  return {
    user: user || null,
    isLoading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isDeveloper: user?.role === 'developer' || user?.role === 'admin',
    isTeacher: user?.role === 'teacher' || user?.role === 'developer' || user?.role === 'admin',
  };
}
