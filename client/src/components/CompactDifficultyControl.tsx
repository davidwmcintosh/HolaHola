import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TrendingUp, TrendingDown, Check, ChevronDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface PerformanceAnalysis {
  successRate: number;
  totalAssessed: number;
  averageScore: number;
  recommendedDifficulty: string | null;
  shouldAdjust: boolean;
  reason: string;
}

interface CompactDifficultyControlProps {
  conversationId: string | null;
}

export function CompactDifficultyControl({ conversationId }: CompactDifficultyControlProps) {
  const { difficulty, setDifficulty, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [recommendationDismissed, setRecommendationDismissed] = useState(false);
  const { toast } = useToast();

  const { data: analysis } = useQuery<PerformanceAnalysis>({
    queryKey: [`/api/difficulty-recommendation/${conversationId}`],
    refetchInterval: 60000,
    enabled: !!conversationId,
  });

  const updateDifficultyMutation = useMutation({
    mutationFn: async (newDifficulty: string) => {
      await apiRequest("PATCH", `/api/conversations/${conversationId}`, {
        difficulty: newDifficulty,
      });

      await apiRequest("PATCH", `/api/progress/${language}`, {
        suggestedDifficulty: newDifficulty,
        lastDifficultyAdjustment: new Date().toISOString(),
      });
    },
    onSuccess: (_, newDifficulty) => {
      setDifficulty(newDifficulty as any);
      toast({
        title: "Difficulty Updated!",
        description: `Switched to ${newDifficulty} level.`,
      });
      setRecommendationDismissed(false);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/difficulty-recommendation/${conversationId}`] });
    },
  });

  const handleManualChange = (level: string) => {
    if (conversationId) {
      updateDifficultyMutation.mutate(level);
    } else {
      setDifficulty(level as any);
      setOpen(false);
    }
  };

  const handleAcceptRecommendation = () => {
    if (analysis?.recommendedDifficulty) {
      updateDifficultyMutation.mutate(analysis.recommendedDifficulty);
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'intermediate': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'advanced': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default: return '';
    }
  };

  const showRecommendation = analysis?.shouldAdjust && !recommendationDismissed;
  const successPercentage = analysis ? Math.round(analysis.successRate * 100) : 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 hover-elevate"
          data-testid="button-difficulty-control"
        >
          <span className="text-xs text-muted-foreground">Difficulty:</span>
          <Badge className={getDifficultyColor(difficulty)} data-testid="badge-current-difficulty">
            {difficulty}
          </Badge>
          {showRecommendation && analysis?.recommendedDifficulty && (
            analysis.recommendedDifficulty > difficulty ? (
              <TrendingUp className="h-3 w-3 text-primary" />
            ) : (
              <TrendingDown className="h-3 w-3 text-primary" />
            )
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Difficulty Level</h4>
            <div className="grid grid-cols-3 gap-2">
              {['beginner', 'intermediate', 'advanced'].map((level) => (
                <Button
                  key={level}
                  size="sm"
                  variant={difficulty === level ? "default" : "outline"}
                  onClick={() => handleManualChange(level)}
                  disabled={updateDifficultyMutation.isPending}
                  data-testid={`button-select-${level}`}
                >
                  {level === difficulty && <Check className="h-3 w-3 mr-1" />}
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {analysis && analysis.totalAssessed >= 5 && (
            <div className="text-sm text-muted-foreground border-t pt-3">
              <div className="flex justify-between">
                <span>Success rate:</span>
                <span className="font-medium">{successPercentage}%</span>
              </div>
              <div className="flex justify-between">
                <span>Messages assessed:</span>
                <span className="font-medium">{analysis.totalAssessed}</span>
              </div>
            </div>
          )}

          {analysis && analysis.totalAssessed < 20 && (
            <div className="text-xs text-muted-foreground text-center">
              {20 - analysis.totalAssessed} more messages until automatic recommendation
            </div>
          )}

          {showRecommendation && analysis?.recommendedDifficulty && (
            <Card className="p-3 border-primary/50 bg-primary/5" data-testid="card-recommendation">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  {analysis.recommendedDifficulty > difficulty ? (
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      Switch to {analysis.recommendedDifficulty}?
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analysis?.reason}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAcceptRecommendation}
                    disabled={updateDifficultyMutation.isPending}
                    className="flex-1"
                    data-testid="button-accept-recommendation"
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRecommendationDismissed(true)}
                    className="flex-1"
                    data-testid="button-dismiss-recommendation"
                  >
                    Not Now
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
