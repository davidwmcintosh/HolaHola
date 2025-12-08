/**
 * Whiteboard - Tutor-controlled visual teaching aid
 * 
 * Philosophy: "We provide tools, the tutor teaches"
 * The AI tutor decides WHEN and WHAT to display - students don't toggle this.
 * 
 * Phase 2 Extensions:
 * - Image items with visual vocabulary
 * - Drill items with interactive exercises
 * - Pronunciation feedback with score display
 * 
 * Behavior:
 * - Content persists until tutor explicitly sends [CLEAR]
 * - Multiple items stack vertically (new items appear at bottom)
 * - Each item type has its own visual treatment
 * - Mobile: Overlay at bottom of screen (above subtitles)
 * - Desktop: Same positioning, larger text
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { 
  Pencil, 
  Volume2, 
  ArrowLeftRight, 
  X, 
  ImageIcon, 
  Mic, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Star,
  Trophy,
  Target,
  BookOpen,
  Table2,
  Languages,
  PenTool,
  Network,
  Link2,
  RotateCcw,
  Globe,
  Utensils,
  HandMetal,
  Calendar,
  Users,
  Play,
  Pause,
  Square,
  MapPin,
  Sparkles,
  ListChecks,
  RefreshCw,
  AlertTriangle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { synthesizeSpeech } from "@/lib/restVoiceApi";
import type HanziWriter from "hanzi-writer";
import type { 
  WhiteboardItem, 
  WhiteboardItemType,
  ImageItem,
  DrillItem,
  PronunciationItem,
  ContextItem,
  GrammarTableItem,
  ReadingItem,
  StrokeItem,
  WordMapItem,
  CultureItem,
  PlayItem,
  ScenarioItem,
  SummaryItem,
  ErrorPatternsItem,
  VocabularyTimelineItem,
  DrillState,
  MatchPair,
} from "@shared/whiteboard-types";
import { isImageItem, isDrillItem, isPronunciationItem, isContextItem, isGrammarTableItem, isReadingItem, isStrokeItem, isWordMapItem, isCultureItem, isPlayItem, isScenarioItem, isSummaryItem, isErrorPatternsItem, isVocabularyTimelineItem, isMatchingDrill, isFillBlankDrill, isSentenceOrderDrill, getDrillInstructions } from "@shared/whiteboard-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { GripVertical } from "lucide-react";

interface WhiteboardProps {
  items: WhiteboardItem[];
  onClear?: () => void;
  onDrillResponse?: (drillId: string, response: string) => void;
  onDrillStart?: (drillId: string) => void;
  language?: string;
}

const getItemIcon = (type: WhiteboardItemType) => {
  switch (type) {
    case "write":
      return <Pencil className="h-4 w-4" />;
    case "phonetic":
      return <Volume2 className="h-4 w-4" />;
    case "compare":
      return <ArrowLeftRight className="h-4 w-4" />;
    case "image":
      return <ImageIcon className="h-4 w-4" />;
    case "drill":
      return <Target className="h-4 w-4" />;
    case "pronunciation":
      return <Mic className="h-4 w-4" />;
    case "context":
      return <BookOpen className="h-4 w-4" />;
    case "grammar_table":
      return <Table2 className="h-4 w-4" />;
    case "reading":
      return <Languages className="h-4 w-4" />;
    case "stroke":
      return <PenTool className="h-4 w-4" />;
    case "word_map":
      return <Network className="h-4 w-4" />;
    case "culture":
      return <Globe className="h-4 w-4" />;
    case "play":
      return <Volume2 className="h-4 w-4" />;
    case "scenario":
      return <MapPin className="h-4 w-4" />;
    case "summary":
      return <ListChecks className="h-4 w-4" />;
    case "error_patterns":
      return <AlertTriangle className="h-4 w-4" />;
    case "vocabulary_timeline":
      return <TrendingUp className="h-4 w-4" />;
    default:
      return null;
  }
};

const getItemStyle = (type: WhiteboardItemType): string => {
  switch (type) {
    case "write":
      return "bg-primary/10 border-primary/30 text-foreground";
    case "phonetic":
      return "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300 font-mono";
    case "compare":
      return "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300";
    case "image":
      return "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300";
    case "drill":
      return "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300";
    case "pronunciation":
      return "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300";
    case "context":
      return "bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300";
    case "grammar_table":
      return "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300";
    case "reading":
      return "bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-300";
    case "stroke":
      return "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300";
    case "word_map":
      return "bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300";
    case "culture":
      return "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300";
    case "play":
      return "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300";
    case "scenario":
      return "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300";
    case "summary":
      return "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300";
    case "error_patterns":
      return "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300";
    case "vocabulary_timeline":
      return "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300";
    default:
      return "bg-muted border-border text-foreground";
  }
};

const getScoreColor = (score: number): string => {
  if (score >= 90) return "text-green-600 dark:text-green-400";
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 60) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
};

const getScoreIcon = (score: number) => {
  if (score >= 90) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (score >= 80) return <Star className="h-5 w-5 text-emerald-500" />;
  if (score >= 70) return <CheckCircle2 className="h-5 w-5 text-blue-500" />;
  return <Target className="h-5 w-5 text-orange-500" />;
};

const getDrillStateIcon = (state: DrillState) => {
  switch (state) {
    case "waiting":
      return <Mic className="h-5 w-5 animate-pulse" />;
    case "listening":
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    case "evaluating":
      return <Loader2 className="h-5 w-5 animate-spin text-violet-500" />;
    case "complete":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    default:
      return null;
  }
};

interface ImageItemDisplayProps {
  item: ImageItem;
  index: number;
}

const ImageItemDisplay = ({ item, index }: ImageItemDisplayProps) => {
  const { data } = item;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-2 p-4 rounded-lg border bg-emerald-500/10 border-emerald-500/30"
      data-testid={`whiteboard-item-image-${index}`}
    >
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 opacity-60" />
        <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
          {data.word}
        </span>
      </div>
      
      {data.isLoading ? (
        <div className="flex items-center justify-center h-32 bg-muted/50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data.imageUrl ? (
        <img 
          src={data.imageUrl} 
          alt={data.description}
          className="w-full h-32 object-cover rounded-lg"
          data-testid={`image-vocab-${data.word}`}
        />
      ) : (
        <div className="flex items-center justify-center h-32 bg-muted/50 rounded-lg text-muted-foreground text-sm">
          {data.description}
        </div>
      )}
      
      {data.description && data.description !== data.word && (
        <span className="text-sm text-muted-foreground italic">
          {data.description}
        </span>
      )}
    </motion.div>
  );
};

interface DrillItemDisplayProps {
  item: DrillItem;
  index: number;
  onResponse?: (drillId: string, response: string) => void;
  onStart?: (drillId: string) => void;
}

const DrillItemDisplay = ({ item, index, onResponse, onStart }: DrillItemDisplayProps) => {
  const { data } = item;
  const instructions = getDrillInstructions(data.drillType);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-violet-500/10 border-violet-500/30"
      data-testid={`whiteboard-item-drill-${index}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300 uppercase tracking-wide">
            {data.drillType.replace('_', ' ')} Drill
          </span>
        </div>
        {getDrillStateIcon(data.state)}
      </div>
      
      <p className="text-xs text-muted-foreground">{instructions}</p>
      
      <div className="text-xl md:text-2xl font-bold text-center py-3 bg-background/50 rounded-lg">
        {data.prompt}
      </div>
      
      {data.state === 'waiting' && onStart && (
        <Button 
          onClick={() => onStart(item.id!)}
          className="w-full"
          variant="outline"
          data-testid={`button-start-drill-${index}`}
        >
          <Mic className="h-4 w-4 mr-2" />
          Start Speaking
        </Button>
      )}
      
      {data.state === 'listening' && (
        <div className="text-center text-sm text-blue-600 dark:text-blue-400 animate-pulse">
          Listening...
        </div>
      )}
      
      {data.state === 'evaluating' && (
        <div className="text-center text-sm text-violet-600 dark:text-violet-400">
          Evaluating your response...
        </div>
      )}
      
      {data.state === 'complete' && (
        <div className="flex flex-col gap-2">
          {data.studentResponse && (
            <div className="text-sm text-muted-foreground">
              You said: <span className="font-medium">{data.studentResponse}</span>
            </div>
          )}
          
          <div className={`flex items-center gap-2 ${data.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {data.isCorrect ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <span className="font-medium">
              {data.isCorrect ? 'Great job!' : 'Keep practicing!'}
            </span>
          </div>
          
          {data.feedback && (
            <p className="text-sm text-muted-foreground">{data.feedback}</p>
          )}
        </div>
      )}
    </motion.div>
  );
};

interface MatchDrillDisplayProps {
  item: DrillItem;
  index: number;
  onMatchComplete?: (drillId: string, success: boolean) => void;
}

const MatchDrillDisplay = ({ item, index, onMatchComplete }: MatchDrillDisplayProps) => {
  const { data } = item;
  const pairs = data.pairs || [];
  const shuffledRightIds = data.shuffledRightIds || [];
  
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<{ leftId: string; rightId: string } | null>(null);
  const [attempts, setAttempts] = useState(0);
  
  const isComplete = matchedIds.size === pairs.length;
  const progress = pairs.length > 0 ? (matchedIds.size / pairs.length) * 100 : 0;
  
  const handleLeftClick = useCallback((pairId: string) => {
    if (matchedIds.has(pairId)) return;
    setWrongPair(null);
    setSelectedLeftId(selectedLeftId === pairId ? null : pairId);
  }, [selectedLeftId, matchedIds]);
  
  const handleRightClick = useCallback((pairId: string) => {
    if (!selectedLeftId || matchedIds.has(pairId)) return;
    
    setAttempts(prev => prev + 1);
    
    if (selectedLeftId === pairId) {
      setMatchedIds(prev => {
        const newSet = new Set(prev);
        newSet.add(pairId);
        return newSet;
      });
      setSelectedLeftId(null);
      setWrongPair(null);
      
      if (matchedIds.size + 1 === pairs.length && onMatchComplete) {
        onMatchComplete(item.id!, true);
      }
    } else {
      setWrongPair({ leftId: selectedLeftId, rightId: pairId });
      setTimeout(() => setWrongPair(null), 800);
    }
  }, [selectedLeftId, matchedIds, pairs.length, item.id, onMatchComplete]);
  
  const handleReset = useCallback(() => {
    setSelectedLeftId(null);
    setMatchedIds(new Set());
    setWrongPair(null);
    setAttempts(0);
  }, []);
  
  const getPairById = useCallback((id: string) => pairs.find(p => p.id === id), [pairs]);
  
  const sortedRightPairs = useMemo(() => {
    return shuffledRightIds.map(id => getPairById(id)).filter(Boolean) as MatchPair[];
  }, [shuffledRightIds, getPairById]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-cyan-500/10 border-cyan-500/30"
      data-testid={`whiteboard-item-match-drill-${index}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <span className="text-sm font-medium text-cyan-700 dark:text-cyan-300 uppercase tracking-wide">
            Match Drill
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <span className="text-xs text-muted-foreground">
              {matchedIds.size}/{pairs.length}
            </span>
          )}
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Tap an item on the left, then tap its match on the right
      </p>
      
      <Progress value={progress} className="h-1.5" />
      
      {isComplete ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-3 py-4"
        >
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Trophy className="h-6 w-6" />
            <span className="text-lg font-bold">All matched!</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Completed in {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
          </p>
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            data-testid={`button-reset-match-${index}`}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            {pairs.map((pair) => {
              const isMatched = matchedIds.has(pair.id);
              const isSelected = selectedLeftId === pair.id;
              const isWrong = wrongPair?.leftId === pair.id;
              
              return (
                <motion.button
                  key={pair.id}
                  onClick={() => handleLeftClick(pair.id)}
                  disabled={isMatched}
                  animate={isWrong ? { x: [-4, 4, -4, 4, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className={`
                    px-3 py-2 rounded-md text-sm font-medium text-left transition-all
                    ${isMatched 
                      ? 'bg-green-500/20 text-green-700 dark:text-green-300 line-through opacity-60' 
                      : isSelected
                        ? 'bg-cyan-500/30 text-cyan-800 dark:text-cyan-200 ring-2 ring-cyan-500'
                        : isWrong
                          ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                          : 'bg-background/80 hover:bg-cyan-500/15'
                    }
                  `}
                  data-testid={`button-match-left-${pair.id}`}
                >
                  {pair.left}
                </motion.button>
              );
            })}
          </div>
          
          <div className="flex flex-col gap-2">
            {sortedRightPairs.map((pair) => {
              const isMatched = matchedIds.has(pair.id);
              const isWrong = wrongPair?.rightId === pair.id;
              const canSelect = selectedLeftId && !isMatched;
              
              return (
                <motion.button
                  key={pair.id}
                  onClick={() => handleRightClick(pair.id)}
                  disabled={isMatched || !selectedLeftId}
                  animate={isWrong ? { x: [-4, 4, -4, 4, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className={`
                    px-3 py-2 rounded-md text-sm font-medium text-left transition-all
                    ${isMatched 
                      ? 'bg-green-500/20 text-green-700 dark:text-green-300 line-through opacity-60' 
                      : isWrong
                        ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                        : canSelect
                          ? 'bg-background/80 hover:bg-cyan-500/15 cursor-pointer'
                          : 'bg-background/80 opacity-50 cursor-not-allowed'
                    }
                  `}
                  data-testid={`button-match-right-${pair.id}`}
                >
                  {pair.right}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

interface FillBlankDrillDisplayProps {
  item: DrillItem;
  index: number;
  onComplete?: (drillId: string, isCorrect: boolean) => void;
}

const FillBlankDrillDisplay = ({ item, index, onComplete }: FillBlankDrillDisplayProps) => {
  const { data } = item;
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  
  const hasOptions = data.options && data.options.length > 0;
  const instructions = getDrillInstructions(data.drillType);
  
  const handleSubmit = useCallback(() => {
    const answer = hasOptions ? selectedAnswer : textInput.trim();
    const correct = answer.toLowerCase() === data.correctAnswer?.toLowerCase();
    setIsCorrect(correct);
    setIsSubmitted(true);
    if (onComplete) {
      onComplete(item.id!, correct);
    }
  }, [selectedAnswer, textInput, hasOptions, data.correctAnswer, item.id, onComplete]);
  
  const handleReset = useCallback(() => {
    setSelectedAnswer('');
    setTextInput('');
    setIsSubmitted(false);
    setIsCorrect(null);
  }, []);
  
  const renderBlankedText = () => {
    const text = data.blankedText || data.prompt;
    const parts = text.split('___');
    
    return (
      <div className="text-lg md:text-xl font-medium text-center py-3 bg-background/50 rounded-lg flex flex-wrap items-center justify-center gap-1">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <span className={`inline-block min-w-[80px] mx-1 px-2 py-1 rounded border-2 border-dashed ${
                isSubmitted 
                  ? isCorrect 
                    ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300'
                    : 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300'
                  : 'border-violet-500/50'
              }`}>
                {isSubmitted 
                  ? (hasOptions ? selectedAnswer : textInput) || '___'
                  : hasOptions 
                    ? (selectedAnswer || '___')
                    : (textInput || '___')
                }
              </span>
            )}
          </span>
        ))}
      </div>
    );
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-violet-500/10 border-violet-500/30"
      data-testid={`whiteboard-item-fill-blank-${index}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300 uppercase tracking-wide">
            Fill in the Blank
          </span>
        </div>
        {isSubmitted && (
          isCorrect 
            ? <CheckCircle2 className="h-5 w-5 text-green-500" />
            : <XCircle className="h-5 w-5 text-red-500" />
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">{instructions}</p>
      
      {renderBlankedText()}
      
      {!isSubmitted ? (
        <div className="flex flex-col gap-3">
          {hasOptions ? (
            <Select value={selectedAnswer} onValueChange={setSelectedAnswer}>
              <SelectTrigger className="w-full" data-testid={`select-fill-blank-${index}`}>
                <SelectValue placeholder="Choose an answer..." />
              </SelectTrigger>
              <SelectContent>
                {data.options?.map((option, i) => (
                  <SelectItem key={i} value={option} data-testid={`option-${option}`}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your answer..."
              className="text-center"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              data-testid={`input-fill-blank-${index}`}
            />
          )}
          
          <Button
            onClick={handleSubmit}
            disabled={hasOptions ? !selectedAnswer : !textInput.trim()}
            className="w-full"
            data-testid={`button-submit-fill-blank-${index}`}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Check Answer
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className={`flex items-center gap-2 ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isCorrect ? (
              <>
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Correct!</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5" />
                <span className="font-medium">
                  The answer is: <strong>{data.correctAnswer}</strong>
                </span>
              </>
            )}
          </div>
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            data-testid={`button-reset-fill-blank-${index}`}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      )}
    </motion.div>
  );
};

interface SentenceOrderDrillDisplayProps {
  item: DrillItem;
  index: number;
  onComplete?: (drillId: string, isCorrect: boolean) => void;
}

const SentenceOrderDrillDisplay = ({ item, index, onComplete }: SentenceOrderDrillDisplayProps) => {
  const { data } = item;
  const [currentOrder, setCurrentOrder] = useState<string[]>(data.currentOrder || data.words || []);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const instructions = getDrillInstructions(data.drillType);
  
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    setCurrentOrder(prev => {
      const newOrder = [...prev];
      const draggedItem = newOrder[draggedIndex];
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(index, 0, draggedItem);
      return newOrder;
    });
    setDraggedIndex(index);
  }, [draggedIndex]);
  
  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);
  
  const moveWord = useCallback((fromIndex: number, direction: 'left' | 'right') => {
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= currentOrder.length) return;
    
    setCurrentOrder(prev => {
      const newOrder = [...prev];
      [newOrder[fromIndex], newOrder[toIndex]] = [newOrder[toIndex], newOrder[fromIndex]];
      return newOrder;
    });
  }, [currentOrder.length]);
  
  const handleSubmit = useCallback(() => {
    const correct = JSON.stringify(currentOrder) === JSON.stringify(data.correctOrder);
    setIsCorrect(correct);
    setIsSubmitted(true);
    if (onComplete) {
      onComplete(item.id!, correct);
    }
  }, [currentOrder, data.correctOrder, item.id, onComplete]);
  
  const handleReset = useCallback(() => {
    setCurrentOrder(data.words || []);
    setIsSubmitted(false);
    setIsCorrect(null);
  }, [data.words]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-indigo-500/10 border-indigo-500/30"
      data-testid={`whiteboard-item-sentence-order-${index}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
            Sentence Builder
          </span>
        </div>
        {isSubmitted && (
          isCorrect 
            ? <CheckCircle2 className="h-5 w-5 text-green-500" />
            : <XCircle className="h-5 w-5 text-red-500" />
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">{instructions}</p>
      
      <div className="flex flex-wrap gap-2 p-3 bg-background/50 rounded-lg min-h-[60px] justify-center">
        {currentOrder.map((word, i) => (
          <motion.div
            key={`${word}-${i}`}
            draggable={!isSubmitted}
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragEnd={handleDragEnd}
            layout
            className={`
              flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium
              ${isSubmitted 
                ? isCorrect
                  ? 'bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30'
                  : 'bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30'
                : draggedIndex === i
                  ? 'bg-indigo-500/30 text-indigo-800 dark:text-indigo-200 ring-2 ring-indigo-500 cursor-grabbing'
                  : 'bg-background border border-indigo-500/30 cursor-grab hover:bg-indigo-500/10'
              }
            `}
            data-testid={`word-${i}-${word}`}
          >
            {!isSubmitted && (
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            )}
            {word}
          </motion.div>
        ))}
      </div>
      
      {!isSubmitted && (
        <div className="flex flex-wrap gap-1 justify-center text-xs text-muted-foreground">
          <span>Tap arrows or drag to reorder:</span>
          <div className="flex gap-1">
            {currentOrder.map((_, i) => (
              <div key={i} className="flex gap-0.5">
                <button
                  onClick={() => moveWord(i, 'left')}
                  disabled={i === 0}
                  className="px-1 py-0.5 rounded text-xs hover:bg-muted disabled:opacity-30"
                  data-testid={`button-move-left-${i}`}
                >
                  ←
                </button>
                <span className="text-muted-foreground/50">{i + 1}</span>
                <button
                  onClick={() => moveWord(i, 'right')}
                  disabled={i === currentOrder.length - 1}
                  className="px-1 py-0.5 rounded text-xs hover:bg-muted disabled:opacity-30"
                  data-testid={`button-move-right-${i}`}
                >
                  →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {!isSubmitted ? (
        <Button
          onClick={handleSubmit}
          className="w-full"
          data-testid={`button-submit-sentence-order-${index}`}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Check Order
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className={`flex items-center gap-2 ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isCorrect ? (
              <>
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Perfect order!</span>
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Not quite right</span>
                </div>
                <p className="text-sm">
                  Correct order: <strong>{data.correctOrder?.join(' ')}</strong>
                </p>
              </div>
            )}
          </div>
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            data-testid={`button-reset-sentence-order-${index}`}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      )}
    </motion.div>
  );
};

interface PronunciationItemDisplayProps {
  item: PronunciationItem;
  index: number;
}

const PronunciationItemDisplay = ({ item, index }: PronunciationItemDisplayProps) => {
  const { data } = item;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-rose-500/10 border-rose-500/30"
      data-testid={`whiteboard-item-pronunciation-${index}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
            Pronunciation Feedback
          </span>
        </div>
        {getScoreIcon(data.score)}
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Progress value={data.score} className="h-2" />
        </div>
        <span className={`text-2xl font-bold ${getScoreColor(data.score)}`}>
          {data.score}
        </span>
      </div>
      
      <p className="text-sm">{data.feedback}</p>
      
      {data.strengths.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.strengths.map((strength, i) => (
            <span 
              key={i}
              className="text-xs px-2 py-0.5 bg-green-500/20 text-green-700 dark:text-green-300 rounded-full"
            >
              {strength}
            </span>
          ))}
        </div>
      )}
      
      {data.phoneticIssues.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.phoneticIssues.map((issue, i) => (
            <span 
              key={i}
              className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-700 dark:text-orange-300 rounded-full"
            >
              {issue}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
};

interface TextItemDisplayProps {
  item: WhiteboardItem;
  index: number;
}

const TextItemDisplay = ({ item, index }: TextItemDisplayProps) => {
  const icon = getItemIcon(item.type);
  const style = getItemStyle(item.type);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`flex items-start gap-2 px-4 py-3 rounded-lg border ${style}`}
      data-testid={`whiteboard-item-${item.type}-${index}`}
    >
      {icon && (
        <span className="flex-shrink-0 mt-0.5 opacity-60">
          {icon}
        </span>
      )}
      <span className="text-lg md:text-xl font-medium leading-relaxed">
        {item.content}
      </span>
    </motion.div>
  );
};

interface ContextItemDisplayProps {
  item: ContextItem;
  index: number;
}

const ContextItemDisplay = ({ item, index }: ContextItemDisplayProps) => {
  const { data } = item;
  
  const highlightWord = (sentence: string, word: string) => {
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const unicodeBoundary = '(?<![\\p{L}\\p{N}])';
    const unicodeBoundaryEnd = '(?![\\p{L}\\p{N}])';
    const regex = new RegExp(`${unicodeBoundary}(${escapedWord})${unicodeBoundaryEnd}`, 'giu');
    const parts = sentence.split(regex);
    return parts.map((part, i) => 
      part.toLowerCase() === word.toLowerCase() ? (
        <span key={i} className="font-bold text-cyan-600 dark:text-cyan-300 bg-cyan-500/20 px-1 rounded">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-cyan-500/10 border-cyan-500/30"
      data-testid={`whiteboard-item-context-${index}`}
    >
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-cyan-600 dark:text-cyan-400 opacity-60" />
        <span className="text-xl font-bold text-cyan-700 dark:text-cyan-300">
          {data.word}
        </span>
        <span className="text-sm text-muted-foreground">in context</span>
      </div>
      
      <div className="flex flex-col gap-2 pl-2 border-l-2 border-cyan-500/30">
        {data.sentences.map((sentence, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.15 }}
            className="text-base leading-relaxed"
          >
            {highlightWord(sentence, data.word)}
          </motion.p>
        ))}
      </div>
    </motion.div>
  );
};

interface ReadingItemDisplayProps {
  item: ReadingItem;
  index: number;
}

/**
 * Reading guide display - shows character with pronunciation annotation
 * Supports: furigana (Japanese), pinyin (Mandarin), romanization (Korean)
 * Uses ruby HTML element for proper reading annotation display
 */
const ReadingItemDisplay = ({ item, index }: ReadingItemDisplayProps) => {
  const { data } = item;
  
  const getLanguageLabel = (lang?: string): string => {
    switch (lang?.toLowerCase()) {
      case 'japanese':
      case 'ja':
        return 'Furigana';
      case 'mandarin':
      case 'chinese':
      case 'zh':
        return 'Pinyin';
      case 'korean':
      case 'ko':
        return 'Romanization';
      default:
        return 'Reading';
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-pink-500/10 border-pink-500/30"
      data-testid={`whiteboard-item-reading-${index}`}
    >
      <div className="flex items-center gap-2">
        <Languages className="h-4 w-4 text-pink-600 dark:text-pink-400 opacity-60" />
        <span className="text-sm text-muted-foreground">{getLanguageLabel(data.language)}</span>
      </div>
      
      <div className="flex justify-center items-center py-2">
        <ruby className="text-3xl font-medium text-pink-700 dark:text-pink-300">
          {data.character}
          <rp>(</rp>
          <rt className="text-base text-pink-600 dark:text-pink-400">{data.reading}</rt>
          <rp>)</rp>
        </ruby>
      </div>
      
      {data.reading && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-sm text-muted-foreground"
        >
          Pronunciation: <span className="font-mono text-pink-600 dark:text-pink-400">{data.reading}</span>
        </motion.p>
      )}
    </motion.div>
  );
};

interface StrokeItemDisplayProps {
  item: StrokeItem;
  index: number;
}

/**
 * Stroke order display - shows character with animated stroke order using HanziWriter
 * Supports: CJK characters (Chinese, Japanese Kanji, Korean Hanja)
 * Features: Play animation, replay button, stroke count display
 * Uses dynamic import to avoid SSR issues (HanziWriter requires window)
 */
const StrokeItemDisplay = ({ item, index }: StrokeItemDisplayProps) => {
  const { data } = item;
  const writerContainerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [strokeCount, setStrokeCount] = useState<number | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const getLanguageLabel = (lang?: string): string => {
    switch (lang?.toLowerCase()) {
      case 'japanese':
      case 'ja':
        return 'Japanese';
      case 'mandarin':
      case 'chinese':
      case 'zh':
        return 'Chinese';
      case 'korean':
      case 'ko':
        return 'Korean';
      default:
        return 'Character';
    }
  };
  
  useEffect(() => {
    if (!data.character) {
      setIsLoading(false);
      setHasError(true);
      return;
    }
    if (typeof window === 'undefined') {
      setIsLoading(false);
      setHasError(true);
      return;
    }
    if (!writerContainerRef.current) {
      setIsLoading(false);
      setHasError(true);
      return;
    }
    
    const container = writerContainerRef.current;
    let mounted = true;
    
    const initWriter = async () => {
      try {
        const HanziWriterModule = await import('hanzi-writer');
        const HanziWriter = HanziWriterModule.default;
        
        if (!mounted || !container) return;
        
        container.innerHTML = '';
        
        const writer = HanziWriter.create(container, data.character, {
          width: 120,
          height: 120,
          padding: 5,
          showOutline: true,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 300,
          strokeColor: '#ea580c',
          outlineColor: '#fdba74',
          drawingColor: '#c2410c',
          radicalColor: '#f97316',
          highlightColor: '#fb923c',
          showCharacter: true,
          onLoadCharDataSuccess: (charData: any) => {
            if (!mounted) return;
            setStrokeCount(charData?.strokes?.length || null);
            setIsSupported(true);
            setHasError(false);
            setIsLoading(false);
          },
          onLoadCharDataError: () => {
            if (!mounted) return;
            console.warn(`[HanziWriter] Character "${data.character}" not found in database`);
            setIsSupported(false);
            setHasError(true);
            setIsLoading(false);
          },
        });
        
        if (!mounted) {
          (writer as any).destroy?.();
          return;
        }
        
        writerRef.current = writer;
        
        setTimeout(() => {
          if (mounted && writerRef.current) {
            setIsAnimating(true);
            writerRef.current.animateCharacter({
              onComplete: () => {
                if (mounted) setIsAnimating(false);
              },
            });
          }
        }, 500);
        
      } catch (error) {
        if (mounted) {
          console.error('[HanziWriter] Failed to create writer:', error);
          setHasError(true);
          setIsLoading(false);
        }
      }
    };
    
    initWriter();
    
    return () => {
      mounted = false;
      if (writerRef.current) {
        try {
          (writerRef.current as any).destroy?.();
        } catch (e) {
        }
        writerRef.current = null;
      }
    };
  }, [data.character]);
  
  const handleReplay = useCallback(() => {
    if (writerRef.current && !isAnimating) {
      setIsAnimating(true);
      writerRef.current.animateCharacter({
        onComplete: () => setIsAnimating(false),
      });
    }
  }, [isAnimating]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-orange-500/10 border-orange-500/30"
      data-testid={`whiteboard-item-stroke-${index}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenTool className="h-4 w-4 text-orange-600 dark:text-orange-400 opacity-60" />
          <span className="text-sm text-muted-foreground">
            {getLanguageLabel(data.language)} Stroke Order
          </span>
        </div>
        {strokeCount && isSupported && (
          <span className="text-xs bg-orange-500/20 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">
            {strokeCount} strokes
          </span>
        )}
      </div>
      
      <div className="flex justify-center items-center py-4 min-h-[140px]">
        {isLoading && !hasError ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2"
          >
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            <span className="text-xs text-muted-foreground">Loading stroke data...</span>
          </motion.div>
        ) : hasError || !isSupported ? (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 10 }}
            className="relative flex flex-col items-center gap-2"
          >
            <span 
              className="text-6xl font-medium text-orange-700 dark:text-orange-300"
              style={{ fontFamily: '"Noto Sans JP", "Noto Sans SC", "Noto Sans KR", sans-serif' }}
            >
              {data.character}
            </span>
            <p className="text-xs text-orange-600/70 dark:text-orange-400/70">
              Stroke data not available
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 10 }}
            className="relative"
          >
            <div 
              ref={writerContainerRef}
              className="w-[120px] h-[120px]"
              data-testid={`stroke-writer-${index}`}
            />
          </motion.div>
        )}
      </div>
      
      {isSupported && !hasError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReplay}
            disabled={isAnimating}
            className="text-orange-600 dark:text-orange-400 hover:bg-orange-500/20"
            data-testid={`stroke-replay-${index}`}
          >
            {isAnimating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            {isAnimating ? 'Animating...' : 'Replay Animation'}
          </Button>
        </motion.div>
      )}
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-xs text-muted-foreground"
      >
        Watch and learn the stroke order for "{data.character}"
      </motion.p>
    </motion.div>
  );
};

interface WordMapItemDisplayProps {
  item: WordMapItem;
  index: number;
}

/**
 * Word map display - shows visual web of related words
 * Displays synonyms, antonyms, collocations, and word family
 * Uses radial layout to show word relationships
 */
const WordMapItemDisplay = ({ item, index }: WordMapItemDisplayProps) => {
  const { data } = item;
  
  const hasRelations = data.synonyms?.length || data.antonyms?.length || 
    data.collocations?.length || data.wordFamily?.length;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-teal-500/10 border-teal-500/30"
      data-testid={`whiteboard-item-word-map-${index}`}
    >
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-teal-600 dark:text-teal-400 opacity-60" />
        <span className="text-sm text-muted-foreground">Word Map</span>
      </div>
      
      <div className="flex justify-center items-center py-2">
        <motion.span
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
          className="text-2xl font-bold text-teal-700 dark:text-teal-300 px-4 py-2 bg-teal-500/20 rounded-full"
        >
          {data.targetWord}
        </motion.span>
      </div>
      
      {data.isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          <span className="ml-2 text-sm text-muted-foreground">Finding related words...</span>
        </div>
      ) : hasRelations ? (
        <div className="grid gap-3">
          {data.synonyms && data.synonyms.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-wrap gap-1.5 items-center"
            >
              <span className="text-xs font-medium text-teal-600 dark:text-teal-400 w-20">Synonyms:</span>
              {data.synonyms.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  className="px-2 py-0.5 text-sm bg-teal-500/15 rounded-md text-teal-700 dark:text-teal-300"
                >
                  {word}
                </motion.span>
              ))}
            </motion.div>
          )}
          
          {data.antonyms && data.antonyms.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-1.5 items-center"
            >
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400 w-20">Antonyms:</span>
              {data.antonyms.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  className="px-2 py-0.5 text-sm bg-rose-500/15 rounded-md text-rose-700 dark:text-rose-300"
                >
                  {word}
                </motion.span>
              ))}
            </motion.div>
          )}
          
          {data.collocations && data.collocations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-1.5 items-center"
            >
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 w-20">Common:</span>
              {data.collocations.map((phrase, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 + i * 0.05 }}
                  className="px-2 py-0.5 text-sm bg-amber-500/15 rounded-md text-amber-700 dark:text-amber-300"
                >
                  {phrase}
                </motion.span>
              ))}
            </motion.div>
          )}
          
          {data.wordFamily && data.wordFamily.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap gap-1.5 items-center"
            >
              <span className="text-xs font-medium text-violet-600 dark:text-violet-400 w-20">Family:</span>
              {data.wordFamily.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.45 + i * 0.05 }}
                  className="px-2 py-0.5 text-sm bg-violet-500/15 rounded-md text-violet-700 dark:text-violet-300"
                >
                  {word}
                </motion.span>
              ))}
            </motion.div>
          )}
        </div>
      ) : (
        <div className="py-3 text-center">
          <p className="text-sm text-muted-foreground italic">
            Exploring word relationships for <span className="font-semibold">{data.targetWord}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
};

interface CultureItemDisplayProps {
  item: CultureItem;
  index: number;
}

/**
 * Get icon for cultural category
 */
const getCultureCategoryIcon = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'food':
    case 'dining':
      return <Utensils className="h-4 w-4" />;
    case 'gestures':
    case 'body language':
      return <HandMetal className="h-4 w-4" />;
    case 'holidays':
    case 'festivals':
      return <Calendar className="h-4 w-4" />;
    case 'etiquette':
    case 'customs':
      return <Users className="h-4 w-4" />;
    default:
      return <Globe className="h-4 w-4" />;
  }
};

/**
 * Culture display - shows cultural insights, customs, etiquette
 * Helps learners understand cultural context beyond vocabulary
 */
const CultureItemDisplay = ({ item, index }: CultureItemDisplayProps) => {
  const { data } = item;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-amber-500/10 border-amber-500/30"
      data-testid={`whiteboard-item-culture-${index}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-amber-600 dark:text-amber-400 opacity-80">
          {getCultureCategoryIcon(data.category)}
        </span>
        {data.category && (
          <span className="text-xs uppercase tracking-wide text-amber-600 dark:text-amber-400 font-medium">
            {data.category}
          </span>
        )}
      </div>
      
      <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">
        {data.topic}
      </h3>
      
      <p className="text-sm text-amber-900/80 dark:text-amber-100/80 leading-relaxed">
        {data.context}
      </p>
    </motion.div>
  );
};

interface PlayItemDisplayProps {
  item: PlayItem;
  index: number;
  language?: string;
}

const PlayItemDisplay = ({ item, index, language }: PlayItemDisplayProps) => {
  const { data } = item;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const speed = data.speed || 'normal';
  
  const speedLabel = {
    slow: '0.5x',
    normal: '1x',
    fast: '1.5x',
  }[speed];
  
  const speedRate = {
    slow: 0.5,
    normal: 1.0,
    fast: 1.5,
  }[speed];
  
  const speedColor = {
    slow: 'text-green-600 dark:text-green-400',
    normal: 'text-sky-600 dark:text-sky-400',
    fast: 'text-orange-600 dark:text-orange-400',
  }[speed];
  
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);
  
  const handlePlay = useCallback(async () => {
    if (isLoading) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      return;
    }
    
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }
    
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;
    
    try {
      setIsLoading(true);
      
      const result = await synthesizeSpeech(
        data.text,
        language,
        undefined,
        language,
        false,
        undefined,
        speedRate,
        signal
      );
      
      if (signal.aborted) return;
      
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      
      const audioUrl = URL.createObjectURL(result.audioBlob);
      audioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        console.error('[PLAY] Audio playback error');
      };
      
      if (signal.aborted) return;
      
      setIsPlaying(true);
      await audio.play();
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('[PLAY] Failed to synthesize speech:', error);
      }
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, isLoading, data.text, language, speedRate]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex items-center gap-4 p-4 rounded-lg border bg-sky-500/10 border-sky-500/30"
      data-testid={`whiteboard-item-play-${index}`}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePlay}
        disabled={isLoading}
        className={`h-12 w-12 rounded-full ${isPlaying ? 'bg-sky-500/20' : 'bg-sky-500/10'} hover:bg-sky-500/20`}
        data-testid={`play-button-${index}`}
      >
        {isLoading ? (
          <Loader2 className="h-6 w-6 text-sky-600 dark:text-sky-400 animate-spin" />
        ) : isPlaying ? (
          <Square className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        ) : (
          <Play className="h-6 w-6 text-sky-600 dark:text-sky-400" />
        )}
      </Button>
      
      <div className="flex flex-col gap-1 flex-1">
        <span className="text-lg font-medium text-sky-900 dark:text-sky-100">
          {data.text}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${speedColor}`}>
            {speedLabel}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

interface ScenarioItemDisplayProps {
  item: ScenarioItem;
  index: number;
}

const ScenarioItemDisplay = ({ item, index }: ScenarioItemDisplayProps) => {
  const { data } = item;
  const mood = data.mood || 'casual';
  
  const moodStyles: Record<string, { icon: typeof Sparkles; color: string }> = {
    formal: { icon: Users, color: 'text-purple-600 dark:text-purple-400' },
    casual: { icon: Sparkles, color: 'text-purple-500 dark:text-purple-300' },
    urgent: { icon: Target, color: 'text-red-500 dark:text-red-400' },
    friendly: { icon: Star, color: 'text-yellow-500 dark:text-yellow-400' },
  };
  
  const moodInfo = moodStyles[mood] || moodStyles.casual;
  const MoodIcon = moodInfo.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-purple-500/10 border-purple-500/30"
      data-testid={`whiteboard-item-scenario-${index}`}
    >
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        <span className="text-lg font-bold text-purple-800 dark:text-purple-200">
          {data.location}
        </span>
        <span className={`ml-auto flex items-center gap-1 text-xs uppercase tracking-wide font-medium ${moodInfo.color}`}>
          <MoodIcon className="h-3 w-3" />
          {mood}
        </span>
      </div>
      
      <p className="text-sm text-purple-900/80 dark:text-purple-100/80 leading-relaxed italic">
        "{data.situation}"
      </p>
    </motion.div>
  );
};

interface SummaryItemDisplayProps {
  item: SummaryItem;
  index: number;
}

const SummaryItemDisplay = ({ item, index }: SummaryItemDisplayProps) => {
  const { data } = item;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-emerald-500/10 border-emerald-500/30"
      data-testid={`whiteboard-item-summary-${index}`}
    >
      <div className="flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
          {data.title}
        </h3>
      </div>
      
      {data.words.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-emerald-600/80 dark:text-emerald-400/80 font-medium">
            Words Learned
          </span>
          <div className="flex flex-wrap gap-2">
            {data.words.map((word, i) => (
              <span 
                key={i}
                className="px-2 py-1 text-sm rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 font-medium"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {data.phrases.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-emerald-600/80 dark:text-emerald-400/80 font-medium">
            Key Phrases
          </span>
          <ul className="space-y-1">
            {data.phrases.map((phrase, i) => (
              <li 
                key={i}
                className="text-sm text-emerald-900/80 dark:text-emerald-100/80 pl-3 border-l-2 border-emerald-500/40"
              >
                {phrase}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
};

interface ErrorPatternsItemDisplayProps {
  item: ErrorPatternsItem;
  index: number;
}

const ErrorPatternsItemDisplay = ({ item, index }: ErrorPatternsItemDisplayProps) => {
  const { data } = item;
  
  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'pronunciation':
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30';
      case 'grammar':
        return 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 'vocabulary':
        return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'conjugation':
        return 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30';
      default:
        return 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30';
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-rose-500/10 border-rose-500/30"
      data-testid={`whiteboard-item-error-patterns-${index}`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
        <h3 className="text-lg font-bold text-rose-800 dark:text-rose-200">
          {data.category ? `${data.category} Patterns` : 'Common Mistakes'}
        </h3>
      </div>
      
      {data.isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
          <span className="ml-2 text-sm text-muted-foreground">Loading patterns...</span>
        </div>
      ) : data.patterns.length > 0 ? (
        <div className="space-y-3">
          {data.patterns.map((pattern, i) => (
            <motion.div
              key={pattern.id || i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex flex-col gap-1 p-3 bg-background/50 rounded-lg border border-rose-500/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-rose-600 dark:text-rose-400 line-through text-sm">
                    {pattern.incorrect}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                    {pattern.correct}
                  </span>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full border ${getCategoryColor(pattern.category)}`}>
                  {pattern.category}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Occurred {pattern.frequency}x</span>
                {pattern.lastOccurred && (
                  <>
                    <span>•</span>
                    <span>Last: {new Date(pattern.lastOccurred).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-3 text-center">
          <p className="text-sm text-muted-foreground italic">
            No error patterns recorded yet. Keep practicing!
          </p>
        </div>
      )}
    </motion.div>
  );
};

interface VocabularyTimelineItemDisplayProps {
  item: VocabularyTimelineItem;
  index: number;
}

const VocabularyTimelineItemDisplay = ({ item, index }: VocabularyTimelineItemDisplayProps) => {
  const { data } = item;
  
  const getProficiencyColor = (proficiency: string) => {
    switch (proficiency) {
      case 'new':
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30';
      case 'learning':
        return 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 'familiar':
        return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'mastered':
        return 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30';
    }
  };
  
  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'conversation':
        return <Volume2 className="h-3 w-3" />;
      case 'lesson':
        return <BookOpen className="h-3 w-3" />;
      case 'drill':
        return <Target className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-blue-500/10 border-blue-500/30"
      data-testid={`whiteboard-item-vocabulary-timeline-${index}`}
    >
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200">
          {data.topic ? `${data.topic} Vocabulary` : 'Recent Vocabulary'}
        </h3>
        {data.timeRange && (
          <span className="text-xs text-muted-foreground capitalize">
            ({data.timeRange})
          </span>
        )}
      </div>
      
      {data.isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-muted-foreground">Loading vocabulary...</span>
        </div>
      ) : data.entries.length > 0 ? (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-blue-500/20" />
          <div className="space-y-3">
            {data.entries.map((entry, i) => (
              <motion.div
                key={entry.id || i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="relative flex items-start gap-3 pl-8"
              >
                <div className="absolute left-2 top-2 w-4 h-4 rounded-full bg-blue-500/30 border-2 border-blue-500/50 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                </div>
                <div className="flex-1 p-3 bg-background/50 rounded-lg border border-blue-500/20">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      {entry.word}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${getProficiencyColor(entry.proficiency)}`}>
                      {entry.proficiency}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{entry.translation}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {getSourceIcon(entry.source)}
                      {entry.source}
                    </span>
                    <span>•</span>
                    <span>{new Date(entry.learnedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-3 text-center">
          <p className="text-sm text-muted-foreground italic">
            No vocabulary recorded yet. Start learning!
          </p>
        </div>
      )}
    </motion.div>
  );
};

interface GrammarTableItemDisplayProps {
  item: GrammarTableItem;
  index: number;
}

const GrammarTableItemDisplay = ({ item, index }: GrammarTableItemDisplayProps) => {
  const { data } = item;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex flex-col gap-3 p-4 rounded-lg border bg-indigo-500/10 border-indigo-500/30"
      data-testid={`whiteboard-item-grammar-table-${index}`}
    >
      <div className="flex items-center gap-2">
        <Table2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 opacity-60" />
        <span className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
          {data.verb}
        </span>
        <span className="text-sm text-muted-foreground capitalize">
          ({data.tense})
        </span>
      </div>
      
      {data.isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="ml-2 text-sm text-muted-foreground">Loading conjugations...</span>
        </div>
      ) : data.conjugations && data.conjugations.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {data.conjugations.map((conj, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 rounded"
            >
              <span className="text-sm text-muted-foreground w-12">{conj.pronoun}</span>
              <span className="font-medium text-indigo-700 dark:text-indigo-300">{conj.form}</span>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-3 text-center">
          <p className="text-sm text-muted-foreground italic mb-2">
            {data.tense.charAt(0).toUpperCase() + data.tense.slice(1)} tense of <span className="font-semibold">{data.verb}</span>
          </p>
          <p className="text-xs text-muted-foreground/70">
            Conjugation patterns help you recognize verb forms
          </p>
        </div>
      )}
    </motion.div>
  );
};

const WhiteboardItemDisplay = ({ 
  item, 
  index,
  onDrillResponse,
  onDrillStart,
  language,
}: { 
  item: WhiteboardItem; 
  index: number;
  onDrillResponse?: (drillId: string, response: string) => void;
  onDrillStart?: (drillId: string) => void;
  language?: string;
}) => {
  if (isImageItem(item)) {
    return <ImageItemDisplay item={item} index={index} />;
  }
  
  if (isDrillItem(item)) {
    if (isMatchingDrill(item)) {
      return <MatchDrillDisplay item={item} index={index} />;
    }
    if (isFillBlankDrill(item)) {
      return <FillBlankDrillDisplay item={item} index={index} />;
    }
    if (isSentenceOrderDrill(item)) {
      return <SentenceOrderDrillDisplay item={item} index={index} />;
    }
    return (
      <DrillItemDisplay 
        item={item} 
        index={index} 
        onResponse={onDrillResponse}
        onStart={onDrillStart}
      />
    );
  }
  
  if (isPronunciationItem(item)) {
    return <PronunciationItemDisplay item={item} index={index} />;
  }
  
  if (isContextItem(item)) {
    return <ContextItemDisplay item={item} index={index} />;
  }
  
  if (isGrammarTableItem(item)) {
    return <GrammarTableItemDisplay item={item} index={index} />;
  }
  
  if (isReadingItem(item)) {
    return <ReadingItemDisplay item={item} index={index} />;
  }
  
  if (isStrokeItem(item)) {
    return <StrokeItemDisplay item={item} index={index} />;
  }
  
  if (isWordMapItem(item)) {
    return <WordMapItemDisplay item={item} index={index} />;
  }
  
  if (isCultureItem(item)) {
    return <CultureItemDisplay item={item} index={index} />;
  }
  
  if (isPlayItem(item)) {
    return <PlayItemDisplay item={item} index={index} language={language} />;
  }
  
  if (isScenarioItem(item)) {
    return <ScenarioItemDisplay item={item} index={index} />;
  }
  
  if (isSummaryItem(item)) {
    return <SummaryItemDisplay item={item} index={index} />;
  }
  
  if (isErrorPatternsItem(item)) {
    return <ErrorPatternsItemDisplay item={item} index={index} />;
  }
  
  if (isVocabularyTimelineItem(item)) {
    return <VocabularyTimelineItemDisplay item={item} index={index} />;
  }
  
  return <TextItemDisplay item={item} index={index} />;
};

export function Whiteboard({ items, onClear, onDrillResponse, onDrillStart, language: propLanguage }: WhiteboardProps) {
  const { language: contextLanguage } = useLanguage();
  const language = propLanguage || contextLanguage;
  
  if (items.length === 0) {
    return null;
  }
  
  return (
    <div 
      className="fixed bottom-28 left-0 right-0 z-40 px-4 pointer-events-none"
      data-testid="whiteboard-container"
    >
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <div className="relative bg-background/95 backdrop-blur-md rounded-xl border border-border shadow-lg p-4">
          {onClear && (
            <button
              onClick={onClear}
              className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Clear whiteboard"
              data-testid="button-clear-whiteboard"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          
          <AnimatePresence mode="sync">
            <div className="flex flex-col gap-2">
              {items.map((item, index) => (
                <WhiteboardItemDisplay 
                  key={item.id || `${item.type}-${item.content}-${index}`} 
                  item={item} 
                  index={index}
                  onDrillResponse={onDrillResponse}
                  onDrillStart={onDrillStart}
                  language={language}
                />
              ))}
            </div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact whiteboard variant for inline display
 * Used when whiteboard should appear within the chat flow
 */
export function InlineWhiteboard({ 
  items,
  onDrillResponse,
  onDrillStart,
  language: propLanguage,
}: { 
  items: WhiteboardItem[];
  onDrillResponse?: (drillId: string, response: string) => void;
  onDrillStart?: (drillId: string) => void;
  language?: string;
}) {
  const { language: contextLanguage } = useLanguage();
  const language = propLanguage || contextLanguage;
  
  if (items.length === 0) {
    return null;
  }
  
  return (
    <div 
      className="my-3 rounded-lg border border-border bg-muted/50 p-3"
      data-testid="inline-whiteboard"
    >
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <WhiteboardItemDisplay 
            key={item.id || `${item.type}-${item.content}-${index}`} 
            item={item} 
            index={index}
            onDrillResponse={onDrillResponse}
            onDrillStart={onDrillStart}
            language={language}
          />
        ))}
      </div>
    </div>
  );
}
