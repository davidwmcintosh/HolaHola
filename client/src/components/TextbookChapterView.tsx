import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  BookMarked,
  Loader2,
  Library,
  Globe,
  MessageCircle,
} from "lucide-react";
import { VisualVocabGrid } from "./TextbookInfographics";
import { ChapterIntroduction, classifyGrammarType, GrammarChapterView, ConversationStripsSection } from "./ChapterIntroduction";
import { RhythmDrill } from "./RhythmDrill";
import { SeeItSayItLoop } from "./SeeItSayItLoop";
import { SentenceColumnGenerator, SentenceColumn } from "./SentenceColumnGenerator";
import { NegativeFormSection, NegativeFormItem } from "./NegativeFormSection";
import { QuestionFormSection, QuestionFormItem } from "./QuestionFormSection";
import { SocialPhraseUnit } from "./SocialPhraseUnit";
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
  onStartConversation: (lessonId?: string) => void;
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

interface GrammarExample {
  target: string;
  translation: string;
  note?: string;
}

interface TextbookContent {
  lesson_id: string;
  introduction?: string;
  grammar_explanation?: string;
  grammar_examples?: GrammarExample[];
  cultural_note?: string;
  reading_passage?: string;
  actfl_level?: string;
}

const INLINE_SUPPRESS_TYPES = new Set([
  'ja_numbers', 'ko_numbers', 'zh_numbers', 'he_numbers',
  'es_numbers', 'fr_numbers', 'de_numbers', 'it_numbers', 'pt_numbers', 'en_numbers',
]);

// ── Micro-cycle data hook ──────────────────────────────────────────────────────
// Fetches AI-generated NegativeForm / QuestionForm / SentenceColumns for a lesson.
// First call: backend calls Claude (~2-3s). All subsequent calls: instant cache.

interface MicroCycleData {
  negativeItems: NegativeFormItem[];
  questionItems: QuestionFormItem[];
  sentenceColumns: SentenceColumn[];
  patternLabel: string;
  fromCache: boolean;
}

function useMicroCycleData(lessonId: string | undefined, language: string) {
  return useQuery<MicroCycleData>({
    queryKey: ["/api/textbook/micro-cycle", lessonId, language],
    queryFn: async () => {
      if (!lessonId) throw new Error("No lessonId");
      const res = await fetch(
        `/api/textbook/micro-cycle/${lessonId}?language=${encodeURIComponent(language)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`micro-cycle fetch failed: ${res.status}`);
      return res.json();
    },
    enabled: !!lessonId,
    staleTime: 1000 * 60 * 30,
  });
}

// ── Inline lesson content ──────────────────────────────────────────────────────

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
        <div className="space-y-5 text-sm">

          {/* Grammar Focus */}
          {content.grammar_explanation && (
            <div className="space-y-1.5">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Grammar Focus</p>
              <p className="text-muted-foreground leading-relaxed">{content.grammar_explanation}</p>
            </div>
          )}

          {/* Grammar Examples — with register/usage notes */}
          {content.grammar_examples && content.grammar_examples.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Examples</p>
              <div className="space-y-2">
                {content.grammar_examples.slice(0, 5).map((ex, i) => (
                  <div key={i} className="rounded-md bg-muted/40 px-3 py-2 space-y-0.5">
                    {ex.note && (
                      <p className="text-[10px] text-muted-foreground/70 italic leading-snug">{ex.note}</p>
                    )}
                    <p className="font-medium text-sm leading-snug">{ex.target}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{ex.translation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cultural Context */}
          {content.cultural_note && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cultural Context</p>
              </div>
              <p className="text-muted-foreground leading-relaxed">{content.cultural_note}</p>
            </div>
          )}

          {/* Reading — rendered as dialogue if lines start with — */}
          {content.reading_passage && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Reading</p>
              </div>
              {content.reading_passage.includes('—') ? (
                <div
                  className="rounded-md border bg-muted/20 px-4 py-3 space-y-2"
                  data-testid="reading-dialogue"
                >
                  {content.reading_passage.split('\n').filter(Boolean).map((line, i) => {
                    const isLine = line.startsWith('—') || line.startsWith('-');
                    const text = isLine ? line.replace(/^[—-]\s*/, '') : line;
                    return (
                      <p
                        key={i}
                        className={`text-sm leading-snug ${
                          isLine
                            ? i % 2 === 0
                              ? 'font-medium'
                              : 'text-muted-foreground pl-4'
                            : 'text-muted-foreground italic'
                        }`}
                      >
                        {isLine && (
                          <span className="text-muted-foreground/50 mr-1.5 select-none">—</span>
                        )}
                        {text}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground leading-relaxed">{content.reading_passage}</p>
              )}
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

// ── Flat lesson section ────────────────────────────────────────────────────────
// All content visible without clicking. Progress marked automatically when
// section scrolls into view (IntersectionObserver, 40% threshold).

function FlatLessonSection({
  section,
  index,
  language,
  onViewed,
  onMarkedRead,
}: {
  section: Section;
  index: number;
  language?: string;
  onViewed: () => void;
  onMarkedRead?: (id: string) => void;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(false);
  const markedReadRef = useRef(false);
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

  // Auto-mark read + viewed when scrolled into view
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      viewedRef.current = true;
      onViewed();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!viewedRef.current) {
            viewedRef.current = true;
            onViewed();
          }
          if (!markedReadRef.current) {
            markedReadRef.current = true;
            markReadMutation.mutate();
          }
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div
      ref={sectionRef}
      className="space-y-4"
      data-testid={`flat-lesson-${section.id}`}
    >
      {/* Section name — minimal label */}
      <div className="flex items-center gap-2.5">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          section.isComplete
            ? 'bg-green-500/20 text-green-600 dark:text-green-400'
            : 'bg-primary/10 text-primary'
        }`}>
          {section.isComplete ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
        </div>
        <h3 className="font-semibold text-sm" data-testid={`text-lesson-name-${section.id}`}>
          {section.name}
        </h3>
        {section.textbookRead && (
          <Badge variant="secondary" className="text-xs gap-1 py-0" data-testid={`badge-read-${section.id}`}>
            <BookMarked className="h-3 w-3" />
            Read
          </Badge>
        )}
        {section.danielaCovered && (
          <Badge className="text-xs gap-1 py-0 bg-primary/20 text-primary" data-testid={`badge-daniela-${section.id}`}>
            <Sparkles className="h-3 w-3" />
            Covered
          </Badge>
        )}
      </div>

      {/* Study notes — always visible, no click required */}
      <div data-testid={`study-notes-${section.id}`}>
        <InlineLessonContent
          lessonId={section.id}
          lessonName={section.name}
          language={language ?? "spanish"}
        />
      </div>

      {/* Quick Review — visible when drills are available */}
      {isRhythmEligible && rhythmItems.length > 0 && (
        <div className="pt-1" data-testid={`rhythm-drill-${section.id}`}>
          <div className="flex items-center gap-2 mb-3">
            <Music2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Review
            </span>
          </div>
          <RhythmDrill
            title={section.name}
            description="Listen to each item, then say it aloud when the mic appears."
            items={rhythmItems}
            language={language}
          />
        </div>
      )}
    </div>
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

  // Chapter-level See It, Say It — uses first vocab/drill section
  const firstSislSection = chapter.sections.find(
    s => s.lessonType === 'vocabulary' || s.lessonType === 'drill'
  );

  // Micro-cycle data — AI-generated for this chapter's first vocab lesson
  const { data: microCycle, isLoading: microCycleLoading } = useMicroCycleData(
    firstSislSection?.id,
    language ?? "spanish"
  );

  const hasMicroCycle =
    !microCycleLoading &&
    microCycle &&
    (microCycle.negativeItems.length > 0 || microCycle.questionItems.length > 0 || microCycle.sentenceColumns.length > 0);

  // ── Format 1: Social Phrase Card ──────────────────────────────────────────
  if (chapter.chapterType === 'social_phrases') {
    return (
      <div className="space-y-6 w-full max-w-2xl mx-auto pb-12 touch-pan-y overscroll-contain">
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
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Unit {chapter.number}
          </p>
          <h1 className="text-2xl font-bold">{chapter.title}</h1>
          <p className="text-sm text-muted-foreground">{chapter.description}</p>
        </div>

        <SocialPhraseUnit language={language} />

        <div className="pt-2">
          <Button
            className="w-full min-h-[52px] text-base gap-2"
            onClick={() => onStartConversation()}
            data-testid="button-start-chapter-chat"
          >
            <MessageSquare className="h-5 w-5" />
            Practice with Daniela
          </Button>
        </div>
      </div>
    );
  }

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

      {/* ── See It, Say It — primary vocab presentation (Madrigal method) ── */}
      {firstSislSection && (
        <div data-testid="sisl-chapter-inline">
          <SeeItSayItLoop
            lessonId={firstSislSection.id}
            language={language}
            lessonName={firstSislSection.name}
          />
        </div>
      )}

      {/* ── Negative form — real data from micro-cycle hook ── */}
      {(microCycleLoading || (hasMicroCycle && microCycle!.negativeItems.length > 0)) && (
        <div data-testid="negative-form-section-wrapper">
          <div className="flex items-center gap-2 px-1 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Negative Form
            </h2>
          </div>
          {microCycleLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Generating practice content…</span>
            </div>
          ) : (
            <NegativeFormSection
              language={language}
              patternLabel={microCycle!.patternLabel}
              items={microCycle!.negativeItems}
            />
          )}
        </div>
      )}

      {/* ── Question form — real data from micro-cycle hook ── */}
      {(microCycleLoading || (hasMicroCycle && microCycle!.questionItems.length > 0)) && (
        <div data-testid="question-form-section-wrapper">
          <div className="flex items-center gap-2 px-1 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Question Form
            </h2>
          </div>
          {microCycleLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Generating practice content…</span>
            </div>
          ) : (
            <QuestionFormSection
              language={language}
              patternLabel={microCycle!.patternLabel}
              items={microCycle!.questionItems}
            />
          )}
        </div>
      )}

      {/* ── Sentence Practice — real data from micro-cycle hook ── */}
      {(microCycleLoading || (hasMicroCycle && microCycle!.sentenceColumns.length > 0)) && (
        <div data-testid="sentence-column-generator-section">
          <div className="flex items-center gap-2 px-1 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Sentence Practice
            </h2>
          </div>
          {microCycleLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Generating practice content…</span>
            </div>
          ) : (
            <SentenceColumnGenerator
              language={language}
              columns={microCycle!.sentenceColumns}
            />
          )}
        </div>
      )}

      {/* ── Grammar / intro reference ── */}
      <ChapterIntroduction
        chapterNumber={chapter.number}
        chapterTitle={chapter.title}
        language={language}
        chapterType={chapter.chapterType || undefined}
        className="mb-4"
      />

      {/* ── Chapter-level vocab grid (hidden when SeeItSayItLoop covers the same vocab) ── */}
      {chapter.sections.length > 0 && !firstSislSection && (
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

      {/* ── Flat lesson sections ── */}
      {chapter.sections.length > 0 && (
        <div className="space-y-8" data-testid="flat-lesson-sections">
          <div className="flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Lesson Notes
            </h2>
          </div>
          {chapter.sections.map((section, index) => (
            <FlatLessonSection
              key={section.id}
              section={{
                ...section,
                textbookRead: section.textbookRead || locallyReadIds.has(section.id),
              }}
              index={index}
              language={language}
              onViewed={() => handleSectionViewed(section.id)}
              onMarkedRead={handleMarkedRead}
            />
          ))}
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

      {/* ── CTAs — at the bottom, after all content ── */}
      <div className="space-y-2 pt-2" data-testid="chapter-cta-section">
        <Button
          className="w-full min-h-[52px] text-base gap-2"
          onClick={() => onStartConversation(firstSislSection?.id)}
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
    </div>
  );
}

export default TextbookChapterView;
