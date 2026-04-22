import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessageSquare, Dumbbell, Loader2 } from "lucide-react";
import { classifyGrammarType, GrammarChapterView } from "./ChapterIntroduction";
import { SeeItSayItLoop } from "./SeeItSayItLoop";
import { NegativeFormSection, NegativeFormItem } from "./NegativeFormSection";
import { QuestionFormSection, QuestionFormItem } from "./QuestionFormSection";
import { SentenceColumnGenerator, SentenceColumn } from "./SentenceColumnGenerator";
import { MadrigalAnchorBlock, MadrigalPositiveGrid, MadrigalVamosLine } from "./MadrigalPageComponents";
import { getMadrigalContent } from "@/data/madrigal-unit-content";

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

// ── Micro-cycle hook (used when Madrigal static content is NOT available) ─────

function useMicroCycle(lessonId: string | undefined, language: string, enabled: boolean) {
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
    enabled: enabled && !!lessonId,
    staleTime: 1000 * 60 * 30,
  });
}

// ── Thin horizontal rule between major page sections ─────────────────────────

function PageRule() {
  return <hr className="border-dashed border-border/60" />;
}

// ── VerbUnit ──────────────────────────────────────────────────────────────────

export function VerbUnit({ chapter, language, onBack, onStartConversation, onStartDrill }: VerbUnitProps) {
  const grammarType = classifyGrammarType(chapter.title, language);

  // Check for hardcoded Madrigal content first
  const madrigal = getMadrigalContent(chapter.title);
  const hasMadrigal = !!madrigal;

  // For fallback path: find the grammar/vocabulary lesson
  const firstVocabSection =
    chapter.sections.find(s => s.lessonType === "grammar") ??
    chapter.sections[0];

  const { data: microCycle, isLoading: microLoading } = useMicroCycle(
    firstVocabSection?.id,
    language,
    !hasMadrigal  // only fetch when no hardcoded content
  );

  const totalDrills = chapter.sections.reduce((acc, s) => acc + (s.drillCount || 0), 0);
  const firstDrillSectionId = chapter.sections.find(s => s.hasDrills && s.drillCount > 0)?.id;

  // Fallback path flags
  const hasNegative = !microLoading && microCycle && microCycle.negativeItems.length > 0;
  const hasQuestion = !microLoading && microCycle && microCycle.questionItems.length > 0;
  const hasSentence = !microLoading && microCycle && microCycle.sentenceColumns.length > 0;
  const anyMicro = hasNegative || hasQuestion || hasSentence;

  return (
    <div
      className="w-full max-w-2xl mx-auto pb-16 touch-pan-y overscroll-contain"
      data-testid="verb-unit"
    >
      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 border-b supports-[backdrop-filter]:bg-background/80 mb-6">
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

      {/* ════════════════════════════════════════════════════════════════════
          PATH A — Madrigal hardcoded content (pp. 9–13 formula)

          Page structure (matches Madrigal exactly):
            Verb header (ch. number + verb + English)
            ─────────────
            Anchor block (Voy / Al)
            Positive image grid (2×2)
            ─────────────
            Negative image grid (2×2)
            Vamos line
            ─────────────
            Q&A image grid (2×2)
            ─────────────
            Substitution drill
            ─────────────
            Unit title + CTAs
          ════════════════════════════════════════════════════════════════════ */}
      {hasMadrigal && madrigal && (
        <div className="space-y-7 px-4">

          {/* ── Verb header ── */}
          <div data-testid="verb-unit-chapter-header">
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              Chapter {chapter.number}
            </p>
            <h1 className="text-4xl font-bold tracking-tight" data-testid="verb-unit-title">
              {chapter.title}
            </h1>
            {chapter.description && (
              <p className="text-base text-muted-foreground mt-1">{chapter.description}</p>
            )}
          </div>

          <PageRule />

          {/* ── Anchor block ── */}
          <MadrigalAnchorBlock items={madrigal.anchor} />

          {/* ── Positive image grid ── */}
          <div data-testid="verb-unit-positive">
            <MadrigalPositiveGrid
              items={madrigal.positiveItems}
              language={language}
            />
          </div>

          <PageRule />

          {/* ── Negative image grid ── */}
          {madrigal.negativeItems.length > 0 && (
            <NegativeFormSection
              language={language}
              items={madrigal.negativeItems}
            />
          )}

          {/* ── Vamos line ── */}
          {madrigal.vamos && (
            <MadrigalVamosLine
              vamos={madrigal.vamos}
              language={language}
            />
          )}

          <PageRule />

          {/* ── Q&A section ── */}
          {madrigal.questionItems.length > 0 && (
            <QuestionFormSection
              language={language}
              items={madrigal.questionItems}
            />
          )}

          <PageRule />

          {/* ── Substitution drill ── */}
          {madrigal.sentenceColumns.length > 0 && (
            <SentenceColumnGenerator
              language={language}
              columns={madrigal.sentenceColumns}
            />
          )}

          <PageRule />

          {/* ── CTAs ── */}
          <div className="space-y-2" data-testid="verb-unit-ctas">
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
      )}

      {/* ════════════════════════════════════════════════════════════════════
          PATH B — Fallback: grammar reference card + SeeItSayItLoop + micro-cycle
          Used for chapters not yet transcribed from Madrigal
          ════════════════════════════════════════════════════════════════════ */}
      {!hasMadrigal && (
        <div className="space-y-8 px-4">

          {/* Chapter header */}
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              Chapter {chapter.number}
            </p>
            <h1 className="text-3xl font-bold" data-testid="verb-unit-title">
              {chapter.title}
            </h1>
          </div>

          {/* Grammar reference card */}
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

          {/* Vocabulary grid (See It, Say It) */}
          {firstVocabSection && (
            <div data-testid="verb-unit-sisl">
              <SeeItSayItLoop
                lessonId={firstVocabSection.id}
                language={language}
                lessonName={firstVocabSection.name}
              />
            </div>
          )}

          {/* Micro-cycle drills */}
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

          {/* CTAs */}
          <div className="space-y-2 pt-4" data-testid="verb-unit-ctas">
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
      )}
    </div>
  );
}
