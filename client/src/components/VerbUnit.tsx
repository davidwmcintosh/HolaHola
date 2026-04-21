import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessageSquare, Dumbbell, Loader2 } from "lucide-react";
import { classifyGrammarType, GrammarChapterView } from "./ChapterIntroduction";
import { SeeItSayItLoop } from "./SeeItSayItLoop";
import { NegativeFormSection, NegativeFormItem } from "./NegativeFormSection";
import { QuestionFormSection, QuestionFormItem } from "./QuestionFormSection";
import { SentenceColumnGenerator, SentenceColumn } from "./SentenceColumnGenerator";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  lessonType: string;
  hasDrills: boolean;
  drillCount: number;
  drills?: DrillItem[];
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  description: string;
  progress: number;
  sectionsCount: number;
  completedSections: number;
  sections: Section[];
  chapterType?: string | null;
}

interface MicroCycleData {
  negativeItems: NegativeFormItem[];
  questionItems: QuestionFormItem[];
  sentenceColumns: SentenceColumn[];
  patternLabel: string;
  fromCache: boolean;
}

interface VerbUnitProps {
  chapter: Chapter;
  language: string;
  onBack: () => void;
  onStartConversation: (lessonId?: string) => void;
  onStartDrill: (lessonId: string) => void;
}

// ── Micro-cycle hook ──────────────────────────────────────────────────────────

function useMicroCycle(lessonId: string | undefined, language: string) {
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

// ── VerbUnit ──────────────────────────────────────────────────────────────────

export function VerbUnit({ chapter, language, onBack, onStartConversation, onStartDrill }: VerbUnitProps) {
  const grammarType = classifyGrammarType(chapter.title, language);

  // Use the grammar spotlight lesson if present, otherwise the first section.
  // Verb units are seeded with 'grammar' or 'conversation' lesson types, not 'vocabulary'.
  const firstVocabSection =
    chapter.sections.find(s => s.lessonType === "grammar") ??
    chapter.sections[0];

  const { data: microCycle, isLoading: microLoading } = useMicroCycle(
    firstVocabSection?.id,
    language
  );

  const totalDrills = chapter.sections.reduce((acc, s) => acc + (s.drillCount || 0), 0);
  const firstDrillSectionId = chapter.sections.find(s => s.hasDrills && s.drillCount > 0)?.id;

  const hasNegative = !microLoading && microCycle && microCycle.negativeItems.length > 0;
  const hasQuestion = !microLoading && microCycle && microCycle.questionItems.length > 0;
  const hasSentence = !microLoading && microCycle && microCycle.sentenceColumns.length > 0;
  const anyMicro = hasNegative || hasQuestion || hasSentence;

  return (
    <div
      className="space-y-8 w-full max-w-3xl mx-auto pb-12 touch-pan-y overscroll-contain"
      data-testid="verb-unit"
    >
      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 border-b supports-[backdrop-filter]:bg-background/80">
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

      {/* ── Grammar reference card — FIRST ── */}
      {grammarType && (
        <div data-testid="verb-unit-grammar-card">
          <GrammarChapterView
            type={grammarType}
            chapterNumber={chapter.number}
            language={language}
            chapterTitle={chapter.title}
          />
        </div>
      )}

      {/* ── Vocabulary grid (See It, Say It) ── */}
      {firstVocabSection && (
        <div data-testid="verb-unit-sisl">
          <SeeItSayItLoop
            lessonId={firstVocabSection.id}
            language={language}
            lessonName={firstVocabSection.name}
          />
        </div>
      )}

      {/* ── Micro-cycle drills — flat, no section headers ── */}
      {microLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Generating practice drills…</span>
        </div>
      )}

      {anyMicro && (
        <div className="space-y-6" data-testid="verb-unit-micro-cycle">
          {hasNegative && (
            <NegativeFormSection
              language={language}
              patternLabel={microCycle!.patternLabel}
              items={microCycle!.negativeItems}
            />
          )}

          {hasQuestion && (
            <QuestionFormSection
              language={language}
              patternLabel={microCycle!.patternLabel}
              items={microCycle!.questionItems}
            />
          )}

          {hasSentence && (
            <SentenceColumnGenerator
              language={language}
              columns={microCycle!.sentenceColumns}
            />
          )}
        </div>
      )}

      {/* ── Unit title — bottom, like a chapter total ── */}
      <div className="space-y-0.5 border-t pt-6">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Unit {chapter.number}
        </p>
        <h1 className="text-2xl font-bold" data-testid="verb-unit-title">
          {chapter.title}
        </h1>
      </div>

      {/* ── CTAs ── */}
      <div className="space-y-2 pt-2" data-testid="verb-unit-ctas">
        <Button
          className="w-full min-h-[52px] text-base gap-2"
          onClick={() => onStartConversation(firstVocabSection?.id)}
          data-testid="button-start-chapter-chat"
        >
          <MessageSquare className="h-5 w-5" />
          Practice with Daniela
        </Button>
        {firstDrillSectionId && totalDrills > 0 && (
          <Button
            variant="outline"
            className="w-full min-h-[44px] gap-2"
            onClick={() => onStartDrill(firstDrillSectionId)}
            data-testid="button-start-chapter-drill"
          >
            <Dumbbell className="h-4 w-4" />
            {totalDrills} Practice Activities
          </Button>
        )}
      </div>
    </div>
  );
}
