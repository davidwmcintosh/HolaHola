import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLeftPageCount } from "@/data/madrigal-page-scans";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Volume2,
  Mic,
  MicOff,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  BookOpen,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ExampleSentence {
  target: string;
  translation: string;
}

interface VocabItem {
  word: string;
  translation: string;
  partOfSpeech: string;
  gender?: string;
  exampleSentences: ExampleSentence[];
}

interface KeyPhrase {
  phrase: string;
  context: string;
  translation: string;
}

interface TextbookContent {
  vocabulary_list: VocabItem[];
  key_phrases_for_chat: KeyPhrase[];
  introduction?: string;
}

interface VocabImageMap {
  [word: string]: { url: string; source: string };
}

interface SeeItSayItLoopProps {
  lessonId: string;
  language?: string;
  lessonName?: string;
  onComplete?: () => void;
  hideHeader?: boolean;
  /** How many vocab items go on the LEFT page. Defaults to Math.ceil(n/2).
   *  Pass this when the content has a known book-page boundary (Madrigal chapters). */
  leftPageCount?: number;
  /** Madrigal chapter key (e.g. "where are you going").
   *  When provided, leftPageCount is derived automatically from the scan registry
   *  once the vocab list is loaded — unless leftPageCount is also explicitly passed. */
  chapterKey?: string;
}

type CardState = "idle" | "speaking" | "eval" | "mastered" | "needs-work";

// ── Helpers ──────────────────────────────────────────────────────────────────

const LANG_TAGS: Record<string, string> = {
  spanish: "es-MX",
  french: "fr-FR",
  portuguese: "pt-BR",
  italian: "it-IT",
  german: "de-DE",
  mandarin: "zh-CN",
  japanese: "ja-JP",
  korean: "ko-KR",
  arabic: "ar-SA",
};

function getLangTag(language?: string): string {
  return LANG_TAGS[(language ?? "spanish").toLowerCase()] ?? "es-MX";
}

// ── CompactVocabCard — one item in the page grid ──────────────────────────────

function CompactVocabCard({
  item,
  imageUrl,
  cardState,
  ttsLoading,
  onListen,
  onSpeak,
  onDone,
  onGotIt,
  onNeedsWork,
  horizontal = false,
}: {
  item: VocabItem;
  imageUrl?: string;
  cardState: CardState;
  ttsLoading: boolean;
  onListen: () => void;
  onSpeak: () => void;
  onDone: () => void;
  onGotIt: () => void;
  onNeedsWork: () => void;
  horizontal?: boolean;
}) {
  const isMastered = cardState === "mastered";
  const isNeedsWork = cardState === "needs-work";
  const phrase = item.exampleSentences?.[0];

  const stateClass = isMastered
    ? "border-green-500/40 bg-green-500/5 dark:bg-green-500/10"
    : isNeedsWork
    ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10"
    : "";

  // ── Horizontal book-page layout ──────────────────────────────────────────
  if (horizontal) {
    return (
      <div
        className={`rounded-md border bg-card flex flex-row overflow-hidden transition-colors ${stateClass}`}
        data-testid={`vocab-card-${item.word}`}
      >
        {/* Square image — fixed width on left */}
        <div className="relative w-20 shrink-0 bg-muted/30 self-stretch">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.word}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl font-bold text-muted-foreground/20 select-none">
                {item.word[0]?.toUpperCase()}
              </span>
            </div>
          )}
          {isMastered && (
            <div className="absolute top-1 left-1 bg-green-500 rounded-full p-0.5 shadow-sm">
              <CheckCircle2 className="h-2.5 w-2.5 text-white" />
            </div>
          )}
          {isNeedsWork && (
            <div className="absolute top-1 left-1 bg-amber-500 rounded-full p-0.5 shadow-sm">
              <RotateCcw className="h-2.5 w-2.5 text-white" />
            </div>
          )}
        </div>

        {/* Text + controls — right side */}
        <div className="flex-1 min-w-0 flex flex-col justify-between px-2.5 py-2">
          <div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-semibold text-sm leading-tight">{item.word}</span>
              {item.gender && (
                <span className="text-[10px] text-muted-foreground">
                  {item.gender === "m" ? "masc." : "fem."}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-tight">{item.translation}</p>
            {phrase && (
              <p className="text-[10px] text-foreground/50 italic leading-snug mt-0.5 line-clamp-1">
                {phrase.target}
              </p>
            )}
          </div>

          {/* Compact action controls */}
          <div className="mt-1.5">
            {(cardState === "idle" || cardState === "mastered" || cardState === "needs-work") && (
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onListen} disabled={ttsLoading} data-testid={`button-listen-${item.word}`}>
                  {ttsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSpeak} data-testid={`button-speak-${item.word}`}>
                  <Mic className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {cardState === "speaking" && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={onDone} data-testid={`button-done-${item.word}`}>
                  <MicOff className="h-3 w-3 mr-1" />Done
                </Button>
              </div>
            )}
            {cardState === "eval" && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs px-2 flex-1" onClick={onNeedsWork} data-testid={`button-needs-work-${item.word}`}>
                  <XCircle className="h-3 w-3 mr-1 text-destructive" />Again
                </Button>
                <Button size="sm" className="h-7 text-xs px-2 flex-1" onClick={onGotIt} data-testid={`button-got-it-${item.word}`}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />Got it
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Portrait card layout (mobile / fallback) ──────────────────────────────
  return (
    <div
      className={`rounded-md border bg-card flex flex-col overflow-hidden transition-colors ${stateClass}`}
      data-testid={`vocab-card-${item.word}`}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-muted/30 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.word}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl font-bold text-muted-foreground/20 select-none">
              {item.word[0]?.toUpperCase()}
            </span>
          </div>
        )}
        {isMastered && (
          <div className="absolute top-1.5 right-1.5 bg-green-500 rounded-full p-0.5 shadow-sm">
            <CheckCircle2 className="h-3 w-3 text-white" />
          </div>
        )}
        {isNeedsWork && (
          <div className="absolute top-1.5 right-1.5 bg-amber-500 rounded-full p-0.5 shadow-sm">
            <RotateCcw className="h-3 w-3 text-white" />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="px-2 pt-2 pb-1 flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="font-semibold text-sm leading-tight">{item.word}</span>
          {item.gender && (
            <span className="text-[10px] text-muted-foreground">
              {item.gender === "m" ? "masc." : "fem."}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-tight">{item.translation}</p>
        {phrase && (
          <p className="text-[11px] text-foreground/60 italic leading-snug mt-0.5">
            {phrase.target}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="px-2 pb-2 pt-1 mt-auto">
        {(cardState === "idle" || cardState === "mastered" || cardState === "needs-work") && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="flex-1" onClick={onListen} disabled={ttsLoading} data-testid={`button-listen-${item.word}`}>
              {ttsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="flex-1" onClick={onSpeak} data-testid={`button-speak-${item.word}`}>
              <Mic className="h-4 w-4" />
            </Button>
          </div>
        )}
        {cardState === "speaking" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              Listening…
            </div>
            <Button size="sm" variant="destructive" className="w-full" onClick={onDone} data-testid={`button-done-${item.word}`}>
              <MicOff className="h-3 w-3 mr-1.5" />Done
            </Button>
          </div>
        )}
        {cardState === "eval" && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="flex-1" onClick={onNeedsWork} data-testid={`button-needs-work-${item.word}`}>
              <XCircle className="h-3 w-3 mr-1 text-destructive" />Again
            </Button>
            <Button size="sm" className="flex-1" onClick={onGotIt} data-testid={`button-got-it-${item.word}`}>
              <CheckCircle2 className="h-3 w-3 mr-1" />Got it
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PhraseRow — compact phrase with listen/speak ──────────────────────────────

function PhraseRow({
  phrase,
  index,
  ttsLoading,
  phraseState,
  onListen,
  onSpeak,
  onDone,
}: {
  phrase: KeyPhrase;
  index: number;
  ttsLoading: boolean;
  phraseState: CardState;
  onListen: () => void;
  onSpeak: () => void;
  onDone: () => void;
}) {
  return (
    <div
      className={`rounded-md border bg-card px-3 py-2.5 flex items-start gap-3 ${
        phraseState === "mastered" ? "border-green-500/40" : ""
      }`}
      data-testid={`phrase-row-${index}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{phrase.phrase}</p>
        <p className="text-xs text-muted-foreground leading-snug">{phrase.translation}</p>
        {phrase.context && (
          <p className="text-[11px] text-foreground/50 italic leading-snug mt-0.5">{phrase.context}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        {phraseState === "speaking" ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={onDone}
            data-testid={`button-phrase-done-${index}`}
          >
            <MicOff className="h-3 w-3 mr-1" />
            Done
          </Button>
        ) : (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={onListen}
              disabled={ttsLoading}
              data-testid={`button-phrase-listen-${index}`}
            >
              {ttsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onSpeak}
              data-testid={`button-phrase-speak-${index}`}
            >
              {phraseState === "mastered" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── SeeItSayItLoop — full page vocab grid ─────────────────────────────────────

export function SeeItSayItLoop({
  lessonId,
  language,
  lessonName,
  onComplete,
  hideHeader = false,
  leftPageCount,
  chapterKey,
}: SeeItSayItLoopProps) {
  const langTag = getLangTag(language);
  const { tutorGender } = useLanguage();

  const { data, isLoading, error } = useQuery<{ content: TextbookContent | null }>({
    queryKey: ["/api/textbook-content", lessonId],
    queryFn: () =>
      fetch(`/api/textbook-content/${lessonId}`, { credentials: "include" }).then((r) =>
        r.json()
      ),
  });

  const { data: imagesData } = useQuery<{ images: VocabImageMap }>({
    queryKey: ["/api/textbook-content", lessonId, "vocab-images", language],
    queryFn: () =>
      fetch(
        `/api/textbook-content/${lessonId}/vocab-images?language=${encodeURIComponent(language ?? "spanish")}`,
        { credentials: "include" }
      ).then((r) => r.json()),
    enabled: !!lessonId,
    staleTime: 1000 * 60 * 60,
  });

  const imageMap: VocabImageMap = imagesData?.images ?? {};
  const content = data?.content;

  // Deduplicate vocab, remove explicit tú-pronoun items (we teach usted forms)
  const TU_WORD = /\btú\b/i;
  const rawVocab: VocabItem[] = content?.vocabulary_list ?? [];
  const seenVocab = new Set<string>();
  const vocabList: VocabItem[] = rawVocab.filter(v => {
    // Drop items that use the explicit tú pronoun
    if (TU_WORD.test(v.word)) return false;
    // Deduplicate by normalized key
    const key = v.word.toLowerCase().replace(/[¿?¡!,;:.]/g, '').trim();
    if (seenVocab.has(key)) return false;
    seenVocab.add(key);
    return true;
  });

  // Key phrases — suppress any that duplicate a vocab word or use tú pronoun
  const vocabNorms = new Set(vocabList.map(v => v.word.toLowerCase().replace(/[¿?¡!,;:.]/g, '').trim()));
  const phrases: KeyPhrase[] = (content?.key_phrases_for_chat ?? []).filter(kp => {
    if (TU_WORD.test(kp.phrase)) return false;
    const norm = kp.phrase.toLowerCase().replace(/[¿?¡!,;:.]/g, '').trim();
    return !vocabNorms.has(norm);
  });

  // Per-card state (not sequential — any card can be in any state)
  const [cardStates, setCardStates] = useState<Map<number, CardState>>(new Map());
  const [ttsLoadingIndex, setTtsLoadingIndex] = useState<number | null>(null);
  const [phraseStates, setPhraseStates] = useState<Map<number, CardState>>(new Map());
  const [phraseTtsLoadingIndex, setPhraseTtsLoadingIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getCard = (i: number): CardState => cardStates.get(i) ?? "idle";
  const setCard = (i: number, state: CardState) =>
    setCardStates((prev) => new Map(prev).set(i, state));
  const getPhrase = (i: number): CardState => phraseStates.get(i) ?? "idle";
  const setPhrase = (i: number, state: CardState) =>
    setPhraseStates((prev) => new Map(prev).set(i, state));

  const masteredCount = Array.from(cardStates.values()).filter((s) => s === "mastered").length;
  const progressPct = vocabList.length > 0 ? (masteredCount / vocabList.length) * 100 : 0;

  const speakTTS = useCallback(
    async (text: string) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      try {
        // Use the same pronunciation endpoint as TextAudioPlayButton / VisualVocabGrid
        // so voice gender is consistent with every other component on the page.
        const response = await apiRequest("POST", "/api/tts/pronunciation", {
          text,
          language: language ?? "spanish",
          gender: tutorGender ?? "female",
        });
        const data = await response.json();
        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;
        audio.onended = () => { audioRef.current = null; };
        audio.onerror = () => { audioRef.current = null; };
        await audio.play();
      } catch {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utt = new SpeechSynthesisUtterance(text);
          utt.lang = langTag;
          utt.rate = 0.82;
          window.speechSynthesis.speak(utt);
        }
      }
    },
    [language, langTag, tutorGender]
  );

  const handleVocabListen = useCallback(
    async (item: VocabItem, index: number) => {
      if (ttsLoadingIndex !== null) return;
      setTtsLoadingIndex(index);
      const text = item.exampleSentences?.[0]?.target ?? item.word;
      await speakTTS(text);
      setTtsLoadingIndex(null);
    },
    [ttsLoadingIndex, speakTTS]
  );

  const handlePhraseListen = useCallback(
    async (phrase: KeyPhrase, index: number) => {
      if (phraseTtsLoadingIndex !== null) return;
      setPhraseTtsLoadingIndex(index);
      await speakTTS(phrase.phrase);
      setPhraseTtsLoadingIndex(null);
    },
    [phraseTtsLoadingIndex, speakTTS]
  );

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading vocabulary…</span>
      </div>
    );
  }

  if (error || !content || vocabList.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No vocabulary content available for this lesson yet.
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5" data-testid="sisl-page">

      {/* Header row */}
      {!hideHeader && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {lessonName ?? "Vocabulary"}
            </span>
          </div>
          {masteredCount > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              {masteredCount} / {vocabList.length} mastered
            </Badge>
          )}
        </div>
      )}

      {/* Progress bar (only shows once practice starts) */}
      {masteredCount > 0 && (
        <Progress value={progressPct} className="h-1.5" />
      )}

      {/* ── Vocab — two-page book spread ── */}
      {/* Always two columns of horizontal cards (book spread).
          leftPageCount prop or n/2 default determines the page break.
          If chapterKey is provided, the scan registry is consulted for the split. */}
      {(() => {
        const vocabWords = vocabList.map((v) => v.word);
        const half =
          leftPageCount ??
          (chapterKey
            ? getLeftPageCount(chapterKey, vocabWords)
            : Math.ceil(vocabList.length / 2));
        const leftItems = vocabList.slice(0, half);
        const rightItems = vocabList.slice(half);
        return (
          <div className="grid grid-cols-2 gap-6" data-testid="sisl-vocab-grid-book">
            {/* Left page */}
            <div className="flex flex-col gap-2">
              {leftItems.map((item, i) => (
                <CompactVocabCard
                  key={i}
                  item={item}
                  imageUrl={imageMap[item.word]?.url}
                  cardState={getCard(i)}
                  ttsLoading={ttsLoadingIndex === i}
                  onListen={() => handleVocabListen(item, i)}
                  onSpeak={() => setCard(i, "speaking")}
                  onDone={() => setCard(i, "eval")}
                  onGotIt={() => setCard(i, "mastered")}
                  onNeedsWork={() => setCard(i, "needs-work")}
                  horizontal
                />
              ))}
            </div>
            {/* Right page — subtle spine divider */}
            <div className="relative flex flex-col gap-2">
              <div className="absolute -left-3 top-0 bottom-0 w-px bg-border/40" />
              {rightItems.map((item, i) => {
                const idx = half + i;
                return (
                  <CompactVocabCard
                    key={idx}
                    item={item}
                    imageUrl={imageMap[item.word]?.url}
                    cardState={getCard(idx)}
                    ttsLoading={ttsLoadingIndex === idx}
                    onListen={() => handleVocabListen(item, idx)}
                    onSpeak={() => setCard(idx, "speaking")}
                    onDone={() => setCard(idx, "eval")}
                    onGotIt={() => setCard(idx, "mastered")}
                    onNeedsWork={() => setCard(idx, "needs-work")}
                    horizontal
                  />
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Key phrases — compact list ── */}
      {phrases.length > 0 && (
        <div className="space-y-2" data-testid="sisl-phrases-section">
          <div className="flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Key Phrases
            </span>
          </div>
          <div className="space-y-1.5">
            {phrases.map((phrase, i) => (
              <PhraseRow
                key={i}
                phrase={phrase}
                index={i}
                ttsLoading={phraseTtsLoadingIndex === i}
                phraseState={getPhrase(i)}
                onListen={() => handlePhraseListen(phrase, i)}
                onSpeak={() => setPhrase(i, "speaking")}
                onDone={() => setPhrase(i, "mastered")}
              />
            ))}
          </div>
        </div>
      )}

      {/* Done button */}
      {masteredCount > 0 && onComplete && (
        <Button
          variant="outline"
          className="w-full"
          onClick={onComplete}
          data-testid="button-sisl-finish"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Continue to grammar
        </Button>
      )}
    </div>
  );
}
