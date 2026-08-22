import { useLayoutEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessageSquare, Dumbbell, Loader2 } from "lucide-react";
import { classifyGrammarType, GrammarChapterView } from "./ChapterIntroduction";
import { SeeItSayItLoop } from "./SeeItSayItLoop";
import { NegativeFormSection, NegativeFormItem } from "./NegativeFormSection";
import { SentenceColumnGenerator, SentenceColumn } from "./SentenceColumnGenerator";
import {
  BookAnchorBlock,
  BookVocabGrid,
  BookNote,
  BookQAGridP12,
  BookVaDefinition,
  BookGrid2x2,
  BookNegGrid2x2,
  BookQAGrid,
} from "./MadrigalPageComponents";
import { BookSpread, BookPageShell } from "./BookSpread";
import type { SpreadDef } from "./BookSpread";
import { PreteriteUnit } from "./PreteriteUnit";
import { SerUnit } from "./SerUnit";
import { HayUnit } from "./HayUnit";
import { GustUnit } from "./GustUnit";
import { getBookVerbContent, getPreteriteContent, getSerContent, getHayContent, getGustContent } from "@/data/book-unit-content";

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

// ── Thin dashed rule — acts as page break in scroll format ─────────

function PageRule() {
  return <hr className="border-dashed border-border/50 my-1" />;
}

// ── VerbUnit ──────────────────────────────────────────────────────────────────

export function VerbUnit({ chapter, language, onBack, onStartConversation, onStartDrill }: VerbUnitProps) {
  const grammarType = classifyGrammarType(chapter.title, language);

  // Hardcoded book content takes precedence
  const bookContent = getBookVerbContent(chapter.title);
  const preterite = !bookContent ? getPreteriteContent(chapter.title) : null;
  const ser = !bookContent && !preterite ? getSerContent(chapter.title) : null;
  const hay = !bookContent && !preterite && !ser ? getHayContent(chapter.title) : null;
  const gust = !bookContent && !preterite && !ser && !hay ? getGustContent(chapter.title) : null;
  const hasBookContent = !!bookContent;
  const hasPreterite = !!preterite;
  const hasSer = !!ser;
  const hasHay = !!hay;
  const hasGust = !!gust;

  const topRef = useRef<HTMLDivElement>(null);

  // Scroll to top whenever this chapter opens (hooks must precede conditional returns)
  useLayoutEffect(() => {
    topRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
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

  // If this is a ser/gender/plurals unit, delegate to SerUnit
  if (hasSer && ser) {
    return (
      <SerUnit
        content={ser}
        language={language}
        chapter={chapter}
        onBack={onBack}
        onStartConversation={onStartConversation}
        onStartDrill={onStartDrill}
      />
    );
  }

  // If this is a Hay / Puedo ir unit, delegate to HayUnit
  if (hasHay && hay) {
    return (
      <HayUnit
        content={hay}
        language={language}
        chapter={chapter}
        onBack={onBack}
        onStartConversation={onStartConversation}
        onStartDrill={onStartDrill}
      />
    );
  }

  // If this is a gustar-family unit, delegate to GustUnit
  if (hasGust && gust) {
    return (
      <GustUnit
        content={gust}
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
    !hasBookContent
  );

  const sections = chapter.sections ?? [];
  const totalDrills = sections.reduce((acc, s) => acc + (s.drillCount || 0), 0);
  const firstDrillSectionId = sections.find(s => s.hasDrills && s.drillCount > 0)?.id;

  const hasNegative = !microLoading && microCycle && microCycle.negativeItems.length > 0;
  const hasQuestion  = !microLoading && microCycle && microCycle.questionItems.length > 0;
  const hasSentence  = !microLoading && microCycle && microCycle.sentenceColumns.length > 0;
  const anyMicro = hasNegative || hasQuestion || hasSentence;

  // ════════════════════════════════════════════════════════════════════════════
  // PATH A — fixed-height book reader (takes over full viewport)
  // Four spreads, no scrolling. Each page is the pedagogical equivalent of one
  // physical printed page — same structure, same visual rhythm, every time.
  // ════════════════════════════════════════════════════════════════════════════
  if (hasBookContent && bookContent) {
    const rule = <div className="h-px bg-border/40 my-1.5 shrink-0" />;

    const spreads: SpreadDef[] = [
      // ── Spread 0: p.9 — Voy (single right-hand page) ──────────────────────
      // Anchor row → 2×2 positive vocab grid → rule → ¿Va? drill + note
      {
        pages: [{
          bookPageNum: 9,
          node: (
            <div className="flex flex-col h-full gap-2 min-h-0">
              <div className="shrink-0">
                <BookAnchorBlock items={bookContent.voyAnchor} />
              </div>
              <div className="flex-1 min-h-0">
                <BookGrid2x2 items={bookContent.positiveItems} language={language} />
              </div>
              <div className="shrink-0">
                {rule}
                <BookAnchorBlock items={bookContent.vaAnchor} />
                <div className="mt-1">
                  <SentenceColumnGenerator language={language} columns={bookContent.vaColumns} />
                </div>
                {bookContent.subjectPronounNote && (
                  <div className="mt-1">
                    <BookNote text={bookContent.subjectPronounNote} />
                  </div>
                )}
              </div>
            </div>
          ),
        }],
      },

      // ── Spread 1: pp.10–11 — No voy | Vamos (facing spread) ────────────────
      // Left: negative anchor → 2×2 negative grid → rule → verb table
      // Right: vamos anchor → 2×2 vamos grid → rule → note
      {
        pages: [
          {
            bookPageNum: 10,
            node: (
              <div className="flex flex-col h-full gap-2 min-h-0">
                <div className="shrink-0">
                  <BookAnchorBlock items={bookContent.noVoyAnchor} />
                </div>
                <div className="flex-1 min-h-0">
                  <BookNegGrid2x2 items={bookContent.negativeItems} language={language} />
                </div>
                <div className="shrink-0">
                  {rule}
                  <SentenceColumnGenerator language={language} columns={bookContent.sentenceColumns} />
                </div>
              </div>
            ),
          },
          {
            bookPageNum: 11,
            node: (
              <div className="flex flex-col h-full gap-2 min-h-0">
                <div className="shrink-0">
                  <BookAnchorBlock items={bookContent.vamosAnchor} />
                </div>
                <div className="flex-1 min-h-0">
                  <BookGrid2x2 items={bookContent.vamosItems} language={language} />
                </div>
                {bookContent.vamosNote && (
                  <div className="shrink-0">
                    {rule}
                    <BookNote text={bookContent.vamosNote} />
                  </div>
                )}
              </div>
            ),
          },
        ],
      },

      // ── Spread 2: p.12 — Q&A (single page) ─────────────────────────────────
      // Anchor row → 2×2 Q&A grid → rule → Va: definition
      {
        pages: [{
          bookPageNum: 12,
          node: (
            <div className="flex flex-col h-full gap-2 min-h-0">
              <div className="shrink-0">
                <BookAnchorBlock items={bookContent.page12Anchors} />
              </div>
              <div className="flex-1 min-h-0">
                <BookQAGrid items={bookContent.page12Items} language={language} />
              </div>
              {bookContent.vaDefinition && (
                <div className="shrink-0">
                  {rule}
                  <BookVaDefinition text={bookContent.vaDefinition} />
                </div>
              )}
            </div>
          ),
        }],
      },

      // ── Spread 3: Practice CTAs (no page number) ────────────────────────────
      {
        pages: [{
          node: (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
              <p className="text-sm text-muted-foreground text-center">
                Ready to practice what you've learned?
              </p>
              <Button
                className="w-full max-w-xs min-h-[52px] text-base gap-2"
                onClick={() => onStartConversation(firstVocabSection?.id)}
                data-testid="button-start-chapter-chat"
              >
                <MessageSquare className="h-5 w-5" />
                Practice with Daniela
              </Button>
              {firstDrillSectionId && totalDrills > 0 && (
                <Button
                  variant="outline"
                  className="w-full max-w-xs min-h-[44px] gap-2"
                  onClick={() => onStartDrill(firstDrillSectionId)}
                  data-testid="button-start-chapter-drill"
                >
                  <Dumbbell className="h-4 w-4" />
                  {totalDrills} Practice Activities
                </Button>
              )}
            </div>
          ),
        }],
      },
    ];

    return <BookSpread spreads={spreads} onBack={onBack} />;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PATH B — scrolling layout for chapters without hardcoded book content
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div
      ref={topRef}
      className="w-full max-w-4xl mx-auto pb-16 touch-pan-y overscroll-contain"
      data-testid="verb-unit"
    >
      {/* ── Sticky back bar ── */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 border-b mb-3">
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
              chapterKey={chapter.title?.toLowerCase()}
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
    </div>
  );
}
