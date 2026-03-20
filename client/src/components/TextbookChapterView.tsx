import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Loader2,
} from "lucide-react";
import { LessonPrepCard } from "./TextbookInfographics";
import { ChapterRecap } from "./ChapterRecap";
import { ChapterIntroduction, classifyGrammarType, GrammarChapterView } from "./ChapterIntroduction";
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

interface TextbookContent {
  lesson_id: string;
  introduction?: string;
  grammar_explanation?: string;
  vocabulary_notes?: string;
  example_sentences?: Array<{ target: string; native: string }>;
  cultural_notes?: string;
  actfl_level?: string;
}

function InlineLessonContent({ lessonId, lessonName, language }: {
  lessonId: string;
  lessonName: string;
  language: string;
}) {
  const referenceType = classifyGrammarType(lessonName, language);

  const { data, isLoading } = useQuery<{ content: TextbookContent | null }>({
    queryKey: ["/api/textbook-content", lessonId],
    enabled: !!lessonId,
  });

  const content = data?.content;

  return (
    <div className="space-y-4 pt-1">
      {referenceType && (
        <GrammarChapterView type={referenceType} chapterNumber={0} language={language} />
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && content && (
        <div className="space-y-4 text-sm">
          {content.introduction && (
            <p className="text-muted-foreground leading-relaxed">{content.introduction}</p>
          )}
          {content.grammar_explanation && (
            <div className="space-y-1">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Grammar Focus</p>
              <p className="text-muted-foreground leading-relaxed">{content.grammar_explanation}</p>
            </div>
          )}
          {content.vocabulary_notes && (
            <div className="space-y-1">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Vocabulary Notes</p>
              <p className="text-muted-foreground leading-relaxed">{content.vocabulary_notes}</p>
            </div>
          )}
          {content.example_sentences && content.example_sentences.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Examples</p>
              <div className="space-y-1.5">
                {content.example_sentences.slice(0, 4).map((ex, i) => (
                  <div key={i} className="rounded-md bg-muted/50 px-3 py-1.5">
                    <p className="font-medium">{ex.target}</p>
                    <p className="text-xs text-muted-foreground">{ex.native}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {content.cultural_notes && (
            <div className="space-y-1">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cultural Notes</p>
              <p className="text-muted-foreground leading-relaxed">{content.cultural_notes}</p>
            </div>
          )}
        </div>
      )}

      {!isLoading && !content && !referenceType && (
        <p className="text-sm text-muted-foreground text-center py-4">No additional content available for this lesson.</p>
      )}
    </div>
  );
}

function VisualLessonCard({
  section,
  index,
  language,
  autoExpand,
  onStartConversation,
  onStartDrill,
  onViewed,
  onMarkedRead,
}: {
  section: Section;
  index: number;
  language?: string;
  autoExpand?: boolean;
  onStartConversation: () => void;
  onStartDrill: () => void;
  onViewed: () => void;
  onMarkedRead?: (id: string) => void;
}) {
  const viewedRef = useRef(false);
  const hasMarkedReadRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [showRhythmDrill, setShowRhythmDrill] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(autoExpand ?? false);
  const queryClient = useQueryClient();

  const markReadMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/textbook/progress/${section.id}`, {
        sectionType: "content",
        viewed: true,
        completed: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/textbook/progress", section.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/textbook"] });
      onMarkedRead?.(section.id);
    },
  });

  // Fire mark-read when auto-expanding (first section on chapter open)
  useEffect(() => {
    if (autoExpand && !hasMarkedReadRef.current) {
      hasMarkedReadRef.current = true;
      markReadMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleToggleContent() {
    const opening = !contentExpanded;
    setContentExpanded(opening);
    if (opening && !hasMarkedReadRef.current) {
      hasMarkedReadRef.current = true;
      markReadMutation.mutate();
    }
  }

  const isRhythmEligible =
    (section.lessonType === 'vocabulary' || section.lessonType === 'drill') &&
    section.hasDrills &&
    section.drills &&
    section.drills.length > 0;

  const hasAltCTA = !!(section.conversationTopic || (section.hasDrills && section.drillCount > 0) || isRhythmEligible);

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
              variant={contentExpanded ? "secondary" : hasAltCTA ? "outline" : "default"}
              size="sm"
              className={`min-h-[44px] touch-manipulation${!hasAltCTA ? ' flex-1' : ''}`}
              onClick={handleToggleContent}
              data-testid={`button-read-lesson-${section.id}`}
            >
              <BookOpen className="h-4 w-4 mr-1" />
              {contentExpanded ? "Hide Notes" : "Study Notes"}
              {contentExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
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

          {contentExpanded && (
            <div
              className="border-t pt-4"
              data-testid={`inline-lesson-content-${section.id}`}
            >
              <InlineLessonContent
                lessonId={section.id}
                lessonName={section.name}
                language={language ?? "spanish"}
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
            autoExpand={index === 0}
            language={language}
            onStartConversation={onStartConversation}
            onStartDrill={() => onStartDrill(section.id)}
            onViewed={() => handleSectionViewed(section.id)}
            onMarkedRead={handleMarkedRead}
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

    </div>
  );
}

export default TextbookChapterView;
