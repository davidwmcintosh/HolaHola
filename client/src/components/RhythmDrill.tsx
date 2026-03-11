import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Mic,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Music2,
  Sparkles,
  MicOff,
} from "lucide-react";

interface DrillItem {
  id: string;
  prompt: string;
  targetText: string;
  audioUrl?: string;
  difficulty?: number;
  category?: string;
  focusPhoneme?: string;
}

interface DrillResult {
  itemId: string;
  correct: boolean;
  pronunciation?: number;
  attempts: number;
  feedback?: string;
}

interface DrillGroup {
  id: string;
  name: string;
  description?: string;
  items: DrillItem[];
}

interface RhythmDrillProps {
  title: string;
  description?: string;
  items: DrillItem[];
  language?: string;
  onComplete?: (results: DrillResult[]) => void;
  className?: string;
}

type DrillState = 'idle' | 'playing' | 'listening' | 'evaluating' | 'result';

function DrillItemCard({
  item,
  state,
  result,
  isActive,
  onPlay
}: {
  item: DrillItem;
  state: DrillState;
  result?: DrillResult;
  isActive: boolean;
  onPlay: () => void;
}) {
  const getStatusColor = () => {
    if (!result) return 'bg-muted/50';
    if (result.correct) return 'bg-green-500/10 border-green-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  const getStatusIcon = () => {
    if (!result) return null;
    if (result.correct) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div
      className={`
        relative p-3 rounded-lg border transition-all
        ${getStatusColor()}
        ${isActive ? 'ring-2 ring-primary ring-offset-2' : ''}
        ${!result && !isActive ? 'hover-elevate cursor-pointer' : ''}
      `}
      onClick={() => !result && !isActive && onPlay()}
      data-testid={`drill-item-${item.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold">{item.prompt}</p>
          <p className="text-sm text-muted-foreground truncate">{item.targetText}</p>
        </div>

        <div className="flex items-center gap-2">
          {getStatusIcon()}

          {isActive && state === 'playing' && (
            <div className="flex items-center gap-1">
              <Volume2 className="h-4 w-4 text-primary animate-pulse" />
            </div>
          )}

          {isActive && state === 'listening' && (
            <div className="flex items-center gap-1">
              <Mic className="h-4 w-4 text-red-500 animate-pulse" />
            </div>
          )}

          {isActive && state === 'evaluating' && (
            <div className="flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            </div>
          )}

          {!result && !isActive && (
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <Play className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {result?.pronunciation !== undefined && (
        <div className="mt-2 space-y-1">
          <Progress
            value={result.pronunciation * 100}
            className="h-1.5"
          />
          <p className="text-xs text-muted-foreground">
            Pronunciation: {Math.round(result.pronunciation * 100)}%
          </p>
          {result.feedback && (
            <p className="text-xs text-muted-foreground italic">
              {result.feedback}
            </p>
          )}
        </div>
      )}

      {item.focusPhoneme && !result && (
        <div className="mt-2">
          <Badge variant="outline" className="text-xs">
            Focus: {item.focusPhoneme}
          </Badge>
        </div>
      )}
    </div>
  );
}

async function scoreWithDeepgram(
  audioBlob: Blob,
  targetText: string,
  language: string
): Promise<{ score: number; transcript: string; matched: boolean }> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('targetWord', targetText);
  formData.append('language', language);

  const res = await fetch('/api/pronunciation/score', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!res.ok) throw new Error(`Scoring API error: ${res.status}`);
  return res.json();
}

export function RhythmDrill({
  title,
  description,
  items,
  language = 'english',
  onComplete,
  className = ''
}: RhythmDrillProps) {
  const [drillState, setDrillState] = useState<DrillState>('idle');
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [results, setResults] = useState<Map<string, DrillResult>>(new Map());
  const [isComplete, setIsComplete] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isRunningRef = useRef(false);

  const completedCount = results.size;
  const correctCount = Array.from(results.values()).filter(r => r.correct).length;
  const progressPercent = items.length > 0
    ? Math.round((completedCount / items.length) * 100)
    : 0;

  const generateFeedback = useCallback((score: number, item: DrillItem, matched: boolean): string => {
    if (!matched) {
      return "Try saying the word more clearly — listen again and repeat.";
    }
    if (score >= 0.9) {
      return "Excellent! Perfect rhythm and pronunciation.";
    } else if (score >= 0.8) {
      return "Great job! Minor improvements possible.";
    } else if (score >= 0.7) {
      if (item.focusPhoneme) {
        return `Good effort! Focus on the "${item.focusPhoneme}" sound.`;
      }
      return "Good effort! Try slowing down a bit.";
    } else if (score >= 0.6) {
      if (item.focusPhoneme) {
        return `Practice the "${item.focusPhoneme}" sound more.`;
      }
      return "Keep practicing! Listen to the rhythm carefully.";
    } else {
      return "Try again — listen closely and repeat slowly.";
    }
  }, []);

  const recordAudio = useCallback(async (durationMs: number): Promise<Blob | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      return new Promise((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          resolve(blob.size > 100 ? blob : null);
        };

        recorder.start();
        setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, durationMs);
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicError('Microphone permission denied. Please allow microphone access and try again.');
      } else {
        setMicError('Could not access microphone. Check your device settings.');
      }
      return null;
    }
  }, []);

  const playItem = useCallback(async (index: number) => {
    if (index < 0 || index >= items.length || !isRunningRef.current) return;

    const item = items[index];
    setCurrentIndex(index);
    setDrillState('playing');

    // Play audio if available
    if (item.audioUrl) {
      audioRef.current = new Audio(item.audioUrl);
      try {
        await audioRef.current.play();
        await new Promise<void>(resolve => {
          if (!audioRef.current) { resolve(); return; }
          audioRef.current.onended = () => resolve();
          audioRef.current.onerror = () => resolve();
          setTimeout(resolve, 5000);
        });
      } catch {
        await new Promise(r => setTimeout(r, 1000));
      }
    } else {
      await new Promise(r => setTimeout(r, 1200));
    }

    if (!isRunningRef.current) return;

    setDrillState('listening');

    const audioBlob = await recordAudio(2500);

    if (!isRunningRef.current) return;

    setDrillState('evaluating');

    let pronunciationScore = 0.5;
    let matched = false;

    if (audioBlob) {
      try {
        const res = await scoreWithDeepgram(audioBlob, item.targetText, language);
        pronunciationScore = res.score;
        matched = res.matched;
      } catch {
        pronunciationScore = 0.5;
        matched = true;
      }
    } else if (micError) {
      pronunciationScore = 0.5;
      matched = true;
    }

    if (!isRunningRef.current) return;

    const isCorrect = pronunciationScore >= 0.65;
    const feedback = generateFeedback(pronunciationScore, item, matched);

    setResults(prev => {
      const next = new Map(prev);
      next.set(item.id, {
        itemId: item.id,
        correct: isCorrect,
        pronunciation: pronunciationScore,
        attempts: (prev.get(item.id)?.attempts || 0) + 1,
        feedback,
      });
      return next;
    });

    setDrillState('result');

    await new Promise(r => setTimeout(r, 600));

    if (!isRunningRef.current) return;

    if (index < items.length - 1) {
      playItem(index + 1);
    } else {
      setDrillState('idle');
      setCurrentIndex(-1);
      setIsComplete(true);
    }
  }, [items, language, generateFeedback, recordAudio, micError]);

  const startDrill = useCallback(() => {
    setResults(new Map());
    setIsComplete(false);
    setMicError(null);
    isRunningRef.current = true;
    playItem(0);
  }, [playItem]);

  const resetDrill = useCallback(() => {
    isRunningRef.current = false;
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setDrillState('idle');
    setCurrentIndex(-1);
    setResults(new Map());
    setIsComplete(false);
    setMicError(null);
  }, []);

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (isComplete && results.size === items.length && onComplete) {
      onComplete(Array.from(results.values()));
    }
  }, [isComplete, results, items.length, onComplete]);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-center gap-2">
            <Music2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>

          {completedCount > 0 && (
            <Badge variant="outline">
              {correctCount}/{completedCount} correct
            </Badge>
          )}
        </div>

        {description && (
          <p className="text-sm text-muted-foreground mt-1">
            {description}
          </p>
        )}

        {micError && (
          <div className="flex items-center gap-2 mt-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md p-2">
            <MicOff className="h-4 w-4 shrink-0" />
            <span>{micError} Scores are approximated.</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {!isComplete && drillState === 'idle' && completedCount === 0 && (
          <div className="text-center py-6">
            <Music2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Ready to Practice?</h3>
            <p className="text-sm text-muted-foreground mb-1">
              Listen to each word, then say it aloud when the mic appears.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Microphone access required for pronunciation scoring.
            </p>
            <Button
              onClick={startDrill}
              data-testid="button-start-rhythm-drill"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Rhythm Drill
            </Button>
          </div>
        )}

        {(drillState !== 'idle' || completedCount > 0) && (
          <>
            <div className="flex items-center gap-3">
              <Progress value={progressPercent} className="flex-1 h-2" />
              <span className="text-sm font-medium">{progressPercent}%</span>
            </div>

            <div className="grid gap-2">
              {items.map((item, index) => (
                <DrillItemCard
                  key={item.id}
                  item={item}
                  state={drillState}
                  result={results.get(item.id)}
                  isActive={index === currentIndex}
                  onPlay={() => {
                    if (drillState === 'idle' && !results.has(item.id)) {
                      isRunningRef.current = true;
                      playItem(index);
                    }
                  }}
                />
              ))}
            </div>
          </>
        )}

        {isComplete && (
          <div className="text-center py-4 bg-gradient-to-r from-primary/10 via-primary/5 to-background rounded-lg">
            <Sparkles className="h-8 w-8 text-primary mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Drill Complete!</h3>
            <p className="text-sm text-muted-foreground mb-3">
              You got {correctCount} out of {items.length} correct
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={resetDrill}
                data-testid="button-retry-drill"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button data-testid="button-next-drill">
                Next Section
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {drillState !== 'idle' && !isComplete && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetDrill}
            >
              <Pause className="h-4 w-4 mr-2" />
              Stop Drill
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface GroupedRhythmDrillProps {
  title: string;
  groups: DrillGroup[];
  language?: string;
  onComplete?: (results: DrillResult[]) => void;
  className?: string;
}

export function GroupedRhythmDrill({
  title,
  groups,
  language = 'english',
  onComplete,
  className = ''
}: GroupedRhythmDrillProps) {
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [groupResults, setGroupResults] = useState<Map<string, DrillResult[]>>(new Map());

  const currentGroup = groups[currentGroupIndex];
  const isLastGroup = currentGroupIndex === groups.length - 1;
  const allComplete = groupResults.size === groups.length;

  const handleGroupComplete = useCallback((results: DrillResult[]) => {
    setGroupResults(prev => {
      const next = new Map(prev);
      next.set(currentGroup.id, results);
      return next;
    });
  }, [currentGroup]);

  const handleNextGroup = useCallback(() => {
    if (!isLastGroup) {
      setCurrentGroupIndex(prev => prev + 1);
    } else if (onComplete) {
      const allResults = Array.from(groupResults.values()).flat();
      onComplete(allResults);
    }
  }, [isLastGroup, onComplete, groupResults]);

  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);
  const completedItems = Array.from(groupResults.values()).reduce(
    (acc, results) => acc + results.length,
    0
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Group {currentGroupIndex + 1} of {groups.length}
            </p>
          </div>
          <Badge variant="outline">
            {completedItems}/{totalItems} items
          </Badge>
        </div>

        <Progress
          value={(completedItems / totalItems) * 100}
          className="h-2 mt-3"
        />
      </CardHeader>

      <CardContent>
        {currentGroup && (
          <RhythmDrill
            title={currentGroup.name}
            description={currentGroup.description}
            items={currentGroup.items}
            language={language}
            onComplete={handleGroupComplete}
          />
        )}

        {groupResults.has(currentGroup?.id) && (
          <div className="flex justify-center mt-4">
            <Button onClick={handleNextGroup} data-testid="button-next-group">
              {isLastGroup ? 'Complete All Groups' : 'Next Group'}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RhythmDrill;
