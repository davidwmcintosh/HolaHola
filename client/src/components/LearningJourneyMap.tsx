import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Map,
  CheckCircle2,
  Circle,
  Lock,
  BookOpen,
  MessageCircle,
  Sparkles,
  ChevronRight
} from "lucide-react";

interface ChapterNode {
  id: string;
  name: string;
  progress: number;
  isComplete: boolean;
  isLocked: boolean;
  lessonCount: number;
  topicPreview?: string;
}

interface LearningJourneyMapProps {
  chapters: ChapterNode[];
  currentChapterId?: string;
  onChapterClick?: (chapterId: string) => void;
  className?: string;
}

function ChapterNodeCard({
  chapter,
  isCurrent,
  isFirst,
  isLast,
  onClick
}: {
  chapter: ChapterNode;
  isCurrent: boolean;
  isFirst: boolean;
  isLast: boolean;
  onClick?: () => void;
}) {
  const getStatusIcon = () => {
    if (chapter.isComplete) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    if (chapter.isLocked) {
      return <Lock className="h-5 w-5 text-muted-foreground" />;
    }
    if (isCurrent) {
      return <Sparkles className="h-5 w-5 text-primary animate-pulse" />;
    }
    return <Circle className="h-5 w-5 text-muted-foreground" />;
  };
  
  const getNodeStyle = () => {
    if (chapter.isComplete) {
      return "border-green-500/30 bg-green-500/5";
    }
    if (isCurrent) {
      return "border-primary ring-2 ring-primary/20 bg-primary/5";
    }
    if (chapter.isLocked) {
      return "border-muted-foreground/20 bg-muted/30 opacity-60";
    }
    return "border-border hover-elevate cursor-pointer";
  };
  
  return (
    <div className="relative flex items-start gap-3">
      {!isFirst && (
        <div className="absolute left-[11px] -top-4 h-4 w-0.5 bg-border" />
      )}
      
      <div className="flex flex-col items-center">
        <div className={`
          relative z-10 flex items-center justify-center
          w-6 h-6 rounded-full bg-background border-2
          ${chapter.isComplete ? 'border-green-500' : isCurrent ? 'border-primary' : 'border-muted-foreground'}
        `}>
          {chapter.isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : isCurrent ? (
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
          )}
        </div>
        
        {!isLast && (
          <div className={`
            w-0.5 h-8 
            ${chapter.isComplete ? 'bg-green-500/50' : 'bg-border'}
          `} />
        )}
      </div>
      
      <div
        className={`
          flex-1 p-3 rounded-lg border transition-all
          ${getNodeStyle()}
          ${!chapter.isLocked && onClick ? 'cursor-pointer' : ''}
        `}
        onClick={() => !chapter.isLocked && onClick?.()}
        data-testid={`journey-node-${chapter.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{chapter.name}</h4>
            {chapter.topicPreview && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {chapter.topicPreview}
              </p>
            )}
          </div>
          
          {getStatusIcon()}
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          <Progress value={chapter.progress} className="flex-1 h-1.5" />
          <span className="text-xs text-muted-foreground shrink-0">
            {chapter.progress}%
          </span>
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            <BookOpen className="h-3 w-3 mr-1" />
            {chapter.lessonCount} lessons
          </Badge>
          
          {chapter.isComplete && (
            <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
              Complete
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export function LearningJourneyMap({
  chapters,
  currentChapterId,
  onChapterClick,
  className = ""
}: LearningJourneyMapProps) {
  const stats = useMemo(() => {
    const completed = chapters.filter(c => c.isComplete).length;
    const totalProgress = chapters.reduce((acc, c) => acc + c.progress, 0);
    const avgProgress = chapters.length > 0 ? Math.round(totalProgress / chapters.length) : 0;
    
    return { completed, total: chapters.length, avgProgress };
  }, [chapters]);
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Map className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Learning Journey</CardTitle>
          </div>
          
          <Badge variant="secondary">
            {stats.completed}/{stats.total} chapters
          </Badge>
        </div>
        
        <div className="flex items-center gap-3 mt-2">
          <Progress value={stats.avgProgress} className="flex-1 h-2" />
          <span className="text-sm font-medium">{stats.avgProgress}%</span>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-2">
          {chapters.map((chapter, index) => (
            <ChapterNodeCard
              key={chapter.id}
              chapter={chapter}
              isCurrent={chapter.id === currentChapterId}
              isFirst={index === 0}
              isLast={index === chapters.length - 1}
              onClick={() => onChapterClick?.(chapter.id)}
            />
          ))}
        </div>
        
        {chapters.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Map className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No chapters available yet</p>
          </div>
        )}
        
        {stats.completed === stats.total && stats.total > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-primary/10 text-center">
            <Sparkles className="h-6 w-6 text-primary mx-auto mb-1" />
            <p className="text-sm font-medium">Journey Complete!</p>
            <p className="text-xs text-muted-foreground">
              You've mastered all {stats.total} chapters
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MiniJourneyProgressProps {
  chapters: ChapterNode[];
  currentChapterId?: string;
  className?: string;
}

export function MiniJourneyProgress({
  chapters,
  currentChapterId,
  className = ""
}: MiniJourneyProgressProps) {
  const currentIndex = chapters.findIndex(c => c.id === currentChapterId);
  const completedCount = chapters.filter(c => c.isComplete).length;
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {chapters.slice(0, 8).map((chapter, index) => (
        <div
          key={chapter.id}
          className={`
            w-2 h-2 rounded-full transition-all
            ${chapter.isComplete 
              ? 'bg-green-500' 
              : chapter.id === currentChapterId 
                ? 'bg-primary animate-pulse w-3 h-3' 
                : 'bg-muted-foreground/30'
            }
          `}
          title={chapter.name}
        />
      ))}
      
      {chapters.length > 8 && (
        <span className="text-xs text-muted-foreground ml-1">
          +{chapters.length - 8}
        </span>
      )}
      
      <span className="text-xs text-muted-foreground ml-2">
        {completedCount}/{chapters.length}
      </span>
    </div>
  );
}

export default LearningJourneyMap;
