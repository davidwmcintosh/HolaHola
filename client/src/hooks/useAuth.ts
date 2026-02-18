// Replit Auth Integration - useAuth hook
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { User } from "@shared/schema";
import { getQueryFn, apiRequest } from "@/lib/queryClient";

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 30000,
  });
  
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    if (isLoading) return;
    
    if (!user && retryCountRef.current < 3) {
      const hasSessionEvidence = !!localStorage.getItem("userName");
      
      if (hasSessionEvidence) {
        const delay = retryCountRef.current === 0 ? 1000 : 2000;
        console.log(`[Auth] Got 401 but user session evidence exists — retrying in ${delay}ms (attempt ${retryCountRef.current + 1}/3)`);
        
        retryTimerRef.current = setTimeout(() => {
          retryCountRef.current++;
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        }, delay);
      }
    }
    
    if (user) {
      retryCountRef.current = 0;
    }
    
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [user, isLoading, queryClient]);
  
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
