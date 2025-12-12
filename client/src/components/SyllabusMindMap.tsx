/**
 * SyllabusMindMap - Brain-based visualization with orbital lobe-shaped satellites
 * 
 * Features:
 * - Colorful brain image with transparent background (floating effect)
 * - 5 lobe-shaped satellite bubbles orbiting the brain
 * - 3-state lighting system: dim → semi-lit → lit (based on mastery progress)
 * - ACTFL standards meter in the center of the brain
 * - Expand-in-place animation for topic lists
 * - Phase progression: Beginner → Intermediate → Advanced
 */

import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sparkles, Lock, CheckCircle2, Circle, ChevronUp,
  MessageSquare, BookOpen, Compass, Palette, Settings2, X
} from "lucide-react";
import { useState, useMemo } from "react";
import type { ActflProgress } from "@shared/schema";
import { calculateContinuousScore } from "@/components/actfl/actfl-gauge-core";
import brainImage from "@assets/transparent_colorful_cartoon_brain_Background_Removed_1765564186963.png";

interface TopicNode {
  id: string;
  name: string;
  status: 'discovered' | 'practiced' | 'mastered' | 'locked';
  practiceCount: number;
  lastPracticed?: string | null;
  connections: string[];
  category?: string;
  topicType?: string;
}

type BrainSegment = 'frontal' | 'temporal' | 'parietal' | 'occipital' | 'cerebellum';
type LightingState = 'dim' | 'semi-lit' | 'lit';

const SEGMENT_CONFIG: Record<BrainSegment, {
  name: string;
  shortName: string;
  color: string;
  glowColor: string;
  icon: typeof MessageSquare;
  categories: string[];
  // Orbital position (angle in degrees, distance from center)
  orbit: { angle: number; distance: number };
  // Soft cloud-like SVG path (100x70 viewBox)
  cloudPath: string;
  // Arrow endpoint on brain (relative to brain center, percentage of brain size)
  arrowTarget: { x: number; y: number };
}> = {
  frontal: {
    name: 'Communication',
    shortName: 'TALK!',
    color: '#60A5FA', // light blue matching brain
    glowColor: 'rgba(96, 165, 250, 0.6)',
    icon: MessageSquare,
    categories: ['Social Situations', 'Communication', 'Conversations', 'Introductions'],
    orbit: { angle: -55, distance: 150 },
    cloudPath: 'M25,35 C10,35 5,25 15,15 C20,5 35,5 45,10 C55,5 70,8 75,18 C85,20 90,32 80,42 C85,52 75,60 60,58 C50,65 30,62 25,52 C12,55 8,45 25,35 Z',
    arrowTarget: { x: -40, y: -40 }, // Blue frontal lobe (top-left)
  },
  parietal: {
    name: 'Practical Skills',
    shortName: 'DO!',
    color: '#4ADE80', // green matching brain
    glowColor: 'rgba(74, 222, 128, 0.6)',
    icon: Compass,
    categories: ['Daily Life', 'Travel', 'Directions', 'Shopping', 'Work'],
    orbit: { angle: -15, distance: 160 },
    cloudPath: 'M20,38 C8,35 5,22 18,12 C28,2 48,5 55,12 C65,5 82,10 85,25 C95,30 92,48 78,52 C80,62 65,68 50,60 C35,68 15,60 18,48 C5,48 8,40 20,38 Z',
    arrowTarget: { x: 10, y: -45 }, // Green parietal lobe (top-center-right)
  },
  temporal: {
    name: 'Vocabulary',
    shortName: 'WORDS!',
    color: '#FBBF24', // yellow matching brain
    glowColor: 'rgba(251, 191, 36, 0.6)',
    icon: BookOpen,
    categories: ['Vocabulary', 'Memory', 'Numbers', 'Colors', 'Time'],
    orbit: { angle: 200, distance: 150 },
    cloudPath: 'M22,32 C10,28 8,15 22,10 C32,2 52,5 58,15 C68,8 85,15 82,30 C92,38 85,55 70,55 C72,65 55,70 42,62 C28,70 10,60 15,48 C2,45 5,35 22,32 Z',
    arrowTarget: { x: -60, y: 5 }, // Yellow temporal lobe (left side)
  },
  occipital: {
    name: 'Culture',
    shortName: 'FEEL!',
    color: '#F87171', // red matching brain
    glowColor: 'rgba(248, 113, 113, 0.6)',
    icon: Palette,
    categories: ['Culture', 'Customs', 'Traditions', 'Food', 'Music', 'Art'],
    orbit: { angle: 25, distance: 155 },
    cloudPath: 'M28,35 C15,32 10,20 25,12 C35,3 55,8 60,18 C72,10 88,18 85,32 C95,40 88,58 72,55 C75,65 58,72 45,62 C30,70 12,58 18,45 C5,42 10,35 28,35 Z',
    arrowTarget: { x: 55, y: -5 }, // Red/orange occipital lobe (right side)
  },
  cerebellum: {
    name: 'Grammar',
    shortName: 'BUILD!',
    color: '#C084FC', // purple matching brain
    glowColor: 'rgba(192, 132, 252, 0.6)',
    icon: Settings2,
    categories: ['Grammar', 'Conjugation', 'Tenses', 'Sentence Structure'],
    orbit: { angle: 160, distance: 155 },
    cloudPath: 'M25,30 C12,25 8,12 25,8 C38,0 58,5 62,18 C75,10 92,22 85,38 C95,48 82,62 65,58 C68,70 48,75 35,65 C20,72 5,58 15,45 C2,40 8,32 25,30 Z',
    arrowTarget: { x: 15, y: 50 }, // Purple cerebellum (bottom)
  },
};

function getCategorySegment(category: string): BrainSegment {
  const categoryLower = category.toLowerCase();
  
  if (['social situations', 'communication', 'conversations', 'introductions', 'greetings'].some(c => categoryLower.includes(c.toLowerCase()))) {
    return 'frontal';
  }
  if (['daily life', 'travel', 'directions', 'shopping', 'work', 'practical'].some(c => categoryLower.includes(c.toLowerCase()))) {
    return 'parietal';
  }
  if (['vocabulary', 'memory', 'numbers', 'colors', 'time', 'family', 'weather'].some(c => categoryLower.includes(c.toLowerCase()))) {
    return 'temporal';
  }
  if (['culture', 'customs', 'traditions', 'food', 'music', 'art'].some(c => categoryLower.includes(c.toLowerCase()))) {
    return 'occipital';
  }
  if (['grammar', 'conjugation', 'tenses', 'sentence', 'verb', 'noun'].some(c => categoryLower.includes(c.toLowerCase()))) {
    return 'cerebellum';
  }
  
  return 'temporal';
}

function getLightingState(progress: number): LightingState {
  if (progress >= 70) return 'lit';
  if (progress >= 30) return 'semi-lit';
  return 'dim';
}

function TopicListItem({ topic }: { topic: TopicNode }) {
  const Icon = topic.status === 'mastered' ? CheckCircle2 : 
               topic.status === 'practiced' ? Sparkles : 
               topic.status === 'discovered' ? Circle : Lock;
  
  const statusColor = topic.status === 'mastered' ? 'text-green-500' :
                      topic.status === 'practiced' ? 'text-blue-500' :
                      topic.status === 'discovered' ? 'text-purple-500' :
                      'text-muted-foreground';
  
  return (
    <div 
      className={`flex items-center gap-2 py-1.5 px-2 rounded-md text-sm ${
        topic.status === 'locked' ? 'opacity-50' : ''
      }`}
      data-testid={`topic-item-${topic.id}`}
    >
      <Icon className={`h-4 w-4 flex-shrink-0 ${statusColor}`} />
      <span className={topic.status === 'mastered' ? 'font-medium' : ''}>
        {topic.name}
      </span>
      {topic.practiceCount > 0 && (
        <Badge variant="secondary" className="ml-auto text-xs h-5">
          {topic.practiceCount}x
        </Badge>
      )}
    </div>
  );
}

function LobeSatellite({ 
  segment, 
  topics,
  isExpanded,
  onToggle,
  centerX,
  centerY,
}: { 
  segment: BrainSegment;
  topics: TopicNode[];
  isExpanded: boolean;
  onToggle: () => void;
  centerX: number;
  centerY: number;
}) {
  const config = SEGMENT_CONFIG[segment];
  const Icon = config.icon;
  
  const mastered = topics.filter(t => t.status === 'mastered').length;
  const total = topics.length;
  const progress = total > 0 ? (mastered / total) * 100 : 0;
  const lightingState = getLightingState(progress);
  
  // Calculate position based on orbit
  const angle = (config.orbit.angle * Math.PI) / 180;
  const x = centerX + Math.cos(angle) * config.orbit.distance;
  const y = centerY + Math.sin(angle) * config.orbit.distance;
  
  // Lighting state styles
  const opacityMap: Record<LightingState, number> = {
    dim: 0.4,
    'semi-lit': 0.7,
    lit: 1,
  };
  
  const glowIntensity: Record<LightingState, string> = {
    dim: '0 0 0px transparent',
    'semi-lit': `0 0 15px ${config.glowColor}`,
    lit: `0 0 25px ${config.glowColor}, 0 0 50px ${config.glowColor}`,
  };

  // Expanded size for in-place expansion - bigger satellite size
  const expandedWidth = 220;
  const expandedHeight = 240;
  const collapsedWidth = 100;
  const collapsedHeight = 80;

  return (
    <div
      className={`absolute cursor-pointer transition-all duration-300 ease-out ${
        isExpanded ? 'z-40' : 'z-10'
      }`}
      style={{
        left: isExpanded ? x - expandedWidth / 2 : x - collapsedWidth / 2,
        top: isExpanded ? y - collapsedHeight / 2 : y - collapsedHeight / 2,
        width: isExpanded ? expandedWidth : collapsedWidth,
        height: isExpanded ? expandedHeight : collapsedHeight,
        opacity: opacityMap[lightingState],
      }}
      onClick={() => !isExpanded && onToggle()}
      data-testid={`satellite-${segment}`}
    >
      {/* Background shape - morphs from cloud to rounded card */}
      <div 
        className="absolute inset-0 transition-all duration-300"
        style={{
          borderRadius: isExpanded ? '16px' : '0',
          backgroundColor: isExpanded ? 'var(--card)' : 'transparent',
          border: isExpanded ? '1px solid var(--border)' : 'none',
          boxShadow: isExpanded ? '0 20px 40px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        {/* Collapsed: Show comic-book splat SVG with text */}
        <div 
          className="absolute inset-0 transition-all duration-300"
          style={{ 
            opacity: isExpanded ? 0 : 1,
            transform: isExpanded ? 'scale(0.5)' : 'scale(1)',
          }}
        >
          <svg 
            width={collapsedWidth} 
            height={collapsedHeight} 
            viewBox="0 0 100 80"
            className="w-full h-full"
          >
            <defs>
              {/* Cloud shape as clipPath to contain all effects */}
              <clipPath id={`cloud-clip-${segment}`}>
                <path d={config.cloudPath} />
              </clipPath>
              {/* Empty (unfilled) gradient - lighter/desaturated version */}
              <linearGradient id={`grad-empty-${segment}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={config.color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={config.color} stopOpacity="0.2" />
              </linearGradient>
              {/* Filled gradient - full saturation */}
              <linearGradient id={`grad-filled-${segment}`} x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor={config.color} stopOpacity="1" />
                <stop offset="100%" stopColor={config.color} stopOpacity="0.85" />
              </linearGradient>
            </defs>
            
            {/* Main group with drop shadow on the shape only */}
            <g style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.25)) ${lightingState === 'lit' ? `drop-shadow(0 0 8px ${config.glowColor})` : ''}` }}>
              {/* Background cloud shape (empty/unfilled base) */}
              <path
                d={config.cloudPath}
                fill={`url(#grad-empty-${segment})`}
                stroke="white"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              
              {/* Filled portion clipped to cloud shape - rises from bottom */}
              <g clipPath={`url(#cloud-clip-${segment})`}>
                <rect
                  x="0"
                  y={80 - (progress / 100) * 80}
                  width="100"
                  height={(progress / 100) * 80}
                  fill={`url(#grad-filled-${segment})`}
                  className="transition-all duration-700"
                />
              </g>
              
              {/* White stroke on top for crisp edge */}
              <path
                d={config.cloudPath}
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </g>
            
            {/* Text label inside splat */}
            <text
              x="50"
              y="38"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontWeight="bold"
              fontSize="14"
              fontFamily="system-ui, sans-serif"
              style={{ 
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                letterSpacing: '-0.5px',
              }}
            >
              {config.shortName}
            </text>
            
            {/* Progress counter */}
            <text
              x="50"
              y="55"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontWeight="600"
              fontSize="10"
              fontFamily="system-ui, sans-serif"
              style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.6)' }}
            >
              {mastered}/{total}
            </text>
          </svg>
        </div>

        {/* Expanded: Show content */}
        <div 
          className="absolute inset-0 p-3 transition-all duration-300 overflow-hidden"
          style={{ 
            opacity: isExpanded ? 1 : 0,
            transform: isExpanded ? 'scale(1)' : 'scale(0.8)',
          }}
        >
          {/* Header with colored bar */}
          <div 
            className="h-1 rounded-full mb-2"
            style={{ backgroundColor: config.color }}
          />
          
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" style={{ color: config.color }} />
              <div>
                <h3 className="font-semibold text-xs" style={{ color: config.color }}>
                  {config.name}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {mastered}/{total} mastered
                </p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              data-testid={`close-${segment}`}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
          
          {/* Progress bar */}
          <Progress value={progress} className="h-1 mb-2" />
          
          {/* Topics list */}
          <div className="space-y-0 max-h-32 overflow-y-auto text-xs">
            {topics.length > 0 ? (
              topics.slice(0, 6).map(topic => (
                <TopicListItem key={topic.id} topic={topic} />
              ))
            ) : (
              <p className="text-[10px] text-muted-foreground py-2 text-center">
                No topics yet
              </p>
            )}
            {topics.length > 6 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                +{topics.length - 6} more
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ACTFLMeter({ progress, level }: { progress: ActflProgress | null | undefined; level: string }) {
  // Use the same continuous score calculation as the Language Hub dial
  const overallProgress = calculateContinuousScore(progress?.currentActflLevel, progress);

  // Compact half-circle dial with needle
  const size = 80;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const needleAngle = -180 + (overallProgress / 100) * 180;
  const needleRadians = (needleAngle * Math.PI) / 180;
  const needleLength = radius - 12;
  const needleX = center + needleLength * Math.cos(needleRadians);
  const needleY = center + needleLength * Math.sin(needleRadians);

  return (
    <div 
      className="absolute flex flex-col items-center justify-center pointer-events-none z-30"
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
      data-testid="actfl-meter"
    >
      {/* Half-circle dial with needle */}
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`} className="overflow-visible">
        <defs>
          <linearGradient id="actfl-dial-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="33%" stopColor="#f59e0b" />
            <stop offset="66%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <filter id="dial-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Semi-transparent arc-shaped background matching the dial */}
        <path
          d={`M ${strokeWidth / 2 - 6} ${center + 8} 
              A ${radius + 6} ${radius + 6} 0 0 1 ${size - strokeWidth / 2 + 6} ${center + 8}
              L ${size - strokeWidth / 2 + 6} ${center + 22}
              L ${strokeWidth / 2 - 6} ${center + 22}
              Z`}
          fill="rgba(0,0,0,0.5)"
        />
        
        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Colored arc showing progress */}
        <path
          d={`M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`}
          fill="none"
          stroke="url(#actfl-dial-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={radius * Math.PI}
          strokeDashoffset={(1 - overallProgress / 100) * radius * Math.PI}
          style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
          filter="url(#dial-glow)"
        />
        
        {/* Needle */}
        <g style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
          <circle cx={center} cy={center} r={6} fill="white" />
          <line
            x1={center}
            y1={center}
            x2={needleX}
            y2={needleY}
            stroke="white"
            strokeWidth={2.5}
            strokeLinecap="round"
            style={{ transition: 'all 0.7s ease-out' }}
          />
          <circle cx={center} cy={center} r={3} fill="#1f2937" />
        </g>
        
        {/* Score number below - with extra padding from needle */}
        <text
          x={center}
          y={center + 24}
          textAnchor="middle"
          fill="white"
          fontSize="14"
          fontWeight="bold"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
        >
          {Math.round(overallProgress)}
        </text>
      </svg>
    </div>
  );
}

const DEMO_TOPICS: TopicNode[] = [
  { id: '1', name: 'Greetings', status: 'mastered', practiceCount: 15, connections: [], category: 'Social Situations', topicType: 'subject' },
  { id: '2', name: 'Introductions', status: 'mastered', practiceCount: 12, connections: [], category: 'Communication', topicType: 'subject' },
  { id: '3', name: 'Family Members', status: 'practiced', practiceCount: 8, connections: [], category: 'Vocabulary', topicType: 'subject' },
  { id: '4', name: 'Shopping', status: 'practiced', practiceCount: 5, connections: [], category: 'Daily Life', topicType: 'function' },
  { id: '5', name: 'Weather', status: 'discovered', practiceCount: 2, connections: [], category: 'Vocabulary', topicType: 'subject' },
  { id: '6', name: 'Food & Cuisine', status: 'discovered', practiceCount: 3, connections: [], category: 'Culture', topicType: 'subject' },
  { id: '7', name: 'Past Tense', status: 'practiced', practiceCount: 6, connections: [], category: 'Grammar', topicType: 'grammar' },
  { id: '8', name: 'Asking Directions', status: 'discovered', practiceCount: 1, connections: [], category: 'Travel', topicType: 'function' },
  { id: '9', name: 'Customs', status: 'locked', practiceCount: 0, connections: [], category: 'Culture', topicType: 'subject' },
  { id: '10', name: 'Verb Conjugation', status: 'locked', practiceCount: 0, connections: [], category: 'Grammar', topicType: 'grammar' },
  { id: '11', name: 'Numbers 1-100', status: 'mastered', practiceCount: 20, connections: [], category: 'Vocabulary', topicType: 'subject' },
  { id: '12', name: 'Colors', status: 'mastered', practiceCount: 18, connections: [], category: 'Vocabulary', topicType: 'subject' },
];

interface SyllabusMindMapProps {
  classId?: string;
  language?: string;
  className?: string;
  mode?: 'emergent' | 'roadmap';
}

export function SyllabusMindMap({ classId, language: languageProp, className, mode = 'emergent' }: SyllabusMindMapProps) {
  const { language: globalLanguage, difficulty } = useLanguage();
  const language = languageProp ?? globalLanguage;
  const [expandedSegment, setExpandedSegment] = useState<BrainSegment | null>(null);
  
  // Container dimensions for positioning
  const containerWidth = 400;
  const containerHeight = 400;
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  
  const { data: progress, isLoading: progressLoading } = useQuery<ActflProgress | null>({
    queryKey: ['/api/actfl-progress', language],
    enabled: !!language && language !== 'all',
  });
  
  const { data: conversationTopics, isLoading: topicsLoading } = useQuery<{ topics: TopicNode[] }>({
    queryKey: ['/api/conversation-topics', language],
    enabled: !!language && language !== 'all',
  });
  
  const allTopics = conversationTopics?.topics || DEMO_TOPICS;
  
  const visibleTopics = useMemo(() => {
    if (mode === 'emergent') {
      return allTopics.filter(t => t.status !== 'locked');
    }
    return allTopics;
  }, [allTopics, mode]);
  
  const topicsBySegment = useMemo(() => {
    const result: Record<BrainSegment, TopicNode[]> = {
      frontal: [],
      temporal: [],
      parietal: [],
      occipital: [],
      cerebellum: [],
    };
    
    visibleTopics.forEach(topic => {
      const segment = getCategorySegment(topic.category || '');
      result[segment].push(topic);
    });
    
    return result;
  }, [visibleTopics]);
  
  // Calculate segment progress for brain lighting
  const segmentProgress = useMemo(() => {
    const segments: BrainSegment[] = ['frontal', 'temporal', 'parietal', 'occipital', 'cerebellum'];
    const result: Record<BrainSegment, number> = {} as any;
    
    segments.forEach(segment => {
      const topics = topicsBySegment[segment];
      const mastered = topics.filter(t => t.status === 'mastered').length;
      const total = topics.length;
      result[segment] = total > 0 ? (mastered / total) * 100 : 0;
    });
    
    return result;
  }, [topicsBySegment]);
  
  const toggleSegment = (segment: BrainSegment) => {
    setExpandedSegment(prev => prev === segment ? null : segment);
  };
  
  const isLoading = progressLoading || topicsLoading;
  
  if (isLoading) {
    return (
      <div className={className} data-testid="mind-map-loading">
        <div className="flex flex-col items-center justify-center h-[400px] gap-4">
          <Skeleton className="h-[180px] w-[180px] rounded-full" />
          <p className="text-sm text-muted-foreground">Building your learning brain...</p>
        </div>
      </div>
    );
  }
  
  const stats = {
    mastered: allTopics.filter(t => t.status === 'mastered').length,
    practiced: allTopics.filter(t => t.status === 'practiced').length,
    discovered: allTopics.filter(t => t.status === 'discovered').length,
    locked: allTopics.filter(t => t.status === 'locked').length,
  };
  
  // Calculate overall brain glow based on average progress
  const avgProgress = Object.values(segmentProgress).reduce((a, b) => a + b, 0) / 5;
  
  return (
    <div className={className} data-testid="syllabus-mind-map">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-2 mb-4 items-center justify-center">
        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          {stats.mastered} Mastered
        </Badge>
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {stats.practiced} Practicing
        </Badge>
        <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          {stats.discovered} Discovered
        </Badge>
        {mode === 'roadmap' && stats.locked > 0 && (
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            {stats.locked} Unexplored
          </Badge>
        )}
      </div>
      
      {/* Brain visualization container with soft blue cloud background */}
      <div 
        className="relative mx-auto rounded-3xl"
        style={{ 
          width: containerWidth, 
          height: containerHeight + 120, // Extra space for expanded panels
          background: 'linear-gradient(135deg, #87CEEB 0%, #B0E0E6 30%, #E0F4FF 60%, #87CEEB 100%)',
        }}
        data-testid="brain-container"
      >
        {/* Cloud decorations */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-50" preserveAspectRatio="none">
          <ellipse cx="10%" cy="15%" rx="60" ry="30" fill="white" opacity="0.6"/>
          <ellipse cx="85%" cy="20%" rx="50" ry="25" fill="white" opacity="0.5"/>
          <ellipse cx="15%" cy="85%" rx="70" ry="35" fill="white" opacity="0.4"/>
          <ellipse cx="90%" cy="80%" rx="55" ry="28" fill="white" opacity="0.5"/>
        </svg>
        
        {/* Curved arrows from satellites to brain - above brain */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#374151"/>
            </marker>
          </defs>
          {(['frontal', 'parietal', 'temporal', 'occipital', 'cerebellum'] as BrainSegment[]).map(segment => {
            const config = SEGMENT_CONFIG[segment];
            const angle = (config.orbit.angle * Math.PI) / 180;
            const satelliteX = centerX + Math.cos(angle) * config.orbit.distance;
            const satelliteY = centerY + Math.sin(angle) * config.orbit.distance;
            const targetX = centerX + config.arrowTarget.x;
            const targetY = centerY + config.arrowTarget.y;
            
            // Calculate control point for curved arrow
            const midX = (satelliteX + targetX) / 2;
            const midY = (satelliteY + targetY) / 2;
            const curveOffset = 20;
            const perpAngle = Math.atan2(targetY - satelliteY, targetX - satelliteX) + Math.PI / 2;
            const ctrlX = midX + Math.cos(perpAngle) * curveOffset;
            const ctrlY = midY + Math.sin(perpAngle) * curveOffset;
            
            // Start point offset from satellite edge
            const startOffsetX = Math.cos(Math.atan2(targetY - satelliteY, targetX - satelliteX)) * 45;
            const startOffsetY = Math.sin(Math.atan2(targetY - satelliteY, targetX - satelliteX)) * 35;
            
            return (
              <path
                key={`arrow-${segment}`}
                d={`M ${satelliteX + startOffsetX} ${satelliteY + startOffsetY} Q ${ctrlX} ${ctrlY} ${targetX} ${targetY}`}
                stroke={config.color}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                markerEnd="url(#arrowhead)"
                opacity="0.8"
                className="transition-opacity duration-300"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
              />
            );
          })}
        </svg>
        
        {/* Click outside to close expanded panel */}
        {expandedSegment && (
          <div 
            className="absolute inset-0 z-20"
            onClick={() => setExpandedSegment(null)}
          />
        )}
        
        {/* Brain image - floating with glow effect and per-lobe lighting - at back */}
        <div 
          className="absolute transition-all duration-500 z-10"
          style={{
            left: centerX - 100,
            top: centerY - 100,
            width: 200,
            height: 200,
          }}
        >
          {/* Ambient glow behind brain */}
          <div 
            className="absolute inset-0 rounded-full blur-xl transition-opacity duration-700"
            style={{
              background: `radial-gradient(circle, rgba(139, 92, 246, ${0.2 + avgProgress / 200}) 0%, rgba(59, 130, 246, ${0.1 + avgProgress / 300}) 50%, transparent 70%)`,
            }}
          />
          
          {/* Brain image - transparent PNG, no masking needed */}
          <img 
            src={brainImage} 
            alt="Your Learning Brain" 
            className="w-full h-full object-contain relative z-10"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}
            data-testid="brain-image"
          />
          
          {/* Per-lobe lighting overlays */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none z-20"
            viewBox="0 0 200 200"
          >
            <defs>
              {/* Glow filters for each segment */}
              {(['frontal', 'parietal', 'temporal', 'occipital', 'cerebellum'] as BrainSegment[]).map(segment => (
                <filter key={`filter-${segment}`} id={`glow-${segment}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              ))}
            </defs>
            
            {/* Frontal lobe (top-left, blue) */}
            <ellipse
              cx="65"
              cy="60"
              rx="35"
              ry="40"
              fill={SEGMENT_CONFIG.frontal.color}
              opacity={segmentProgress.frontal >= 70 ? 0.4 : segmentProgress.frontal >= 30 ? 0.2 : 0.05}
              filter={segmentProgress.frontal >= 70 ? 'url(#glow-frontal)' : undefined}
              className="transition-all duration-700"
            />
            
            {/* Parietal lobe (top-right, green) */}
            <ellipse
              cx="130"
              cy="55"
              rx="30"
              ry="35"
              fill={SEGMENT_CONFIG.parietal.color}
              opacity={segmentProgress.parietal >= 70 ? 0.4 : segmentProgress.parietal >= 30 ? 0.2 : 0.05}
              filter={segmentProgress.parietal >= 70 ? 'url(#glow-parietal)' : undefined}
              className="transition-all duration-700"
            />
            
            {/* Temporal lobe (left side, yellow) */}
            <ellipse
              cx="55"
              cy="120"
              rx="30"
              ry="25"
              fill={SEGMENT_CONFIG.temporal.color}
              opacity={segmentProgress.temporal >= 70 ? 0.4 : segmentProgress.temporal >= 30 ? 0.2 : 0.05}
              filter={segmentProgress.temporal >= 70 ? 'url(#glow-temporal)' : undefined}
              className="transition-all duration-700"
            />
            
            {/* Occipital lobe (back, red) */}
            <ellipse
              cx="155"
              cy="100"
              rx="25"
              ry="30"
              fill={SEGMENT_CONFIG.occipital.color}
              opacity={segmentProgress.occipital >= 70 ? 0.4 : segmentProgress.occipital >= 30 ? 0.2 : 0.05}
              filter={segmentProgress.occipital >= 70 ? 'url(#glow-occipital)' : undefined}
              className="transition-all duration-700"
            />
            
            {/* Cerebellum (bottom-back, purple) */}
            <ellipse
              cx="145"
              cy="155"
              rx="30"
              ry="22"
              fill={SEGMENT_CONFIG.cerebellum.color}
              opacity={segmentProgress.cerebellum >= 70 ? 0.4 : segmentProgress.cerebellum >= 30 ? 0.2 : 0.05}
              filter={segmentProgress.cerebellum >= 70 ? 'url(#glow-cerebellum)' : undefined}
              className="transition-all duration-700"
            />
          </svg>
          
          {/* ACTFL Meter overlay */}
          <ACTFLMeter progress={progress} level={difficulty} />
        </div>
        
        {/* Orbital satellite lobes */}
        {(['frontal', 'parietal', 'temporal', 'occipital', 'cerebellum'] as BrainSegment[]).map(segment => (
          <LobeSatellite
            key={segment}
            segment={segment}
            topics={topicsBySegment[segment]}
            isExpanded={expandedSegment === segment}
            onToggle={() => toggleSegment(segment)}
            centerX={centerX}
            centerY={centerY}
          />
        ))}
      </div>
      
      {/* Instructions hint */}
      <div className="text-center mt-4">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          <ChevronUp className="h-3 w-3" />
          Tap a lobe to explore topics
        </p>
      </div>
    </div>
  );
}
