import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

interface FlashcardData {
  id: string;
  word: string;
  translation: string;
  example: string;
  pronunciation: string;
}

const sampleCards: FlashcardData[] = [
  {
    id: "1",
    word: "Hola",
    translation: "Hello",
    example: "Hola, ¿cómo estás?",
    pronunciation: "OH-lah",
  },
  {
    id: "2",
    word: "Gracias",
    translation: "Thank you",
    example: "Gracias por tu ayuda.",
    pronunciation: "GRAH-see-ahs",
  },
  {
    id: "3",
    word: "Amigo",
    translation: "Friend",
    example: "Mi amigo es muy amable.",
    pronunciation: "ah-MEE-goh",
  },
];

export function VocabularyFlashcard() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentCard = sampleCards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % sampleCards.length);
  };

  const handlePrevious = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + sampleCards.length) % sampleCards.length);
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
            {sampleCards.map((_, index) => (
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
          disabled={currentIndex === sampleCards.length - 1}
          data-testid="button-flashcard-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Card {currentIndex + 1} of {sampleCards.length}
      </p>
    </div>
  );
}
