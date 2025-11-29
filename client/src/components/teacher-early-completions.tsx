import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Sparkles, 
  Trophy, 
  TrendingUp,
  CheckCircle2,
  Calendar,
  ThumbsUp
} from "lucide-react";

interface EarlyCompletion {
  id: string;
  studentId: string;
  lessonId: string;
  status: string;
  topicsCoveredCount: number;
  vocabularyMastered: number;
  grammarScore: number | null;
  pronunciationScore: number | null;
  tutorVerified: boolean;
  tutorNotes: string | null;
  completedAt: string | null;
  daysAhead: number | null;
  student: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    profileImageUrl: string | null;
  };
  lesson: {
    id: string;
    name: string;
    description: string | null;
  };
}

interface TeacherEarlyCompletionsProps {
  classId: string;
  className?: string;
}

export function TeacherEarlyCompletions({ classId, className }: TeacherEarlyCompletionsProps) {
  const { data: earlyCompletions, isLoading } = useQuery<EarlyCompletion[]>({
    queryKey: ['/api/teacher/classes', classId, 'early-completions'],
    queryFn: async () => {
      const response = await fetch(`/api/teacher/classes/${classId}/early-completions`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch early completions');
      return response.json();
    },
    enabled: !!classId,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Early Completions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const studentStats = new Map<string, { count: number; student: EarlyCompletion['student'] }>();
  earlyCompletions?.forEach(completion => {
    const existing = studentStats.get(completion.studentId);
    if (existing) {
      existing.count++;
    } else {
      studentStats.set(completion.studentId, { count: 1, student: completion.student });
    }
  });

  const topPerformers = Array.from(studentStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          Organic Learning Progress
        </CardTitle>
        <CardDescription>
          Students who mastered curriculum topics through natural conversation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {earlyCompletions && earlyCompletions.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Trophy className="h-5 w-5" />
                  <span className="font-medium">Total Early Completions</span>
                </div>
                <p className="text-3xl font-bold mt-2">{earlyCompletions.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 text-primary">
                  <TrendingUp className="h-5 w-5" />
                  <span className="font-medium">Students Ahead</span>
                </div>
                <p className="text-3xl font-bold mt-2">{studentStats.size}</p>
              </div>
            </div>

            {topPerformers.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  Top Performers
                </h4>
                <div className="space-y-2">
                  {topPerformers.map(([studentId, { count, student }]) => (
                    <div 
                      key={studentId}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={student.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {student.firstName?.[0] || student.email?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {student.email}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {count} {count === 1 ? 'lesson' : 'lessons'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Recent Completions</h4>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {earlyCompletions.slice(0, 10).map((completion) => (
                  <div 
                    key={completion.id}
                    className="p-3 rounded-lg bg-muted/30 border"
                    data-testid={`completion-${completion.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={completion.student.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {completion.student.firstName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {completion.student.firstName} {completion.student.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {completion.lesson.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {completion.tutorVerified && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="gap-1 text-xs">
                                <ThumbsUp className="h-3 w-3" />
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>AI Tutor verified</TooltipContent>
                          </Tooltip>
                        )}
                        {completion.daysAhead && completion.daysAhead > 0 && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            +{completion.daysAhead}d
                          </Badge>
                        )}
                      </div>
                    </div>
                    {(completion.topicsCoveredCount > 0 || completion.vocabularyMastered > 0) && (
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{completion.topicsCoveredCount} topics</span>
                        <span>{completion.vocabularyMastered} words</span>
                        {completion.grammarScore !== null && (
                          <span>Grammar: {Math.round(completion.grammarScore * 100)}%</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No early completions yet</p>
            <p className="text-sm mt-1">
              As students practice with the AI tutor, organic completions will appear here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
