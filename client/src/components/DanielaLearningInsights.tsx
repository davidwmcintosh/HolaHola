import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle,
  Trophy,
  Lightbulb,
  ChevronRight,
  Target,
  Zap,
  Heart,
  BookOpen
} from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTutorName } from "@/lib/tutor-avatars";

interface RecurringStruggle {
  id: string;
  errorCategory: string;
  specificError: string;
  description: string;
  occurrenceCount: number;
  status: 'active' | 'improving' | 'resolved' | 'mastered';
  successfulApproaches: string[];
}

interface StudentInsight {
  id: string;
  insightType: string;
  content: string;
  confidenceScore: number;
}

interface PersonalFact {
  id: string;
  factType: string;
  fact: string;
  confidenceScore: number;
}

interface BreakthroughInfo {
  struggleArea: string;
  description: string;
  occurrenceCount: number;
  successfulStrategies: string[];
  createdAt: string;
}

interface StudentLearningContext {
  struggles: RecurringStruggle[];
  insights: StudentInsight[];
  personalFacts: PersonalFact[];
  effectiveStrategies: string[];
  strugglingAreas: string[];
  recentProgress: string[];
  recentBreakthroughs: BreakthroughInfo[];
}

interface Props {
  language: string;
  userId?: string;
}

const strategyLabels: Record<string, string> = {
  visual_timeline: "Visual timelines",
  role_play: "Role playing",
  repetition_drill: "Practice drills",
  comparison_chart: "Comparison charts",
  mnemonic: "Memory tricks",
  real_world_context: "Real-world examples",
  slow_pronunciation: "Slow pronunciation",
  written_example: "Written examples",
  chunking: "Breaking into chunks",
  spaced_repetition: "Spaced practice",
  error_correction_immediate: "Immediate feedback",
  self_discovery: "Discovery learning",
  explicit_rule: "Clear explanations",
  storytelling: "Storytelling",
};

const categoryLabels: Record<string, string> = {
  grammar: "Grammar",
  pronunciation: "Pronunciation", 
  vocabulary: "Vocabulary",
  cultural: "Cultural nuances",
  comprehension: "Listening",
};

const categoryIcons: Record<string, typeof BookOpen> = {
  grammar: BookOpen,
  pronunciation: Zap,
  vocabulary: Lightbulb,
  cultural: Heart,
  comprehension: Target,
};

export function DanielaLearningInsights({ language, userId }: Props) {
  const { tutorGender } = useLanguage();
  const tutorName = getTutorName(language, tutorGender);
  const { data: context, isLoading, error } = useQuery<StudentLearningContext | null>({
    queryKey: ["/api/student-learning/context", userId, language],
    queryFn: async () => {
      if (!userId || language === 'all') return null;
      const response = await fetch(`/api/student-learning/context/${userId}/${language}`, { 
        credentials: 'include' 
      });
      if (!response.ok) {
        console.warn('[DanielaInsights] Failed to fetch learning context:', response.status);
        return null;
      }
      const data = await response.json();
      return data.context as StudentLearningContext;
    },
    enabled: !!userId && language !== 'all',
  });

  if (language === 'all') return null;
  
  if (isLoading) {
    return (
      <Card data-testid="card-daniela-insights-loading">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !context) return null;

  const hasContent = 
    context.recentBreakthroughs.length > 0 || 
    context.struggles.length > 0 || 
    context.effectiveStrategies.length > 0 ||
    context.recentProgress.length > 0;

  if (!hasContent) return null;

  const improvingStruggles = context.struggles.filter(s => s.status === 'improving');
  const activeStruggles = context.struggles.filter(s => s.status === 'active').slice(0, 3);

  return (
    <Card className="relative overflow-hidden" data-testid="card-daniela-insights">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />
      
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-lg">{tutorName}'s Insights</CardTitle>
        </div>
        <CardDescription>
          Your personalized learning insights
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {context.recentBreakthroughs.length > 0 && (
          <div className="space-y-2" data-testid="section-breakthroughs">
            <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
              <Trophy className="h-4 w-4" />
              <span>Recent Wins</span>
            </div>
            <div className="space-y-2">
              {context.recentBreakthroughs.slice(0, 2).map((breakthrough, i) => (
                <div 
                  key={i}
                  className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900"
                  data-testid={`breakthrough-${i}`}
                >
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    {breakthrough.description}
                  </p>
                  {breakthrough.successfulStrategies.length > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                      What helped: {breakthrough.successfulStrategies.map(s => strategyLabels[s] || s).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {improvingStruggles.length > 0 && (
          <div className="space-y-2" data-testid="section-improving">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
              <TrendingUp className="h-4 w-4" />
              <span>Making Progress</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {improvingStruggles.slice(0, 3).map((struggle) => {
                const CategoryIcon = categoryIcons[struggle.errorCategory] || BookOpen;
                return (
                  <Badge 
                    key={struggle.id}
                    variant="outline"
                    className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 gap-1"
                    data-testid={`improving-${struggle.id}`}
                  >
                    <CategoryIcon className="h-3 w-3" />
                    {struggle.description.length > 40 
                      ? struggle.description.substring(0, 40) + '...' 
                      : struggle.description}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {activeStruggles.length > 0 && (
          <div className="space-y-2" data-testid="section-focus-areas">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span>Let's Work On</span>
            </div>
            <div className="space-y-2">
              {activeStruggles.map((struggle) => {
                const CategoryIcon = categoryIcons[struggle.errorCategory] || BookOpen;
                return (
                  <div 
                    key={struggle.id}
                    className="flex items-start gap-3 p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20"
                    data-testid={`struggle-${struggle.id}`}
                  >
                    <div className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50">
                      <CategoryIcon className="h-3 w-3 text-amber-700 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        {struggle.description}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        {categoryLabels[struggle.errorCategory] || struggle.errorCategory} · 
                        Noticed {struggle.occurrenceCount}x
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {context.effectiveStrategies.length > 0 && (
          <div className="space-y-2" data-testid="section-strategies">
            <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-400">
              <Lightbulb className="h-4 w-4" />
              <span>What Works for You</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {context.effectiveStrategies.slice(0, 5).map((strategy, i) => (
                <Badge 
                  key={i}
                  variant="outline"
                  className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 text-xs"
                  data-testid={`strategy-${i}`}
                >
                  {strategyLabels[strategy] || strategy}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Link href="/chat">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-2 gap-2"
            data-testid="button-practice-now"
          >
            <Sparkles className="h-4 w-4" />
            Practice with {tutorName}
            <ChevronRight className="h-4 w-4 ml-auto" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
