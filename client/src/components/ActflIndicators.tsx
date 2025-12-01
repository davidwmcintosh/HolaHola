import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Target, 
  BarChart3, 
  CheckCircle2, 
  BookOpen,
  Layers 
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from "recharts";

interface ActflAnalysis {
  levelRange: {
    start: string;
    end: string;
  };
  lessonsByLevel: Record<string, number>;
  totalLessons: number;
  totalUnits: number;
  canDoCategories: {
    interpersonal: number;
    interpretive: number;
    presentational: number;
  };
  estimatedStatementsCovered: number;
}

interface ActflIndicatorsProps {
  curriculumPathId: string;
  language: string;
  compact?: boolean;
}

const ACTFL_COLORS: Record<string, string> = {
  novice_low: "#94a3b8",
  novice_mid: "#64748b",
  novice_high: "#475569",
  intermediate_low: "#22c55e",
  intermediate_mid: "#16a34a",
  intermediate_high: "#15803d",
  advanced_low: "#3b82f6",
  advanced_mid: "#2563eb",
  advanced_high: "#1d4ed8",
};

const ACTFL_LABELS: Record<string, string> = {
  novice_low: "Novice Low",
  novice_mid: "Novice Mid",
  novice_high: "Novice High",
  intermediate_low: "Intermediate Low",
  intermediate_mid: "Intermediate Mid",
  intermediate_high: "Intermediate High",
  advanced_low: "Advanced Low",
  advanced_mid: "Advanced Mid",
  advanced_high: "Advanced High",
};

export function ActflIndicators({ curriculumPathId, language, compact = false }: ActflIndicatorsProps) {
  const { data: analysis, isLoading } = useQuery<ActflAnalysis>({
    queryKey: ["/api/curriculum/paths", curriculumPathId, "actfl-analysis"],
    queryFn: async () => {
      const response = await fetch(`/api/curriculum/paths/${curriculumPathId}/actfl-analysis`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch ACTFL analysis');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-20 bg-muted rounded" />
        {!compact && <div className="h-32 bg-muted rounded" />}
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const chartData = Object.entries(analysis.lessonsByLevel)
    .filter(([_, count]) => count > 0)
    .map(([level, count]) => ({
      name: ACTFL_LABELS[level] || level,
      value: count,
      color: ACTFL_COLORS[level] || "#8884d8",
    }));

  const totalCanDo = analysis.canDoCategories.interpersonal + 
    analysis.canDoCategories.interpretive + 
    analysis.canDoCategories.presentational;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Target className="w-4 h-4" />
              <span>{ACTFL_LABELS[analysis.levelRange.start]} → {ACTFL_LABELS[analysis.levelRange.end]}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>ACTFL Level Range</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1">
              <Layers className="w-3 h-3" />
              {analysis.totalUnits} units
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total curriculum units</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1">
              <BookOpen className="w-3 h-3" />
              {analysis.totalLessons} lessons
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total lessons across all units</p>
          </TooltipContent>
        </Tooltip>
        {analysis.estimatedStatementsCovered > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                ~{analysis.estimatedStatementsCovered} Can-Do
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Estimated Can-Do Statements covered</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Level Range & Stats */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <span className="font-medium">
            {ACTFL_LABELS[analysis.levelRange.start]} → {ACTFL_LABELS[analysis.levelRange.end]}
          </span>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Layers className="w-3 h-3" />
          {analysis.totalUnits} units
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <BookOpen className="w-3 h-3" />
          {analysis.totalLessons} lessons
        </Badge>
      </div>

      {/* Lesson Distribution Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Lesson Distribution by ACTFL Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number, name: string) => [`${value} lessons`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {chartData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span>{entry.name}</span>
                  <span className="text-muted-foreground">({entry.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Can-Do Statement Coverage */}
      {totalCanDo > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Can-Do Statement Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Interpersonal</span>
                <span className="text-muted-foreground">{analysis.canDoCategories.interpersonal} topics</span>
              </div>
              <Progress 
                value={(analysis.canDoCategories.interpersonal / Math.max(totalCanDo, 1)) * 100} 
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Interpretive</span>
                <span className="text-muted-foreground">{analysis.canDoCategories.interpretive} topics</span>
              </div>
              <Progress 
                value={(analysis.canDoCategories.interpretive / Math.max(totalCanDo, 1)) * 100} 
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Presentational</span>
                <span className="text-muted-foreground">{analysis.canDoCategories.presentational} topics</span>
              </div>
              <Progress 
                value={(analysis.canDoCategories.presentational / Math.max(totalCanDo, 1)) * 100} 
                className="h-2"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Estimated {analysis.estimatedStatementsCovered} ACTFL Can-Do Statements covered
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ActflLevelBadge({ level, showLabel = true }: { level: string; showLabel?: boolean }) {
  const color = ACTFL_COLORS[level] || "#8884d8";
  const label = ACTFL_LABELS[level] || level;

  return (
    <Badge 
      variant="outline" 
      className="gap-1.5"
      style={{ borderColor: color, color: color }}
    >
      <div 
        className="w-2 h-2 rounded-full" 
        style={{ backgroundColor: color }}
      />
      {showLabel && label}
    </Badge>
  );
}
