/**
 * MadrigalPageComponents.tsx
 * Digital equivalents of Madrigal's print page elements, in the exact order she uses them.
 *
 * Components:
 *   MadrigalAnchorBlock   — Same-line anchor items (e.g. "Voy, I'm going.  al, to the.")
 *   MadrigalPositiveGrid  — 2×2 image grid with "Voy al ___" sentences + TTS
 *   MadrigalVaQuestionGrid— 2×2 image grid showing only the question + translation
 *   MadrigalNote          — Muted italic pedagogical note (e.g. subject pronoun note)
 *   MadrigalPage12Grid    — Q&A pairs: 2 with images, 2 text-only
 *   MadrigalVaDefinition  — Final "Va: You are going · He is going…" reference block
 */

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import type {
  MadrigalAnchorItem,
  MadrigalPositiveItem,
  VaQuestionItem,
  Page12QAItem,
} from "@/data/madrigal-unit-content";

// ── Shared: fetch one image by word ──────────────────────────────────────────

function useWordImage(word: string | undefined, language: string) {
  return useQuery<{ url: string | null }>({
    queryKey: ["/api/vocab-image/by-word", word ?? "", language],
    queryFn: () =>
      fetch(
        `/api/vocab-image/by-word?word=${encodeURIComponent(word ?? "")}&language=${encodeURIComponent(language)}`,
        { credentials: "include" }
      ).then((r) => r.json()),
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

// ── MadrigalAnchorBlock ────────────────────────────────────────────────────────
//
// All anchor items on ONE horizontal line with generous gap between them.
// "Voy,  I'm going.          al,  to the."
// "¿Va?  Are you going?"
// "¿Va?  Are you going?   al,  to the.   Voy,  I'm going.   Sí,  Yes."

export function MadrigalAnchorBlock({ items }: { items: MadrigalAnchorItem[] }) {
  return (
    <div
      className="flex flex-wrap items-baseline gap-x-8 gap-y-2 py-1"
      data-testid="madrigal-anchor-block"
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

// ── MadrigalNote ──────────────────────────────────────────────────────────────
//
// Quiet muted note — Madrigal's pedagogical asides, never in bold.

export function MadrigalNote({ text }: { text: string }) {
  return (
    <p
      className="text-sm text-muted-foreground italic px-0.5"
      data-testid="madrigal-note"
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
  const { data: img } = useWordImage(word, language);
  const { play, playingKey } = useTTS(language, gender);
  const key = `vocab-${word}-${testIndex}`;
  const isPlaying = playingKey === key;

  return (
    <div
      className="rounded-md border bg-card overflow-hidden flex flex-col"
      data-testid={`madrigal-vocab-card-${testIndex}`}
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
      <div className="flex items-center gap-1 px-2 py-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => play(sentence, key)}
          disabled={isPlaying}
          className="shrink-0"
          data-testid={`button-listen-${testIndex}`}
        >
          {isPlaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
        </Button>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{sentence}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">{translation}</p>
        </div>
      </div>
    </div>
  );
}

// ── MadrigalPositiveGrid ───────────────────────────────────────────────────────
// 2×2 grid of image cards with sentences. ("Voy al hotel." etc.)

export function MadrigalPositiveGrid({
  items,
  language,
}: {
  items: MadrigalPositiveItem[];
  language: string;
}) {
  const { tutorGender } = useLanguage();
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="madrigal-positive-grid">
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

// ── MadrigalVaQuestionGrid ─────────────────────────────────────────────────────
//
// 2×2 grid showing only the question + translation under each image.
// No answer visible — student reads the question aloud.

function VaQuestionCard({
  item,
  language,
  gender,
  index,
}: {
  item: VaQuestionItem;
  language: string;
  gender: string;
  index: number;
}) {
  const { data: img } = useWordImage(item.imageWord, language);
  const { play, playingKey } = useTTS(language, gender);
  const key = `va-q-${item.imageWord}-${index}`;
  const isPlaying = playingKey === key;

  return (
    <div
      className="rounded-md border bg-card overflow-hidden flex flex-col"
      data-testid={`va-question-card-${index}`}
    >
      <div className="aspect-square bg-muted/30 overflow-hidden">
        {img?.url ? (
          <img src={img.url} alt={item.imageWord} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 px-2 py-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => play(item.question, key)}
          disabled={isPlaying}
          className="shrink-0"
          data-testid={`button-listen-va-${index}`}
        >
          {isPlaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
        </Button>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{item.question}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">{item.questionTranslation}</p>
        </div>
      </div>
    </div>
  );
}

export function MadrigalVaQuestionGrid({
  items,
  language,
}: {
  items: VaQuestionItem[];
  language: string;
}) {
  const { tutorGender } = useLanguage();
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="madrigal-va-question-grid">
      {items.map((item, i) => (
        <VaQuestionCard
          key={item.imageWord}
          item={item}
          language={language}
          gender={tutorGender ?? "female"}
          index={i}
        />
      ))}
    </div>
  );
}

// ── MadrigalPage12Grid ─────────────────────────────────────────────────────────
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

export function MadrigalPage12Grid({
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
    <div className="space-y-3" data-testid="madrigal-page12-grid">
      {withImages.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
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

// ── MadrigalVaDefinition ───────────────────────────────────────────────────────
//
// "Va: You are going · He is going · She is going · It is going"
// "¿Va?: Are you going? · Is he going? · Is she going? · Is it going?"

export function MadrigalVaDefinition({ text }: { text: string }) {
  return (
    <div
      className="rounded-md bg-muted/40 border px-3 py-2.5 space-y-0.5"
      data-testid="madrigal-va-definition"
    >
      {text.split("\n").map((line, i) => (
        <p key={i} className="text-sm text-muted-foreground leading-relaxed">
          {line}
        </p>
      ))}
    </div>
  );
}
