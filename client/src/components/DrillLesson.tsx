import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Loader2,
  Mic,
  MicOff,
  Trophy,
  Target,
  MessageCircle
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CurriculumDrillItem, UserDrillProgress } from "@shared/schema";

interface DrillItemWithProgress extends CurriculumDrillItem {
  progress: UserDrillProgress | null;
}

interface DrillProgressResponse {
  items: DrillItemWithProgress[];
  stats: {
    totalItems: number;
    attemptedCount: number;
    masteredCount: number;
    completionPercent: number;
  };
}

interface DrillLessonProps {
  lessonId: string;
  language: string;
  lessonName?: string;
  conversationTopic?: string;
  onComplete?: () => void;
  onPracticeConversation?: (topic: string) => void;
}

type DrillMode = 'listen_repeat' | 'number_dictation' | 'translate_speak' | 'matching' | 'fill_blank';

export function DrillLesson({ lessonId, language, lessonName, conversationTopic, onComplete, onPracticeConversation }: DrillLessonProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [cachedAudioUrls, setCachedAudioUrls] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const { data: drillData, isLoading, error } = useQuery<DrillProgressResponse>({
    queryKey: ['/api/drill-progress', lessonId],
  });

  const recordAttemptMutation = useMutation({
    mutationFn: async ({ drillItemId, score, timeSpentMs }: { 
      drillItemId: string; 
      score: number; 
      timeSpentMs: number 
    }) => {
      return await apiRequest("POST", "/api/drill-progress/attempt", {
        drillItemId,
        score,
        timeSpentMs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drill-progress', lessonId] });
    },
  });

  const currentItem = drillData?.items[currentIndex];
  const totalItems = drillData?.stats.totalItems ?? 0;
  const progress = totalItems > 0 ? ((currentIndex) / totalItems) * 100 : 0;

  const playAudio = useCallback(async () => {
    if (!currentItem) return;
    
    setIsPlaying(true);
    
    try {
      let audioUrl = currentItem.audioUrl || cachedAudioUrls[currentItem.id];
      
      if (!audioUrl) {
        const response = await fetch(`/api/drill-audio/${currentItem.id}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to load audio');
        const data = await response.json();
        audioUrl = data.audioUrl;
        if (audioUrl) {
          setCachedAudioUrls(prev => ({ ...prev, [currentItem.id]: audioUrl! }));
        }
      }
      
      if (audioUrl) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => {
          setIsPlaying(false);
          toast({
            title: "Audio Error",
            description: "Could not play the audio. Please try again.",
            variant: "destructive",
          });
        };
        
        await audio.play();
        
        if (!startTime) {
          setStartTime(Date.now());
        }
      }
    } catch (error) {
      setIsPlaying(false);
      console.error('Error playing audio:', error);
    }
  }, [currentItem, cachedAudioUrls, startTime, toast]);

  const checkAnswer = useCallback(() => {
    if (!currentItem) return;
    
    const timeSpentMs = startTime ? Date.now() - startTime : 5000;
    const normalizedAnswer = userAnswer.trim().toLowerCase();
    const normalizedTarget = currentItem.targetText.trim().toLowerCase();
    
    const isAnswerCorrect = normalizedAnswer === normalizedTarget || 
      (currentItem.acceptableAlternatives?.some(
        alt => alt.toLowerCase() === normalizedAnswer
      ) ?? false);
    
    setIsCorrect(isAnswerCorrect);
    setShowResult(true);
    
    const score = isAnswerCorrect ? 1 : 0;
    recordAttemptMutation.mutate({
      drillItemId: currentItem.id,
      score,
      timeSpentMs,
    });
  }, [currentItem, userAnswer, startTime, recordAttemptMutation]);

  const nextItem = useCallback(() => {
    if (currentIndex < totalItems - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer("");
      setShowResult(false);
      setIsCorrect(null);
      setStartTime(null);
    } else {
      toast({
        title: "Lesson Complete!",
        description: `You've finished all ${totalItems} items in this drill.`,
      });
      onComplete?.();
    }
  }, [currentIndex, totalItems, onComplete, toast]);

  const resetItem = useCallback(() => {
    setUserAnswer("");
    setShowResult(false);
    setIsCorrect(null);
    setStartTime(null);
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !drillData || drillData.items.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No drill items available for this lesson.
        </p>
      </Card>
    );
  }

  if (!currentItem) {
    const defaultTopic = conversationTopic || (lessonName ? `Practice using ${lessonName.replace(/Lesson \d+:\s*/i, '')}` : 'Practice what you learned');
    
    return (
      <Card className="p-8 text-center">
        <Trophy className="h-12 w-12 mx-auto text-primary mb-4" />
        <h3 className="text-xl font-semibold mb-2">Drill Complete!</h3>
        <p className="text-muted-foreground mb-4">
          You've completed all items in this drill.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-2">
          <Button onClick={() => setCurrentIndex(0)} variant="outline" data-testid="button-practice-again">
            <RotateCcw className="h-4 w-4 mr-2" />
            Practice Again
          </Button>
          {onPracticeConversation && (
            <Button 
              onClick={() => onPracticeConversation(defaultTopic)}
              data-testid="button-practice-conversation"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Practice in Conversation
            </Button>
          )}
        </div>
        {onPracticeConversation && (
          <p className="text-sm text-muted-foreground mt-4">
            Ready to use what you learned? Start a conversation to practice these phrases in context.
          </p>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="badge-item-count">
            {currentIndex + 1} / {totalItems}
          </Badge>
          <Badge variant="outline" data-testid="badge-drill-type">
            {formatDrillType(currentItem.itemType)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {drillData.stats.masteredCount} mastered
          </span>
        </div>
      </div>
      
      <Progress value={progress} className="h-2" />
      
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {getDrillIcon(currentItem.itemType)}
            {getDrillInstruction(currentItem.itemType)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="text-3xl font-bold text-center" data-testid="text-prompt">
              {currentItem.prompt}
            </div>
            
            <Button
              size="lg"
              variant={isPlaying ? "secondary" : "default"}
              onClick={playAudio}
              disabled={isPlaying}
              className="w-full max-w-xs"
              data-testid="button-play-audio"
            >
              {isPlaying ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Playing...
                </>
              ) : (
                <>
                  <Volume2 className="h-5 w-5 mr-2" />
                  Listen
                </>
              )}
            </Button>
          </div>
          
          {currentItem.itemType === 'listen_repeat' ? (
            <ListenRepeatMode
              key={currentItem.id}
              onCorrect={() => {
                const timeSpentMs = startTime ? Date.now() - startTime : 5000;
                setIsCorrect(true);
                setShowResult(true);
                recordAttemptMutation.mutate({
                  drillItemId: currentItem.id,
                  score: 1,
                  timeSpentMs,
                });
              }}
              onIncorrect={() => {
                const timeSpentMs = startTime ? Date.now() - startTime : 5000;
                setIsCorrect(false);
                setShowResult(true);
                recordAttemptMutation.mutate({
                  drillItemId: currentItem.id,
                  score: 0,
                  timeSpentMs,
                });
              }}
              onNext={nextItem}
              showResult={showResult}
              isCorrect={isCorrect}
              targetText={currentItem.targetText}
            />
          ) : (
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Type your answer..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                disabled={showResult}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !showResult && userAnswer.trim()) {
                    checkAnswer();
                  }
                }}
                className="text-lg text-center"
                data-testid="input-answer"
              />
              
              {!showResult ? (
                <Button 
                  onClick={checkAnswer} 
                  disabled={!userAnswer.trim()}
                  className="w-full"
                  data-testid="button-check"
                >
                  Check Answer
                </Button>
              ) : (
                <ResultDisplay
                  isCorrect={isCorrect}
                  targetText={currentItem.targetText}
                  userAnswer={userAnswer}
                  onNext={nextItem}
                  onRetry={resetItem}
                />
              )}
            </div>
          )}
          
          {currentItem.hints && currentItem.hints.length > 0 && !showResult && (
            <HintSection hints={currentItem.hints} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ListenRepeatMode({ 
  onCorrect,
  onIncorrect,
  onNext,
  showResult, 
  isCorrect, 
  targetText 
}: { 
  onCorrect: () => void;
  onIncorrect: () => void;
  onNext: () => void;
  showResult: boolean;
  isCorrect: boolean | null;
  targetText: string;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  
  const handleRecordToggle = () => {
    if (isRecording) {
      setIsRecording(false);
      setHasRecorded(true);
    } else {
      setIsRecording(true);
    }
  };

  if (showResult) {
    return (
      <div className="text-center space-y-4">
        <div className={`p-4 rounded-lg ${
          isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
        }`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            {isCorrect ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" />
            )}
            <span className={`font-medium ${
              isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            }`}>
              {isCorrect ? 'Great pronunciation!' : 'Keep practicing!'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Target: <span className="font-medium">{targetText}</span>
          </p>
        </div>
        <Button onClick={onNext} className="w-full max-w-xs">
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    );
  }

  if (hasRecorded) {
    return (
      <div className="flex flex-col items-center space-y-4">
        <p className="text-muted-foreground text-center">
          How did you do? Compare your pronunciation to the audio.
        </p>
        <div className="flex gap-3 w-full max-w-xs">
          <Button
            size="lg"
            variant="outline"
            onClick={onIncorrect}
            className="flex-1"
            data-testid="button-self-eval-incorrect"
          >
            <XCircle className="h-5 w-5 mr-2" />
            Needs Work
          </Button>
          <Button
            size="lg"
            onClick={onCorrect}
            className="flex-1"
            data-testid="button-self-eval-correct"
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Got It
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHasRecorded(false)}
          className="text-muted-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <p className="text-muted-foreground text-center">
        Listen to the audio, then repeat what you hear
      </p>
      <Button
        size="lg"
        variant={isRecording ? "destructive" : "outline"}
        onClick={handleRecordToggle}
        className="w-full max-w-xs"
        data-testid="button-record"
      >
        {isRecording ? (
          <>
            <MicOff className="h-5 w-5 mr-2" />
            I'm Done
          </>
        ) : (
          <>
            <Mic className="h-5 w-5 mr-2" />
            Start Speaking
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        Practice speaking, then self-evaluate your pronunciation
      </p>
    </div>
  );
}

function ResultDisplay({ 
  isCorrect, 
  targetText, 
  userAnswer, 
  onNext, 
  onRetry 
}: {
  isCorrect: boolean | null;
  targetText: string;
  userAnswer: string;
  onNext: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg ${
        isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
      }`}>
        <div className="flex items-center justify-center gap-2 mb-2">
          {isCorrect ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : (
            <XCircle className="h-6 w-6 text-red-600" />
          )}
          <span className={`font-medium ${
            isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
          }`}>
            {isCorrect ? 'Correct!' : 'Not quite right'}
          </span>
        </div>
        {!isCorrect && (
          <div className="text-sm space-y-1">
            <p className="text-muted-foreground">
              Your answer: <span className="line-through">{userAnswer}</span>
            </p>
            <p className="text-muted-foreground">
              Correct answer: <span className="font-medium text-foreground">{targetText}</span>
            </p>
          </div>
        )}
      </div>
      
      <div className="flex gap-2">
        {!isCorrect && (
          <Button variant="outline" onClick={onRetry} className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
        <Button onClick={onNext} className={isCorrect ? "w-full" : "flex-1"}>
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function HintSection({ hints }: { hints: string[] }) {
  const [showHint, setShowHint] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);

  return (
    <div className="pt-4 border-t">
      {!showHint ? (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowHint(true)}
          className="text-muted-foreground"
          data-testid="button-show-hint"
        >
          Need a hint?
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground italic">
            Hint: {hints[hintIndex]}
          </p>
          {hintIndex < hints.length - 1 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setHintIndex(prev => prev + 1)}
              data-testid="button-next-hint"
            >
              Another hint
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function formatDrillType(type: DrillMode): string {
  const labels: Record<DrillMode, string> = {
    listen_repeat: 'Listen & Repeat',
    number_dictation: 'Number Dictation',
    translate_speak: 'Translate & Speak',
    matching: 'Matching',
    fill_blank: 'Fill in the Blank',
  };
  return labels[type] || type;
}

function getDrillIcon(type: DrillMode) {
  const icons: Record<DrillMode, JSX.Element> = {
    listen_repeat: <Volume2 className="h-5 w-5" />,
    number_dictation: <Target className="h-5 w-5" />,
    translate_speak: <Mic className="h-5 w-5" />,
    matching: <CheckCircle2 className="h-5 w-5" />,
    fill_blank: <CheckCircle2 className="h-5 w-5" />,
  };
  return icons[type] || null;
}

function getDrillInstruction(type: DrillMode): string {
  const instructions: Record<DrillMode, string> = {
    listen_repeat: 'Listen and repeat after the audio',
    number_dictation: 'Type the number you hear',
    translate_speak: 'Translate and speak your answer',
    matching: 'Match the correct answer',
    fill_blank: 'Fill in the missing word',
  };
  return instructions[type] || 'Complete the exercise';
}
