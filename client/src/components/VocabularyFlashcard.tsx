import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCw, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import type { VocabularyWord } from "@shared/schema";

export function VocabularyFlashcard() {
  const { language, difficulty } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const { data: vocabularyWords = [], isLoading } = useQuery<VocabularyWord[]>({
    queryKey: [`/api/vocabulary?language=${language}&difficulty=${difficulty}`],
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
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No vocabulary words available for this language and difficulty level.</p>
      </Card>
    );
  }

  const currentCard = vocabularyWords[currentIndex];

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

  return (
    <div className="space-y-6">
      <Card 
        className="min-h-64 aspect-[3/2] p-8 flex items-center justify-center cursor-pointer hover-elevate active-elevate-2"
        onClick={handleFlip}
        data-testid="card-flashcard"
      >
        <div className="text-center space-y-4">
          {!isFlipped ? (
            <>
              <h3 className="text-2xl font-bold" data-testid="text-flashcard-word">
                {currentCard.word}
              </h3>
              <p className="text-sm text-muted-foreground">Click to reveal</p>
            </>
          ) : (
            <>
              <h3 className="text-2xl font-bold text-primary" data-testid="text-flashcard-translation">
                {currentCard.translation}
              </h3>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground italic">
                  Pronunciation: {currentCard.pronunciation}
                </p>
                <p className="text-base">
                  <span className="text-muted-foreground">Example: </span>
                  {currentCard.example}
                </p>
              </div>
            </>
          )}
        </div>
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

        <div className="flex gap-2 items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFlip}
            data-testid="button-flashcard-flip"
          >
            <RotateCw className="h-4 w-4 mr-2" />
            Flip Card
          </Button>
          <div className="flex gap-2">
            {vocabularyWords.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full ${
                  index === currentIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

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
