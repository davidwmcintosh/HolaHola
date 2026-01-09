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
  Sparkles
} from "lucide-react";

interface DrillItem {
  id: string;
  prompt: string;
  targetText: string;
  audioUrl?: string;
  difficulty?: number;
}

interface DrillResult {
  itemId: string;
  correct: boolean;
  pronunciation?: number;
  attempts: number;
}

interface RhythmDrillProps {
  title: string;
  description?: string;
  items: DrillItem[];
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
          
          {!result && !isActive && (
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <Play className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {result?.pronunciation !== undefined && (
        <div className="mt-2">
          <Progress 
            value={result.pronunciation * 100} 
            className="h-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Pronunciation: {Math.round(result.pronunciation * 100)}%
          </p>
        </div>
      )}
    </div>
  );
}

export function RhythmDrill({
  title,
  description,
  items,
  onComplete,
  className = ''
}: RhythmDrillProps) {
  const [drillState, setDrillState] = useState<DrillState>('idle');
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [results, setResults] = useState<Map<string, DrillResult>>(new Map());
  const [isComplete, setIsComplete] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const completedCount = results.size;
  const correctCount = Array.from(results.values()).filter(r => r.correct).length;
  const progressPercent = items.length > 0 
    ? Math.round((completedCount / items.length) * 100)
    : 0;

  const playItem = useCallback((index: number) => {
    if (index < 0 || index >= items.length) return;
    
    setCurrentIndex(index);
    setDrillState('playing');
    
    setTimeout(() => {
      setDrillState('listening');
      
      setTimeout(() => {
        setDrillState('evaluating');
        
        setTimeout(() => {
          const item = items[index];
          const isCorrect = Math.random() > 0.3;
          const pronunciationScore = 0.6 + Math.random() * 0.4;
          
          setResults(prev => {
            const next = new Map(prev);
            next.set(item.id, {
              itemId: item.id,
              correct: isCorrect,
              pronunciation: pronunciationScore,
              attempts: (prev.get(item.id)?.attempts || 0) + 1
            });
            return next;
          });
          
          setDrillState('result');
          
          setTimeout(() => {
            if (index < items.length - 1) {
              playItem(index + 1);
            } else {
              setDrillState('idle');
              setCurrentIndex(-1);
              setIsComplete(true);
            }
          }, 800);
        }, 500);
      }, 2000);
    }, 1500);
  }, [items]);

  const startDrill = useCallback(() => {
    setResults(new Map());
    setIsComplete(false);
    playItem(0);
  }, [playItem]);

  const resetDrill = useCallback(() => {
    setDrillState('idle');
    setCurrentIndex(-1);
    setResults(new Map());
    setIsComplete(false);
  }, []);

  useEffect(() => {
    if (isComplete && results.size === items.length && onComplete) {
      onComplete(Array.from(results.values()));
    }
  }, [isComplete, results, items.length, onComplete]);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
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
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!isComplete && drillState === 'idle' && completedCount === 0 && (
          <div className="text-center py-6">
            <Music2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Ready to Practice?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Listen and repeat each item. Practice makes perfect!
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
            <div className="flex items-center justify-center gap-2">
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

export default RhythmDrill;
