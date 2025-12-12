/**
 * SyllabusMindMap - Brain-based visualization with expandable satellite cards
 * 
 * Features:
 * - Colorful brain image at center
 * - 5 expandable satellite cards (one per brain lobe)
 * - Phase progression: Beginner → Intermediate → Advanced
 * - Celebration animation when phase completes
 */

import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Sparkles, Lock, CheckCircle2, Circle, Brain, ChevronDown, ChevronRight,
  MessageSquare, BookOpen, Compass, Palette, Settings2, Trophy, Star
} from "lucide-react";
import { useState, useMemo } from "react";
import type { ActflProgress } from "@shared/schema";
import brainImage from "@assets/generated_images/colorful_educational_brain_diagram.png";

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
type LearningPhase = 'beginner' | 'intermediate' | 'advanced';

const SEGMENT_CONFIG: Record<BrainSegment, {
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Brain;
  categories: string[];
  position: { top?: string; bottom?: string; left?: string; right?: string };
}> = {
  frontal: {
    name: 'Communication',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: MessageSquare,
    categories: ['Social Situations', 'Communication', 'Conversations', 'Introductions'],
    position: { top: '5%', left: '5%' },
  },
  parietal: {
    name: 'Practical Skills',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: Compass,
    categories: ['Daily Life', 'Travel', 'Directions', 'Shopping', 'Work'],
    position: { top: '5%', right: '5%' },
  },
  temporal: {
    name: 'Vocabulary',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    icon: BookOpen,
    categories: ['Vocabulary', 'Memory', 'Numbers', 'Colors', 'Time'],
    position: { bottom: '5%', left: '5%' },
  },
  occipital: {
    name: 'Culture',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: Palette,
    categories: ['Culture', 'Customs', 'Traditions', 'Food', 'Music', 'Art'],
    position: { bottom: '5%', right: '5%' },
  },
  cerebellum: {
    name: 'Grammar',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    icon: Settings2,
    categories: ['Grammar', 'Conjugation', 'Tenses', 'Sentence Structure'],
    position: { bottom: '25%', right: '5%' },
  },
};

const PHASE_CONFIG: Record<LearningPhase, {
  name: string;
  description: string;
  color: string;
  requiredMastery: number;
}> = {
  beginner: {
    name: 'Beginner Brain',
    description: 'Building foundations',
    color: 'text-emerald-600',
    requiredMastery: 100,
  },
  intermediate: {
    name: 'Intermediate Brain',
    description: 'Expanding abilities',
    color: 'text-blue-600',
    requiredMastery: 100,
  },
  advanced: {
    name: 'Advanced Brain',
    description: 'Mastering fluency',
    color: 'text-purple-600',
    requiredMastery: 100,
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

function SatelliteCard({ 
  segment, 
  topics,
  isExpanded,
  onToggle,
}: { 
  segment: BrainSegment;
  topics: TopicNode[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = SEGMENT_CONFIG[segment];
  const Icon = config.icon;
  
  const mastered = topics.filter(t => t.status === 'mastered').length;
  const total = topics.length;
  const progress = total > 0 ? (mastered / total) * 100 : 0;
  const isComplete = progress === 100 && total > 0;
  
  return (
    <Card 
      className={`${config.bgColor} ${config.borderColor} border overflow-hidden transition-all duration-200 ${
        isComplete ? 'ring-2 ring-green-500/50' : ''
      }`}
      data-testid={`satellite-${segment}`}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-3 h-auto hover:bg-transparent"
            data-testid={`satellite-toggle-${segment}`}
          >
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-md ${config.bgColor}`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
              <div className="text-left">
                <div className={`font-medium text-sm ${config.color}`}>
                  {config.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {mastered}/{total} mastered
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isComplete && (
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              )}
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <div className="px-3 pb-2">
          <Progress value={progress} className="h-1.5" />
        </div>
        
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-0.5 max-h-40 overflow-y-auto">
            {topics.length > 0 ? (
              topics.map(topic => (
                <TopicListItem key={topic.id} topic={topic} />
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-2 text-center">
                No topics discovered yet
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function PhaseIndicator({ 
  phase, 
  overallProgress,
  onPhaseComplete,
}: { 
  phase: LearningPhase;
  overallProgress: number;
  onPhaseComplete?: () => void;
}) {
  const config = PHASE_CONFIG[phase];
  const phases: LearningPhase[] = ['beginner', 'intermediate', 'advanced'];
  const currentIndex = phases.indexOf(phase);
  
  return (
    <div className="flex items-center justify-between mb-4" data-testid="phase-indicator">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {phases.map((p, i) => (
            <div
              key={p}
              className={`h-2 w-8 rounded-full transition-colors ${
                i < currentIndex ? 'bg-green-500' :
                i === currentIndex ? 'bg-primary' :
                'bg-muted'
              }`}
            />
          ))}
        </div>
        <div>
          <h3 className={`font-semibold ${config.color}`}>{config.name}</h3>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-lg font-bold">{Math.round(overallProgress)}%</div>
          <div className="text-xs text-muted-foreground">Complete</div>
        </div>
        {overallProgress === 100 && (
          <Button 
            size="sm" 
            className="gap-1"
            onClick={onPhaseComplete}
            data-testid="button-next-phase"
          >
            <Trophy className="h-4 w-4" />
            Next Phase
          </Button>
        )}
      </div>
    </div>
  );
}

function CelebrationOverlay({ onDismiss, isLastPhase }: { onDismiss: () => void; isLastPhase: boolean }) {
  return (
    <div 
      className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 rounded-lg"
      data-testid="celebration-overlay"
    >
      <div className="text-center space-y-4 animate-in zoom-in-50 duration-300 p-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-yellow-500/20">
            <Trophy className="h-16 w-16 text-yellow-500" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white">
          {isLastPhase ? 'Brain Mastery Complete!' : 'Phase Complete!'}
        </h2>
        <p className="text-white/80">
          {isLastPhase 
            ? 'Congratulations! You have mastered all phases!' 
            : 'Your brain has evolved to the next level!'}
        </p>
        <Button 
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }} 
          data-testid="button-dismiss-celebration"
          className="gap-2"
        >
          <Star className="h-4 w-4" />
          {isLastPhase ? 'View Your Mastery' : 'Continue to Next Phase'}
        </Button>
      </div>
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
  const [expandedSegments, setExpandedSegments] = useState<Set<BrainSegment>>(new Set());
  const [showCelebration, setShowCelebration] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>(
    difficulty === 'advanced' ? 'advanced' : 
    difficulty === 'intermediate' ? 'intermediate' : 'beginner'
  );
  
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
    const segments: BrainSegment[] = ['frontal', 'temporal', 'parietal', 'occipital', 'cerebellum'];
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
  
  const segmentProgress = useMemo(() => {
    const segments: BrainSegment[] = ['frontal', 'temporal', 'parietal', 'occipital', 'cerebellum'];
    return segments.map(segment => {
      const topics = topicsBySegment[segment];
      const mastered = topics.filter(t => t.status === 'mastered').length;
      const total = topics.length;
      return total > 0 ? (mastered / total) * 100 : 0;
    });
  }, [topicsBySegment]);
  
  const overallProgress = useMemo(() => {
    const totalMastered = visibleTopics.filter(t => t.status === 'mastered').length;
    const total = visibleTopics.length;
    return total > 0 ? (totalMastered / total) * 100 : 0;
  }, [visibleTopics]);
  
  const toggleSegment = (segment: BrainSegment) => {
    setExpandedSegments(prev => {
      const next = new Set(prev);
      if (next.has(segment)) {
        next.delete(segment);
      } else {
        next.add(segment);
      }
      return next;
    });
  };
  
  const handlePhaseComplete = () => {
    setShowCelebration(true);
  };
  
  const handleDismissCelebration = () => {
    setShowCelebration(false);
    const phases: LearningPhase[] = ['beginner', 'intermediate', 'advanced'];
    const currentIndex = phases.indexOf(currentPhase);
    if (currentIndex < phases.length - 1) {
      setCurrentPhase(phases[currentIndex + 1]);
    }
  };
  
  const isLoading = progressLoading || topicsLoading;
  
  if (isLoading) {
    return (
      <div className={className} data-testid="mind-map-loading">
        <div className="flex flex-col items-center justify-center h-[500px] gap-4">
          <Skeleton className="h-[200px] w-[200px] rounded-full" />
          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
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
  
  return (
    <div className={className} data-testid="syllabus-mind-map">
      <PhaseIndicator 
        phase={currentPhase} 
        overallProgress={overallProgress}
        onPhaseComplete={handlePhaseComplete}
      />
      
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
      
      <div className="relative">
        {showCelebration && (
          <CelebrationOverlay 
            onDismiss={handleDismissCelebration} 
            isLastPhase={currentPhase === 'advanced'}
          />
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left column - 2 satellites */}
          <div className="space-y-3 order-2 md:order-1">
            <SatelliteCard
              segment="frontal"
              topics={topicsBySegment.frontal}
              isExpanded={expandedSegments.has('frontal')}
              onToggle={() => toggleSegment('frontal')}
            />
            <SatelliteCard
              segment="temporal"
              topics={topicsBySegment.temporal}
              isExpanded={expandedSegments.has('temporal')}
              onToggle={() => toggleSegment('temporal')}
            />
          </div>
          
          {/* Center - Brain image */}
          <div className="flex items-center justify-center order-1 md:order-2">
            <div className="relative">
              <img 
                src={brainImage} 
                alt="Your Learning Brain" 
                className="w-48 h-48 md:w-56 md:h-56 object-contain drop-shadow-lg"
                data-testid="brain-image"
              />
              {/* Glow effect based on progress */}
              <div 
                className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle, rgba(34, 197, 94, ${overallProgress / 200}) 0%, transparent 70%)`,
                }}
              />
            </div>
          </div>
          
          {/* Right column - 3 satellites */}
          <div className="space-y-3 order-3">
            <SatelliteCard
              segment="parietal"
              topics={topicsBySegment.parietal}
              isExpanded={expandedSegments.has('parietal')}
              onToggle={() => toggleSegment('parietal')}
            />
            <SatelliteCard
              segment="occipital"
              topics={topicsBySegment.occipital}
              isExpanded={expandedSegments.has('occipital')}
              onToggle={() => toggleSegment('occipital')}
            />
            <SatelliteCard
              segment="cerebellum"
              topics={topicsBySegment.cerebellum}
              isExpanded={expandedSegments.has('cerebellum')}
              onToggle={() => toggleSegment('cerebellum')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
