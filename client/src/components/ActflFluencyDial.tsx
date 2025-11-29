import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Award, Target, Zap, HelpCircle, Globe } from "lucide-react";
import type { ActflProgress } from "@shared/schema";

const ACTFL_LEVELS = [
  { key: 'novice_low', label: 'Novice Low', shortLabel: 'NL', score: 0, color: '#ef4444' },
  { key: 'novice_mid', label: 'Novice Mid', shortLabel: 'NM', score: 9, color: '#f97316' },
  { key: 'novice_high', label: 'Novice High', shortLabel: 'NH', score: 18, color: '#f59e0b' },
  { key: 'intermediate_low', label: 'Intermediate Low', shortLabel: 'IL', score: 27, color: '#eab308' },
  { key: 'intermediate_mid', label: 'Intermediate Mid', shortLabel: 'IM', score: 36, color: '#84cc16' },
  { key: 'intermediate_high', label: 'Intermediate High', shortLabel: 'IH', score: 45, color: '#22c55e' },
  { key: 'advanced_low', label: 'Advanced Low', shortLabel: 'AL', score: 54, color: '#10b981' },
  { key: 'advanced_mid', label: 'Advanced Mid', shortLabel: 'AM', score: 63, color: '#14b8a6' },
  { key: 'advanced_high', label: 'Advanced High', shortLabel: 'AH', score: 72, color: '#06b6d4' },
  { key: 'superior', label: 'Superior', shortLabel: 'S', score: 86, color: '#3b82f6' },
  { key: 'distinguished', label: 'Distinguished', shortLabel: 'D', score: 100, color: '#8b5cf6' },
];

function getLevelInfo(levelKey: string | null | undefined) {
  const level = ACTFL_LEVELS.find(l => l.key === levelKey);
  return level || ACTFL_LEVELS[0];
}

function getNextLevel(levelKey: string | null | undefined) {
  const currentIndex = ACTFL_LEVELS.findIndex(l => l.key === levelKey);
  if (currentIndex === -1 || currentIndex >= ACTFL_LEVELS.length - 1) return null;
  return ACTFL_LEVELS[currentIndex + 1];
}

function estimateProgressWithinLevel(progress: ActflProgress | null | undefined): number {
  if (!progress) return 0;
  
  const messagesTarget = 50;
  const daysTarget = 14;
  const practiceHoursTarget = 5;
  
  const messagesProgress = Math.min(1, (progress.messagesAtCurrentLevel || 0) / messagesTarget);
  const daysProgress = Math.min(1, (progress.daysAtCurrentLevel || 0) / daysTarget);
  const practiceProgress = Math.min(1, (progress.practiceHours || 0) / practiceHoursTarget);
  
  const grammarScore = progress.grammarScore || 0;
  const vocabScore = progress.vocabularyScore || 0;
  const pronunciationScore = progress.avgPronunciationConfidence || 0;
  const factAverage = (grammarScore + vocabScore + pronunciationScore) / 3;
  
  const weights = { messages: 0.3, days: 0.15, practice: 0.15, fact: 0.4 };
  const weightedProgress = 
    messagesProgress * weights.messages +
    daysProgress * weights.days +
    practiceProgress * weights.practice +
    factAverage * weights.fact;
  
  return Math.min(0.95, weightedProgress);
}

function calculateContinuousScore(levelKey: string | null | undefined, progress: ActflProgress | null | undefined): number {
  const levelInfo = getLevelInfo(levelKey);
  const levelIndex = ACTFL_LEVELS.findIndex(l => l.key === levelKey);
  const nextLevel = levelIndex < ACTFL_LEVELS.length - 1 ? ACTFL_LEVELS[levelIndex + 1] : null;
  
  if (!nextLevel) return levelInfo.score;
  
  const progressWithin = estimateProgressWithinLevel(progress);
  const levelSpan = nextLevel.score - levelInfo.score;
  
  return Math.round(levelInfo.score + (progressWithin * levelSpan));
}

interface GaugeDialProps {
  score: number;
  color: string;
  size?: number;
}

function GaugeDial({ score, color, size = 200 }: GaugeDialProps) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI;
  const progress = (score / 100) * circumference;
  const center = size / 2;
  
  const tickMarks = [];
  for (let i = 0; i <= 10; i++) {
    const angle = -180 + (i * 18);
    const radians = (angle * Math.PI) / 180;
    const innerRadius = radius - 20;
    const outerRadius = radius - 8;
    const x1 = center + innerRadius * Math.cos(radians);
    const y1 = center + innerRadius * Math.sin(radians);
    const x2 = center + outerRadius * Math.cos(radians);
    const y2 = center + outerRadius * Math.sin(radians);
    tickMarks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="currentColor"
        strokeWidth={i % 5 === 0 ? 2 : 1}
        className="text-muted-foreground/40"
      />
    );
  }
  
  const needleAngle = -180 + (score / 100) * 180;
  const needleRadians = (needleAngle * Math.PI) / 180;
  const needleLength = radius - 30;
  const needleX = center + needleLength * Math.cos(needleRadians);
  const needleY = center + needleLength * Math.sin(needleRadians);
  
  return (
    <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`} className="overflow-visible">
      <defs>
        <linearGradient id="dialGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="25%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#22c55e" />
          <stop offset="75%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="needleShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3"/>
        </filter>
      </defs>
      
      <path
        d={`M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="text-muted/20"
      />
      
      <path
        d={`M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`}
        fill="none"
        stroke="url(#dialGradient)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        filter="url(#glow)"
      />
      
      {tickMarks}
      
      <g filter="url(#needleShadow)">
        <circle cx={center} cy={center} r={8} fill={color} />
        <line
          x1={center}
          y1={center}
          x2={needleX}
          y2={needleY}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          style={{ 
            transition: 'all 1s ease-out',
            transformOrigin: `${center}px ${center}px`
          }}
        />
        <circle cx={center} cy={center} r={4} fill="white" />
      </g>
      
      <text x={strokeWidth + 5} y={center + 20} fontSize="10" className="fill-muted-foreground">0</text>
      <text x={size - strokeWidth - 20} y={center + 20} fontSize="10" className="fill-muted-foreground">100</text>
    </svg>
  );
}

interface ActflFluencyDialProps {
  compact?: boolean;
  language?: string; // Optional override for the language (e.g., from LearningFilterContext)
}

export function ActflFluencyDial({ compact = false, language: languageProp }: ActflFluencyDialProps) {
  const { language: globalLanguage } = useLanguage();
  
  // Use prop language if provided, otherwise fall back to global context
  const language = languageProp ?? globalLanguage;
  
  // Don't fetch if language is "all" - ACTFL is per-language
  const isAllLanguages = language === 'all';
  
  const { data: progress, isLoading } = useQuery<ActflProgress | null>({
    queryKey: ['/api/actfl-progress', language],
    enabled: !isAllLanguages && !!language,
  });
  
  const hasProgress = progress && (progress.tasksTotal > 0 || progress.topicsTotal > 0 || (progress.practiceHours && progress.practiceHours > 0));
  const levelInfo = getLevelInfo(progress?.currentActflLevel);
  const nextLevel = getNextLevel(progress?.currentActflLevel);
  const readyForAdvancement = progress?.readyForAdvancement;
  
  const continuousScore = hasProgress 
    ? calculateContinuousScore(progress?.currentActflLevel, progress) 
    : levelInfo.score;
  
  const progressWithinLevel = estimateProgressWithinLevel(progress);
  
  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <Skeleton className="h-[130px] w-[200px] rounded-t-full" />
          <Skeleton className="h-8 w-40 mt-4" />
        </CardContent>
      </Card>
    );
  }
  
  // When "All Languages" is selected, show a helpful message
  if (isAllLanguages) {
    return (
      <Card className="overflow-hidden" data-testid="card-actfl-dial-all-languages">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-muted-foreground" />
            ACTFL Fluency Level
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-8">
          <div className="p-4 rounded-full bg-muted/50 mb-4">
            <Globe className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Select a Language</h3>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            ACTFL proficiency is measured per language. Select a specific language to view your fluency level.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  if (!hasProgress) {
    return (
      <Card className="overflow-hidden" data-testid="card-actfl-dial-pending">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-muted-foreground" />
            ACTFL Fluency Level
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-8">
          <div className="p-4 rounded-full bg-muted/50 mb-4">
            <HelpCircle className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Assessment Pending</h3>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Start practicing with your AI tutor to receive your fluency assessment
          </p>
          <Badge variant="outline" className="mt-4">
            Complete a few conversations to unlock
          </Badge>
        </CardContent>
      </Card>
    );
  }
  
  if (compact) {
    return (
      <Card className="overflow-hidden" data-testid="card-actfl-dial-compact">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <GaugeDial score={continuousScore} color={levelInfo.color} size={100} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-bold" style={{ color: levelInfo.color }}>
                  {continuousScore}
                </span>
                <Badge variant="secondary" className="text-xs" style={{ backgroundColor: `${levelInfo.color}20`, color: levelInfo.color }}>
                  {levelInfo.label}
                </Badge>
              </div>
              {nextLevel && (
                <p className="text-xs text-muted-foreground">
                  {Math.round(progressWithinLevel * 100)}% to {nextLevel.shortLabel}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="overflow-hidden" data-testid="card-actfl-dial">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            ACTFL Fluency Level
          </CardTitle>
          {readyForAdvancement && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600 gap-1">
                    <Zap className="h-3 w-3" />
                    Ready to Level Up!
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{progress?.advancementReason || "You've demonstrated readiness to advance!"}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center pt-0">
        <div className="relative">
          <GaugeDial score={continuousScore} color={levelInfo.color} size={220} />
          
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <div className="text-4xl font-bold" style={{ color: levelInfo.color }} data-testid="text-actfl-score">
              {continuousScore}
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <Badge 
            variant="secondary" 
            className="text-base px-4 py-1.5 font-semibold"
            style={{ backgroundColor: `${levelInfo.color}20`, color: levelInfo.color, borderColor: levelInfo.color }}
            data-testid="badge-actfl-level"
          >
            {levelInfo.label}
          </Badge>
        </div>
        
        {nextLevel && (
          <div className="mt-4 w-full">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>Progress to {nextLevel.shortLabel}</span>
              <span>{Math.round(progressWithinLevel * 100)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-1000"
                style={{ 
                  width: `${progressWithinLevel * 100}%`,
                  backgroundColor: levelInfo.color 
                }}
              />
            </div>
          </div>
        )}
        
        <div className="mt-6 grid grid-cols-3 gap-4 w-full text-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-3 rounded-lg bg-muted/50 hover-elevate cursor-help">
                <div className="text-lg font-semibold">{progress?.topicsTotal || 0}</div>
                <div className="text-xs text-muted-foreground">Topics</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Topics covered in conversations</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-3 rounded-lg bg-muted/50 hover-elevate cursor-help">
                <div className="text-lg font-semibold">{progress?.tasksTotal || 0}</div>
                <div className="text-xs text-muted-foreground">Tasks</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Communication tasks mastered</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-3 rounded-lg bg-muted/50 hover-elevate cursor-help">
                <div className="text-lg font-semibold">{Math.round((progress?.practiceHours || 0) * 10) / 10}h</div>
                <div className="text-xs text-muted-foreground">Practice</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Total practice hours</TooltipContent>
          </Tooltip>
        </div>
        
        {progress?.advancementReason && !readyForAdvancement && (
          <div className="mt-4 p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground flex items-start gap-2">
            <Target className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{progress.advancementReason}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ActflMiniGauge() {
  const { language } = useLanguage();
  
  const { data: progress, isLoading } = useQuery<ActflProgress>({
    queryKey: ['/api/actfl-progress', language],
  });
  
  const levelInfo = getLevelInfo(progress?.currentActflLevel);
  
  if (isLoading) {
    return <Skeleton className="h-8 w-20 rounded-full" />;
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className="gap-1.5 cursor-help px-3"
          style={{ borderColor: levelInfo.color, color: levelInfo.color }}
          data-testid="badge-actfl-mini"
        >
          <TrendingUp className="h-3 w-3" />
          <span className="font-semibold">{levelInfo.shortLabel}</span>
          <span className="text-muted-foreground">•</span>
          <span>{levelInfo.score}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>ACTFL Level: {levelInfo.label}</p>
        <p className="text-xs text-muted-foreground">Fluency Score: {levelInfo.score}/100</p>
      </TooltipContent>
    </Tooltip>
  );
}
