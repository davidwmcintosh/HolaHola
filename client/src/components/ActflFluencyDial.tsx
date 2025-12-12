import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Award, Target, Zap, HelpCircle, Globe } from "lucide-react";
import type { ActflProgress } from "@shared/schema";
import {
  ACTFL_LEVELS,
  getLevelInfo,
  getNextLevel,
  estimateProgressWithinLevel,
  calculateContinuousScore,
  ActflRingDial,
} from "@/components/actfl/actfl-gauge-core";


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
  stat?: boolean; // Render as a stat card matching other counters
  language?: string; // Optional override for the language (e.g., from LearningFilterContext)
}

export function ActflFluencyDial({ compact = false, stat = false, language: languageProp }: ActflFluencyDialProps) {
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
    if (stat) {
      return (
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div>
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-3 w-12 mt-1" />
            </div>
          </div>
        </Card>
      );
    }
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
  
  // Stat mode - matches the other stat cards with a mini ring indicator
  if (stat) {
    if (isAllLanguages) {
      return (
        <Card className="p-3" data-testid="card-actfl-stat-all">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <Globe className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">--</p>
              <p className="text-xs text-muted-foreground">ACTFL</p>
            </div>
          </div>
        </Card>
      );
    }
    
    if (!hasProgress) {
      return (
        <Card className="p-3" data-testid="card-actfl-stat-pending">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <Award className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">--</p>
              <p className="text-xs text-muted-foreground">ACTFL</p>
            </div>
          </div>
        </Card>
      );
    }
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="p-3 cursor-help" data-testid="card-actfl-stat">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center">
                <ActflRingDial score={continuousScore} color={levelInfo.color} size={36} strokeWidth={3} showLabel={false} />
                <span 
                  className="absolute text-[10px] font-bold" 
                  style={{ color: levelInfo.color }}
                >
                  {continuousScore}
                </span>
              </div>
              <div>
                <p className="text-lg font-bold leading-tight" style={{ color: levelInfo.color }}>
                  {levelInfo.shortLabel}
                </p>
                <p className="text-xs text-muted-foreground">ACTFL</p>
              </div>
              {readyForAdvancement && (
                <Zap className="h-4 w-4 text-green-500 ml-auto" />
              )}
            </div>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{levelInfo.label}</p>
            <p className="text-xs text-muted-foreground">
              Score: {continuousScore}/100
              {nextLevel && ` • ${Math.round(progressWithinLevel * 100)}% to ${nextLevel.shortLabel}`}
            </p>
            {readyForAdvancement && (
              <p className="text-xs text-green-600">{progress?.advancementReason || "Ready to advance!"}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  // Compact mode handling - horizontal card layout
  if (compact) {
    if (isAllLanguages) {
      return (
        <Card className="overflow-hidden" data-testid="card-actfl-dial-all-languages">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-muted/50">
                <Globe className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">ACTFL Fluency</p>
                <p className="text-xs text-muted-foreground">Select a language to view level</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    if (!hasProgress) {
      return (
        <Card className="overflow-hidden" data-testid="card-actfl-dial-pending">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-muted/50">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">ACTFL Fluency</p>
                <p className="text-xs text-muted-foreground">Start practicing to unlock assessment</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card className="overflow-hidden" data-testid="card-actfl-dial-compact">
        <CardContent className="p-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <GaugeDial score={continuousScore} color={levelInfo.color} size={70} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-bold" style={{ color: levelInfo.color }}>
                  {continuousScore}
                </span>
                <Badge variant="secondary" className="text-xs" style={{ backgroundColor: `${levelInfo.color}20`, color: levelInfo.color }}>
                  {levelInfo.shortLabel}
                </Badge>
                {readyForAdvancement && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Badge className="bg-green-500 hover:bg-green-600 gap-1 text-xs">
                          <Zap className="h-3 w-3" />
                          Ready!
                        </Badge>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{progress?.advancementReason || "Ready to advance!"}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-xs text-muted-foreground">ACTFL Fluency Level</p>
              {nextLevel && (
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(progressWithinLevel * 100)}% toward {nextLevel.shortLabel}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Non-compact mode: When "All Languages" is selected
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
