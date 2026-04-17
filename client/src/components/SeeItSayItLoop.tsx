import { useState, useCallback, useEffect, useRef } from "react";
import { synthesizeSpeech } from "@/lib/restVoiceApi";
import { useQuery } from "@tanstack/react-query";
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
}) {
  const isMastered = cardState === "mastered";
  const isNeedsWork = cardState === "needs-work";
  const phrase = item.exampleSentences?.[0];

  return (
    <div
      className={`rounded-md border bg-card flex flex-col overflow-hidden transition-colors ${
        isMastered
          ? "border-green-500/40 bg-green-500/5 dark:bg-green-500/10"
          : isNeedsWork
          ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10"
          : ""
      }`}
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
            <Button
              size="icon"
              variant="ghost"
              className="flex-1"
              onClick={onListen}
              disabled={ttsLoading}
              data-testid={`button-listen-${item.word}`}
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
              className="flex-1"
              onClick={onSpeak}
              data-testid={`button-speak-${item.word}`}
            >
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
            <Button
              size="sm"
              variant="destructive"
              className="w-full"
              onClick={onDone}
              data-testid={`button-done-${item.word}`}
            >
              <MicOff className="h-3 w-3 mr-1.5" />
              Done
            </Button>
          </div>
        )}

        {cardState === "eval" && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={onNeedsWork}
              data-testid={`button-needs-work-${item.word}`}
            >
              <XCircle className="h-3 w-3 mr-1 text-destructive" />
              Again
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={onGotIt}
              data-testid={`button-got-it-${item.word}`}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Got it
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
}: SeeItSayItLoopProps) {
  const langTag = getLangTag(language);

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
  const vocabList: VocabItem[] = content?.vocabulary_list ?? [];
  const phrases: KeyPhrase[] = content?.key_phrases_for_chat ?? [];

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
        const result = await synthesizeSpeech(text, language ?? "spanish");
        const url = URL.createObjectURL(result.audioBlob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };
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
    [language, langTag]
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

      {/* Progress bar (only shows once practice starts) */}
      {masteredCount > 0 && (
        <Progress value={progressPct} className="h-1.5" />
      )}

      {/* ── Vocab grid — all items visible at once ── */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
        data-testid="sisl-vocab-grid"
      >
        {vocabList.map((item, i) => (
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
          />
        ))}
      </div>

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
