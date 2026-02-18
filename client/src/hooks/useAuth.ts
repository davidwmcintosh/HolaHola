// Replit Auth Integration - useAuth hook
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { User } from "@shared/schema";
import { getQueryFn, apiRequest } from "@/lib/queryClient";

const MAX_RETRIES = 3;
const MAX_RETRY_WINDOW_MS = 8000;

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading: queryLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 30000,
  });
  
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryWindowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  
  useEffect(() => {
    if (queryLoading) return;
    
    if (!user && retryCountRef.current < MAX_RETRIES) {
      const hasSessionEvidence = !!localStorage.getItem("userName");
      
      if (hasSessionEvidence) {
        setIsRetrying(true);
        const delay = retryCountRef.current === 0 ? 1000 : 2000;
        console.log(`[Auth] No user but session evidence exists — retrying in ${delay}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`);
        
        if (retryCountRef.current === 0 && !retryWindowTimerRef.current) {
          retryWindowTimerRef.current = setTimeout(() => {
            console.log(`[Auth] Retry window expired (${MAX_RETRY_WINDOW_MS}ms) — giving up`);
            setIsRetrying(false);
            retryCountRef.current = MAX_RETRIES;
          }, MAX_RETRY_WINDOW_MS);
        }
        
        retryTimerRef.current = setTimeout(() => {
          retryCountRef.current++;
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        }, delay);
      } else {
        setIsRetrying(false);
      }
    }
    
    if (!user && retryCountRef.current >= MAX_RETRIES) {
      setIsRetrying(false);
    }
    
    if (user) {
      retryCountRef.current = 0;
      setIsRetrying(false);
      if (retryWindowTimerRef.current) {
        clearTimeout(retryWindowTimerRef.current);
        retryWindowTimerRef.current = null;
      }
    }
    
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      if (retryWindowTimerRef.current) {
        clearTimeout(retryWindowTimerRef.current);
        retryWindowTimerRef.current = null;
      }
    };
  }, [user, queryLoading, queryClient]);
  
  // Sync timezone when user is authenticated
  const timezoneSynced = useRef(false);
  
  useEffect(() => {
    if (user && !queryLoading && !timezoneSynced.current) {
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
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
  }, [user, queryLoading]);

  const isLoading = queryLoading || isRetrying;

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
