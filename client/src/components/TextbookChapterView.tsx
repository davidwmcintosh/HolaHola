import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  MessageSquare,
  Dumbbell,
  Book,
  GraduationCap,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Play,
  Music2,
  ChevronDown,
  ChevronUp,
  BookMarked,
} from "lucide-react";
import { LessonPrepCard } from "./TextbookInfographics";
import { ChapterRecap } from "./ChapterRecap";
import { ChapterIntroduction } from "./ChapterIntroduction";
import { TextbookLessonReader } from "./TextbookLessonReader";
import { RhythmDrill } from "./RhythmDrill";
import { apiRequest } from "@/lib/queryClient";

interface DrillItem {
  id: string;
  itemType: string;
  prompt: string;
  targetText: string;
  difficulty: number;
  mastered: boolean;
  attempts: number;
}

interface Section {
  id: string;
  name: string;
  description: string;
  lessonType: string;
  estimatedMinutes: number;
  progress: number;
  isComplete: boolean;
  textbookRead?: boolean;
  danielaCovered?: boolean;
  hasDrills: boolean;
  drillCount: number;
  objectives?: string[];
  conversationTopic?: string;
  drills?: DrillItem[];
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  description: string;
  progress: number;
  isLocked: boolean;
  sectionsCount: number;
  completedSections: number;
  sections: Section[];
  culturalTheme?: string;
  actflLevel?: string;
  chapterType?: string | null;
}

interface TextbookChapterViewProps {
  chapter: Chapter;
  language: string;
  onBack: () => void;
  onStartConversation: () => void;
  onStartDrill: (sectionId: string) => void;
  onReviewFlashcards?: () => void;
}

function getLessonTypeIcon(type: string) {
  switch (type) {
    case 'conversation':
      return <MessageSquare className="h-4 w-4" />;
    case 'drill':
      return <Dumbbell className="h-4 w-4" />;
    case 'vocabulary':
      return <Book className="h-4 w-4" />;
    case 'grammar':
      return <GraduationCap className="h-4 w-4" />;
    default:
      return <BookOpen className="h-4 w-4" />;
  }
}

function VisualLessonCard({
  section,
  index,
  language,
  onStartConversation,
  onStartDrill,
  onViewed,
  onRead,
}: {
  section: Section;
  index: number;
  language?: string;
  onStartConversation: () => void;
  onStartDrill: () => void;
  onViewed: () => void;
  onRead: () => void;
}) {
  const viewedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [showRhythmDrill, setShowRhythmDrill] = useState(false);

  const isRhythmEligible =
    (section.lessonType === 'vocabulary' || section.lessonType === 'drill') &&
    section.hasDrills &&
    section.drills &&
    section.drills.length > 0;

  const rhythmItems = (section.drills ?? []).map(d => ({
    id: d.id,
    prompt: d.prompt,
    targetText: d.targetText,
    difficulty: d.difficulty,
    category: d.itemType,
  }));

  useEffect(() => {
    const el = cardRef.current;
    if (!el || viewedRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      viewedRef.current = true;
      onViewed();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewedRef.current) {
          viewedRef.current = true;
          onViewed();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onViewed]);

  return (
    <Card 
      ref={cardRef}
      className="overflow-hidden touch-manipulation"
      data-testid={`visual-lesson-card-${section.id}`}
    >
      <CardContent className="p-0">
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                section.isComplete 
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
                  : 'bg-primary/10 text-primary'
              }`}>
                {section.isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              <div>
                <h3 className="font-semibold text-sm">{section.name}</h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {section.lessonType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {section.estimatedMinutes} min
                  </span>
                  {section.textbookRead && (
                    <Badge variant="secondary" className="text-xs gap-1" data-testid={`badge-read-${section.id}`}>
                      <BookMarked className="h-3 w-3" />
                      Read
                    </Badge>
                  )}
                  {section.danielaCovered && (
                    <Badge className="text-xs gap-1 bg-primary/20 text-primary hover:bg-primary/20" data-testid={`badge-daniela-${section.id}`}>
                      <Sparkles className="h-3 w-3" />
                      Daniela covered
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {section.progress > 0 && section.progress < 100 && (
              <div className="flex items-center gap-2">
                <Progress value={section.progress} className="w-12 h-1.5" />
                <span className="text-xs text-muted-foreground">{section.progress}%</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {section.description && (
            <p className="text-sm text-muted-foreground">{section.description}</p>
          )}
          
          <LessonPrepCard
            objectives={section.objectives}
            drills={section.drills}
            conversationTopic={section.conversationTopic}
            lessonType={section.lessonType}
            language={language}
            lessonId={section.id}
          />
          
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] touch-manipulation"
              onClick={onRead}
              data-testid={`button-read-lesson-${section.id}`}
            >
              <BookOpen className="h-4 w-4 mr-1" />
              Read
            </Button>
            {section.conversationTopic && (
              <Button 
                className="flex-1 min-h-[44px] touch-manipulation" 
                onClick={onStartConversation}
                data-testid={`button-practice-daniela-${section.id}`}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Practice with Daniela
              </Button>
            )}
            {section.hasDrills && section.drillCount > 0 && !isRhythmEligible && (
              <Button 
                variant={section.conversationTopic ? "outline" : "default"}
                className={`min-h-[44px] touch-manipulation ${section.conversationTopic ? "" : "flex-1"}`}
                onClick={onStartDrill}
                data-testid={`button-start-drill-${section.id}`}
              >
                <Dumbbell className="h-4 w-4 mr-2" />
                {section.drillCount} Drills
              </Button>
            )}
            {isRhythmEligible && (
              <Button
                variant={showRhythmDrill ? "default" : "outline"}
                className="flex-1 min-h-[44px] touch-manipulation"
                onClick={() => setShowRhythmDrill(prev => !prev)}
                data-testid={`button-rhythm-drill-${section.id}`}
              >
                <Music2 className="h-4 w-4 mr-2" />
                Rhythm Practice
                {showRhythmDrill
                  ? <ChevronUp className="h-4 w-4 ml-2" />
                  : <ChevronDown className="h-4 w-4 ml-2" />
                }
              </Button>
            )}
            {!section.conversationTopic && !section.hasDrills && (
              <Button 
                className="flex-1 min-h-[44px] touch-manipulation" 
                variant="secondary"
                onClick={onStartConversation}
                data-testid={`button-start-lesson-${section.id}`}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Lesson
              </Button>
            )}
          </div>

          {showRhythmDrill && isRhythmEligible && rhythmItems.length > 0 && (
            <div className="pt-2" data-testid={`rhythm-drill-panel-${section.id}`}>
              <RhythmDrill
                title={section.name}
                description={`Listen to each item, then say it aloud when the mic appears.`}
                items={rhythmItems}
                language={language}
                onComplete={(results) => {
                  const correct = results.filter(r => r.correct).length;
                  if (correct / results.length >= 0.7) {
                    setShowRhythmDrill(false);
                  }
                }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function TextbookChapterView({
  chapter,
  language,
  onBack,
  onStartConversation,
  onStartDrill,
  onReviewFlashcards
}: TextbookChapterViewProps) {
  const completedCount = chapter.sections.filter(s => s.isComplete).length;
  const viewedSectionsRef = useRef<Set<string>>(new Set());
  const [readerLesson, setReaderLesson] = useState<{ id: string; name: string } | null>(null);
  // Local read state for immediate badge updates without refetch
  const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  useEffect(() => {
    viewedSectionsRef.current = new Set();
  }, [chapter.id]);
  
  const saveProgressMutation = useMutation({
    mutationFn: async (data: { lessonId: string; viewed?: boolean; completed?: boolean; drillScore?: number }) => {
      return apiRequest('POST', `/api/textbook/progress/${data.lessonId}`, {
        viewed: data.viewed,
        completed: data.completed,
        drillScore: data.drillScore,
      });
    },
  });

  const handleSectionViewed = useCallback((sectionId: string) => {
    if (!viewedSectionsRef.current.has(sectionId)) {
      viewedSectionsRef.current.add(sectionId);
      saveProgressMutation.mutate({ lessonId: sectionId, viewed: true });
    }
  }, [saveProgressMutation]);

  const handleMarkedRead = useCallback((lessonId: string) => {
    setLocallyReadIds(prev => new Set([...prev, lessonId]));
    // Also refresh chapter-level data in the background
    queryClient.invalidateQueries({ queryKey: ['/api/textbook'] });
  }, [queryClient]);
  
  const handleReviewFlashcards = () => {
    if (onReviewFlashcards) {
      onReviewFlashcards();
    }
  };
  
  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto pb-12 touch-pan-y overscroll-contain">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 border-b supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            data-testid="button-back-to-chapters"
            className="gap-1 -ml-2"
          >
            <ChevronLeft className="h-4 w-4" />
            All Chapters
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {completedCount}/{chapter.sectionsCount} complete
            </span>
            <Progress value={chapter.progress} className="w-20 h-2" />
          </div>
        </div>
      </div>
      
      <div className="text-center space-y-2">
        <Badge variant="outline" className="mb-2">
          Chapter {chapter.number}
        </Badge>
        <h1 className="text-2xl md:text-3xl font-bold">{chapter.title}</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">{chapter.description}</p>
        {chapter.culturalTheme && (
          <p className="text-sm text-primary">
            <Sparkles className="h-3 w-3 inline mr-1" />
            Cultural focus: {chapter.culturalTheme}
          </p>
        )}
      </div>
      
      <ChapterIntroduction 
        chapterNumber={chapter.number}
        chapterTitle={chapter.title}
        language={language}
        chapterType={chapter.chapterType || undefined}
        className="mb-4"
      />
      
      <div className="grid gap-4">
        {chapter.sections.map((section, index) => (
          <VisualLessonCard
            key={section.id}
            section={{
              ...section,
              textbookRead: section.textbookRead || locallyReadIds.has(section.id),
            }}
            index={index}
            language={language}
            onStartConversation={onStartConversation}
            onStartDrill={() => onStartDrill(section.id)}
            onViewed={() => handleSectionViewed(section.id)}
            onRead={() => setReaderLesson({ id: section.id, name: section.name })}
          />
        ))}
      </div>
      
      {chapter.sections.length === 0 && (
        <Card className="p-8 text-center bg-muted/30">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Lessons Coming Soon</h3>
          <p className="text-sm text-muted-foreground">
            This chapter's visual lessons are being prepared. Check back soon!
          </p>
        </Card>
      )}
      
      {chapter.sections.length > 0 && (
        <ChapterRecap
          chapter={chapter}
          language={language}
          onPracticeWithDaniela={onStartConversation}
          onReviewFlashcards={handleReviewFlashcards}
        />
      )}

      <TextbookLessonReader
        lessonId={readerLesson?.id ?? ""}
        lessonName={readerLesson?.name ?? ""}
        language={language}
        open={!!readerLesson}
        onClose={() => setReaderLesson(null)}
        onMarkedRead={() => readerLesson && handleMarkedRead(readerLesson.id)}
      />
    </div>
  );
}

export default TextbookChapterView;
