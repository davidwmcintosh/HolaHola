/**
 * PreteriteComponents.tsx
 * Components for Madrigal's preterite-style verb units (tomar, comprar, etc.)
 *
 * Components:
 *   PreteriteQAGrid       — 2×2 grid of Q&A image cards (¿Tomó? / Sí, tomé…)
 *   PreteriteConjTable    — Clean conjugation table (Tomé / I took, etc.)
 */

import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import type { PreteriteQACard, PreteriteConjugationRow } from "@/data/madrigal-unit-content";

// ── Shared: fetch one image by word ──────────────────────────────────────────

function useWordImage(word: string | undefined, language: string, description?: string) {
  return useQuery<{ url: string | null }>({
    queryKey: ["/api/vocab-image/by-word", word ?? "", language, description ?? ""],
    queryFn: () => {
      const params = new URLSearchParams({ word: word ?? "", language });
      if (description) params.set("description", description);
      return fetch(`/api/vocab-image/by-word?${params.toString()}`, { credentials: "include" }).then((r) => r.json());
    },
    enabled: !!word,
    staleTime: 1000 * 60 * 60 * 24,
  });
}

// ── Shared: single-instance TTS player ───────────────────────────────────────

function useTTSButton(language: string, gender: string) {
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(async (text: string, key: string) => {
    if (playingKey === key) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingKey(key);
    try {
      const res = await apiRequest("POST", "/api/tts/pronunciation", { text, language, gender });
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

  return { playingKey, play };
}

// ── PreteriteQACard ───────────────────────────────────────────────────────────

function PreteriteQACardItem({
  card,
  language,
  tutorGender,
}: {
  card: PreteriteQACard;
  language: string;
  tutorGender: string;
}) {
  const { data: imageData } = useWordImage(card.imageWord, language, card.imageDescription);
  const { playingKey, play } = useTTSButton(language, tutorGender);
  const imageUrl = imageData?.url;

  const qKey = `q-${card.imageWord}`;
  const aKey = `a-${card.imageWord}`;

  return (
    <div
      className="rounded-md border bg-card flex flex-col overflow-hidden"
      data-testid={`preterite-qa-card-${card.imageWord}`}
    >
      {/* Image — square container matching Chapter 2 standard */}
      <div className="relative w-full aspect-square bg-muted/30 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={card.imageWord}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Question — speaker + text + translation inline */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-border/30">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => play(card.question, qKey)}
          disabled={playingKey === qKey}
          data-testid={`button-play-question-${card.imageWord}`}
          title={`Hear "${card.question}"`}
          className="flex-shrink-0"
        >
          {playingKey === qKey
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Volume2 className="h-3.5 w-3.5" />
          }
        </Button>
        <div className="flex flex-col min-w-0">
          <p
            className="text-sm font-medium leading-snug text-blue-600 dark:text-blue-400"
            data-testid={`text-question-${card.imageWord}`}
          >
            {card.question}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {card.questionTranslation}
          </p>
        </div>
      </div>

      {/* Answer — speaker + text + translation inline */}
      <div className="flex items-center gap-2 px-2 py-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => play(card.answer, aKey)}
          disabled={playingKey === aKey}
          data-testid={`button-play-answer-${card.imageWord}`}
          title={`Hear "${card.answer}"`}
          className="flex-shrink-0"
        >
          {playingKey === aKey
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Volume2 className="h-3.5 w-3.5" />
          }
        </Button>
        <div className="flex flex-col min-w-0">
          <p
            className="text-sm font-medium leading-snug text-red-600 dark:text-red-400"
            data-testid={`text-answer-${card.imageWord}`}
          >
            {card.answer}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {card.answerTranslation}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── PreteriteQAGrid: 2-column grid ────────────────────────────────────────────

export function PreteriteQAGrid({
  cards,
  language,
}: {
  cards: PreteriteQACard[];
  language: string;
}) {
  const { tutorGender } = useLanguage();

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      data-testid="preterite-qa-grid"
    >
      {cards.map((card) => (
        <PreteriteQACardItem
          key={card.imageWord}
          card={card}
          language={language}
          tutorGender={tutorGender}
        />
      ))}
    </div>
  );
}

// ── PreteriteConjTable: conjugation table ─────────────────────────────────────

export function PreteriteConjTable({
  rows,
  language,
}: {
  rows: PreteriteConjugationRow[];
  language: string;
}) {
  const { tutorGender } = useLanguage();
  const { playingKey, play } = useTTSButton(language, tutorGender);

  return (
    <div
      className="rounded-md border bg-card px-4 py-3 space-y-1.5"
      data-testid="preterite-conj-table"
    >
      {rows.map((row, i) => {
        const isInfinitive = i === 0;
        const key = `conj-${row.form}`;
        return (
          <div
            key={row.form}
            className={`flex items-center gap-3 ${isInfinitive ? "pb-1.5 mb-0.5 border-b border-border/40" : ""}`}
          >
            <button
              className="flex items-center gap-1 group min-w-0"
              onClick={() => play(row.form, key)}
              title={`Hear "${row.form}"`}
              data-testid={`button-conj-${row.form}`}
            >
              <span className={`font-semibold text-sm tabular-nums ${isInfinitive ? "text-muted-foreground" : ""}`}>
                {row.form}
              </span>
              {playingKey === key
                ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                : <Volume2 className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 shrink-0 transition-colors" />
              }
            </button>
            <span className="text-sm text-muted-foreground">
              {row.meaning}
            </span>
          </div>
        );
      })}
    </div>
  );
}
