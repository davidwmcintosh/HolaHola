import { useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
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
  Play
} from "lucide-react";
import { 
  LessonSnapshot,
  ObjectivesHighlight,
  VocabularyStudyGuide,
  UsefulPhrases,
  PreparationTips
} from "./TextbookInfographics";
import { ChapterRecap } from "./ChapterRecap";
import { ChapterIntroduction } from "./ChapterIntroduction";
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
  onStartConversation,
  onStartDrill,
  onViewed
}: {
  section: Section;
  index: number;
  onStartConversation: () => void;
  onStartDrill: () => void;
  onViewed: () => void;
}) {
  const viewedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

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
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">
                    {section.lessonType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {section.estimatedMinutes} min
                  </span>
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
          
          {section.objectives && section.objectives.length > 0 && (
            <ObjectivesHighlight 
              objectives={section.objectives} 
              title="After this lesson, I can..."
            />
          )}
          
          {section.drills && section.drills.length > 0 && (
            <VocabularyStudyGuide 
              drills={section.drills}
              title="Study These Words First"
            />
          )}
          
          {section.conversationTopic && section.drills && section.drills.length > 0 && (
            <UsefulPhrases 
              drills={section.drills}
              topic={section.conversationTopic}
            />
          )}
          
          <PreparationTips 
            lessonType={section.lessonType}
            conversationTopic={section.conversationTopic}
            objectives={section.objectives}
          />
          
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
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
            {section.hasDrills && section.drillCount > 0 && (
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
        className="mb-4"
      />
      
      <div className="grid gap-4">
        {chapter.sections.map((section, index) => (
          <VisualLessonCard
            key={section.id}
            section={section}
            index={index}
            onStartConversation={onStartConversation}
            onStartDrill={() => onStartDrill(section.id)}
            onViewed={() => handleSectionViewed(section.id)}
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
