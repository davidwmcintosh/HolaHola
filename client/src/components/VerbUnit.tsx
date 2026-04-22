import { useLayoutEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessageSquare, Dumbbell, Loader2 } from "lucide-react";
import { classifyGrammarType, GrammarChapterView } from "./ChapterIntroduction";
import { SeeItSayItLoop } from "./SeeItSayItLoop";
import { NegativeFormSection, NegativeFormItem } from "./NegativeFormSection";
import { SentenceColumnGenerator, SentenceColumn } from "./SentenceColumnGenerator";
import {
  MadrigalAnchorBlock,
  MadrigalPositiveGrid,
  MadrigalNote,
  MadrigalPage12Grid,
  MadrigalVaDefinition,
} from "./MadrigalPageComponents";
import { PreteriteUnit } from "./PreteriteUnit";
import { getMadrigalContent, getPreteriteContent } from "@/data/madrigal-unit-content";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  name: string;
  lessonType: string;
  hasDrills: boolean;
  drillCount: number;
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
  questionItems: { imageWord: string; question: string; questionTranslation: string; affirmativeAnswer: string; affirmativeTranslation: string; negativeAnswer: string; negativeTranslation: string }[];
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

// ── Micro-cycle hook (fallback path only) ─────────────────────────────────────

function useMicroCycle(lessonId: string | undefined, language: string, enabled: boolean) {
  return useQuery<MicroCycleData>({
    queryKey: ["/api/textbook/micro-cycle", lessonId, language],
    queryFn: async () => {
      if (!lessonId) throw new Error("No lessonId");
      const res = await fetch(
        `/api/textbook/micro-cycle/${lessonId}?language=${encodeURIComponent(language)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`micro-cycle: ${res.status}`);
      return res.json();
    },
    enabled: enabled && !!lessonId,
    staleTime: 1000 * 60 * 30,
  });
}

// ── Thin dashed rule — acts as Madrigal's page break in scroll format ─────────

function PageRule() {
  return <hr className="border-dashed border-border/50 my-1" />;
}

// ── VerbUnit ──────────────────────────────────────────────────────────────────

export function VerbUnit({ chapter, language, onBack, onStartConversation, onStartDrill }: VerbUnitProps) {
  const grammarType = classifyGrammarType(chapter.title, language);

  // Madrigal hardcoded content takes precedence
  const madrigal = getMadrigalContent(chapter.title);
  const preterite = getPreteriteContent(chapter.title);
  const hasMadrigal = !!madrigal;
  const hasPreterite = !hasMadrigal && !!preterite;

  // Scroll to top whenever this chapter opens (hooks must precede conditional returns)
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    const scrollContainer = document.querySelector(".overflow-y-auto");
    if (scrollContainer) scrollContainer.scrollTop = 0;
  }, [chapter.id]);

  // If this is a preterite unit, delegate immediately
  if (hasPreterite && preterite) {
    return (
      <PreteriteUnit
        content={preterite}
        language={language}
        chapter={chapter}
        onBack={onBack}
        onStartConversation={onStartConversation}
        onStartDrill={onStartDrill}
      />
    );
  }

  const firstVocabSection =
    chapter.sections.find(s => s.lessonType === "grammar") ??
    chapter.sections[0];

  const { data: microCycle, isLoading: microLoading } = useMicroCycle(
    firstVocabSection?.id,
    language,
    !hasMadrigal
  );

  const sections = chapter.sections ?? [];
  const totalDrills = sections.reduce((acc, s) => acc + (s.drillCount || 0), 0);
  const firstDrillSectionId = sections.find(s => s.hasDrills && s.drillCount > 0)?.id;

  const hasNegative = !microLoading && microCycle && microCycle.negativeItems.length > 0;
  const hasQuestion  = !microLoading && microCycle && microCycle.questionItems.length > 0;
  const hasSentence  = !microLoading && microCycle && microCycle.sentenceColumns.length > 0;
  const anyMicro = hasNegative || hasQuestion || hasSentence;

  return (
    <div
      className="w-full max-w-2xl mx-auto pb-16 touch-pan-y overscroll-contain"
      data-testid="verb-unit"
    >
      {/* ── Sticky back bar ── */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 border-b mb-6">
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

      {/* ══════════════════════════════════════════════════════════════════════
          PATH A — Hardcoded Madrigal content
          Madrigal gets straight into content — no chapter title, no header.

          Scroll order matches the book exactly:
            voyAnchor + 4 positive
            ─ ─ ─ ─ ─
            vaAnchor + ¿Va? 2-column drill + note
            ─ ─ ─ ─ ─
            noVoyAnchor + 4 negative (same places)
            substitution drill (8 verb forms × 8 places)
            ─ ─ ─ ─ ─
            vamosAnchor + 4 Vamos pictures + note
            ─ ─ ─ ─ ─
            page12Anchors + 4 Q&A pairs + Va: definition
            ─ ─ ─ ─ ─
            CTAs
          ══════════════════════════════════════════════════════════════════════ */}
      {hasMadrigal && madrigal && (
        <div className="space-y-6 px-4">

          {/* Voy + al — same line anchor */}
          <MadrigalAnchorBlock items={madrigal.voyAnchor} />

          {/* 4 positive pictures: Voy al hotel / banco / garaje / restaurante */}
          <MadrigalPositiveGrid items={madrigal.positiveItems} language={language} />

          <PageRule />

          {/* ¿Va? anchor */}
          <MadrigalAnchorBlock items={madrigal.vaAnchor} />

          {/* ¿Va al ___? — 2-column substitution drill */}
          <SentenceColumnGenerator language={language} columns={madrigal.vaColumns} />

          {/* Subject pronoun note */}
          {madrigal.subjectPronounNote && (
            <MadrigalNote text={madrigal.subjectPronounNote} />
          )}

          <PageRule />

          {/* No voy + al — same line anchor */}
          <MadrigalAnchorBlock items={madrigal.noVoyAnchor} />

          {/* 4 negative pictures — same 4 places as positive */}
          <NegativeFormSection items={madrigal.negativeItems} language={language} />

          {/* Substitution drill: 8 verb forms × 8 places */}
          <SentenceColumnGenerator language={language} columns={madrigal.sentenceColumns} />

          <PageRule />

          {/* Vamos anchor */}
          <MadrigalAnchorBlock items={madrigal.vamosAnchor} />

          {/* 4 Vamos pictures */}
          <MadrigalPositiveGrid items={madrigal.vamosItems} language={language} />

          {/* Vamos note */}
          {madrigal.vamosNote && <MadrigalNote text={madrigal.vamosNote} />}

          <PageRule />

          {/* Page 12: 4-item anchor (¿Va? + al + Voy + Sí) */}
          <MadrigalAnchorBlock items={madrigal.page12Anchors} />

          {/* 4 Q&A pairs (2 with images, 2 text-only) */}
          <MadrigalPage12Grid items={madrigal.page12Items} language={language} />

          {/* Va: definition */}
          {madrigal.vaDefinition && <MadrigalVaDefinition text={madrigal.vaDefinition} />}

          <PageRule />

          {/* CTAs */}
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

      {/* ══════════════════════════════════════════════════════════════════════
          PATH B — Fallback: grammar card + SeeItSayItLoop + micro-cycle
          Used for chapters not yet transcribed from Madrigal
          ══════════════════════════════════════════════════════════════════════ */}
      {!hasMadrigal && (
        <div className="space-y-8 px-4">

          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">
              Chapter {chapter.number}
            </p>
            <h1 className="text-3xl font-bold" data-testid="verb-unit-title">
              {chapter.title}
            </h1>
          </div>

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

          {firstVocabSection && (
            <div data-testid="verb-unit-sisl">
              <SeeItSayItLoop
                lessonId={firstVocabSection.id}
                language={language}
                lessonName={firstVocabSection.name}
              />
            </div>
          )}

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
              {hasSentence && (
                <SentenceColumnGenerator
                  language={language}
                  columns={microCycle!.sentenceColumns}
                />
              )}
            </div>
          )}

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
