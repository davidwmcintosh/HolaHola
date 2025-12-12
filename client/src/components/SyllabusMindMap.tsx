/**
 * SyllabusMindMap - Interactive mind map visualization of learning progress
 * 
 * Features:
 * - Fluency gauge at center (ACTFL dial)
 * - Topic nodes radiate outward as interconnected bubbles
 * - Nodes "light up" based on discovery/mastery through conversation
 * - No rigid progression path - organic, interest-driven exploration
 * - Connections show relationships between topics
 */

import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Lock, CheckCircle2, Circle, BookOpen } from "lucide-react";
import { useState, useMemo } from "react";
import type { ActflProgress } from "@shared/schema";
import { 
  getLevelInfo, 
  calculateContinuousScore,
  ActflDialSvgGroup 
} from "@/components/actfl/actfl-gauge-core";

interface TopicNode {
  id: string;
  name: string;
  status: 'discovered' | 'practiced' | 'mastered' | 'locked';
  practiceCount: number;
  lastPracticed?: string | null;
  connections: string[];
  category?: string;
}

interface MindMapNode {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  status: 'discovered' | 'practiced' | 'mastered' | 'locked';
  practiceCount: number;
  connections: string[];
  category?: string;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function calculateNodePositions(topics: TopicNode[], centerX: number, centerY: number): MindMapNode[] {
  if (topics.length === 0) return [];
  
  const nodes: MindMapNode[] = [];
  const baseRadius = 35;
  const ringGap = 90;
  
  const sortedTopics = [...topics].sort((a, b) => {
    const statusOrder = { mastered: 0, practiced: 1, discovered: 2, locked: 3 };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return a.id.localeCompare(b.id);
  });
  
  let currentRing = 1;
  let nodesInRing = 0;
  let maxNodesInRing = 6;
  let angleOffset = 0;
  
  sortedTopics.forEach((topic, index) => {
    if (nodesInRing >= maxNodesInRing) {
      currentRing++;
      nodesInRing = 0;
      maxNodesInRing = Math.floor(maxNodesInRing * 1.5);
      angleOffset = Math.PI / maxNodesInRing;
    }
    
    const ringRadius = currentRing * ringGap;
    const angleStep = (2 * Math.PI) / Math.min(maxNodesInRing, sortedTopics.length - (index - nodesInRing));
    const angle = angleOffset + (nodesInRing * angleStep) - (Math.PI / 2);
    
    const seed = hashString(topic.id);
    const jitter = (seededRandom(seed) - 0.5) * 20;
    const x = centerX + ringRadius * Math.cos(angle) + jitter;
    const y = centerY + ringRadius * Math.sin(angle) + (seededRandom(seed + 1) - 0.5) * 20;
    
    const sizeMultiplier = topic.status === 'mastered' ? 1.2 : 
                          topic.status === 'practiced' ? 1.0 : 
                          topic.status === 'discovered' ? 0.9 : 0.8;
    
    nodes.push({
      id: topic.id,
      name: topic.name,
      x,
      y,
      radius: baseRadius * sizeMultiplier,
      status: topic.status,
      practiceCount: topic.practiceCount,
      connections: topic.connections,
      category: topic.category,
    });
    
    nodesInRing++;
  });
  
  return nodes;
}

function getNodeColors(status: string) {
  switch (status) {
    case 'mastered':
      return {
        fill: 'hsl(142, 76%, 36%)',
        stroke: 'hsl(142, 76%, 36%)',
        text: '#ffffff',
        glow: 'rgba(34, 197, 94, 0.4)',
      };
    case 'practiced':
      return {
        fill: 'hsl(221, 83%, 53%)',
        stroke: 'hsl(221, 83%, 53%)',
        text: '#ffffff',
        glow: 'rgba(59, 130, 246, 0.3)',
      };
    case 'discovered':
      return {
        fill: 'hsl(271, 91%, 65%)',
        stroke: 'hsl(271, 91%, 65%)',
        text: '#ffffff',
        glow: 'rgba(168, 85, 247, 0.2)',
      };
    default:
      return {
        fill: 'hsl(var(--muted))',
        stroke: 'hsl(var(--muted-foreground) / 0.3)',
        text: 'hsl(var(--muted-foreground))',
        glow: 'none',
      };
  }
}

function TopicNodeComponent({ 
  node, 
  isHovered, 
  onHover, 
  onLeave 
}: { 
  node: MindMapNode; 
  isHovered: boolean; 
  onHover: () => void; 
  onLeave: () => void;
}) {
  const colors = getNodeColors(node.status);
  const Icon = node.status === 'mastered' ? CheckCircle2 : 
               node.status === 'practiced' ? Sparkles : 
               node.status === 'discovered' ? Circle : Lock;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g 
          className="cursor-pointer transition-all duration-200"
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
          style={{ transform: isHovered ? 'scale(1.1)' : 'scale(1)', transformOrigin: `${node.x}px ${node.y}px` }}
        >
          {node.status !== 'locked' && (
            <circle
              cx={node.x}
              cy={node.y}
              r={node.radius + 8}
              fill={colors.glow}
              className="animate-pulse"
              style={{ animationDuration: '3s' }}
            />
          )}
          <circle
            cx={node.x}
            cy={node.y}
            r={node.radius}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth={2}
            className="transition-all duration-200"
            style={{ 
              filter: isHovered ? 'brightness(1.1)' : 'none',
              opacity: node.status === 'locked' ? 0.5 : 1,
            }}
          />
          <text
            x={node.x}
            y={node.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[10px] font-medium pointer-events-none select-none"
            fill={colors.text}
          >
            {node.name.length > 10 ? node.name.substring(0, 8) + '...' : node.name}
          </text>
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
          {node.category && (
            <Badge variant="outline" className="text-xs">{node.category}</Badge>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ConnectionLines({ nodes }: { nodes: MindMapNode[] }) {
  const lines: JSX.Element[] = [];
  const drawnConnections = new Set<string>();
  
  nodes.forEach(node => {
    node.connections.forEach(targetId => {
      const connectionKey = [node.id, targetId].sort().join('-');
      if (drawnConnections.has(connectionKey)) return;
      drawnConnections.add(connectionKey);
      
      const targetNode = nodes.find(n => n.id === targetId);
      if (!targetNode) return;
      
      const opacity = (node.status !== 'locked' && targetNode.status !== 'locked') ? 0.3 : 0.1;
      
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
  { id: '1', name: 'Greetings', status: 'mastered', practiceCount: 15, connections: ['2', '3'], category: 'Basics' },
  { id: '2', name: 'Numbers', status: 'mastered', practiceCount: 12, connections: ['1', '4'], category: 'Basics' },
  { id: '3', name: 'Family', status: 'practiced', practiceCount: 8, connections: ['1', '5'], category: 'People' },
  { id: '4', name: 'Shopping', status: 'practiced', practiceCount: 5, connections: ['2', '6'], category: 'Daily Life' },
  { id: '5', name: 'Weather', status: 'discovered', practiceCount: 2, connections: ['3', '7'], category: 'Environment' },
  { id: '6', name: 'Food', status: 'discovered', practiceCount: 3, connections: ['4', '7'], category: 'Daily Life' },
  { id: '7', name: 'Travel', status: 'locked', practiceCount: 0, connections: ['5', '6'], category: 'Advanced' },
  { id: '8', name: 'Work', status: 'locked', practiceCount: 0, connections: ['4'], category: 'Professional' },
];

interface SyllabusMindMapProps {
  classId?: string;
  language?: string;
  className?: string;
}

export function SyllabusMindMap({ classId, language: languageProp, className }: SyllabusMindMapProps) {
  const { language: globalLanguage } = useLanguage();
  const language = languageProp ?? globalLanguage;
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
  const { data: progress, isLoading: progressLoading } = useQuery<ActflProgress | null>({
    queryKey: ['/api/actfl-progress', language],
    enabled: !!language && language !== 'all',
  });
  
  const { data: conversationTopics, isLoading: topicsLoading } = useQuery<{ topics: TopicNode[] }>({
    queryKey: ['/api/conversation-topics', language],
    enabled: !!language && language !== 'all',
  });
  
  const topics = conversationTopics?.topics || DEMO_TOPICS;
  const levelInfo = getLevelInfo(progress?.currentActflLevel);
  
  const containerWidth = 500;
  const containerHeight = 400;
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  
  const nodes = useMemo(() => 
    calculateNodePositions(topics, centerX, centerY),
    [topics, centerX, centerY]
  );
  
  const isLoading = progressLoading || topicsLoading;
  
  if (isLoading) {
    return (
      <Card className={className} data-testid="mind-map-loading">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Learning Mind Map
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <Skeleton className="h-[300px] w-[400px] rounded-lg mx-auto" />
            <p className="text-sm text-muted-foreground mt-4">Building your learning map...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const stats = {
    mastered: topics.filter(t => t.status === 'mastered').length,
    practiced: topics.filter(t => t.status === 'practiced').length,
    discovered: topics.filter(t => t.status === 'discovered').length,
    locked: topics.filter(t => t.status === 'locked').length,
  };
  
  return (
    <Card className={className} data-testid="syllabus-mind-map">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Learning Mind Map
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {stats.mastered} Mastered
            </Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {stats.practiced} Practicing
            </Badge>
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              {stats.discovered} Discovered
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-hidden rounded-lg bg-muted/20 border">
          <svg 
            viewBox={`0 0 ${containerWidth} ${containerHeight}`}
            className="w-full h-auto"
            style={{ maxHeight: '400px' }}
          >
            <ConnectionLines nodes={nodes} />
            
            <ActflDialSvgGroup 
              cx={centerX} 
              cy={centerY} 
              size={100}
              score={calculateContinuousScore(progress?.currentActflLevel, progress)} 
              levelInfo={levelInfo} 
            />
            
            {nodes.map(node => (
              <TopicNodeComponent
                key={node.id}
                node={node}
                isHovered={hoveredNode === node.id}
                onHover={() => setHoveredNode(node.id)}
                onLeave={() => setHoveredNode(null)}
              />
            ))}
          </svg>
        </div>
        
        <div className="mt-4 flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Mastered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Practicing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>Discovered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted" />
            <span>Unexplored</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
