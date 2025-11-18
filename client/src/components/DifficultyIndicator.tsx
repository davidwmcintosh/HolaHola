import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Check, X, Info } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PerformanceAnalysis {
  successRate: number;
  totalAssessed: number;
  averageScore: number;
  recommendedDifficulty: string | null;
  shouldAdjust: boolean;
  reason: string;
}

interface DifficultyIndicatorProps {
  conversationId: string;
  currentDifficulty: string;
  language: string;
}

export function DifficultyIndicator({ conversationId, currentDifficulty, language }: DifficultyIndicatorProps) {
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();

  // Fetch difficulty recommendation
  const { data: analysis, refetch } = useQuery<PerformanceAnalysis>({
    queryKey: [`/api/difficulty-recommendation/${conversationId}`],
    refetchInterval: 60000, // Check every minute
    enabled: !!conversationId,
  });

  // Mutation to update conversation difficulty
  const updateDifficultyMutation = useMutation({
    mutationFn: async (newDifficulty: string) => {
      // Update conversation difficulty
      await apiRequest("PATCH", `/api/conversations/${conversationId}`, {
        difficulty: newDifficulty,
      });

      // Update user progress with last adjustment date and suggested difficulty
      // Use language as the ID since getOrCreateUserProgress creates IDs as `${language}-progress`
      await apiRequest("PATCH", `/api/progress/${language}`, {
        suggestedDifficulty: newDifficulty,
        lastDifficultyAdjustment: new Date().toISOString(),
      });
    },
    onSuccess: (_, newDifficulty) => {
      toast({
        title: "Difficulty Updated!",
        description: `Switched to ${newDifficulty} level. Keep up the great work!`,
      });
      setDismissed(false);
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/difficulty-recommendation/${conversationId}`] });
      refetch();
    },
  });

  const handleAccept = () => {
    if (analysis?.recommendedDifficulty) {
      updateDifficultyMutation.mutate(analysis.recommendedDifficulty);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    toast({
      title: "Recommendation Dismissed",
      description: "We'll check again later!",
    });
  };

  // Reset dismissed state when new recommendation appears
  useEffect(() => {
    if (analysis?.shouldAdjust) {
      setDismissed(false);
    }
  }, [analysis?.shouldAdjust]);

  if (!analysis) return null;

  const successPercentage = Math.round(analysis.successRate * 100);
  const showRecommendation = analysis.shouldAdjust && !dismissed;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'intermediate': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'advanced': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-3">
      {/* Current Performance */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge className={getDifficultyColor(currentDifficulty)} data-testid="badge-current-difficulty">
              {currentDifficulty}
            </Badge>
            {analysis.totalAssessed >= 5 && (
              <div className="text-sm text-muted-foreground" data-testid="text-performance">
                {successPercentage}% success • {analysis.totalAssessed} messages assessed
              </div>
            )}
          </div>
          
          {analysis.totalAssessed < 20 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>{20 - analysis.totalAssessed} more to assess</span>
            </div>
          )}
        </div>
      </Card>

      {/* Difficulty Adjustment Recommendation */}
      {showRecommendation && analysis.recommendedDifficulty && (
        <Card className="p-4 border-primary/50 bg-primary/5" data-testid="card-difficulty-recommendation">
          <div className="flex items-start gap-3">
            {analysis.recommendedDifficulty > currentDifficulty ? (
              <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
            ) : (
              <TrendingDown className="h-5 w-5 text-primary mt-0.5" />
            )}
            
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="font-semibold mb-1" data-testid="text-recommendation-title">
                  Switch to {analysis.recommendedDifficulty}?
                </h4>
                <p className="text-sm text-muted-foreground" data-testid="text-recommendation-reason">
                  {analysis.reason}
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAccept}
                  disabled={updateDifficultyMutation.isPending}
                  data-testid="button-accept-difficulty"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Switch Level
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismiss}
                  data-testid="button-dismiss-difficulty"
                >
                  <X className="h-4 w-4 mr-2" />
                  Not Now
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Helpful message when no recommendation */}
      {!showRecommendation && analysis.totalAssessed >= 20 && (
        <p className="text-xs text-muted-foreground text-center" data-testid="text-no-recommendation">
          {analysis.reason}
        </p>
      )}
    </div>
  );
}
