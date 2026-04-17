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
  Music2,
  ChevronDown,
  ChevronUp,
  BookMarked,
  Loader2,
  Library,
  Eye,
} from "lucide-react";
import { VisualVocabGrid } from "./TextbookInfographics";
import { ChapterRecap } from "./ChapterRecap";
import { ChapterIntroduction, classifyGrammarType, GrammarChapterView, ConversationStripsSection } from "./ChapterIntroduction";
import { RhythmDrill } from "./RhythmDrill";
import { SeeItSayItLoop } from "./SeeItSayItLoop";
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
  imageUrl?: string | null;
  relatedScenario?: { slug: string; title: string } | null;
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
      return <MessageSquare className="h-3.5 w-3.5" />;
    case 'drill':
      return <Dumbbell className="h-3.5 w-3.5" />;
    case 'vocabulary':
      return <Book className="h-3.5 w-3.5" />;
    case 'grammar':
      return <GraduationCap className="h-3.5 w-3.5" />;
    default:
      return <BookOpen className="h-3.5 w-3.5" />;
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

const INLINE_SUPPRESS_TYPES = new Set([
  'ja_numbers', 'ko_numbers', 'zh_numbers', 'he_numbers',
  'es_numbers', 'fr_numbers', 'de_numbers', 'it_numbers', 'pt_numbers', 'en_numbers',
]);

function InlineLessonContent({ lessonId, lessonName, language }: {
  lessonId: string;
  lessonName: string;
  language: string;
}) {
  const referenceType = classifyGrammarType(lessonName, language);
  const inlineRefType = referenceType && INLINE_SUPPRESS_TYPES.has(referenceType) ? null : referenceType;

  const { data, isLoading } = useQuery<{ content: TextbookContent | null }>({
    queryKey: ["/api/textbook-content", lessonId],
    enabled: !!lessonId,
  });

  const content = data?.content;

  return (
    <div className="space-y-4 pt-1">
      {inlineRefType && (
        <GrammarChapterView type={inlineRefType} chapterNumber={0} language={language} />
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

// ── Chapter-level vocab section ───────────────────────────────────────────────
// Shows VisualVocabGrid for each section that has vocab drills, all unified
// under a single "Chapter Vocabulary" header.
// Chapters whose grammar type already has a dedicated reference card
// (numbers grid, family tree, clock SVGs, etc.) suppress DALL-E vocab images
// here — the ChapterIntroduction / per-section grammar view handle them.

const SUPPRESS_CHAPTER_VOCAB_TYPES = new Set([
  // Numbers — all languages (handled by numbers grid)
  'ja_numbers', 'ko_numbers', 'zh_numbers', 'he_numbers',
  'es_numbers', 'fr_numbers', 'de_numbers', 'it_numbers', 'pt_numbers', 'en_numbers',
  // Family vocabulary — all languages (handled by family tree grid)
  'family_tree',
]);

function ChapterVocabSection({
  sections,
  language,
  chapterTitle,
}: {
  sections: Section[];
  language: string;
  chapterTitle: string;
}) {
  const chapterRefType = classifyGrammarType(chapterTitle, language);
  const suppressAll = SUPPRESS_CHAPTER_VOCAB_TYPES.has(chapterRefType ?? '');
  if (suppressAll) return null;

  const sectionsWithVocab = sections.filter(s => {
    if (!s.drills || s.drills.length === 0) return false;
    const vocabDrills = s.drills.filter(d =>
      (d.itemType === 'translate_speak' || d.itemType === 'listen_repeat') &&
      d.targetText && d.targetText.trim().split(/\s+/).length <= 5 &&
      d.targetText.length <= 40 &&
      !/^\d/.test(d.targetText.trim())
    );
    return vocabDrills.length > 0;
  });

  if (sectionsWithVocab.length === 0) return null;

  return (
    <div className="space-y-4" data-testid="chapter-vocab-section">
      <div className="flex items-center gap-2 px-1">
        <Library className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Chapter Vocabulary
        </h2>
      </div>
      <div className="rounded-lg border bg-card p-4 space-y-6">
        {sectionsWithVocab.map(section => (
          <div key={section.id}>
            {sectionsWithVocab.length > 1 && (
              <p className="text-xs font-medium text-muted-foreground mb-2 truncate">
                {section.name}
              </p>
            )}
            <VisualVocabGrid
              lessonId={section.id}
              drills={section.drills!}
              language={language}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Compact lesson reference card ─────────────────────────────────────────────
// Shows lesson name/type + study notes toggle + rhythm drill only.
// No vocab grid (shown at chapter level), no per-lesson chat buttons.

function CompactLessonCard({
  section,
  index,
  language,
  autoExpand,
  onViewed,
  onMarkedRead,
}: {
  section: Section;
  index: number;
  language?: string;
  autoExpand?: boolean;
  onViewed: () => void;
  onMarkedRead?: (id: string) => void;
}) {
  const viewedRef = useRef(false);
  const hasMarkedReadRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [showRhythmDrill, setShowRhythmDrill] = useState(false);
  const [showSeeItSayIt, setShowSeeItSayIt] = useState(false);
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

  const isSeeItSayItEligible =
    section.lessonType === 'vocabulary' || section.lessonType === 'drill';

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
      data-testid={`lesson-card-${section.id}`}
    >
      <CardContent className="p-0">
        {/* Compact header — two siblings: expand area + action buttons */}
        <div className="flex items-center gap-2 p-4">
          {/* Expand toggle (takes up most width) */}
          <button
            className="flex-1 text-left flex items-center gap-3 min-w-0 rounded-md"
            onClick={handleToggleContent}
            data-testid={`button-toggle-lesson-${section.id}`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              section.isComplete
                ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                : 'bg-primary/10 text-primary'
            }`}>
              {section.isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{section.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="outline" className="text-xs gap-1 py-0">
                  {getLessonTypeIcon(section.lessonType)}
                  {section.lessonType}
                </Badge>
                <span className="text-xs text-muted-foreground">{section.estimatedMinutes} min</span>
                {section.textbookRead && (
                  <Badge variant="secondary" className="text-xs gap-1 py-0" data-testid={`badge-read-${section.id}`}>
                    <BookMarked className="h-3 w-3" />
                    Read
                  </Badge>
                )}
                {section.danielaCovered && (
                  <Badge className="text-xs gap-1 py-0 bg-primary/20 text-primary hover:bg-primary/20" data-testid={`badge-daniela-${section.id}`}>
                    <Sparkles className="h-3 w-3" />
                    Covered
                  </Badge>
                )}
              </div>
            </div>
          </button>
          {/* Action buttons — sibling to expand toggle, not nested */}
          <div className="flex items-center gap-2 shrink-0">
            {isSeeItSayItEligible && (
              <Button
                variant={showSeeItSayIt ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => {
                  setShowSeeItSayIt(prev => !prev);
                  setShowRhythmDrill(false);
                  if (contentExpanded) setContentExpanded(false);
                }}
                data-testid={`button-see-it-say-it-${section.id}`}
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                See It, Say It
              </Button>
            )}
            <button
              className="text-muted-foreground p-1 rounded-md hover-elevate"
              onClick={handleToggleContent}
              aria-label={contentExpanded ? "Collapse lesson" : "Expand lesson"}
            >
              {contentExpanded
                ? <ChevronUp className="h-4 w-4" />
                : <ChevronDown className="h-4 w-4" />
              }
            </button>
          </div>
        </div>

        {/* See It, Say It panel — always directly under the header when active */}
        {showSeeItSayIt && isSeeItSayItEligible && (
          <div className="border-t px-4 pb-4 pt-3" data-testid={`sisl-panel-${section.id}`}>
            <SeeItSayItLoop
              lessonId={section.id}
              language={language}
              lessonName={section.name}
              onComplete={() => setShowSeeItSayIt(false)}
            />
          </div>
        )}

        {/* Study notes (expandable) */}
        {contentExpanded && (
          <div className="border-t px-4 pb-4 pt-3" data-testid={`study-notes-${section.id}`}>
            <InlineLessonContent
              lessonId={section.id}
              lessonName={section.name}
              language={language ?? "spanish"}
            />
            {isRhythmEligible && rhythmItems.length > 0 && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <Button
                  variant={showRhythmDrill ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    setShowRhythmDrill(prev => !prev);
                    setShowSeeItSayIt(false);
                  }}
                  data-testid={`button-rhythm-expanded-${section.id}`}
                >
                  <Music2 className="h-3.5 w-3.5 mr-2" />
                  Quick Review
                  {showRhythmDrill
                    ? <ChevronUp className="h-3.5 w-3.5 ml-2" />
                    : <ChevronDown className="h-3.5 w-3.5 ml-2" />
                  }
                </Button>
                {showRhythmDrill && (
                  <div className="mt-2" data-testid={`rhythm-drill-expanded-${section.id}`}>
                    <RhythmDrill
                      title={section.name}
                      description="Listen to each item, then say it aloud when the mic appears."
                      items={rhythmItems}
                      language={language}
                      onComplete={(results) => {
                        const correct = results.filter(r => r.correct).length;
                        if (correct / results.length >= 0.7) setShowRhythmDrill(false);
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main chapter view ─────────────────────────────────────────────────────────

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
  const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  useEffect(() => {
    viewedSectionsRef.current = new Set();
  }, [chapter.id]);

  const saveProgressMutation = useMutation({
    mutationFn: async (data: { lessonId: string; viewed?: boolean; completed?: boolean }) => {
      return apiRequest('POST', `/api/textbook/progress/${data.lessonId}`, {
        viewed: data.viewed,
        completed: data.completed,
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
    queryClient.invalidateQueries({ queryKey: ['/api/textbook'] });
  }, [queryClient]);

  const handleReviewFlashcards = () => {
    if (onReviewFlashcards) onReviewFlashcards();
  };

  // Total drills across all sections (for the chapter-level drill CTA)
  const totalDrillCount = chapter.sections.reduce((acc, s) => acc + (s.drillCount || 0), 0);
  const firstDrillSectionId = chapter.sections.find(s => s.hasDrills && s.drillCount > 0)?.id;

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto pb-12 touch-pan-y overscroll-contain">

      {/* ── Sticky top bar ── */}
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

      {/* ── Chapter title ── */}
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

      {/* ── Grammar / intro reference ── */}
      <ChapterIntroduction
        chapterNumber={chapter.number}
        chapterTitle={chapter.title}
        language={language}
        chapterType={chapter.chapterType || undefined}
        className="mb-4"
      />

      {/* ── Chapter-level vocab grid ── */}
      {chapter.sections.length > 0 && (
        <ChapterVocabSection
          sections={chapter.sections}
          language={language}
          chapterTitle={chapter.title}
        />
      )}

      {/* ── Conversation strips — after vocab so phrases land in context ── */}
      <ConversationStripsSection
        language={language}
        chapterType={chapter.chapterType || undefined}
      />

      {/* ── Per-section visual vocab cards (e.g. La Hora clock grid inside a numbers chapter) ── */}
      {/* Only renders visual-vocab reference types — grammar diagram types are excluded intentionally */}
      {(() => {
        const VISUAL_VOCAB_TYPES = new Set([
          'telling_time', 'days_week', 'weather_vocab', 'emotions_vocab',
          'body_parts', 'face_parts', 'hand_parts', 'temperature_vocab',
          'greeting_etiquette', 'hispanic_food', 'gesture_awareness',
          'world_map', 'festival_calendar', 'dialect_map', 'currency_ref',
          'country_dot_map',
        ]);
        const chapterType = classifyGrammarType(chapter.title, language);
        return chapter.sections
          .map(s => ({ s, type: classifyGrammarType(s.name, language) }))
          .filter(({ type }) => type && VISUAL_VOCAB_TYPES.has(type) && type !== chapterType)
          .map(({ s, type }) => (
            <GrammarChapterView
              key={s.id}
              type={type!}
              chapterNumber={chapter.number}
              chapterTitle={s.name}
              language={language}
            />
          ));
      })()}

      {/* ── Primary CTA: Start Chat ── */}
      <div className="space-y-2" data-testid="chapter-cta-section">
        <Button
          className="w-full min-h-[52px] text-base gap-2"
          onClick={onStartConversation}
          data-testid="button-start-chapter-chat"
        >
          <MessageSquare className="h-5 w-5" />
          Chat about this chapter
        </Button>
        {firstDrillSectionId && totalDrillCount > 0 && (
          <Button
            variant="outline"
            className="w-full min-h-[44px] gap-2"
            onClick={() => onStartDrill(firstDrillSectionId)}
            data-testid="button-start-chapter-drill"
          >
            <Dumbbell className="h-4 w-4" />
            {totalDrillCount} Practice Activities
          </Button>
        )}
      </div>

      {/* ── Lesson reference accordion ── */}
      {chapter.sections.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Lesson Reference
            </h2>
          </div>
          <div className="space-y-2">
            {chapter.sections.map((section, index) => (
              <CompactLessonCard
                key={section.id}
                section={{
                  ...section,
                  textbookRead: section.textbookRead || locallyReadIds.has(section.id),
                }}
                index={index}
                language={language}
                autoExpand={false}
                onViewed={() => handleSectionViewed(section.id)}
                onMarkedRead={handleMarkedRead}
              />
            ))}
          </div>
        </div>
      )}

      {chapter.sections.length === 0 && (
        <Card className="p-8 text-center bg-muted/30">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Lessons Coming Soon</h3>
          <p className="text-sm text-muted-foreground">
            This chapter's content is being prepared. Check back soon!
          </p>
        </Card>
      )}

      {/* ── Chapter recap ── */}
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
