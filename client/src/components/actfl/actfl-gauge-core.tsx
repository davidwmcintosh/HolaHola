/**
 * Shared ACTFL Gauge Components
 * 
 * Provides pure SVG primitives for ACTFL level visualization.
 * Can be used both standalone and embedded within other SVG elements.
 */

import type { ActflProgress } from "@shared/schema";

export const ACTFL_LEVELS = [
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
] as const;

export type ActflLevelInfo = typeof ACTFL_LEVELS[number];

export function getLevelInfo(levelKey: string | null | undefined): ActflLevelInfo {
  const level = ACTFL_LEVELS.find(l => l.key === levelKey);
  return level || ACTFL_LEVELS[0];
}

export function getNextLevel(levelKey: string | null | undefined): ActflLevelInfo | null {
  const currentIndex = ACTFL_LEVELS.findIndex(l => l.key === levelKey);
  if (currentIndex === -1 || currentIndex >= ACTFL_LEVELS.length - 1) return null;
  return ACTFL_LEVELS[currentIndex + 1];
}

export function estimateProgressWithinLevel(progress: ActflProgress | null | undefined): number {
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

export function calculateContinuousScore(levelKey: string | null | undefined, progress: ActflProgress | null | undefined): number {
  const levelInfo = getLevelInfo(levelKey);
  const levelIndex = ACTFL_LEVELS.findIndex(l => l.key === levelKey);
  const nextLevel = levelIndex < ACTFL_LEVELS.length - 1 ? ACTFL_LEVELS[levelIndex + 1] : null;
  
  if (!nextLevel) return levelInfo.score;
  
  const progressWithin = estimateProgressWithinLevel(progress);
  const levelSpan = nextLevel.score - levelInfo.score;
  
  return Math.round(levelInfo.score + (progressWithin * levelSpan));
}

interface ActflRingDialProps {
  score: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function ActflRingDial({ 
  score, 
  color, 
  size = 100, 
  strokeWidth = 8,
  showLabel = true,
  label,
  className = ""
}: ActflRingDialProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (score / 100) * circumference;
  const center = size / 2;
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox={`0 0 ${size} ${size}`}
      className={className}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={progressOffset}
        className="transform -rotate-90 transition-all duration-500"
        style={{ transformOrigin: `${center}px ${center}px` }}
      />
      {showLabel && label && (
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          className="text-xl font-bold"
        >
          {label}
        </text>
      )}
    </svg>
  );
}

interface ActflDialSvgGroupProps {
  cx: number;
  cy: number;
  size?: number;
  strokeWidth?: number;
  score: number;
  levelInfo: ActflLevelInfo;
  showFluencyLabel?: boolean;
}

export function ActflDialSvgGroup({ 
  cx, 
  cy, 
  size = 100, 
  strokeWidth = 8,
  score,
  levelInfo,
  showFluencyLabel = true
}: ActflDialSvgGroupProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (score / 100) * circumference;
  const halfSize = size / 2;
  
  return (
    <g transform={`translate(${cx - halfSize}, ${cy - halfSize})`}>
      <defs>
        <radialGradient id="actflCenterGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={levelInfo.color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={levelInfo.color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={halfSize} cy={halfSize} r={halfSize + 10} fill="url(#actflCenterGlow)" />
      <circle 
        cx={halfSize} 
        cy={halfSize} 
        r={halfSize} 
        fill="hsl(var(--card))" 
      />
      <circle
        cx={halfSize}
        cy={halfSize}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted) / 0.3)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={halfSize}
        cy={halfSize}
        r={radius}
        fill="none"
        stroke={levelInfo.color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={progressOffset}
        className="transform -rotate-90 transition-all duration-500"
        style={{ transformOrigin: `${halfSize}px ${halfSize}px` }}
      />
      <text 
        x={halfSize} 
        y={showFluencyLabel ? halfSize - 5 : halfSize} 
        textAnchor="middle" 
        dominantBaseline="middle"
        className="text-xl font-bold"
        fill={levelInfo.color}
      >
        {levelInfo.shortLabel}
      </text>
      {showFluencyLabel && (
        <text 
          x={halfSize} 
          y={halfSize + 18} 
          textAnchor="middle" 
          dominantBaseline="middle"
          className="text-[10px]"
          fill="hsl(var(--muted-foreground))"
        >
          Fluency
        </text>
      )}
    </g>
  );
}
