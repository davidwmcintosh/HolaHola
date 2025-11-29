import { createContext, useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface UsageBalance {
  totalSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  remainingHours: number;
  percentUsed: number;
  percentRemaining: number;
  warningLevel: 'none' | 'low' | 'critical' | 'exhausted';
  canStartSession: boolean;
  classAllocationSeconds: number;
  purchasedSeconds: number;
  bonusSeconds: number;
}

interface VoiceSession {
  id: string;
  userId: string;
  conversationId: string | null;
  classId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  exchangeCount: number | null;
  status: string;
}

interface UsageStatus {
  balance: UsageBalance;
  activeSession: VoiceSession | null;
  recentSessions: VoiceSession[];
  classEnrollmentUsage: {
    classId: string;
    className: string;
    allocatedSeconds: number;
    usedSeconds: number;
    remainingSeconds: number;
  }[];
}

interface UsageContextType {
  balance: UsageBalance | null;
  status: UsageStatus | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  canStartSession: boolean;
  remainingHours: number;
  remainingMinutes: number;
  warningLevel: 'none' | 'low' | 'critical' | 'exhausted';
  formatRemainingTime: () => string;
}

const defaultBalance: UsageBalance = {
  totalSeconds: 0,
  usedSeconds: 0,
  remainingSeconds: 0,
  remainingHours: 0,
  percentUsed: 0,
  percentRemaining: 100,
  warningLevel: 'none',
  canStartSession: false,
  classAllocationSeconds: 0,
  purchasedSeconds: 0,
  bonusSeconds: 0,
};

const UsageContext = createContext<UsageContextType>({
  balance: null,
  status: null,
  isLoading: true,
  error: null,
  refetch: () => {},
  canStartSession: false,
  remainingHours: 0,
  remainingMinutes: 0,
  warningLevel: 'none',
  formatRemainingTime: () => '0h 0m',
});

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  
  const { data: status, isLoading, error, refetch } = useQuery<UsageStatus>({
    queryKey: ['/api/usage/status'],
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });
  
  const balance = status?.balance || null;
  const remainingSeconds = balance?.remainingSeconds || 0;
  const remainingHours = remainingSeconds / 3600;
  const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
  const canStartSession = balance?.canStartSession || false;
  const warningLevel = balance?.warningLevel || 'none';
  
  const formatRemainingTime = (): string => {
    if (remainingSeconds <= 0) return 'No time remaining';
    
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    
    if (hours >= 1) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes} minutes`;
    }
  };
  
  // Invalidate usage data when voice session ends
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refetch when user returns to tab
        refetch();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetch]);
  
  return (
    <UsageContext.Provider value={{
      balance,
      status: status || null,
      isLoading,
      error: error as Error | null,
      refetch,
      canStartSession,
      remainingHours,
      remainingMinutes,
      warningLevel,
      formatRemainingTime,
    }}>
      {children}
    </UsageContext.Provider>
  );
}

export function useUsage() {
  const context = useContext(UsageContext);
  if (!context) {
    throw new Error('useUsage must be used within a UsageProvider');
  }
  return context;
}

export function useCredits() {
  const { balance, canStartSession, remainingHours, remainingMinutes, warningLevel, formatRemainingTime, refetch } = useUsage();
  
  return {
    balance,
    canStartSession,
    remainingHours,
    remainingMinutes,
    warningLevel,
    formatRemainingTime,
    refetch,
    // Convenience methods
    hasCredits: canStartSession,
    isLow: warningLevel === 'low',
    isCritical: warningLevel === 'critical',
    isExhausted: warningLevel === 'exhausted',
  };
}
