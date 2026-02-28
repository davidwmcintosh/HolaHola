import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, RotateCw, Loader2, Check, X, Filter, Calendar, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLearningFilter } from "@/contexts/LearningFilterContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { VocabularyWord } from "@shared/schema";

type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'older';

const isDue = (nextReviewDate: Date | string): boolean => {
  return new Date() >= new Date(nextReviewDate);
};

const isOverdue = (nextReviewDate: Date | string): boolean => {
  const now = new Date();
  const reviewDate = new Date(nextReviewDate);
  const daysDiff = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > 1;
};

const getReviewStatus = (nextReviewDate: Date | string): "overdue" | "due" | "upcoming" => {
  if (isOverdue(nextReviewDate)) return "overdue";
  if (isDue(nextReviewDate)) return "due";
  return "upcoming";
};

interface VocabularyFlashcardProps {
  timeFilter?: TimeFilter;
}

export function VocabularyFlashcard({ timeFilter = 'all' }: VocabularyFlashcardProps) {
  const { language, difficulty } = useLanguage();
  const { learningContext } = useLearningFilter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showDueOnly, setShowDueOnly] = useState(false);
  const { toast } = useToast();

  // Get classId from learning context when filtering by class
  // When learningContext is not a special value, it IS the classId
  const classId = learningContext !== 'self-directed' && learningContext !== 'founder-mode' && learningContext !== 'honesty-mode' && learningContext !== 'all-learning'
    ? learningContext
    : undefined;

  const { data: allWords = [], isLoading } = useQuery<VocabularyWord[]>({
    queryKey: ["/api/vocabulary/filtered", { language, timeFilter, classId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('language', language);
      if (timeFilter !== 'all') params.append('timeFilter', timeFilter);
      if (classId) params.append('classId', classId);
      const url = `/api/vocabulary/filtered?${params.toString()}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch vocabulary');
      return response.json();
    },
  });

  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [timeFilter]);

  // Filter cards based on due status
  const vocabularyWords = useMemo(() => {
    if (!showDueOnly) return allWords;
    return allWords.filter(word => isDue(word.nextReviewDate));
  }, [allWords, showDueOnly]);

  // Clamp index if the card list shrinks (e.g. after data refresh or due-only filter changes)
  useEffect(() => {
    if (vocabularyWords.length > 0 && currentIndex >= vocabularyWords.length) {
      setCurrentIndex(vocabularyWords.length - 1);
      setIsFlipped(false);
    }
  }, [vocabularyWords.length]);

  // Calculate statistics
  const stats = useMemo(() => {
    const dueCount = allWords.filter(word => isDue(word.nextReviewDate)).length;
    const overdueCount = allWords.filter(word => isOverdue(word.nextReviewDate)).length;
    return { dueCount, overdueCount, total: allWords.length };
  }, [allWords]);

  const reviewMutation = useMutation({
    mutationFn: async ({ id, isCorrect }: { id: string; isCorrect: boolean }) => {
      return await apiRequest("PATCH", `/api/vocabulary/${id}/review`, { isCorrect });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary/filtered"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      
      toast({
        title: variables.isCorrect ? "Correct!" : "Keep practicing!",
        description: variables.isCorrect 
          ? "Great job! Your next review has been scheduled."
          : "Don't worry, you'll see this card again soon.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (vocabularyWords.length === 0) {
    return (
      <div className="space-y-4">
        {stats.total > 0 && showDueOnly && (
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDueOnly(false)}
              data-testid="button-show-all"
            >
              <Filter className="h-4 w-4 mr-2" />
              Show All Cards ({stats.total})
            </Button>
          </div>
        )}
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {showDueOnly 
              ? "No cards due for review right now. Great job staying on top of your practice!" 
              : "No vocabulary words available for this language and difficulty level."}
          </p>
        </Card>
      </div>
    );
  }

  const currentCard = vocabularyWords[currentIndex];
  const reviewStatus = getReviewStatus(currentCard.nextReviewDate);

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % vocabularyWords.length);
  };

  const handlePrevious = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + vocabularyWords.length) % vocabularyWords.length);
  };

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleReview = (isCorrect: boolean) => {
    reviewMutation.mutate({ id: currentCard.id, isCorrect });
    // Move to next card after a short delay
    setTimeout(() => {
      handleNext();
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Statistics and Filter */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          <Badge variant={stats.overdueCount > 0 ? "destructive" : "secondary"} data-testid="badge-review-stats">
            {stats.dueCount} due for review
          </Badge>
          {reviewStatus === "overdue" && (
            <Badge variant="destructive" data-testid="badge-overdue">
              Overdue
            </Badge>
          )}
          {reviewStatus === "due" && (
            <Badge variant="default" data-testid="badge-due">
              Due Today
            </Badge>
          )}
          {reviewStatus === "upcoming" && (
            <Badge variant="secondary" data-testid="badge-upcoming">
              <Calendar className="h-3 w-3 mr-1" />
              Next: {new Date(currentCard.nextReviewDate).toLocaleDateString()}
            </Badge>
          )}
        </div>
        <Button
          variant={showDueOnly ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setShowDueOnly(!showDueOnly);
            setCurrentIndex(0);
          }}
          data-testid="button-filter-due"
        >
          <Filter className="h-4 w-4 mr-2" />
          {showDueOnly ? "Showing Due Only" : "Show Due Only"}
        </Button>
      </div>

      <Card 
        className="min-h-32 max-w-md mx-auto p-4 flex flex-col items-center justify-center cursor-pointer hover-elevate active-elevate-2"
        onClick={!isFlipped ? handleFlip : undefined}
        data-testid="card-flashcard"
      >
        <div className="text-center space-y-2 flex-1 flex items-center">
          {!isFlipped ? (
            <div>
              <h3 className="text-xl font-bold" data-testid="text-flashcard-word">
                {currentCard.word}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Click to reveal</p>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-bold text-primary" data-testid="text-flashcard-translation">
                {currentCard.translation}
              </h3>
              <div className="space-y-1 mt-2">
                <p className="text-xs text-muted-foreground italic">
                  {currentCard.pronunciation}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Ex: </span>
                  {currentCard.example}
                </p>
                {currentCard.sourceConversationId && (
                  <Link 
                    href={`/history?conversation=${currentCard.sourceConversationId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                    data-testid={`link-source-conversation-${currentCard.id}`}
                  >
                    <MessageSquare className="h-3 w-3" />
                    View in conversation
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
        
        {isFlipped && (
          <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleReview(false)}
              disabled={reviewMutation.isPending}
              data-testid="button-flashcard-incorrect"
            >
              <X className="h-3 w-3 mr-1" />
              Wrong
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleReview(true)}
              disabled={reviewMutation.isPending}
              data-testid="button-flashcard-correct"
            >
              <Check className="h-3 w-3 mr-1" />
              Got it
            </Button>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          data-testid="button-flashcard-previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleFlip}
          data-testid="button-flashcard-flip"
        >
          <RotateCw className="h-4 w-4 mr-2" />
          Flip
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          disabled={currentIndex === vocabularyWords.length - 1}
          data-testid="button-flashcard-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Card {currentIndex + 1} of {vocabularyWords.length}
      </p>
    </div>
  );
}
