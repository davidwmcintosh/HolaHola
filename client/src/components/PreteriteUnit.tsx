/**
 * PreteriteUnit.tsx
 * Renders Madrigal's preterite-style verb lessons (tomar, comprar, etc.)
 *
 * Each lesson has 2-3 vocabulary clusters. Each cluster renders:
 *   AnchorBlock  →  [note]  →  QA image cards or statement cards
 *   →  conjugation table  →  sentence former  →  [note]
 *
 * Clusters are separated by the same dashed PageRule used in VerbUnit.
 */

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessageSquare, Dumbbell } from "lucide-react";
import { MadrigalAnchorBlock, MadrigalPositiveGrid, MadrigalNote } from "./MadrigalPageComponents";
import { SentenceColumnGenerator } from "./SentenceColumnGenerator";
import { PreteriteQAGrid, PreteriteConjTable } from "./PreteriteComponents";
import type { PreteriteUnitContent } from "@/data/madrigal-unit-content";

// ── Shared dashed rule (same style as VerbUnit) ───────────────────────────────

function PageRule() {
  return <hr className="border-dashed border-border/50 my-1" />;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PreteriteUnitProps {
  content: PreteriteUnitContent;
  language: string;
  chapter: {
    id: string;
    number: number;
    title: string;
    sections: { id: string; hasDrills: boolean; drillCount: number; lessonType: string }[];
  };
  onBack: () => void;
  onStartConversation: (lessonId?: string) => void;
  onStartDrill: (lessonId: string) => void;
}

// ── PreteriteUnit ─────────────────────────────────────────────────────────────

export function PreteriteUnit({
  content,
  language,
  chapter,
  onBack,
  onStartConversation,
  onStartDrill,
}: PreteriteUnitProps) {
  const sections = chapter.sections ?? [];
  const totalDrills = sections.reduce((acc, s) => acc + (s.drillCount || 0), 0);
  const firstDrillSectionId = sections.find(s => s.hasDrills && s.drillCount > 0)?.id;
  const firstVocabSection =
    sections.find(s => s.lessonType === "grammar") ?? sections[0];

  useEffect(() => {
    window.scrollTo(0, 0);
    const scrollContainer = document.querySelector(".overflow-y-auto");
    if (scrollContainer) scrollContainer.scrollTop = 0;
  }, [chapter.id]);

  return (
    <div
      className="w-full max-w-2xl mx-auto pb-16 touch-pan-y overscroll-contain"
      data-testid="preterite-unit"
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

      <div className="space-y-6 px-4">
        {content.clusters.map((cluster, clusterIndex) => (
          <div key={clusterIndex} className="space-y-6">
            {/* Page rule between clusters (not before the first) */}
            {clusterIndex > 0 && <PageRule />}

            {/* Anchor block */}
            <MadrigalAnchorBlock items={cluster.anchorItems} />

            {/* Note before cards */}
            {cluster.noteBefore && (
              <MadrigalNote text={cluster.noteBefore} />
            )}

            {/* Q&A image cards */}
            {cluster.qaCards && cluster.qaCards.length > 0 && (
              <PreteriteQAGrid cards={cluster.qaCards} language={language} />
            )}

            {/* Statement image cards (para la cena style) */}
            {cluster.statementCards && cluster.statementCards.length > 0 && (
              <MadrigalPositiveGrid
                items={cluster.statementCards}
                language={language}
              />
            )}

            {/* Conjugation table */}
            {cluster.conjugationTable && cluster.conjugationTable.length > 0 && (
              <PreteriteConjTable
                rows={cluster.conjugationTable}
                language={language}
              />
            )}

            {/* Sentence former */}
            {cluster.sentenceColumns && cluster.sentenceColumns.length > 0 && (
              <SentenceColumnGenerator
                language={language}
                columns={cluster.sentenceColumns}
              />
            )}

            {/* Note after */}
            {cluster.noteAfter && (
              <MadrigalNote text={cluster.noteAfter} />
            )}
          </div>
        ))}

        <PageRule />

        {/* CTAs */}
        <div className="space-y-2" data-testid="preterite-unit-ctas">
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
