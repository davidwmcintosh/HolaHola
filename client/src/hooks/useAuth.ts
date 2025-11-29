// Replit Auth Integration - useAuth hook
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 30000, // Cache auth status for 30 seconds to prevent rapid re-fetching
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
