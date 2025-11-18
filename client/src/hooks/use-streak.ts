import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserProgress } from "@shared/schema";

interface StreakUpdateResult {
  practiced: boolean;
  streakIncreased: boolean;
  newStreak: number;
}

export function useStreak() {
  const { language } = useLanguage();

  // Fetch user progress for current language
  const { data: progress, isLoading } = useQuery<UserProgress>({
    queryKey: ["/api/progress", language],
    queryFn: async () => {
      const response = await fetch(`/api/progress/${language}`);
      if (!response.ok) throw new Error("Failed to fetch progress");
      return response.json();
    },
    enabled: !!language,
  });

  // Update streak mutation
  const updateStreakMutation = useMutation({
    mutationFn: async () => {
      // Get progress data (either from query or fetch if needed)
      let currentProgress: UserProgress;
      if (progress) {
        currentProgress = progress;
      } else {
        const response = await fetch(`/api/progress/${language}`);
        if (!response.ok) throw new Error("Failed to fetch progress");
        currentProgress = await response.json();
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      let lastPractice: Date | null = null;
      if (currentProgress.lastPracticeDate) {
        lastPractice = new Date(currentProgress.lastPracticeDate);
        lastPractice = new Date(lastPractice.getFullYear(), lastPractice.getMonth(), lastPractice.getDate());
      }

      // Check if already practiced today
      if (lastPractice && lastPractice.getTime() === today.getTime()) {
        return {
          practiced: false,
          streakIncreased: false,
          newStreak: currentProgress.currentStreak,
        };
      }

      // Calculate new streak
      let newStreak = currentProgress.currentStreak;
      let newLongestStreak = currentProgress.longestStreak;
      let newTotalPracticeDays = currentProgress.totalPracticeDays + 1;

      if (!lastPractice) {
        // First time practicing
        newStreak = 1;
      } else {
        const daysDiff = Math.floor((today.getTime() - lastPractice.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          // Consecutive day - increase streak
          newStreak += 1;
        } else if (daysDiff > 1) {
          // Missed days - reset streak
          newStreak = 1;
        }
      }

      // Update longest streak if needed
      if (newStreak > newLongestStreak) {
        newLongestStreak = newStreak;
      }

      // Update progress
      const updated = await apiRequest("PATCH", `/api/progress/${currentProgress.id}`, {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        totalPracticeDays: newTotalPracticeDays,
        lastPracticeDate: now.toISOString(),
      });

      // Record progress history snapshot for charts
      // Fetch all conversations to get cumulative count
      const conversationsResponse = await fetch(`/api/conversations`);
      const allConversations = conversationsResponse.ok ? await conversationsResponse.json() : [];
      const cumulativeConversations = allConversations.filter((c: any) => c.language === currentProgress.language).length;
      
      // Store cumulative totals as of today (charts will calculate deltas for visualization)
      await apiRequest("POST", "/api/progress-history", {
        language: currentProgress.language,
        date: now.toISOString(),
        wordsLearned: currentProgress.wordsLearned, // Cumulative total as of today
        practiceMinutes: currentProgress.practiceMinutes, // Cumulative total as of today
        conversationsCount: cumulativeConversations, // Cumulative conversations in this language
      });

      return {
        practiced: true,
        streakIncreased: newStreak > currentProgress.currentStreak,
        newStreak,
      };
    },
    onSuccess: () => {
      // Invalidate progress and history queries to refetch
      queryClient.invalidateQueries({ queryKey: ["/api/progress", language] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress-history", language] });
    },
  });

  const recordPractice = async (): Promise<StreakUpdateResult> => {
    const result = await updateStreakMutation.mutateAsync();
    return result;
  };

  return {
    progress,
    isLoading,
    recordPractice,
    currentStreak: progress?.currentStreak ?? 0,
    longestStreak: progress?.longestStreak ?? 0,
    totalPracticeDays: progress?.totalPracticeDays ?? 0,
    lastPracticeDate: progress?.lastPracticeDate ? new Date(progress.lastPracticeDate) : null,
  };
}
