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
import { useUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sparkles, Lock, CheckCircle2, Circle, ChevronUp,
  MessageSquare, BookOpen, Compass, Palette, Settings2, X,
  Target, Layers, GraduationCap, Globe, Mic, Clock,
  TrendingUp, TrendingDown, Minus, Trophy, AlertTriangle, Lightbulb, ChevronRight
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import type { ActflProgress, UnifiedProgressResponse, TimeVarianceSummary } from "@shared/schema";
import { calculateContinuousScore } from "@/components/actfl/actfl-gauge-core";
import brainImage from "@assets/transparent_colorful_cartoon_brain_Background_Removed_1765564186963.png";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { getTutorName } from "@/lib/tutor-avatars";

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

// Syllabus data types for class context
interface SyllabusLesson {
  id: string;
  name: string;
  orderIndex: number;
  lessonType: string;
  status: 'not_started' | 'in_progress' | 'completed';
  estimatedMinutes: number | null;
}

interface SyllabusUnit {
  id: string;
  name: string;
  orderIndex: number;
  lessons: SyllabusLesson[];
}

interface SyllabusOverview {
  classId: string;
  className: string;
  curriculumName: string;
  totalLessons: number;
  completedLessons: number;
  units: SyllabusUnit[];
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
    shortName: 'Chat!',
    color: '#60A5FA', // light blue matching brain
    glowColor: 'rgba(96, 165, 250, 0.6)',
    icon: MessageSquare,
    categories: ['Social Situations', 'Communication', 'Conversations', 'Introductions'],
    orbit: { angle: -65, distance: 150 },
    cloudPath: 'M25,35 C10,35 5,25 15,15 C20,5 35,5 45,10 C55,5 70,8 75,18 C85,20 90,32 80,42 C85,52 75,60 60,58 C50,65 30,62 25,52 C12,55 8,45 25,35 Z',
    arrowTarget: { x: -40, y: -40 }, // Blue frontal lobe (top-left)
  },
  parietal: {
    name: 'Practical Skills',
    shortName: 'Practice!',
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
    shortName: 'Words!',
    color: '#FBBF24', // yellow matching brain
    glowColor: 'rgba(251, 191, 36, 0.6)',
    icon: BookOpen,
    categories: ['Vocabulary', 'Memory', 'Numbers', 'Colors', 'Time'],
    orbit: { angle: 210, distance: 150 },
    cloudPath: 'M22,32 C10,28 8,15 22,10 C32,2 52,5 58,15 C68,8 85,15 82,30 C92,38 85,55 70,55 C72,65 55,70 42,62 C28,70 10,60 15,48 C2,45 5,35 22,32 Z',
    arrowTarget: { x: -60, y: 5 }, // Yellow temporal lobe (left side)
  },
  occipital: {
    name: 'Culture',
    shortName: 'Culture!',
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
    shortName: 'Grammar!',
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
  orbitScale = 1,
  isMobile = false,
}: { 
  segment: BrainSegment;
  topics: TopicNode[];
  isExpanded: boolean;
  onToggle: () => void;
  centerX: number;
  centerY: number;
  orbitScale?: number;
  isMobile?: boolean;
}) {
  const config = SEGMENT_CONFIG[segment];
  const Icon = config.icon;
  
  const mastered = topics.filter(t => t.status === 'mastered').length;
  const practiced = topics.filter(t => t.status === 'practiced').length;
  const total = topics.length;
  const progress = total > 0 ? ((mastered + practiced * 0.5) / total) * 100 : 0;
  const lightingState = getLightingState(progress);
  
  // Calculate position based on orbit - scales distance on mobile but keeps satellite size
  const angle = (config.orbit.angle * Math.PI) / 180;
  const x = centerX + Math.cos(angle) * config.orbit.distance * orbitScale;
  const y = centerY + Math.sin(angle) * config.orbit.distance * orbitScale;
  
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

  // Satellite sizes - mobile uses smaller expanded panels but same touch targets (≥44px)
  const expandedWidth = isMobile ? 200 : 260;
  const expandedHeight = isMobile ? 220 : 280;
  const collapsedWidth = isMobile ? 100 : 130; // Larger pills
  const collapsedHeight = isMobile ? 80 : 100; // Larger pills

  return (
    <div
      className={`absolute cursor-pointer transition-all duration-300 ease-out ${
        isExpanded ? 'z-40' : 'z-10 hover:z-30'
      } group`}
      style={{
        left: isExpanded ? x - expandedWidth / 2 : x - collapsedWidth / 2,
        top: isExpanded ? y - collapsedHeight / 2 : y - collapsedHeight / 2,
        width: isExpanded ? expandedWidth : collapsedWidth,
        height: isExpanded ? expandedHeight : collapsedHeight,
        // Opacity now only affects the fill, not text - text stays bright
      }}
      onClick={() => !isExpanded && onToggle()}
      data-testid={`satellite-${segment}`}
    >
      {/* Background shape - morphs from cloud to rounded card */}
      <div 
        className="absolute inset-0 transition-all duration-300"
        style={{
          borderRadius: isExpanded ? '16px' : '0',
          backgroundColor: isExpanded ? 'hsl(var(--card))' : 'transparent',
          border: isExpanded ? '1px solid hsl(var(--border))' : 'none',
          boxShadow: isExpanded ? '0 20px 40px rgba(0,0,0,0.4)' : 'none',
          backdropFilter: isExpanded ? 'blur(8px)' : 'none',
        }}
      >
        {/* Collapsed: Show comic-book splat SVG with text - scales up on hover */}
        <div 
          className={`absolute inset-0 transition-transform duration-200 ${!isExpanded ? 'group-hover:scale-110' : ''}`}
          style={{ 
            opacity: isExpanded ? 0 : 1,
            transform: isExpanded ? 'scale(0.5)' : undefined,
            transformOrigin: 'center center',
          }}
        >
          <svg 
            width={collapsedWidth} 
            height={collapsedHeight} 
            viewBox="0 0 100 80"
            className="w-full h-full"
            overflow="visible"
            style={{ overflow: 'visible' }}
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
              {/* Glow filter with expanded bounds - base shadow only */}
              <filter id={`glow-base-${segment}`} x="-50%" y="-50%" width="200%" height="200%" filterUnits="userSpaceOnUse">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.25)" />
              </filter>
              {/* Glow filter with expanded bounds - lit state with color glow */}
              <filter id={`glow-lit-${segment}`} x="-50%" y="-50%" width="200%" height="200%" filterUnits="userSpaceOnUse">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.25)" />
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={config.glowColor} />
              </filter>
            </defs>
            
            {/* Main group with filter for glow */}
            <g 
              filter={lightingState === 'lit' ? `url(#glow-lit-${segment})` : `url(#glow-base-${segment})`}
              style={{
                opacity: lightingState === 'dim' ? 0.6 : lightingState === 'semi-lit' ? 0.85 : 1,
              }}
            >
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
            
            {/* Text label inside splat - always full brightness */}
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
                textShadow: '1px 1px 3px rgba(0,0,0,0.7)',
                letterSpacing: '-0.5px',
                opacity: 1,
              }}
            >
              {config.shortName}
            </text>
            
            {/* Progress counter - just the positive number, no cap */}
            <text
              x="50"
              y="55"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontWeight="600"
              fontSize="10"
              fontFamily="system-ui, sans-serif"
              style={{ 
                textShadow: '1px 1px 3px rgba(0,0,0,0.7)',
                opacity: 1,
              }}
            >
              {mastered}
            </text>
          </svg>
        </div>

        {/* Expanded: Show content - only render when expanded to avoid accessibility tree pollution */}
        {isExpanded && (
        <div 
          className="absolute inset-0 p-3 transition-all duration-300 overflow-hidden"
          style={{ 
            opacity: 1,
            transform: 'scale(1)',
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
        )}
      </div>
    </div>
  );
}

// Types for Daniela's learning insights
interface RecurringStruggle {
  id: string;
  errorCategory: string;
  specificError: string;
  description: string;
  occurrenceCount: number;
  status: 'active' | 'improving' | 'resolved' | 'mastered';
  successfulApproaches: string[];
}

interface StudentInsight {
  id: string;
  insightType: string;
  content: string;
  confidenceScore: number;
}

interface PersonalFact {
  id: string;
  factType: string;
  fact: string;
  confidenceScore: number;
}

interface BreakthroughInfo {
  struggleArea: string;
  description: string;
  occurrenceCount: number;
  successfulStrategies: string[];
  createdAt: string;
}

interface StudentLearningContext {
  struggles: RecurringStruggle[];
  insights: StudentInsight[];
  personalFacts: PersonalFact[];
  effectiveStrategies: string[];
  strugglingAreas: string[];
  recentProgress: string[];
  recentBreakthroughs: BreakthroughInfo[];
}

const strategyLabels: Record<string, string> = {
  visual_timeline: "Visual timelines",
  role_play: "Role playing",
  repetition_drill: "Practice drills",
  comparison_chart: "Comparison charts",
  mnemonic: "Memory tricks",
  real_world_context: "Real-world examples",
  slow_pronunciation: "Slow pronunciation",
  written_example: "Written examples",
  chunking: "Breaking into chunks",
  spaced_repetition: "Spaced practice",
  error_correction_immediate: "Immediate feedback",
  self_discovery: "Discovery learning",
  explicit_rule: "Clear explanations",
  storytelling: "Storytelling",
};

const categoryLabels: Record<string, string> = {
  grammar: "Grammar",
  pronunciation: "Pronunciation", 
  vocabulary: "Vocabulary",
  cultural: "Cultural nuances",
  comprehension: "Listening",
};

// Tutor's Observations Bubble - Larger than lobe clouds, positioned on left
function TutorObservationsBubble({
  userId,
  language,
  tutorName,
  isExpanded,
  onToggle,
  centerX,
  centerY,
  isMobile = false,
}: {
  userId?: string;
  language: string;
  tutorName: string;
  isExpanded: boolean;
  onToggle: () => void;
  centerX: number;
  centerY: number;
  isMobile?: boolean;
}) {
  // Fetch learning context
  const { data: context, isLoading } = useQuery<StudentLearningContext | null>({
    queryKey: ["/api/student-learning/context", userId, language],
    queryFn: async () => {
      if (!userId || language === 'all') return null;
      const response = await fetch(`/api/student-learning/context/${userId}/${language}`, { 
        credentials: 'include' 
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.context as StudentLearningContext;
    },
    enabled: !!userId && language !== 'all',
  });

  const hasContent = context && (
    context.recentBreakthroughs.length > 0 || 
    context.struggles.length > 0 || 
    context.effectiveStrategies.length > 0 ||
    context.recentProgress.length > 0
  );

  // Always show the bubble - display placeholder if no content yet

  // Position in upper left corner - offset left for better visual balance
  const x = isMobile ? -30 : -100; // Left side position
  const y = isMobile ? 10 : -30; // Pushed up
  
  // Dimensions - smaller on mobile but still readable (text stays ≥12px)
  const collapsedWidth = isMobile ? 160 : 220;
  const collapsedHeight = isMobile ? 130 : 175;
  const expandedWidth = isMobile ? 280 : 380;
  const expandedHeight = isMobile ? 320 : 450;

  // Colors - primary/accent theme for importance
  const accentColor = 'hsl(var(--primary))';
  const glowColor = 'rgba(139, 92, 246, 0.5)';

  // Summary counts
  const breakthroughCount = context?.recentBreakthroughs.length || 0;
  const activeStruggles = context?.struggles.filter(s => s.status === 'active').slice(0, 3) || [];
  const improvingStruggles = context?.struggles.filter(s => s.status === 'improving').slice(0, 3) || [];
  const strategyCount = context?.effectiveStrategies.length || 0;

  // Cloud path for thought bubble (viewBox 0 0 180 140) - slightly reduced arch
  const cloudPath = "M40,62 C18,58 12,44 30,28 C44,12 80,15 96,26 C114,14 145,22 145,44 C160,50 156,76 135,82 C139,96 118,108 90,104 C72,115 40,110 36,92 C16,92 12,76 40,62 Z";

  return (
    <>
      {/* Arrow from observations bubble to brain */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 35 }}>
        <defs>
          <marker 
            id="arrowhead-daniela" 
            markerWidth="10" 
            markerHeight="7" 
            refX="9" 
            refY="3.5" 
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={accentColor}/>
          </marker>
        </defs>
        {!isExpanded && (
          <path
            d={`M ${x + collapsedWidth - 20} ${y + 70} Q ${x + collapsedWidth + 60} ${y + 80} ${centerX - 55} ${centerY - 75}`}
            stroke={accentColor}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            markerEnd="url(#arrowhead-daniela)"
            opacity="0.7"
            className="transition-opacity duration-300"
          />
        )}
      </svg>

      <div
        className="absolute cursor-pointer transition-all duration-300 ease-out group"
        style={{
          left: isExpanded ? x - (expandedWidth - collapsedWidth) / 2 : x,
          top: isExpanded ? y - 40 : y,
          width: isExpanded ? expandedWidth : collapsedWidth,
          zIndex: isExpanded ? 50 : 25, // z-25 when collapsed to be above the click-outside overlay (z-20)
          height: isExpanded ? expandedHeight : collapsedHeight,
        }}
        onClick={() => !isExpanded && onToggle()}
        data-testid="satellite-daniela-observations"
      >
        {/* Background shape - only visible when expanded (no background square when collapsed) */}
        <div 
          className="absolute inset-0 transition-all duration-300"
          style={{
            borderRadius: isExpanded ? '16px' : '0',
            backgroundColor: isExpanded ? 'hsl(var(--card))' : 'transparent',
            border: isExpanded ? '1px solid hsl(var(--border))' : 'none',
            boxShadow: isExpanded 
              ? '0 20px 40px rgba(0,0,0,0.4)' 
              : 'none', // No box shadow when collapsed - cloud SVG has its own glow
            backdropFilter: isExpanded ? 'blur(8px)' : 'none',
          }}
        >
          {/* Collapsed: Show thought bubble SVG */}
          <div 
            className={`absolute inset-0 transition-transform duration-200 ${!isExpanded ? 'group-hover:scale-105' : ''}`}
            style={{ 
              opacity: isExpanded ? 0 : 1,
              transform: isExpanded ? 'scale(0.5)' : undefined,
              transformOrigin: 'center center',
            }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center w-full h-full">
                <div className="animate-pulse bg-primary/20 rounded-full w-24 h-24" />
              </div>
            ) : (
              <svg 
                width={collapsedWidth} 
                height={collapsedHeight} 
                viewBox="0 0 180 140"
                className="w-full h-full"
                overflow="visible"
                style={{ overflow: 'visible' }}
              >
                <defs>
                  <linearGradient id="grad-daniela" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.75" />
                  </linearGradient>
                  <filter id="glow-daniela" x="-50%" y="-50%" width="200%" height="200%" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.25)" />
                    <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor={glowColor} />
                  </filter>
                </defs>
                
                <g filter="url(#glow-daniela)">
                  <path
                    d={cloudPath}
                    fill="url(#grad-daniela)"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                </g>
                
                {/* Text inside bubble - centered and larger */}
                <text
                  x="90"
                  y="52"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontWeight="bold"
                  fontSize="16"
                  fontFamily="system-ui, sans-serif"
                  style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }}
                >
                  {tutorName}'s
                </text>
                <text
                  x="90"
                  y="72"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontWeight="bold"
                  fontSize="16"
                  fontFamily="system-ui, sans-serif"
                  style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }}
                >
                  Insights
                </text>
                
                {/* Summary count badge - repositioned for larger cloud */}
                {breakthroughCount + activeStruggles.length > 0 && (
                  <g transform="translate(135, 28)">
                    <circle r="14" fill="white" />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="hsl(var(--primary))"
                      fontWeight="bold"
                      fontSize="14"
                    >
                      {breakthroughCount + activeStruggles.length}
                    </text>
                  </g>
                )}
              </svg>
            )}
          </div>

          {/* Expanded: Show full content - only render when expanded to avoid accessibility tree pollution */}
          {isExpanded && (
          <div 
            className="absolute inset-0 p-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{tutorName}'s Observations</h3>
                  <p className="text-[10px] text-muted-foreground">
                    Your personalized insights
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                data-testid="close-daniela-observations"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
            
            {/* Content - scrollable */}
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
              {/* Placeholder when no content yet */}
              {!hasContent && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="p-3 rounded-full bg-primary/10 mb-3">
                    <Sparkles className="h-6 w-6 text-primary/60" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Start practicing to unlock personalized insights!
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {tutorName} will track your progress and learning patterns.
                  </p>
                </div>
              )}
              
              {/* Breakthroughs */}
              {breakthroughCount > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>Recent Wins</span>
                  </div>
                  {context?.recentBreakthroughs.slice(0, 2).map((b, i) => (
                    <div 
                      key={i}
                      className="p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900"
                    >
                      <p className="text-xs text-green-800 dark:text-green-300">
                        {b.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Improving */}
              {improvingStruggles.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Making Progress</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {improvingStruggles.map((s) => (
                      <Badge 
                        key={s.id}
                        variant="outline"
                        className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-[10px] py-0.5"
                      >
                        {s.description.length > 30 ? s.description.substring(0, 30) + '...' : s.description}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Focus Areas */}
              {activeStruggles.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Let's Work On</span>
                  </div>
                  {activeStruggles.map((s) => (
                    <div 
                      key={s.id}
                      className="flex items-start gap-2 p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                          {s.description}
                        </p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-500">
                          {categoryLabels[s.errorCategory] || s.errorCategory} · {s.occurrenceCount}x
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Effective Strategies */}
              {strategyCount > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-purple-700 dark:text-purple-400">
                    <Lightbulb className="h-3.5 w-3.5" />
                    <span>What Works for You</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {context?.effectiveStrategies.slice(0, 4).map((s, i) => (
                      <Badge 
                        key={i}
                        variant="outline"
                        className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 text-[10px] py-0.5"
                      >
                        {strategyLabels[s] || s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Practice button */}
            <div className="mt-3 pt-2 border-t">
              <Link href="/chat">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs h-8 gap-1"
                  data-testid="button-practice-from-mindmap"
                >
                  <Sparkles className="h-3 w-3" />
                  Practice with {tutorName}
                  <ChevronRight className="h-3 w-3 ml-auto" />
                </Button>
              </Link>
            </div>
          </div>
          )}
        </div>
      </div>
    </>
  );
}

function ACTFLMeter({ 
  progress, 
  level,
  syllabusProgress 
}: { 
  progress: ActflProgress | null | undefined; 
  level: string;
  syllabusProgress?: { completed: number; total: number };
}) {
  // Use syllabus progress when available, otherwise ACTFL progress
  const overallProgress = syllabusProgress 
    ? (syllabusProgress.total > 0 ? (syllabusProgress.completed / syllabusProgress.total) * 100 : 0)
    : calculateContinuousScore(progress?.currentActflLevel, progress);

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
        
        {/* Background arc - increased opacity */}
        <path
          d={`M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`}
          fill="none"
          stroke="rgba(255,255,255,0.6)"
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

function formatMinutesToHoursMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

function TimeTrackingDisplay({ timeVariance }: { timeVariance: TimeVarianceSummary }) {
  const { actualTotalMinutes } = timeVariance;
  
  return (
    <div 
      className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 border-border mx-auto max-w-xs"
      data-testid="time-tracking-display"
    >
      <Clock className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Time spent:</span>
      <span className="text-sm font-medium" data-testid="time-actual">
        {formatMinutesToHoursMinutes(actualTotalMinutes)}
      </span>
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
  syllabusOverview?: SyllabusOverview;
  mode?: 'emergent' | 'roadmap';
}

// Helper to map lesson type to a brain segment category
function getLessonTypeCategory(lessonType: string): string {
  switch (lessonType) {
    case 'conversation':
      return 'Communication';
    case 'vocabulary':
      return 'Vocabulary';
    case 'grammar':
      return 'Grammar';
    case 'cultural_exploration':
      return 'Culture';
    default:
      return 'Daily Life';
  }
}

// Convert syllabus lesson status to topic status
function syllabusStatusToTopicStatus(status: SyllabusLesson['status']): TopicNode['status'] {
  switch (status) {
    case 'completed':
      return 'mastered';
    case 'in_progress':
      return 'practiced';
    case 'not_started':
      return 'discovered';
    default:
      return 'discovered';
  }
}

// Transform syllabus lessons into TopicNodes for the brain map
function syllabusToTopics(syllabus: SyllabusOverview): TopicNode[] {
  const topics: TopicNode[] = [];
  
  syllabus.units.forEach(unit => {
    unit.lessons.forEach(lesson => {
      topics.push({
        id: lesson.id,
        name: lesson.name,
        status: syllabusStatusToTopicStatus(lesson.status),
        practiceCount: lesson.status === 'completed' ? 1 : 0,
        connections: [],
        category: getLessonTypeCategory(lesson.lessonType),
        topicType: lesson.lessonType === 'grammar' ? 'grammar' : 
                   lesson.lessonType === 'conversation' ? 'function' : 'subject',
      });
    });
  });
  
  return topics;
}

// Transform unified progress response to TopicNodes for the brain map
function unifiedProgressToTopics(progress: UnifiedProgressResponse): TopicNode[] {
  const topics: TopicNode[] = [];
  
  progress.units.forEach(unit => {
    // A unit is "engaged" if the student has started or completed at least one lesson in it.
    // Units with zero engagement are marked 'locked' so emergent mode hides them and they
    // don't dilute the lobe brightness percentages for units the student is actually working on.
    const unitIsEngaged = unit.lessons.some(
      l => l.status === 'in_progress' || l.status === 'completed' || l.status === 'skipped'
    );

    unit.lessons.forEach(lesson => {
      const status: TopicNode['status'] = 
        lesson.status === 'completed' ? 'mastered' :
        lesson.status === 'in_progress' ? 'practiced' :
        lesson.status === 'skipped' ? 'discovered' :
        unitIsEngaged ? 'discovered' : 'locked'; // Lock unstarted lessons in untouched units
      
      topics.push({
        id: lesson.id,
        name: lesson.name,
        status,
        practiceCount: lesson.status === 'completed' ? 1 : 0,
        connections: [],
        category: getLessonTypeCategory(lesson.lessonType),
        topicType: lesson.lessonType === 'grammar' ? 'grammar' : 
                   lesson.lessonType === 'conversation' ? 'function' : 'subject',
      });
    });
  });
  
  return topics;
}

export function SyllabusMindMap({ classId, language: languageProp, className, syllabusOverview, mode = 'emergent' }: SyllabusMindMapProps) {
  const { language: globalLanguage, difficulty, tutorGender } = useLanguage();
  const { user } = useUser();
  const language = languageProp ?? globalLanguage;
  
  // Query tutor voices from database (Voice Lab is source of truth)
  const { data: tutorVoices } = useQuery<{ 
    language: string; 
    female: { name: string; voiceId: string; speakingRate: number } | null; 
    male: { name: string; voiceId: string; speakingRate: number } | null 
  }>({
    queryKey: ['/api/tutor-voices', language?.toLowerCase()],
    enabled: !!language,
  });
  
  // Get tutor name from database, fallback to directory
  const currentTutorName = tutorGender === 'male' 
    ? (tutorVoices?.male?.name || getTutorName(language, tutorGender))
    : (tutorVoices?.female?.name || getTutorName(language, tutorGender));
  const [expandedSegment, setExpandedSegment] = useState<BrainSegment | null>(null);
  const [observationsExpanded, setObservationsExpanded] = useState(false);
  
  // Responsive dimensions - mobile uses compact layout with smaller brain but same text/touch sizes
  const [isMobileView, setIsMobileView] = useState(false);
  const [containerWidth, setContainerWidth] = useState(560);
  
  useEffect(() => {
    const updateLayout = () => {
      const screenWidth = window.innerWidth;
      if (screenWidth < 500) {
        setIsMobileView(true);
        setContainerWidth(Math.min(screenWidth - 32, 380)); // Compact mobile layout
      } else {
        setIsMobileView(false);
        setContainerWidth(560); // Larger desktop layout
      }
    };
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);
  
  // Derived dimensions based on container width
  const containerHeight = isMobileView ? 380 : 500;
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2 - (isMobileView ? 10 : 20);
  const brainSize = isMobileView ? 200 : 280; // Brain size adapts - larger overall
  const orbitScale = isMobileView ? 0.8 : 1.1; // Larger orbits for bigger layout
  
  // Determine if we're in class/syllabus context
  const hasSyllabus = !!syllabusOverview && syllabusOverview.units.length > 0;
  
  // Fetch unified progress when classId is provided (new API with observations & recommendations)
  const { data: unifiedProgress, isLoading: unifiedLoading } = useQuery<UnifiedProgressResponse>({
    queryKey: ['/api/classes', classId, 'unified-progress'],
    queryFn: async () => {
      const response = await fetch(`/api/classes/${classId}/unified-progress`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch unified progress');
      return response.json();
    },
    enabled: !!classId,
  });
  
  // Only fetch ACTFL progress if NOT in syllabus mode (syllabus uses its own completion metric)
  const { data: progress, isLoading: progressLoading } = useQuery<ActflProgress | null>({
    queryKey: ['/api/actfl-progress', language],
    enabled: !!language && language !== 'all' && !hasSyllabus && !classId,
  });
  
  // Only fetch conversation topics if NOT in syllabus mode
  const { data: conversationTopics, isLoading: topicsLoading } = useQuery<{ topics: TopicNode[] }>({
    queryKey: ['/api/conversation-topics', language],
    enabled: !!language && language !== 'all' && !hasSyllabus && !classId,
  });
  
  // Use unified progress when available, then syllabus, then conversation topics
  const allTopics = useMemo(() => {
    if (unifiedProgress) {
      return unifiedProgressToTopics(unifiedProgress);
    }
    if (hasSyllabus && syllabusOverview) {
      return syllabusToTopics(syllabusOverview);
    }
    return conversationTopics?.topics || DEMO_TOPICS;
  }, [unifiedProgress, hasSyllabus, syllabusOverview, conversationTopics?.topics]);
  
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
  // Mastered (completed) lessons count at full weight; practiced (in_progress) at half weight.
  // This means a lobe begins to glow as soon as a student starts working on lessons in it,
  // and fully lights up once most lessons are completed.
  const segmentProgress = useMemo(() => {
    const segments: BrainSegment[] = ['frontal', 'temporal', 'parietal', 'occipital', 'cerebellum'];
    const result: Record<BrainSegment, number> = {} as any;
    
    segments.forEach(segment => {
      const topics = topicsBySegment[segment];
      const mastered = topics.filter(t => t.status === 'mastered').length;
      const practiced = topics.filter(t => t.status === 'practiced').length;
      const total = topics.length;
      // Practiced contributes half-weight toward lobe activation
      const weightedProgress = mastered + practiced * 0.5;
      result[segment] = total > 0 ? (weightedProgress / total) * 100 : 0;
    });
    
    return result;
  }, [topicsBySegment]);
  
  const toggleSegment = (segment: BrainSegment) => {
    setObservationsExpanded(false); // Close observations when opening a lobe
    setExpandedSegment(prev => prev === segment ? null : segment);
  };
  
  const toggleObservations = () => {
    setExpandedSegment(null); // Close lobe when opening observations
    setObservationsExpanded(prev => !prev);
  };
  
  // Loading state depends on context:
  // - With classId: wait for unified progress
  // - With syllabus: no extra loading needed
  // - Otherwise: wait for ACTFL and conversation topics
  const isLoading = classId 
    ? unifiedLoading 
    : (!hasSyllabus && (progressLoading || topicsLoading));
  
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
  
  // Calculate overall brain glow based on average progress
  const avgProgress = Object.values(segmentProgress).reduce((a, b) => a + b, 0) / 5;
  
  return (
    <div className={`${className} ${isMobileView ? 'overflow-hidden' : 'overflow-visible'}`} data-testid="syllabus-mind-map">
      {/* Brain visualization container - responsive dimensions, no transform scaling */}
      <div 
        className={`relative mx-auto ${isMobileView ? 'overflow-hidden' : 'overflow-visible'}`}
        style={{ 
          width: containerWidth, 
          height: containerHeight + (isMobileView ? 80 : 150),
          marginTop: isMobileView ? 10 : 20,
          marginBottom: isMobileView ? -60 : -200,
        }}
        data-testid="brain-container"
      >
        {/* No scaling wrapper - direct responsive layout */}
        <div
          className="relative"
          style={{
            width: containerWidth,
            height: containerHeight + (isMobileView ? 80 : 150),
          }}
        >
        
        {/* Curved arrows from satellites to brain - above brain */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
          <defs>
            {/* Colored arrowheads for each segment */}
            {(['frontal', 'parietal', 'temporal', 'occipital', 'cerebellum'] as BrainSegment[]).map(segment => (
              <marker 
                key={`arrowhead-${segment}`}
                id={`arrowhead-${segment}`} 
                markerWidth="10" 
                markerHeight="7" 
                refX="9" 
                refY="3.5" 
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill={SEGMENT_CONFIG[segment].color}/>
              </marker>
            ))}
          </defs>
          {(['frontal', 'parietal', 'temporal', 'occipital', 'cerebellum'] as BrainSegment[]).map(segment => {
            const config = SEGMENT_CONFIG[segment];
            const angle = (config.orbit.angle * Math.PI) / 180;
            // Apply orbitScale to satellite positions and arrow targets
            const satelliteX = centerX + Math.cos(angle) * config.orbit.distance * orbitScale;
            const satelliteY = centerY + Math.sin(angle) * config.orbit.distance * orbitScale;
            const brainRatio = brainSize / 230; // Scale arrow targets with brain size
            const targetX = centerX + config.arrowTarget.x * brainRatio;
            const targetY = centerY + config.arrowTarget.y * brainRatio;
            
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
                markerEnd={`url(#arrowhead-${segment})`}
                opacity="0.9"
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
            left: centerX - brainSize / 2,
            top: centerY - brainSize / 2,
            width: brainSize,
            height: brainSize,
          }}
        >
          {/* Ambient glow behind brain - intensifies with progress */}
          <div 
            className={`absolute inset-0 rounded-full blur-xl transition-all duration-700 ${avgProgress >= 30 ? 'animate-pulse' : ''}`}
            style={{
              transform: `scale(${1 + avgProgress / 200})`,
              background: avgProgress < 10 
                ? 'radial-gradient(circle, rgba(100, 100, 100, 0.15) 0%, transparent 60%)'
                : `radial-gradient(circle, rgba(139, 92, 246, ${0.3 + avgProgress / 150}) 0%, rgba(59, 130, 246, ${0.2 + avgProgress / 200}) 50%, transparent 70%)`,
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
          
          {/* ACTFL Meter overlay - shows syllabus completion when in class context */}
          <ACTFLMeter 
            progress={progress} 
            level={difficulty}
            syllabusProgress={unifiedProgress ? {
              completed: unifiedProgress.lessonsCompleted +
                unifiedProgress.units.reduce((acc, u) => acc + u.lessons.filter(l => l.status === 'in_progress').length, 0) * 0.5,
              total: unifiedProgress.lessonsTotal
            } : hasSyllabus && syllabusOverview ? {
              completed: syllabusOverview.completedLessons,
              total: syllabusOverview.totalLessons
            } : undefined}
          />
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
            orbitScale={orbitScale}
            isMobile={isMobileView}
          />
        ))}
        
        {/* Tutor's Observations - Larger thought bubble on the left */}
        <TutorObservationsBubble
          userId={user?.id}
          language={language}
          tutorName={currentTutorName}
          isExpanded={observationsExpanded}
          onToggle={toggleObservations}
          centerX={centerX}
          centerY={centerY}
          isMobile={isMobileView}
        />
      </div>
      
      {/* Activity Inputs with Flow Lines - Learning activities that feed the brain */}
      <div className={`relative ${isMobileView ? '-mt-32 -mb-40' : '-mt-64 -mb-64'}`} data-testid="activity-inputs-container">
        {/* Flow lines SVG - animated gradients rising to brain */}
        <svg 
          className="absolute left-1/2 -translate-x-1/2 bottom-8 pointer-events-none"
          width="400" 
          height="50"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Animated gradient for flow effect - warm teal/cyan */}
            <linearGradient id="flow-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(20, 184, 166, 0.6)">
                <animate attributeName="offset" values="0;0.3;0" dur="2s" repeatCount="indefinite" />
              </stop>
              <stop offset="30%" stopColor="rgba(20, 184, 166, 0.3)">
                <animate attributeName="offset" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="rgba(20, 184, 166, 0)" />
            </linearGradient>
            
            {/* Glow filter for flow lines */}
            <filter id="flow-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Flow lines from each activity position converging to brain center */}
          {[-150, -90, -30, 30, 90, 150].map((xOffset, i) => {
            const startX = 200 + xOffset;
            const startY = 45;
            const endX = 200 + (xOffset * 0.25); // Converge toward center
            const endY = 0;
            const ctrlY = 20;
            
            return (
              <g key={i}>
                {/* Main flow line */}
                <path
                  d={`M ${startX} ${startY} Q ${startX} ${ctrlY} ${endX} ${endY}`}
                  stroke="url(#flow-gradient)"
                  strokeWidth="2.5"
                  fill="none"
                  opacity="0.7"
                  filter="url(#flow-glow)"
                  strokeLinecap="round"
                />
                {/* Animated particles along path */}
                <circle r="2" fill="rgba(20, 184, 166, 0.9)">
                  <animateMotion
                    path={`M ${startX} ${startY} Q ${startX} ${ctrlY} ${endX} ${endY}`}
                    dur={`${1.5 + i * 0.2}s`}
                    repeatCount="indefinite"
                  />
                  <animate attributeName="opacity" values="0;1;1;0" dur={`${1.5 + i * 0.2}s`} repeatCount="indefinite" />
                </circle>
              </g>
            );
          })}
        </svg>
        
        {/* Activity pills - teal/cyan theme (unused color) - hidden on mobile for cleaner layout */}
        <div className={`flex justify-center gap-2 ml-8 ${isMobileView ? 'hidden' : ''}`} data-testid="activity-inputs">
          {[
            { name: 'Practice', Icon: Target },
            { name: 'Talk', Icon: Mic },
            { name: 'Memorize', Icon: Layers },
            { name: 'Study', Icon: GraduationCap },
            { name: 'Culture', Icon: Globe },
            { name: 'Chat', Icon: MessageSquare },
          ].map((activity) => (
            <div
              key={activity.name}
              className="flex flex-col items-center cursor-pointer group"
              data-testid={`activity-${activity.name.toLowerCase()}`}
            >
              {/* Pill-shaped activity button - teal/cyan theme */}
              <div 
                className="relative flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all duration-200 group-hover:scale-105"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(20, 184, 166, 0.3) 100%)',
                  border: '2px solid rgba(20, 184, 166, 0.4)',
                }}
              >
                <activity.Icon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
                  {activity.name}
                </span>
              </div>
            </div>
          ))}
        </div>
        </div>{/* End inner scale container */}
      </div>
      
      {/* Time Tracking Display - only show when unified progress has time data */}
      {unifiedProgress?.timeVariance && unifiedProgress.timeVariance.estimatedTotalMinutes > 0 && (
        <div className="mt-3">
          <TimeTrackingDisplay timeVariance={unifiedProgress.timeVariance} />
        </div>
      )}
      
      {/* Instructions hint */}
      <div className="text-center mt-1">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          <ChevronUp className="h-3 w-3" />
          Tap a lobe to explore topics
        </p>
      </div>
    </div>
  );
}
