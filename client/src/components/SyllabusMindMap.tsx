/**
 * SyllabusMindMap - Interactive brain-based visualization of learning progress
 * 
 * Features:
 * - Brain at center with 5 segments that light up based on category mastery
 * - Topic nodes orbit around brain using different shapes by type
 * - Nodes cluster by category (brain segment)
 * - Progressive glow effects show mastery level
 * - Fun animations: sparkles for practicing, aurora for mastered
 */

import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Lock, CheckCircle2, Circle, Brain } from "lucide-react";
import { useState, useMemo } from "react";
import type { ActflProgress } from "@shared/schema";
import { 
  getLevelInfo, 
  calculateContinuousScore,
  ActflDialSvgGroup 
} from "@/components/actfl/actfl-gauge-core";
import { 
  BrainSvg, 
  type BrainSegment, 
  type BrainSegmentData,
  getCategorySegment,
  BRAIN_SEGMENT_CATEGORIES
} from "@/components/BrainSvg";
import { 
  TopicShape, 
  getTopicShapeType, 
  ShapeLegend,
  type ShapeType 
} from "@/components/TopicShapes";

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

interface ClusteredNode {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  status: 'discovered' | 'practiced' | 'mastered' | 'locked';
  practiceCount: number;
  connections: string[];
  category: string;
  segment: BrainSegment;
  shapeType: ShapeType;
}

const SEGMENT_POSITIONS: Record<BrainSegment, { angle: number; distance: number }> = {
  frontal: { angle: -90, distance: 140 },
  temporal: { angle: 180, distance: 130 },
  parietal: { angle: 0, distance: 130 },
  occipital: { angle: 225, distance: 120 },
  cerebellum: { angle: -45, distance: 120 },
};

const STATUS_COLORS = {
  mastered: { fill: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)' },
  practiced: { fill: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)' },
  discovered: { fill: '#a855f7', glow: 'rgba(168, 85, 247, 0.2)' },
  locked: { fill: 'hsl(var(--muted))', glow: 'transparent' },
};

const SEGMENT_ANGLE_LIMITS: Record<BrainSegment, { min: number; max: number }> = {
  frontal: { min: -120, max: -60 },
  temporal: { min: 150, max: 210 },
  parietal: { min: -30, max: 30 },
  occipital: { min: 210, max: 250 },
  cerebellum: { min: 290, max: 330 },
};

function calculateClusteredPositions(
  topics: TopicNode[], 
  centerX: number, 
  centerY: number
): ClusteredNode[] {
  if (topics.length === 0) return [];
  
  const nodesBySegment = new Map<BrainSegment, TopicNode[]>();
  
  topics.forEach(topic => {
    const segment = getCategorySegment(topic.category || '');
    if (!nodesBySegment.has(segment)) {
      nodesBySegment.set(segment, []);
    }
    nodesBySegment.get(segment)!.push(topic);
  });
  
  const nodes: ClusteredNode[] = [];
  
  nodesBySegment.forEach((segmentTopics, segment) => {
    const baseConfig = SEGMENT_POSITIONS[segment];
    const baseAngleRad = (baseConfig.angle * Math.PI) / 180;
    const baseDistance = baseConfig.distance;
    const angleLimits = SEGMENT_ANGLE_LIMITS[segment];
    const angleRangeRad = ((angleLimits.max - angleLimits.min) * Math.PI) / 180;
    
    const sortedTopics = [...segmentTopics].sort((a, b) => {
      const statusOrder = { mastered: 0, practiced: 1, discovered: 2, locked: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
    
    const count = sortedTopics.length;
    
    sortedTopics.forEach((topic, index) => {
      const ringIndex = Math.floor(index / 5);
      const posInRing = index % 5;
      const nodesInRing = Math.min(5, count - ringIndex * 5);
      
      const angleStep = angleRangeRad / (nodesInRing + 1);
      const angleOffset = (posInRing - (nodesInRing - 1) / 2) * angleStep * 0.6;
      const distance = baseDistance + ringIndex * 40;
      
      const angle = baseAngleRad + angleOffset;
      const x = centerX + distance * Math.cos(angle);
      const y = centerY + distance * Math.sin(angle);
      
      const sizeMultiplier = topic.status === 'mastered' ? 1.3 : 
                            topic.status === 'practiced' ? 1.1 : 
                            topic.status === 'discovered' ? 1.0 : 0.85;
      
      nodes.push({
        id: topic.id,
        name: topic.name,
        x,
        y,
        size: 28 * sizeMultiplier,
        status: topic.status,
        practiceCount: topic.practiceCount,
        connections: topic.connections,
        category: topic.category || 'General',
        segment,
        shapeType: getTopicShapeType(topic.topicType, topic.category),
      });
    });
  });
  
  return nodes;
}

function ClusteredTopicNode({ 
  node, 
  isHovered, 
  onHover, 
  onLeave 
}: { 
  node: ClusteredNode; 
  isHovered: boolean; 
  onHover: () => void; 
  onLeave: () => void;
}) {
  const colors = STATUS_COLORS[node.status];
  const Icon = node.status === 'mastered' ? CheckCircle2 : 
               node.status === 'practiced' ? Sparkles : 
               node.status === 'discovered' ? Circle : Lock;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g>
          <TopicShape
            x={node.x}
            y={node.y}
            size={node.size}
            type={node.shapeType}
            fill={colors.fill}
            fillOpacity={node.status === 'locked' ? 0.4 : 1}
            stroke={isHovered ? '#fff' : 'transparent'}
            strokeWidth={isHovered ? 2 : 0}
            isHovered={isHovered}
            isPulsing={node.status === 'discovered'}
            isSparkle={node.status === 'practiced'}
            isAurora={node.status === 'mastered'}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
          >
            <text
              x={node.size / 2}
              y={node.size / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[8px] font-medium pointer-events-none select-none"
              fill="#fff"
            >
              {node.name.length > 6 ? node.name.substring(0, 5) + '..' : node.name}
            </text>
          </TopicShape>
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="font-medium">{node.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {node.status === 'mastered' && 'Mastered through conversation'}
            {node.status === 'practiced' && `Practiced ${node.practiceCount} times`}
            {node.status === 'discovered' && 'Recently discovered'}
            {node.status === 'locked' && 'Not yet explored'}
          </p>
          <div className="flex gap-1">
            <Badge variant="outline" className="text-xs">{node.category}</Badge>
            <Badge variant="secondary" className="text-xs capitalize">{node.shapeType}</Badge>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ConnectionLines({ nodes }: { nodes: ClusteredNode[] }) {
  const lines: JSX.Element[] = [];
  const drawnConnections = new Set<string>();
  
  nodes.forEach(node => {
    node.connections.forEach(targetId => {
      const connectionKey = [node.id, targetId].sort().join('-');
      if (drawnConnections.has(connectionKey)) return;
      drawnConnections.add(connectionKey);
      
      const targetNode = nodes.find(n => n.id === targetId);
      if (!targetNode) return;
      
      const opacity = (node.status !== 'locked' && targetNode.status !== 'locked') ? 0.25 : 0.08;
      
      lines.push(
        <line
          key={connectionKey}
          x1={node.x}
          y1={node.y}
          x2={targetNode.x}
          y2={targetNode.y}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="4 4"
          className="text-muted-foreground"
          style={{ opacity }}
        />
      );
    });
  });
  
  return <>{lines}</>;
}

const DEMO_TOPICS: TopicNode[] = [
  { id: '1', name: 'Greetings', status: 'mastered', practiceCount: 15, connections: ['3', '4'], category: 'Social Situations', topicType: 'subject' },
  { id: '2', name: 'Numbers', status: 'mastered', practiceCount: 12, connections: ['4', '8'], category: 'Daily Life', topicType: 'subject' },
  { id: '3', name: 'Family', status: 'practiced', practiceCount: 8, connections: ['1', '5'], category: 'Vocabulary', topicType: 'subject' },
  { id: '4', name: 'Shopping', status: 'practiced', practiceCount: 5, connections: ['2', '6'], category: 'Daily Life', topicType: 'function' },
  { id: '5', name: 'Weather', status: 'discovered', practiceCount: 2, connections: ['3'], category: 'Vocabulary', topicType: 'subject' },
  { id: '6', name: 'Food', status: 'discovered', practiceCount: 3, connections: ['4', '9'], category: 'Culture', topicType: 'subject' },
  { id: '7', name: 'Past Tense', status: 'practiced', practiceCount: 6, connections: ['10'], category: 'Grammar', topicType: 'grammar' },
  { id: '8', name: 'Directions', status: 'discovered', practiceCount: 1, connections: ['2'], category: 'Travel', topicType: 'function' },
  { id: '9', name: 'Customs', status: 'locked', practiceCount: 0, connections: ['6'], category: 'Culture', topicType: 'subject' },
  { id: '10', name: 'Conjugation', status: 'locked', practiceCount: 0, connections: ['7'], category: 'Grammar', topicType: 'grammar' },
];

interface SyllabusMindMapProps {
  classId?: string;
  language?: string;
  className?: string;
  mode?: 'emergent' | 'roadmap';
}

export function SyllabusMindMap({ classId, language: languageProp, className, mode = 'emergent' }: SyllabusMindMapProps) {
  const { language: globalLanguage } = useLanguage();
  const language = languageProp ?? globalLanguage;
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<BrainSegment | null>(null);
  
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
  
  const levelInfo = getLevelInfo(progress?.currentActflLevel);
  
  const containerWidth = 550;
  const containerHeight = 450;
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  
  const nodes = useMemo(() => 
    calculateClusteredPositions(visibleTopics, centerX, centerY),
    [visibleTopics, centerX, centerY]
  );
  
  const brainSegments = useMemo((): BrainSegmentData[] => {
    const segments: BrainSegment[] = ['frontal', 'temporal', 'parietal', 'occipital', 'cerebellum'];
    
    return segments.map(segment => {
      const segmentTopics = allTopics.filter(t => getCategorySegment(t.category || '') === segment);
      const masteredCount = segmentTopics.filter(t => t.status === 'mastered').length;
      const total = segmentTopics.length;
      const masteryPercent = total > 0 ? (masteredCount / total) * 100 : 0;
      
      return {
        segment,
        label: segment.charAt(0).toUpperCase() + segment.slice(1),
        categories: BRAIN_SEGMENT_CATEGORIES[segment],
        masteryPercent,
      };
    });
  }, [allTopics]);
  
  const isLoading = progressLoading || topicsLoading;
  
  if (isLoading) {
    return (
      <div className={className} data-testid="mind-map-loading">
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <Skeleton className="h-[300px] w-[450px] rounded-lg mx-auto" />
            <p className="text-sm text-muted-foreground mt-4">Building your learning brain...</p>
          </div>
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
  
  const hasNoDiscoveredTopics = mode === 'emergent' && visibleTopics.length === 0;
  
  if (hasNoDiscoveredTopics) {
    return (
      <div className={className} data-testid="mind-map-empty">
        <div className="flex flex-col items-center justify-center h-[400px] text-center">
          <div className="relative mb-6">
            <BrainSvg 
              segments={brainSegments}
              size={140}
            />
          </div>
          <h3 className="text-lg font-medium mb-2">Your Language Brain Awaits</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Start a conversation to light up your brain! Each topic you explore will 
            appear and illuminate the corresponding brain region.
          </p>
        </div>
      </div>
    );
  }
  
  const totalMastery = brainSegments.reduce((sum, s) => sum + s.masteryPercent, 0) / brainSegments.length;
  
  return (
    <div className={className} data-testid="syllabus-mind-map">
      <div className="flex flex-wrap gap-2 mb-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
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
        <Badge variant="outline" className="flex items-center gap-1">
          <Brain className="h-3 w-3" />
          {Math.round(totalMastery)}% Active
        </Badge>
      </div>
      
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-slate-900/5 to-slate-800/10 dark:from-slate-100/5 dark:to-slate-200/5 border">
        <svg 
          viewBox={`0 0 ${containerWidth} ${containerHeight}`}
          className="w-full h-auto"
          style={{ maxHeight: '400px' }}
        >
          <defs>
            <radialGradient id="brain-bg-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
              <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </radialGradient>
          </defs>
          
          <circle cx={centerX} cy={centerY} r={200} fill="url(#brain-bg-glow)" />
          
          <ConnectionLines nodes={nodes} />
          
          <g transform={`translate(${centerX - 60}, ${centerY - 55})`}>
            <BrainSvg 
              segments={brainSegments}
              size={120}
              hoveredSegment={hoveredSegment}
              onSegmentHover={setHoveredSegment}
            />
          </g>
          
          {nodes.map(node => (
            <ClusteredTopicNode
              key={node.id}
              node={node}
              isHovered={hoveredNode === node.id || hoveredSegment === node.segment}
              onHover={() => setHoveredNode(node.id)}
              onLeave={() => setHoveredNode(null)}
            />
          ))}
          
          {hoveredSegment && (
            <text
              x={centerX}
              y={containerHeight - 20}
              textAnchor="middle"
              className="text-sm font-medium"
              fill="hsl(var(--foreground))"
            >
              {hoveredSegment.charAt(0).toUpperCase() + hoveredSegment.slice(1)} Lobe: {BRAIN_SEGMENT_CATEGORIES[hoveredSegment].slice(0, 3).join(', ')}
            </text>
          )}
        </svg>
      </div>
      
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-center gap-4 md:gap-6 text-xs md:text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span>Mastered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Practicing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Discovered</span>
          </div>
          {mode === 'roadmap' && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-muted border" />
              <span>Unexplored</span>
            </div>
          )}
        </div>
        <ShapeLegend className="pt-1 border-t" />
      </div>
    </div>
  );
}
