/**
 * LearningPaceCard - Dashboard summary of student's learning pace
 * 
 * Shows:
 * - Total lessons completed
 * - Total minutes learned
 * - Weekly activity sparkline
 * - Current streak
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Clock, 
  BookOpen, 
  Flame,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaceSummary {
  totalLessonsCompleted: number;
  totalMinutesLearned: number;
  averageMinutesPerLesson: number;
  weeklyMinutes: number[];
  streakDays: number;
}

interface LearningPaceCardProps {
  classId?: string;
  className?: string;
}

function MiniSparkline({ data, className }: { data: number[]; className?: string }) {
  if (!data || data.length === 0) {
    return (
      <div className={cn("h-8 flex items-end gap-0.5", className)}>
        {[...Array(8)].map((_, i) => (
          <div 
            key={i}
            className="flex-1 bg-muted rounded-sm"
            style={{ height: '20%' }}
          />
        ))}
      </div>
    );
  }

  const max = Math.max(...data, 1);
  const normalized = data.map(v => Math.max((v / max) * 100, 5)); // Min 5% height

  return (
    <div className={cn("h-8 flex items-end gap-0.5", className)}>
      {normalized.map((height, i) => (
        <div 
          key={i}
          className={cn(
            "flex-1 rounded-sm transition-all",
            i === normalized.length - 1 
              ? "bg-primary" 
              : "bg-primary/30"
          )}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

function StatBlock({ 
  icon: Icon, 
  label, 
  value, 
  subtext 
}: { 
  icon: typeof Clock;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {subtext && (
        <p className="text-xs text-muted-foreground">{subtext}</p>
      )}
    </div>
  );
}

export function LearningPaceCard({ classId, className }: LearningPaceCardProps) {
  const { data, isLoading, error } = useQuery<PaceSummary>({
    queryKey: ['/api/analytics/pace-summary', classId].filter(Boolean),
    queryFn: async () => {
      const url = classId 
        ? `/api/analytics/pace-summary?classId=${classId}`
        : '/api/analytics/pace-summary';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch pace summary');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Learning Pace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="h-12 bg-muted rounded" />
              <div className="h-12 bg-muted rounded" />
              <div className="h-12 bg-muted rounded" />
            </div>
            <div className="h-8 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Learning Pace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Start learning to see your pace stats
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  return (
    <Card className={className} data-testid="learning-pace-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Learning Pace
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <StatBlock
            icon={BookOpen}
            label="Lessons"
            value={data.totalLessonsCompleted}
            subtext="completed"
          />
          <StatBlock
            icon={Clock}
            label="Time"
            value={formatMinutes(data.totalMinutesLearned)}
            subtext="total"
          />
          <StatBlock
            icon={Flame}
            label="Streak"
            value={data.streakDays}
            subtext={data.streakDays === 1 ? "day" : "days"}
          />
        </div>

        {/* Weekly Activity */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Weekly Activity</p>
          <MiniSparkline data={data.weeklyMinutes} />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>8 weeks ago</span>
            <span>This week</span>
          </div>
        </div>

        {/* Average */}
        {data.averageMinutesPerLesson > 0 && (
          <p className="text-xs text-center text-muted-foreground pt-2 border-t">
            ~{data.averageMinutesPerLesson} min per lesson on average
          </p>
        )}
      </CardContent>
    </Card>
  );
}
