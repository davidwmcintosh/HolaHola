/**
 * GustUnit.tsx
 * Renders gustar-family chapters — units built around Q&A image cards with
 * grammar rule callouts and optional negative example lists.
 *
 * Used for:
 *   Chapter 37 — Gustar: Me gusta / Me gustan  (pp. 94–97)
 *   Chapter 38 — Me gustaría: I Would Like      (pp. 98–101)
 */

import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Volume2, Loader2, ChevronLeft, MessageSquare, Dumbbell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import { SentenceColumnGenerator } from "@/components/SentenceColumnGenerator";
import type { GustUnitContent, GustVocabCluster, HayQandAPair } from "@/data/madrigal-unit-content";

// ── Types passed in from VerbUnit ─────────────────────────────────────────────

interface ChapterShape {
  id: string;
  title: string;
  number?: number;
  sections: { id: string; name: string; hasDrills?: boolean; drillCount?: number; lessonType?: string }[];
}

interface GustUnitProps {
  content: GustUnitContent;
  language: string;
  chapter: ChapterShape;
  onBack: () => void;
  onStartConversation: (sectionId?: string) => void;
  onStartDrill: (sectionId: string) => void;
}

// ── Image fetcher ─────────────────────────────────────────────────────────────

function useWordImage(word: string | undefined, language: string, description?: string) {
  return useQuery<{ url: string | null }>({
    queryKey: ["/api/vocab-image/by-word", word ?? "", language, description ?? ""],
    queryFn: () => {
      const params = new URLSearchParams({ word: word ?? "", language });
      if (description) params.set("description", description);
      return fetch(`/api/vocab-image/by-word?${params.toString()}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: !!word,
    staleTime: 1000 * 60 * 60 * 24,
  });
}

// ── TTS ───────────────────────────────────────────────────────────────────────

function useTTS(language: string, gender: string) {
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(async (text: string, key: string) => {
    if (playingKey === key) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingKey(key);
    try {
      const res = await apiRequest("POST", "/api/tts/pronunciation", { text, language, tutorGender: gender });
      const { audioUrl } = await res.json();
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setPlayingKey(null); audioRef.current = null; };
      audio.onerror = () => { setPlayingKey(null); audioRef.current = null; };
      audio.play();
    } catch {
      setPlayingKey(null);
    }
  }, [language, gender, playingKey]);

  return { play, playingKey };
}

// ── PageRule ──────────────────────────────────────────────────────────────────

function PageRule() {
  return <hr className="border-border/50 my-2" />;
}

// ── GustNote ──────────────────────────────────────────────────────────────────

function GustNote({ text }: { text: string }) {
  return (
    <p className="text-sm text-muted-foreground italic leading-relaxed" data-testid="gust-note">
      {text}
    </p>
  );
}

// ── GustAnchorBar — vocabulary anchors above a cluster ────────────────────────
// Format: "Me gusta  I like · ¿Le gusta?  Do you like?"

function GustAnchorBar({ text }: { text: string }) {
  const pairs = text.split("·").map(s => s.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 py-1" data-testid="gust-anchor-bar">
      {pairs.map((pair, i) => {
        const midSpace = pair.indexOf("  ");
        if (midSpace === -1) {
          return <span key={i} className="text-xl font-bold tracking-tight">{pair}</span>;
        }
        const spanish = pair.slice(0, midSpace);
        const english = pair.slice(midSpace + 2);
        return (
          <div key={i} className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight leading-none">{spanish}</span>
            <span className="text-sm text-muted-foreground">{english}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── GrammarRuleBox — colored callout for singular / plural rules ──────────────

function GrammarRuleBox({ text }: { text: string }) {
  const parts = text.split("·").map(s => s.trim()).filter(Boolean);
  return (
    <div
      className="rounded-md border bg-muted/60 px-4 py-3 space-y-1"
      data-testid="gust-grammar-rule"
    >
      {parts.map((part, i) => {
        const isExample = part.includes("/") && !part.startsWith("Use");
        return (
          <p
            key={i}
            className={
              isExample
                ? "text-sm font-medium text-foreground"
                : "text-sm text-muted-foreground"
            }
          >
            {isExample ? (
              <>
                {part.split("/").map((seg, j, arr) => (
                  <span key={j}>
                    <span className="font-semibold">{seg.trim()}</span>
                    {j < arr.length - 1 && <span className="text-muted-foreground"> / </span>}
                  </span>
                ))}
              </>
            ) : part}
          </p>
        );
      })}
    </div>
  );
}

// ── ConjugationTable — verb conjugation grid (e.g. Fui/Fue/Fuimos/Fueron) ─────

function ConjugationTable({
  rows,
  language,
  tutorGender,
}: {
  rows: { conjugated: string; translation: string }[];
  language: string;
  tutorGender: string;
}) {
  const { play, playingKey } = useTTS(language, tutorGender);
  return (
    <div className="rounded-md border overflow-hidden" data-testid="gust-conjugation-table">
      <div className="px-4 py-2 bg-muted/60 border-b">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Conjugation
        </p>
      </div>
      <div className="divide-y">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => play(row.conjugated, `conj-${i}`)}
              className="shrink-0"
              data-testid={`button-play-conj-${i}`}
              title="Listen"
            >
              {playingKey === `conj-${i}`
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                : <Volume2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              }
            </button>
            <span
              className="text-lg font-bold flex-1"
              data-testid={`text-conj-${row.conjugated}`}
            >
              {row.conjugated}
            </span>
            <span className="text-sm text-muted-foreground">
              {row.translation}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NegativeExampleList — "No me gusta…" sentences ───────────────────────────

function NegativeExampleList({ items, language, tutorGender }: {
  items: string[];
  language: string;
  tutorGender: string;
}) {
  const { play, playingKey } = useTTS(language, tutorGender);
  return (
    <div className="space-y-1" data-testid="gust-negatives">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Negatives
      </p>
      {items.map((sentence, i) => (
        <div key={i} className="flex items-center gap-2">
          <X className="h-3 w-3 text-muted-foreground shrink-0" />
          <button
            type="button"
            onClick={() => play(sentence, `neg-${i}`)}
            className="shrink-0"
            data-testid={`button-play-neg-${i}`}
            title="Listen"
          >
            {playingKey === `neg-${i}`
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              : <Volume2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
            }
          </button>
          <span className="text-sm font-medium" data-testid={`text-neg-${i}`}>{sentence}</span>
        </div>
      ))}
    </div>
  );
}

// ── GustQACard — one Q&A image card ──────────────────────────────────────────

function GustQACard({
  pair,
  language,
  tutorGender,
}: {
  pair: HayQandAPair;
  language: string;
  tutorGender: string;
}) {
  const { data: imageData } = useWordImage(pair.imageWord, language, pair.imageDescription);
  const { play, playingKey } = useTTS(language, tutorGender);
  const imageUrl = imageData?.url;

  const qKey = `q-${pair.imageWord ?? pair.question}`;
  const aKey = `a-${pair.imageWord ?? pair.answer}`;

  return (
    <div
      className="rounded-md border bg-card flex flex-col overflow-hidden"
      data-testid={`gust-qa-card-${pair.imageWord ?? "text"}`}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={pair.imageWord ?? ""}
          className="w-full h-36 object-cover bg-muted"
          data-testid={`img-gust-${pair.imageWord}`}
        />
      )}
      {!imageUrl && pair.imageWord && (
        <div className="w-full h-36 bg-muted flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="flex flex-col gap-1 p-3">
        {/* Question */}
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => play(pair.question, qKey)}
            className="shrink-0 mt-0.5"
            data-testid={`button-play-q-${pair.imageWord}`}
            title="Listen to question"
          >
            {playingKey === qKey
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              : <Volume2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
            }
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug" data-testid={`text-q-${pair.imageWord}`}>
              {pair.question}
            </p>
            <p className="text-xs text-muted-foreground leading-tight">
              {pair.questionTranslation}
            </p>
          </div>
        </div>

        {/* Answer */}
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => play(pair.answer, aKey)}
            className="shrink-0 mt-0.5"
            data-testid={`button-play-a-${pair.imageWord}`}
            title="Listen to answer"
          >
            {playingKey === aKey
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              : <Volume2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
            }
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug text-primary" data-testid={`text-a-${pair.imageWord}`}>
              {pair.answer}
            </p>
            <p className="text-xs text-muted-foreground leading-tight">
              {pair.answerTranslation}
            </p>
          </div>
        </div>

        {pair.extraNote && (
          <p className="text-xs text-muted-foreground italic mt-1 pl-6" data-testid={`text-extra-${pair.imageWord}`}>
            {pair.extraNote}
          </p>
        )}
      </div>
    </div>
  );
}

// ── GustClusterSection ────────────────────────────────────────────────────────

function GustClusterSection({
  cluster,
  language,
  tutorGender,
}: {
  cluster: GustVocabCluster;
  language: string;
  tutorGender: string;
}) {
  return (
    <div className="space-y-4">
      {cluster.heading && (
        <h2 className="text-3xl font-bold" data-testid="gust-cluster-heading">
          {cluster.heading}
        </h2>
      )}

      {cluster.noteInline && (
        <GustAnchorBar text={cluster.noteInline} />
      )}

      {/* Q&A image card grid */}
      {cluster.pairs.length > 0 && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
          data-testid="gust-qa-grid"
        >
          {cluster.pairs.map((pair, i) => (
            <GustQACard
              key={i}
              pair={pair}
              language={language}
              tutorGender={tutorGender}
            />
          ))}
        </div>
      )}

      {/* Grammar rule callout */}
      {cluster.grammarRule && (
        <GrammarRuleBox text={cluster.grammarRule} />
      )}

      {/* Sentence combiner */}
      {cluster.sentenceColumns && cluster.sentenceColumns.length > 0 && (
        <div data-testid="gust-sentence-columns">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Practice sentences
          </p>
          <SentenceColumnGenerator language={language} columns={cluster.sentenceColumns} />
        </div>
      )}

      {/* Negative examples */}
      {cluster.negativeExamples && cluster.negativeExamples.length > 0 && (
        <NegativeExampleList
          items={cluster.negativeExamples}
          language={language}
          tutorGender={tutorGender}
        />
      )}

      {/* Conjugation table */}
      {cluster.conjugationTable && cluster.conjugationTable.length > 0 && (
        <ConjugationTable
          rows={cluster.conjugationTable}
          language={language}
          tutorGender={tutorGender}
        />
      )}

      {/* Note after */}
      {cluster.noteAfter && (
        <GustNote text={cluster.noteAfter} />
      )}
    </div>
  );
}

// ── GustUnit — main exported component ───────────────────────────────────────

export function GustUnit({
  content,
  language,
  chapter,
  onBack,
  onStartConversation,
  onStartDrill,
}: GustUnitProps) {
  const { tutorGender } = useLanguage();
  const gender = tutorGender ?? "female";

  const sections = chapter.sections ?? [];
  const totalDrills = sections.reduce((acc, s) => acc + (s.drillCount || 0), 0);
  const firstVocabSection = sections.find(s => s.lessonType === "grammar") ?? sections[0];
  const firstDrillSectionId = sections.find(s => s.hasDrills && s.drillCount > 0)?.id;

  return (
    <div
      className="w-full max-w-2xl mx-auto pb-16 touch-pan-y overscroll-contain"
      data-testid="gust-unit"
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

        {/* ── Concept headline ── */}
        <div>
          <p className="text-5xl font-bold tracking-tight leading-none" data-testid="gust-concept-label">
            {content.conceptLabel}
          </p>
          <p className="text-base text-muted-foreground mt-2" data-testid="gust-concept-definition">
            {content.conceptDefinition}
          </p>
        </div>

        {/* ── Intro note ── */}
        {content.introNote && (
          <GustNote text={content.introNote} />
        )}

        <PageRule />

        {/* ── Vocabulary clusters ── */}
        {content.clusters.map((cluster, i) => (
          <div key={i}>
            <GustClusterSection
              cluster={cluster}
              language={language}
              tutorGender={gender}
            />
            {i < content.clusters.length - 1 && <PageRule />}
          </div>
        ))}

        <PageRule />

        {/* ── CTAs ── */}
        <div className="space-y-2" data-testid="gust-unit-ctas">
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
