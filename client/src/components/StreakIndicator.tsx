import { Flame, Trophy, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStreak } from "@/hooks/use-streak";
import { Skeleton } from "@/components/ui/skeleton";

interface StreakIndicatorProps {
  compact?: boolean;
}

export function StreakIndicator({ compact = false }: StreakIndicatorProps) {
  const { currentStreak, longestStreak, totalPracticeDays, isLoading } = useStreak();

  if (isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2" data-testid="streak-compact">
        <Flame className={`h-5 w-5 ${currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
        <span className="font-semibold" data-testid="text-current-streak">
          {currentStreak}
        </span>
        <span className="text-sm text-muted-foreground">day streak</span>
      </div>
    );
  }

  return (
    <Card className="p-6" data-testid="card-streak-indicator">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Your Streak</h3>
            <p className="text-sm text-muted-foreground">
              {currentStreak > 0 
                ? `Keep it going! Practice every day to maintain your streak.`
                : "Start your streak by practicing today!"}
            </p>
          </div>
          <Flame className={`h-8 w-8 ${currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Current</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-current-streak-full">
              {currentStreak}
            </p>
            <p className="text-xs text-muted-foreground">days</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Longest</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-longest-streak">
              {longestStreak}
            </p>
            <p className="text-xs text-muted-foreground">days</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-practice-days">
              {totalPracticeDays}
            </p>
            <p className="text-xs text-muted-foreground">days</p>
          </div>
        </div>

        {currentStreak >= 7 && (
          <Badge variant="default" className="w-full justify-center" data-testid="badge-streak-milestone">
            🔥 {currentStreak} day streak! Amazing!
          </Badge>
        )}
        {currentStreak >= 3 && currentStreak < 7 && (
          <Badge variant="secondary" className="w-full justify-center" data-testid="badge-streak-progress">
            Great progress! Keep it up!
          </Badge>
        )}
      </div>
    </Card>
  );
}
