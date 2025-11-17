import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import type { GrammarExercise as GrammarExerciseType } from "@shared/schema";

export function GrammarExercise() {
  const { language, difficulty } = useLanguage();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const { data: exercises = [], isLoading } = useQuery<GrammarExerciseType[]>({
    queryKey: [`/api/grammar?language=${language}&difficulty=${difficulty}`],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No grammar exercises available for this language and difficulty level.</p>
      </Card>
    );
  }

  const currentQuestion = exercises[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / exercises.length) * 100;

  const handleSubmit = () => {
    if (selectedAnswer !== null) {
      setShowResult(true);
      console.log(`Answer submitted: ${selectedAnswer === currentQuestion.correctAnswer ? "Correct" : "Incorrect"}`);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < exercises.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm text-muted-foreground">Progress</p>
          <p className="text-sm font-medium" data-testid="text-exercise-progress">
            {currentQuestionIndex + 1} / {exercises.length}
          </p>
        </div>
        <Progress value={progress} />
      </div>

      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-6" data-testid="text-question">
          {currentQuestion.question}
        </h3>

        <RadioGroup
          value={selectedAnswer?.toString()}
          onValueChange={(value) => setSelectedAnswer(Number(value))}
          disabled={showResult}
        >
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <div
                key={index}
                className={`flex items-center space-x-3 rounded-lg border p-4 ${
                  showResult && index === currentQuestion.correctAnswer
                    ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                    : showResult && index === selectedAnswer
                    ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                    : ""
                }`}
              >
                <RadioGroupItem value={index.toString()} id={`option-${index}`} data-testid={`radio-option-${index}`} />
                <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                  {option}
                </Label>
                {showResult && index === currentQuestion.correctAnswer && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                {showResult && index === selectedAnswer && index !== currentQuestion.correctAnswer && (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
            ))}
          </div>
        </RadioGroup>

        {showResult && (
          <div className={`mt-6 p-4 rounded-lg ${isCorrect ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
            <p className={`font-semibold mb-2 ${isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
              {isCorrect ? "Correct! ✓" : "Incorrect ✗"}
            </p>
            <p className="text-sm">{currentQuestion.explanation}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {!showResult ? (
            <Button
              onClick={handleSubmit}
              disabled={selectedAnswer === null}
              data-testid="button-check-answer"
            >
              Check Answer
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={currentQuestionIndex === exercises.length - 1}
              data-testid="button-next-question"
            >
              Next Question
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
