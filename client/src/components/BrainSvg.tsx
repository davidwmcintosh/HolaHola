/**
 * BrainSvg - Interactive brain visualization with 5 lightable segments
 * 
 * Segments mapped to topic categories:
 * - Frontal: Communication/Social (greetings, introductions, conversations)
 * - Temporal: Language/Memory (vocabulary, phrases, common expressions)
 * - Parietal: Practical/Spatial (directions, travel, shopping, numbers)
 * - Occipital: Cultural/Visual (customs, media, art, holidays)
 * - Cerebellum: Grammar/Mechanics (verb tenses, conjugation, sentence structure)
 */

import { useMemo } from "react";

export type BrainSegment = 'frontal' | 'temporal' | 'parietal' | 'occipital' | 'cerebellum';

export interface BrainSegmentData {
  segment: BrainSegment;
  label: string;
  categories: string[];
  masteryPercent: number;
}

interface BrainSvgProps {
  segments: BrainSegmentData[];
  size?: number;
  className?: string;
  onSegmentClick?: (segment: BrainSegment) => void;
  onSegmentHover?: (segment: BrainSegment | null) => void;
  hoveredSegment?: BrainSegment | null;
}

const SEGMENT_CONFIG: Record<BrainSegment, { 
  baseColor: string; 
  glowColor: string; 
  position: { angle: number; distance: number };
  labelOffset: { x: number; y: number };
}> = {
  frontal: { 
    baseColor: '#6366f1', 
    glowColor: '#818cf8',
    position: { angle: -90, distance: 0 },
    labelOffset: { x: 0, y: -45 }
  },
  temporal: { 
    baseColor: '#8b5cf6', 
    glowColor: '#a78bfa',
    position: { angle: 180, distance: 25 },
    labelOffset: { x: -55, y: 0 }
  },
  parietal: { 
    baseColor: '#06b6d4', 
    glowColor: '#22d3ee',
    position: { angle: 0, distance: 25 },
    labelOffset: { x: 55, y: 0 }
  },
  occipital: { 
    baseColor: '#f59e0b', 
    glowColor: '#fbbf24',
    position: { angle: 135, distance: 30 },
    labelOffset: { x: -40, y: 40 }
  },
  cerebellum: { 
    baseColor: '#10b981', 
    glowColor: '#34d399',
    position: { angle: 45, distance: 30 },
    labelOffset: { x: 40, y: 40 }
  },
};

function getSegmentOpacity(masteryPercent: number): number {
  if (masteryPercent >= 100) return 1.0;
  if (masteryPercent >= 75) return 0.85;
  if (masteryPercent >= 50) return 0.65;
  if (masteryPercent >= 25) return 0.45;
  if (masteryPercent > 0) return 0.3;
  return 0.15;
}

function getGlowIntensity(masteryPercent: number): number {
  if (masteryPercent >= 100) return 1.0;
  if (masteryPercent >= 75) return 0.7;
  if (masteryPercent >= 50) return 0.4;
  if (masteryPercent >= 25) return 0.2;
  return 0;
}

export function BrainSvg({ 
  segments, 
  size = 120, 
  className,
  onSegmentClick,
  onSegmentHover,
  hoveredSegment
}: BrainSvgProps) {
  const segmentMap = useMemo(() => {
    const map = new Map<BrainSegment, BrainSegmentData>();
    segments.forEach(s => map.set(s.segment, s));
    return map;
  }, [segments]);

  const center = size / 2;
  const brainScale = size / 120;

  return (
    <svg 
      viewBox={`0 0 ${size} ${size}`} 
      width={size} 
      height={size}
      className={className}
      data-testid="brain-svg"
    >
      <defs>
        {Object.entries(SEGMENT_CONFIG).map(([segment, config]) => {
          const data = segmentMap.get(segment as BrainSegment);
          const glowIntensity = getGlowIntensity(data?.masteryPercent ?? 0);
          return (
            <filter key={`glow-${segment}`} id={`brain-glow-${segment}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={3 * glowIntensity} result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          );
        })}
        <radialGradient id="brain-center-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={center} cy={center} r={center * 0.9} fill="url(#brain-center-glow)" />

      <g transform={`translate(${center - 50 * brainScale}, ${center - 45 * brainScale}) scale(${brainScale})`}>
        {/* Frontal Lobe - Top front of brain */}
        <BrainSegmentPath
          segment="frontal"
          path="M50,10 C25,10 10,25 10,45 C10,55 15,65 25,70 L50,75 L75,70 C85,65 90,55 90,45 C90,25 75,10 50,10 Z"
          config={SEGMENT_CONFIG.frontal}
          data={segmentMap.get('frontal')}
          isHovered={hoveredSegment === 'frontal'}
          onClick={() => onSegmentClick?.('frontal')}
          onHover={(h) => onSegmentHover?.(h ? 'frontal' : null)}
        />
        
        {/* Temporal Lobe - Side left */}
        <BrainSegmentPath
          segment="temporal"
          path="M10,45 C5,50 5,60 10,70 C15,80 25,85 35,85 L50,75 L25,70 C15,65 10,55 10,45 Z"
          config={SEGMENT_CONFIG.temporal}
          data={segmentMap.get('temporal')}
          isHovered={hoveredSegment === 'temporal'}
          onClick={() => onSegmentClick?.('temporal')}
          onHover={(h) => onSegmentHover?.(h ? 'temporal' : null)}
        />
        
        {/* Parietal Lobe - Side right */}
        <BrainSegmentPath
          segment="parietal"
          path="M90,45 C95,50 95,60 90,70 C85,80 75,85 65,85 L50,75 L75,70 C85,65 90,55 90,45 Z"
          config={SEGMENT_CONFIG.parietal}
          data={segmentMap.get('parietal')}
          isHovered={hoveredSegment === 'parietal'}
          onClick={() => onSegmentClick?.('parietal')}
          onHover={(h) => onSegmentHover?.(h ? 'parietal' : null)}
        />
        
        {/* Occipital Lobe - Back left */}
        <BrainSegmentPath
          segment="occipital"
          path="M35,85 C30,90 30,95 35,98 C40,100 45,100 50,98 L50,75 L35,85 Z"
          config={SEGMENT_CONFIG.occipital}
          data={segmentMap.get('occipital')}
          isHovered={hoveredSegment === 'occipital'}
          onClick={() => onSegmentClick?.('occipital')}
          onHover={(h) => onSegmentHover?.(h ? 'occipital' : null)}
        />
        
        {/* Cerebellum - Back right */}
        <BrainSegmentPath
          segment="cerebellum"
          path="M65,85 C70,90 70,95 65,98 C60,100 55,100 50,98 L50,75 L65,85 Z"
          config={SEGMENT_CONFIG.cerebellum}
          data={segmentMap.get('cerebellum')}
          isHovered={hoveredSegment === 'cerebellum'}
          onClick={() => onSegmentClick?.('cerebellum')}
          onHover={(h) => onSegmentHover?.(h ? 'cerebellum' : null)}
        />

        {/* Brain fold lines for texture */}
        <g className="opacity-30" stroke="hsl(var(--foreground))" strokeWidth="0.5" fill="none">
          <path d="M30,30 Q40,35 50,30" />
          <path d="M50,30 Q60,35 70,30" />
          <path d="M25,45 Q35,50 45,45" />
          <path d="M55,45 Q65,50 75,45" />
          <path d="M35,60 Q45,65 55,60" />
        </g>
      </g>
    </svg>
  );
}

interface BrainSegmentPathProps {
  segment: BrainSegment;
  path: string;
  config: typeof SEGMENT_CONFIG[BrainSegment];
  data?: BrainSegmentData;
  isHovered: boolean;
  onClick: () => void;
  onHover: (isHovered: boolean) => void;
}

function BrainSegmentPath({ 
  segment, 
  path, 
  config, 
  data, 
  isHovered,
  onClick,
  onHover
}: BrainSegmentPathProps) {
  const masteryPercent = data?.masteryPercent ?? 0;
  const opacity = getSegmentOpacity(masteryPercent);
  const glowIntensity = getGlowIntensity(masteryPercent);
  
  const fillColor = masteryPercent >= 100 
    ? config.glowColor 
    : config.baseColor;

  return (
    <path
      d={path}
      fill={fillColor}
      fillOpacity={opacity}
      stroke={isHovered ? config.glowColor : 'hsl(var(--border))'}
      strokeWidth={isHovered ? 2 : 1}
      filter={glowIntensity > 0 ? `url(#brain-glow-${segment})` : undefined}
      className="cursor-pointer transition-all duration-300"
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      data-testid={`brain-segment-${segment}`}
    />
  );
}

export const BRAIN_SEGMENT_CATEGORIES: Record<BrainSegment, string[]> = {
  frontal: ['Greetings', 'Introductions', 'Conversations', 'Social Situations', 'Opinions'],
  temporal: ['Vocabulary', 'Common Phrases', 'Expressions', 'Idioms', 'Word Families'],
  parietal: ['Directions', 'Travel', 'Shopping', 'Numbers', 'Time', 'Weather', 'Daily Life'],
  occipital: ['Culture', 'Customs', 'Holidays', 'Food', 'Media', 'Art', 'Music'],
  cerebellum: ['Verbs', 'Conjugation', 'Tenses', 'Grammar', 'Sentence Structure', 'Pronouns'],
};

export function getCategorySegment(category: string): BrainSegment {
  const categoryLower = category.toLowerCase();
  
  for (const [segment, categories] of Object.entries(BRAIN_SEGMENT_CATEGORIES)) {
    if (categories.some(c => categoryLower.includes(c.toLowerCase()) || c.toLowerCase().includes(categoryLower))) {
      return segment as BrainSegment;
    }
  }
  
  if (categoryLower.includes('grammar') || categoryLower.includes('verb') || categoryLower.includes('tense')) {
    return 'cerebellum';
  }
  if (categoryLower.includes('travel') || categoryLower.includes('shop') || categoryLower.includes('daily')) {
    return 'parietal';
  }
  if (categoryLower.includes('cultur') || categoryLower.includes('food') || categoryLower.includes('holiday')) {
    return 'occipital';
  }
  if (categoryLower.includes('greet') || categoryLower.includes('social') || categoryLower.includes('intro')) {
    return 'frontal';
  }
  
  return 'temporal';
}
