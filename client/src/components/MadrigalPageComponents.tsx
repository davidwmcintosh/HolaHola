/**
 * BookPageComponents (internal)
 * Digital equivalents of book page elements, in the exact order she uses them.
 *
 * Components:
 *   BookAnchorBlock   — Same-line anchor items (e.g. "Voy, I'm going.  al, to the.")
 *   BookVocabGrid  — 2×2 image grid with sentences + TTS (used for both positive and Vamos)
 *   BookNote          — Muted italic pedagogical note (e.g. subject pronoun note)
 *   BookQAGridP12    — Q&A pairs: 2 with images, 2 text-only
 *   BookVaDefinition  — Final "Va: You are going · He is going…" reference block
 *
 * Book-mode components (fill parent height — used in BookSpread fixed-height pages):
 *   BookGrid2x2           — 2×2 vocab image grid that fills its container height
 *   BookNegGrid2x2        — 2×2 negative-form grid that fills its container height
 *   BookQAGrid            — 2×2 Q&A grid that fills its container height
 */

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type {
  BookAnchorItem,
  BookPositiveItem,
  Page12QAItem,
} from "@/data/book-unit-content";
import type { NegativeFormItem } from "@/components/NegativeFormSection";

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

// ── Shared: play TTS ─────────────────────────────────────────────────────────

function useTTS(language: string, gender: string) {
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const play = useCallback(async (text: string, key: string) => {
    if (playingKey === key) return;
    setPlayingKey(key);
    try {
      const res = await apiRequest("POST", "/api/tts/pronunciation", { text, language, gender });
      const { audioUrl } = await res.json();
      const audio = new Audio(audioUrl);
      audio.onended = () => setPlayingKey(null);
      audio.onerror = () => setPlayingKey(null);
      await audio.play();
    } catch {
      setPlayingKey(null);
    }
  }, [language, gender, playingKey]);

  return { play, playingKey };
}

// ── BookAnchorBlock ────────────────────────────────────────────────────────
//
// All anchor items on ONE horizontal line with generous gap between them.
// "Voy,  I'm going.          al,  to the."
// "¿Va?  Are you going?"
// "¿Va?  Are you going?   al,  to the.   Voy,  I'm going.   Sí,  Yes."

export function BookAnchorBlock({ items }: { items: BookAnchorItem[] }) {
  return (
    <div
      className="flex flex-wrap items-baseline gap-x-8 gap-y-2 py-1"
      data-testid="book-anchor-block"
      aria-label="Lesson anchor"
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-baseline gap-2">
          <span
            className="text-3xl font-bold tracking-tight leading-none"
            data-testid={`anchor-spanish-${i}`}
          >
            {item.spanish}
          </span>
          <span
            className="text-base text-muted-foreground font-normal"
            data-testid={`anchor-english-${i}`}
          >
            {item.english}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── BookNote ──────────────────────────────────────────────────────────────
//
// Quiet muted note — Pedagogical asides, never in bold.

export function BookNote({ text }: { text: string }) {
  return (
    <p
      className="text-sm text-muted-foreground italic px-0.5"
      data-testid="book-note"
    >
      {text}
    </p>
  );
}

// ── Single card: image + sentence + TTS ──────────────────────────────────────

function VocabImageCard({
  word,
  sentence,
  translation,
  language,
  gender,
  testIndex,
  imageDescription,
}: {
  word: string;
  sentence: string;
  translation: string;
  language: string;
  gender: string;
  testIndex: number;
  imageDescription?: string;
}) {
  const { data: img } = useWordImage(word, language, imageDescription);
  const { play, playingKey } = useTTS(language, gender);
  const key = `vocab-${word}-${testIndex}`;
  const isPlaying = playingKey === key;

  return (
    <div
      className="rounded-md border bg-card overflow-hidden flex flex-col"
      data-testid={`book-vocab-card-${testIndex}`}
    >
      <div className="aspect-square bg-muted/30 overflow-hidden">
        {img?.url ? (
          <img src={img.url} alt={word} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="flex flex-col items-center px-2 pt-2 pb-1.5 text-center gap-0.5">
        <p className="text-sm font-medium leading-snug">{sentence}</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{translation}</p>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => play(sentence, key)}
          disabled={isPlaying}
          data-testid={`button-listen-${testIndex}`}
        >
          {isPlaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// ── BookVocabGrid ───────────────────────────────────────────────────────
// 2×2 grid of image cards with sentences. ("Voy al hotel." etc.)

export function BookVocabGrid({
  items,
  language,
}: {
  items: BookPositiveItem[];
  language: string;
}) {
  const { tutorGender } = useLanguage();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="book-vocab-grid">
      {items.map((item, i) => (
        <VocabImageCard
          key={item.word}
          word={item.word}
          sentence={item.sentence}
          translation={item.translation}
          imageDescription={item.imageDescription}
          language={language}
          gender={tutorGender ?? "female"}
          testIndex={i}
        />
      ))}
    </div>
  );
}

// ── BookQAGridP12 ─────────────────────────────────────────────────────────
//
// Page 12 format: question + affirmative answer together.
// First 2 items have images; last 2 are text-only.

function Page12Card({
  item,
  language,
  gender,
  index,
}: {
  item: Page12QAItem;
  language: string;
  gender: string;
  index: number;
}) {
  const { data: img } = useWordImage(item.imageWord ?? "", language);
  const { play, playingKey } = useTTS(language, gender);
  const hasImage = !!item.imageWord;

  const qKey = `p12-q-${index}`;
  const aKey = `p12-a-${index}`;

  return (
    <div
      className="rounded-md border bg-card overflow-hidden flex flex-col"
      data-testid={`page12-card-${index}`}
    >
      {/* Image — only for items with imageWord */}
      {hasImage && (
        <div className="aspect-square bg-muted/30 overflow-hidden">
          {img?.url ? (
            <img src={img.url} alt={item.imageWord} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5 px-2 pt-2 pb-2">
        {/* Question */}
        <div className="flex items-start gap-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug">{item.question}</p>
          </div>
          <button
            type="button"
            onClick={() => play(item.question, qKey)}
            disabled={playingKey === qKey}
            className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`button-p12-q-${index}`}
          >
            {playingKey === qKey
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Volume2 className="h-3 w-3" />
            }
          </button>
        </div>

        <div className="border-t border-dashed" />

        {/* Answer */}
        <div className="flex items-start gap-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-snug">{item.affirmativeAnswer}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{item.affirmativeTranslation}</p>
          </div>
          <button
            type="button"
            onClick={() => play(item.affirmativeAnswer, aKey)}
            disabled={playingKey === aKey}
            className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`button-p12-a-${index}`}
          >
            {playingKey === aKey
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Volume2 className="h-3 w-3" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}

export function BookQAGridP12({
  items,
  language,
}: {
  items: Page12QAItem[];
  language: string;
}) {
  const { tutorGender } = useLanguage();

  // Split: items with images go in a 2-col grid; text-only stack below
  const withImages = items.filter(i => !!i.imageWord);
  const textOnly   = items.filter(i => !i.imageWord);
  const startIndex = withImages.length;

  return (
    <div className="space-y-3" data-testid="book-qa-grid-p12">
      {withImages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {withImages.map((item, i) => (
            <Page12Card
              key={i}
              item={item}
              language={language}
              gender={tutorGender ?? "female"}
              index={i}
            />
          ))}
        </div>
      )}
      {textOnly.length > 0 && (
        <div className="space-y-2">
          {textOnly.map((item, i) => (
            <Page12Card
              key={i}
              item={item}
              language={language}
              gender={tutorGender ?? "female"}
              index={startIndex + i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── BookVaDefinition ───────────────────────────────────────────────────────
//
// "Va: You are going · He is going · She is going · It is going"
// "¿Va?: Are you going? · Is he going? · Is she going? · Is it going?"

export function BookVaDefinition({ text }: { text: string }) {
  return (
    <div
      className="rounded-md bg-muted/40 border px-3 py-2.5 space-y-0.5"
      data-testid="book-va-definition"
    >
      {text.split("\n").map((line, i) => (
        <p key={i} className="text-sm text-muted-foreground leading-relaxed">
          {line}
        </p>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BOOK-MODE COMPONENTS
// Fill parent height — designed for use inside BookSpread fixed-height pages.
// The parent grid cell provides the height; these cards fill it completely.
// ═════════════════════════════════════════════════════════════════════════════

// ── BookFillCard — vocab image card that fills its grid cell ─────────────────

function BookFillCard({
  word,
  sentence,
  translation,
  language,
  gender,
  testIndex,
  imageDescription,
}: {
  word: string;
  sentence: string;
  translation: string;
  language: string;
  gender: string;
  testIndex: number;
  imageDescription?: string;
}) {
  const { data: img } = useWordImage(word, language, imageDescription);
  const { play, playingKey } = useTTS(language, gender);
  const key = `book-vocab-${word}-${testIndex}`;
  const isPlaying = playingKey === key;

  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden rounded-sm border bg-white/60 dark:bg-black/20"
      data-testid={`book-vocab-card-${testIndex}`}
    >
      {/* Image fills remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden bg-muted/20">
        {img?.url ? (
          <img
            src={img.url}
            alt={word}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" />
          </div>
        )}
      </div>
      {/* Text strip at bottom — fixed height */}
      <div className="shrink-0 flex items-center justify-between px-2 py-1 gap-1">
        <div className="min-w-0 flex-1 text-center">
          <p className="text-xs font-medium leading-tight truncate">{sentence}</p>
        </div>
        <button
          type="button"
          onClick={() => play(sentence, key)}
          disabled={isPlaying}
          className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
          data-testid={`button-book-listen-${testIndex}`}
        >
          {isPlaying
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Volume2 className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

// ── BookGrid2x2 — 2×2 vocab grid filling container height ────────────────────

export function BookGrid2x2({
  items,
  language,
}: {
  items: BookPositiveItem[];
  language: string;
}) {
  const { tutorGender } = useLanguage();
  const visible = items.slice(0, 4);
  return (
    <div
      className="grid grid-cols-2 grid-rows-2 gap-1.5 h-full"
      data-testid="book-grid-2x2"
    >
      {visible.map((item, i) => (
        <BookFillCard
          key={item.word}
          word={item.word}
          sentence={item.sentence}
          translation={item.translation}
          imageDescription={item.imageDescription}
          language={language}
          gender={tutorGender ?? "female"}
          testIndex={i}
        />
      ))}
    </div>
  );
}

// ── BookNegFillCard — negative form card that fills its grid cell ─────────────

function BookNegFillCard({
  item,
  language,
  gender,
  testIndex,
}: {
  item: NegativeFormItem;
  language: string;
  gender: string;
  testIndex: number;
}) {
  const { data: img } = useWordImage(item.imageWord, language);
  const { play, playingKey } = useTTS(language, gender);
  const key = `book-neg-${item.imageWord}-${testIndex}`;
  const isPlaying = playingKey === key;

  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden rounded-sm border bg-white/60 dark:bg-black/20"
      data-testid={`book-neg-card-${testIndex}`}
    >
      <div className="flex-1 min-h-0 overflow-hidden bg-muted/20">
        {img?.url ? (
          <img
            src={img.url}
            alt={item.imageWord}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center justify-between px-2 py-1 gap-1">
        <p className="text-xs font-medium leading-tight flex-1 text-center truncate">
          {item.negativePhrase}
        </p>
        <button
          type="button"
          onClick={() => play(item.negativePhrase, key)}
          disabled={isPlaying}
          className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
          data-testid={`button-book-neg-listen-${testIndex}`}
        >
          {isPlaying
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Volume2 className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

// ── BookNegGrid2x2 — 2×2 negative-form grid filling container height ──────────

export function BookNegGrid2x2({
  items,
  language,
}: {
  items: NegativeFormItem[];
  language: string;
}) {
  const { tutorGender } = useLanguage();
  return (
    <div
      className="grid grid-cols-2 grid-rows-2 gap-1.5 h-full"
      data-testid="book-neg-grid-2x2"
    >
      {items.slice(0, 4).map((item, i) => (
        <BookNegFillCard
          key={item.imageWord}
          item={item}
          language={language}
          gender={tutorGender ?? "female"}
          testIndex={i}
        />
      ))}
    </div>
  );
}

// ── BookQAFillCard — Q&A card that fills its grid cell ───────────────────────

function BookQAFillCard({
  item,
  language,
  gender,
  index,
}: {
  item: Page12QAItem;
  language: string;
  gender: string;
  index: number;
}) {
  const { data: img } = useWordImage(item.imageWord ?? "", language);
  const { play, playingKey } = useTTS(language, gender);
  const hasImage = !!item.imageWord;
  const qKey = `book-qa-q-${index}`;
  const aKey = `book-qa-a-${index}`;

  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden rounded-sm border bg-white/60 dark:bg-black/20"
      data-testid={`book-qa-card-${index}`}
    >
      {/* Image (only for items with imageWord) */}
      {hasImage && (
        <div className="flex-1 min-h-0 overflow-hidden bg-muted/20">
          {img?.url ? (
            <img
              src={img.url}
              alt={item.imageWord}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" />
            </div>
          )}
        </div>
      )}
      {/* Q&A text */}
      <div className={cn("shrink-0 px-2 space-y-1", hasImage ? "py-1.5" : "py-3 flex-1 flex flex-col justify-center")}>
        <div className="flex items-start gap-1">
          <p className="text-xs font-medium leading-snug flex-1">{item.question}</p>
          <button
            type="button"
            onClick={() => play(item.question, qKey)}
            disabled={playingKey === qKey}
            className="shrink-0 text-muted-foreground/50 hover:text-foreground"
            data-testid={`button-book-qa-q-${index}`}
          >
            {playingKey === qKey ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Volume2 className="h-2.5 w-2.5" />}
          </button>
        </div>
        <div className="flex items-start gap-1">
          <p className="text-xs text-muted-foreground leading-snug flex-1">{item.affirmativeAnswer}</p>
          <button
            type="button"
            onClick={() => play(item.affirmativeAnswer, aKey)}
            disabled={playingKey === aKey}
            className="shrink-0 text-muted-foreground/50 hover:text-foreground"
            data-testid={`button-book-qa-a-${index}`}
          >
            {playingKey === aKey ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Volume2 className="h-2.5 w-2.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BookQAGrid — 2×2 Q&A grid filling container height ───────────────────────

export function BookQAGrid({
  items,
  language,
}: {
  items: Page12QAItem[];
  language: string;
}) {
  const { tutorGender } = useLanguage();
  return (
    <div
      className="grid grid-cols-2 grid-rows-2 gap-1.5 h-full"
      data-testid="book-qa-grid"
    >
      {items.slice(0, 4).map((item, i) => (
        <BookQAFillCard
          key={i}
          item={item}
          language={language}
          gender={tutorGender ?? "female"}
          index={i}
        />
      ))}
    </div>
  );
}
