import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  Sparkles, 
  Trophy, 
  BookOpen, 
  Target,
  Clock,
  ThumbsUp
} from "lucide-react";

interface SyllabusProgressItem {
  id: string;
  lessonId: string;
  status: 'not_started' | 'in_progress' | 'completed_early' | 'completed_assigned' | 'skipped';
  topicsCoveredCount: number;
  vocabularyMastered: number;
  grammarScore: number | null;
  pronunciationScore: number | null;
  tutorVerified: boolean;
  completedAt: string | null;
  daysAhead: number | null;
}

interface EarlyCompletionCandidate {
  lessonId: string;
  lessonTitle: string;
  recommendation: 'complete_early' | 'partial_progress' | 'needs_work';
  coveragePercent: number;
}

interface SyllabusProgressProps {
  classId: string;
  className?: string;
}

export function SyllabusProgress({ classId, className }: SyllabusProgressProps) {
  const { toast } = useToast();

  const { data: progress, isLoading: isLoadingProgress } = useQuery<SyllabusProgressItem[]>({
    queryKey: ['/api/syllabus-progress', classId],
    queryFn: async () => {
      const response = await fetch(`/api/syllabus-progress/${classId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch progress');
      return response.json();
    },
    enabled: !!classId,
  });

  const { data: upcomingEarlyCompletions, isLoading: isLoadingUpcoming } = useQuery<EarlyCompletionCandidate[]>({
    queryKey: ['/api/competency/upcoming', classId],
    queryFn: async () => {
      const response = await fetch(`/api/competency/upcoming/${classId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch upcoming completions');
      return response.json();
    },
    enabled: !!classId,
  });

  const markEarlyCompleteMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      return apiRequest('POST', '/api/competency/complete-early', {
        classId,
        lessonId,
        tutorVerified: false,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/syllabus-progress', classId] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency/upcoming', classId] });
      toast({
        title: "Lesson Completed Early",
        description: data.message || "You're ahead of the syllabus!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not mark lesson as complete",
        variant: "destructive",
      });
    },
  });

  const earlyCompletions = progress?.filter(p => p.status === 'completed_early') || [];
  const readyToComplete = upcomingEarlyCompletions?.filter(c => c.recommendation === 'complete_early') || [];
  const partialProgress = upcomingEarlyCompletions?.filter(c => c.recommendation === 'partial_progress') || [];

  if (isLoadingProgress || isLoadingUpcoming) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Syllabus Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Syllabus Progress
        </CardTitle>
        <CardDescription>
          Track your curriculum completion and discover topics you've already mastered
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {earlyCompletions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span>Already Completed ({earlyCompletions.length})</span>
            </div>
            <div className="space-y-2">
              {earlyCompletions.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <span className="font-medium">Lesson {item.lessonId.slice(-4)}</span>
                      {item.tutorVerified && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="ml-2 text-xs gap-1">
                              <ThumbsUp className="h-3 w-3" />
                              Verified
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>Tutor confirmed your competency</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {item.daysAhead && item.daysAhead > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {item.daysAhead} days ahead
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {readyToComplete.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Ready to Complete Early ({readyToComplete.length})</span>
            </div>
            <div className="space-y-2">
              {readyToComplete.map((item) => (
                <div 
                  key={item.lessonId}
                  className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20"
                  data-testid={`card-ready-${item.lessonId}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span className="font-medium">{item.lessonTitle}</span>
                      <Badge className="bg-green-500">
                        {item.coveragePercent}% Covered
                      </Badge>
                    </div>
                    <Progress 
                      value={item.coveragePercent} 
                      className="h-2 mt-2"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="ml-4"
                    onClick={() => markEarlyCompleteMutation.mutate(item.lessonId)}
                    disabled={markEarlyCompleteMutation.isPending}
                    data-testid={`button-complete-${item.lessonId}`}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Mark Complete
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {partialProgress.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Making Progress ({partialProgress.length})</span>
            </div>
            <div className="grid gap-2">
              {partialProgress.slice(0, 3).map((item) => (
                <div 
                  key={item.lessonId}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{item.lessonTitle}</span>
                    </div>
                    <Progress 
                      value={item.coveragePercent} 
                      className="h-1.5 mt-2"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground ml-4">
                    {item.coveragePercent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {earlyCompletions.length === 0 && readyToComplete.length === 0 && partialProgress.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No syllabus progress yet</p>
            <p className="text-sm mt-1">Keep practicing to cover curriculum topics organically!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AlreadyCoveredBadge({ 
  coveragePercent, 
  tutorVerified = false 
}: { 
  coveragePercent: number; 
  tutorVerified?: boolean;
}) {
  if (coveragePercent < 40) return null;
  
  const isComplete = coveragePercent >= 80;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant={isComplete ? "default" : "secondary"}
          className={`gap-1 ${isComplete ? 'bg-green-500 hover:bg-green-600' : ''}`}
        >
          {isComplete ? (
            <>
              <Sparkles className="h-3 w-3" />
              Already Covered
            </>
          ) : (
            <>
              <Target className="h-3 w-3" />
              {coveragePercent}% Covered
            </>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {isComplete 
          ? `You've already mastered this topic through conversation practice${tutorVerified ? ' (Tutor verified)' : ''}`
          : `You've covered ${coveragePercent}% of this topic in your conversations`
        }
      </TooltipContent>
    </Tooltip>
  );
}
