import { Card } from "@/components/ui/card";
import { BookOpen, Clock, Flame } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  testId: string;
}

function StatCard({ title, value, icon, testId }: StatCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-2">{title}</p>
          <p className="text-4xl font-bold" data-testid={testId}>{value}</p>
        </div>
        <div className="text-primary">{icon}</div>
      </div>
    </Card>
  );
}

export function StatsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard 
        title="Words Learned" 
        value={247} 
        icon={<BookOpen className="h-8 w-8" />}
        testId="stat-words-learned"
      />
      <StatCard 
        title="Practice Minutes" 
        value={1420} 
        icon={<Clock className="h-8 w-8" />}
        testId="stat-practice-minutes"
      />
      <StatCard 
        title="Day Streak" 
        value={12} 
        icon={<Flame className="h-8 w-8" />}
        testId="stat-day-streak"
      />
    </div>
  );
}
