/**
 * MadrigalPageComponents.tsx
 * Renders the structural elements of a Madrigal lesson page.
 *
 * These components are not generic UI — they are direct digital equivalents
 * of Madrigal's print page elements, in the exact order she uses them.
 *
 * Components:
 *   MadrigalAnchorBlock  — Page top: the two building-block items (Voy / Al)
 *   MadrigalPositiveGrid — 2×2 image grid with sentences (positive forms)
 *   MadrigalVamosLine    — The quiet single-line "Vamos" addition
 */

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import type { MadrigalAnchorItem, MadrigalPositiveItem, MadrigalVamosLine as VamosLineType } from "@/data/madrigal-unit-content";

// ── MadrigalAnchorBlock ────────────────────────────────────────────────────────
//
// Madrigal's page 9 top: two items, large text, generous whitespace between them.
// "Voy,   I'm going."
// [space]
// "Al,    to the."
//
// The space between the two items is structural — it forces the brain to register
// them as two distinct pieces before seeing them combined in the image grid.

export function MadrigalAnchorBlock({ items }: { items: MadrigalAnchorItem[] }) {
  return (
    <div
      className="space-y-6 py-2"
      data-testid="madrigal-anchor-block"
      aria-label="Lesson anchor — key building blocks"
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-baseline gap-4">
          <span
            className="text-3xl font-bold tracking-tight leading-none"
            data-testid={`anchor-spanish-${i}`}
          >
            {item.spanish}
          </span>
          <span
            className="text-lg text-muted-foreground font-normal"
            data-testid={`anchor-english-${i}`}
          >
            {item.english}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Single vocabulary card in the positive grid ────────────────────────────────

function MadrigalVocabCard({
  item,
  language,
  index,
}: {
  item: MadrigalPositiveItem;
  language: string;
  index: number;
}) {
  const { tutorGender } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch the image for this specific word
  const { data: imageData } = useQuery<{ url: string | null; source: string }>({
    queryKey: ["/api/vocab-image/by-word", item.word, language],
    queryFn: () =>
      fetch(
        `/api/vocab-image/by-word?word=${encodeURIComponent(item.word)}&language=${encodeURIComponent(language)}&description=${encodeURIComponent(item.imageDescription)}`,
        { credentials: "include" }
      ).then((r) => r.json()),
    staleTime: 1000 * 60 * 60 * 24,
  });

  const handleListen = useCallback(async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      const response = await apiRequest("POST", "/api/tts/pronunciation", {
        text: item.sentence,
        language,
        gender: tutorGender ?? "female",
      });
      const data = await response.json();
      const audio = new Audio(data.audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  }, [item.sentence, language, tutorGender, isPlaying]);

  const imageUrl = imageData?.url;

  return (
    <div
      className="rounded-md border bg-card overflow-hidden flex flex-col"
      data-testid={`madrigal-vocab-card-${index}`}
    >
      {/* Image */}
      <div className="aspect-square bg-muted/30 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.word}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Sentence + listen */}
      <div className="flex items-center gap-1 px-2 py-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleListen}
          disabled={isPlaying}
          aria-label={`Listen to: ${item.sentence}`}
          data-testid={`button-listen-vocab-${index}`}
          className="shrink-0"
        >
          {isPlaying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </Button>
        <p className="text-sm font-medium leading-snug flex-1 min-w-0">
          {item.sentence}
        </p>
      </div>
    </div>
  );
}

// ── MadrigalPositiveGrid ───────────────────────────────────────────────────────
//
// 2×2 grid of images with sentences (positive form).
// Each image depicts exactly one noun — no background story.
// The sentence frame is identical across all cards; only the noun changes.
// Madrigal's rule: 4 items. Not 6, not 2.

export function MadrigalPositiveGrid({
  items,
  language,
}: {
  items: MadrigalPositiveItem[];
  language: string;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-3"
      data-testid="madrigal-positive-grid"
    >
      {items.map((item, i) => (
        <MadrigalVocabCard
          key={item.word}
          item={item}
          language={language}
          index={i}
        />
      ))}
    </div>
  );
}

// ── MadrigalVamosLine ──────────────────────────────────────────────────────────
//
// The quiet "Vamos" addition at the bottom of the negative page.
// Madrigal introduces it with no heading, no emphasis — just a single line.
// The student absorbs it in context, the way children absorb "let's go"
// before understanding the grammar behind it.

export function MadrigalVamosLine({
  vamos,
  language,
}: {
  vamos: VamosLineType;
  language: string;
}) {
  const { tutorGender } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);

  const handleListen = useCallback(async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      const response = await apiRequest("POST", "/api/tts/pronunciation", {
        text: vamos.sentence,
        language,
        gender: tutorGender ?? "female",
      });
      const data = await response.json();
      const audio = new Audio(data.audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  }, [vamos.sentence, language, tutorGender, isPlaying]);

  return (
    <div
      className="flex items-center gap-2 py-1"
      data-testid="madrigal-vamos-line"
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={handleListen}
        disabled={isPlaying}
        aria-label={`Listen to: ${vamos.sentence}`}
        data-testid="button-listen-vamos"
        className="shrink-0"
      >
        {isPlaying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
      </Button>
      <div>
        <span className="text-sm font-medium">{vamos.sentence}</span>
        <span className="text-xs text-muted-foreground ml-2">{vamos.translation}</span>
      </div>
    </div>
  );
}
