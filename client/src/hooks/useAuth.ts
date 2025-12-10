// Replit Auth Integration - useAuth hook
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { User } from "@shared/schema";
import { getQueryFn, apiRequest } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 30000, // Cache auth status for 30 seconds to prevent rapid re-fetching
  });
  
  // Sync timezone when user is authenticated
  // This runs once per page load to handle traveling users
  const timezoneSynced = useRef(false);
  
  useEffect(() => {
    if (user && !isLoading && !timezoneSynced.current) {
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Only sync if timezone differs from stored value
      if (browserTimezone && browserTimezone !== user.timezone) {
        timezoneSynced.current = true;
        apiRequest('PUT', '/api/user/timezone', { timezone: browserTimezone })
          .then(() => {
            console.log(`[Timezone] Synced: ${browserTimezone}`);
          })
          .catch((err: any) => {
            console.warn('[Timezone] Sync failed:', err.message);
          });
      } else {
        timezoneSynced.current = true;
      }
    }
  }, [user, isLoading]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
