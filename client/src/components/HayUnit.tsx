/**
 * HayUnit.tsx
 * Renders Madrigal's "Hay" and "Puedo ir" chapters — units built around
 * Q&A image cards with a concept headline and vocabulary cluster structure.
 *
 * Used for:
 *   Chapter 35 — I Can Go: Puedo ir  (pp. 84–85)
 *   Chapter 36 — Hay: There Is / There Are  (pp. 86–91)
 */

import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Volume2, Loader2, ChevronLeft, MessageSquare, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import { SentenceColumnGenerator } from "@/components/SentenceColumnGenerator";
import type { HayUnitContent, HayQandAPair, HayVocabCluster } from "@/data/madrigal-unit-content";

// ── Types passed in from VerbUnit ─────────────────────────────────────────────

interface ChapterShape {
  id: string;
  title: string;
  number?: number;
  sections: { id: string; name: string; hasDrills?: boolean; drillCount?: number; lessonType?: string }[];
}

interface HayUnitProps {
  content: HayUnitContent;
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

// ── TTS hook ──────────────────────────────────────────────────────────────────

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

// ── HayNote ───────────────────────────────────────────────────────────────────

function HayNote({ text }: { text: string }) {
  return (
    <p className="text-sm text-muted-foreground italic leading-relaxed" data-testid="hay-note">
      {text}
    </p>
  );
}

// ── HayAnchorBar — vocabulary anchor words shown above a cluster ──────────────
// Format: "Puedo ir  I can go · Puede ir  you can go · a mi casa  to my house"

function HayAnchorBar({ text }: { text: string }) {
  const pairs = text.split("·").map(s => s.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 py-1" data-testid="hay-anchor-bar">
      {pairs.map((pair, i) => {
        const midSpace = pair.indexOf("  ");
        if (midSpace === -1) {
          return (
            <span key={i} className="text-xl font-bold tracking-tight">{pair}</span>
          );
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

// ── HayQACard — one Q&A image card ───────────────────────────────────────────

function HayQACard({
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
      data-testid={`hay-qa-card-${pair.imageWord ?? "text"}`}
    >
      {/* Image */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={pair.imageWord ?? ""}
          className="w-full h-36 object-cover bg-muted"
          data-testid={`img-hay-${pair.imageWord}`}
        />
      )}
      {!imageUrl && pair.imageWord && (
        <div className="w-full h-36 bg-muted flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Q&A text */}
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

        {/* Extra note (e.g. "Eso es absolutamente ridículo.") */}
        {pair.extraNote && (
          <p className="text-xs text-muted-foreground italic mt-1 pl-6" data-testid={`text-extra-${pair.imageWord}`}>
            {pair.extraNote}
          </p>
        )}
      </div>
    </div>
  );
}

// ── HayClusterSection — one vocabulary cluster ────────────────────────────────

function HayClusterSection({
  cluster,
  language,
  tutorGender,
}: {
  cluster: HayVocabCluster;
  language: string;
  tutorGender: string;
}) {
  return (
    <div className="space-y-4">
      {/* Cluster heading */}
      {cluster.heading && (
        <h2 className="text-3xl font-bold" data-testid="hay-cluster-heading">
          {cluster.heading}
        </h2>
      )}

      {/* Anchor vocabulary bar */}
      {cluster.noteInline && (
        <HayAnchorBar text={cluster.noteInline} />
      )}

      {/* Q&A image card grid */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
        data-testid="hay-qa-grid"
      >
        {cluster.pairs.map((pair, i) => (
          <HayQACard
            key={i}
            pair={pair}
            language={language}
            tutorGender={tutorGender}
          />
        ))}
      </div>

      {/* Sentence combiner */}
      {cluster.sentenceColumns && cluster.sentenceColumns.length > 0 && (
        <div data-testid="hay-sentence-columns">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Practice sentences
          </p>
          <SentenceColumnGenerator language={language} columns={cluster.sentenceColumns} />
        </div>
      )}

      {/* Note after */}
      {cluster.noteAfter && (
        <HayNote text={cluster.noteAfter} />
      )}
    </div>
  );
}

// ── HayUnit — main exported component ────────────────────────────────────────

export function HayUnit({
  content,
  language,
  chapter,
  onBack,
  onStartConversation,
  onStartDrill,
}: HayUnitProps) {
  const { tutorGender } = useLanguage();
  const gender = tutorGender ?? "female";

  const sections = chapter.sections ?? [];
  const totalDrills = sections.reduce((acc, s) => acc + (s.drillCount || 0), 0);
  const firstVocabSection = sections.find(s => s.lessonType === "grammar") ?? sections[0];
  const firstDrillSectionId = sections.find(s => s.hasDrills && s.drillCount > 0)?.id;

  return (
    <div
      className="w-full max-w-2xl mx-auto pb-16 touch-pan-y overscroll-contain"
      data-testid="hay-unit"
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
          <p className="text-5xl font-bold tracking-tight leading-none" data-testid="hay-concept-label">
            {content.conceptLabel}
          </p>
          <p className="text-base text-muted-foreground mt-2" data-testid="hay-concept-definition">
            {content.conceptDefinition}
          </p>
        </div>

        {/* ── Intro note ── */}
        {content.introNote && (
          <HayNote text={content.introNote} />
        )}

        <PageRule />

        {/* ── Vocabulary clusters ── */}
        {content.clusters.map((cluster, i) => (
          <div key={i}>
            <HayClusterSection
              cluster={cluster}
              language={language}
              tutorGender={gender}
            />
            {i < content.clusters.length - 1 && <PageRule />}
          </div>
        ))}

        <PageRule />

        {/* ── CTAs ── */}
        <div className="space-y-2" data-testid="hay-unit-ctas">
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
