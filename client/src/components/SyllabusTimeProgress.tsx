/**
 * SyllabusTimeProgress - Shows expected vs actual time for syllabus units/lessons
 * 
 * Displays:
 * - Time spent vs expected per unit
 * - Pace indicator (ahead, on track, behind)
 * - Expandable lessons with individual time tracking
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ChevronDown, 
  ChevronRight,
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Check,
  Circle,
  BookOpen
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface LessonTimeData {
  lessonId: string;
  lessonName: string;
  unitId: string;
  unitName: string;
  expectedMinutes: number | null;
  actualMinutes: number;
  status: string;
  completedAt: string | null;
  paceIndicator: 'ahead' | 'on_track' | 'behind' | 'not_started';
}

interface UnitTimeData {
  unitId: string;
  unitName: string;
  orderIndex: number;
  expectedMinutes: number;
  actualMinutes: number;
  lessonsTotal: number;
  lessonsCompleted: number;
  lessonsInProgress: number;
  paceIndicator: 'ahead' | 'on_track' | 'behind' | 'not_started';
  lessons: LessonTimeData[];
}

interface StudentSyllabusTimeData {
  studentId: string;
  classId: string;
  className: string;
  language: string;
  totalExpectedMinutes: number;
  totalActualMinutes: number;
  overallPace: 'ahead' | 'on_track' | 'behind';
  units: UnitTimeData[];
}

interface SyllabusTimeProgressProps {
  classId: string;
  className?: string;
  compact?: boolean;
}

function PaceIndicator({ pace, size = 'default' }: { pace: string; size?: 'default' | 'sm' }) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  
  switch (pace) {
    case 'ahead':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
              <TrendingUp className={iconSize} />
              {size !== 'sm' && 'Ahead'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Completing lessons faster than expected</TooltipContent>
        </Tooltip>
      );
    case 'on_track':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 gap-1">
              <Check className={iconSize} />
              {size !== 'sm' && 'On Track'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Right on pace with expected timing</TooltipContent>
        </Tooltip>
      );
    case 'behind':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
              <TrendingDown className={iconSize} />
              {size !== 'sm' && 'Taking Time'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Taking a bit longer than expected - that's okay, learning at your own pace!</TooltipContent>
        </Tooltip>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Circle className={iconSize} />
          {size !== 'sm' && 'Not Started'}
        </Badge>
      );
  }
}

function TimeDisplay({ expected, actual }: { expected: number; actual: number }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      <span>
        {actual > 0 ? `${actual}` : '0'} / {expected || '?'} min
      </span>
    </div>
  );
}

function UnitRow({ unit, isExpanded, onToggle }: { 
  unit: UnitTimeData; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const progressPercent = unit.lessonsTotal > 0 
    ? Math.round((unit.lessonsCompleted / unit.lessonsTotal) * 100) 
    : 0;

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`unit-row-${unit.unitId}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover-elevate text-left"
        data-testid={`button-expand-${unit.unitId}`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{unit.unitName}</span>
              <PaceIndicator pace={unit.paceIndicator} size="sm" />
            </div>
            <div className="flex items-center gap-4 mt-1">
              <TimeDisplay expected={unit.expectedMinutes} actual={unit.actualMinutes} />
              <span className="text-xs text-muted-foreground">
                {unit.lessonsCompleted}/{unit.lessonsTotal} lessons
              </span>
            </div>
          </div>
        </div>
        <div className="w-24 shrink-0 ml-2">
          <Progress value={progressPercent} className="h-2" />
        </div>
      </button>
      
      {isExpanded && unit.lessons.length > 0 && (
        <div className="border-t bg-muted/30 p-2 space-y-1">
          {unit.lessons.map((lesson) => (
            <div 
              key={lesson.lessonId}
              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
              data-testid={`lesson-row-${lesson.lessonId}`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{lesson.lessonName}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <TimeDisplay 
                  expected={lesson.expectedMinutes || 0} 
                  actual={lesson.actualMinutes} 
                />
                <PaceIndicator pace={lesson.paceIndicator} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SyllabusTimeProgress({ classId, className, compact = false }: SyllabusTimeProgressProps) {
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<StudentSyllabusTimeData>({
    queryKey: ['/api/analytics/syllabus-time', classId],
    enabled: !!classId,
  });

  const toggleUnit = (unitId: string) => {
    setExpandedUnits(prev => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load time tracking data
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.units.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No syllabus configured for this class yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallProgress = data.totalExpectedMinutes > 0
    ? Math.round((data.totalActualMinutes / data.totalExpectedMinutes) * 100)
    : 0;

  return (
    <Card className={className} data-testid="syllabus-time-progress">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Progress
            </CardTitle>
            <CardDescription className="mt-1">
              Track your learning time against syllabus expectations
            </CardDescription>
          </div>
          <PaceIndicator pace={data.overallPace} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Summary */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {data.totalActualMinutes} / {data.totalExpectedMinutes} min
            </span>
          </div>
          <Progress value={Math.min(overallProgress, 100)} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {overallProgress > 100 
              ? `${overallProgress - 100}% more time invested than expected`
              : `${100 - overallProgress}% remaining`
            }
          </p>
        </div>

        {/* Units List */}
        {!compact && (
          <div className="space-y-2">
            {data.units.map((unit) => (
              <UnitRow
                key={unit.unitId}
                unit={unit}
                isExpanded={expandedUnits.has(unit.unitId)}
                onToggle={() => toggleUnit(unit.unitId)}
              />
            ))}
          </div>
        )}

        {compact && (
          <div className="grid gap-2">
            {data.units.slice(0, 3).map((unit) => (
              <div 
                key={unit.unitId}
                className="flex items-center justify-between p-2 rounded-md border"
              >
                <span className="text-sm truncate flex-1">{unit.unitName}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <TimeDisplay expected={unit.expectedMinutes} actual={unit.actualMinutes} />
                  <PaceIndicator pace={unit.paceIndicator} size="sm" />
                </div>
              </div>
            ))}
            {data.units.length > 3 && (
              <p className="text-xs text-center text-muted-foreground">
                +{data.units.length - 3} more units
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
