import { useState, useCallback, useEffect } from "react";
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
  ArrowRight,
  Loader2,
  BookOpen,
  Star,
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
  conjugations?: Record<string, string>;
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

type Phase = "vocab" | "phrases" | "complete";
type VocabStep = "present" | "speaking" | "eval";

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

function speakText(text: string, langTag: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = langTag;
  utt.rate = 0.82;
  window.speechSynthesis.speak(utt);
}

const POS_GRADIENTS: Record<string, string> = {
  noun: "from-blue-500/25 to-blue-600/10",
  verb: "from-emerald-500/25 to-emerald-600/10",
  "verb phrase": "from-emerald-500/25 to-emerald-600/10",
  adjective: "from-orange-500/25 to-orange-600/10",
  adverb: "from-violet-500/25 to-violet-600/10",
  interjection: "from-amber-500/25 to-amber-600/10",
  phrase: "from-rose-500/25 to-rose-600/10",
  preposition: "from-teal-500/25 to-teal-600/10",
};

function getPosGradient(pos: string): string {
  const key = pos.toLowerCase();
  return POS_GRADIENTS[key] ?? "from-primary/20 to-primary/5";
}

// ── ImageArt — shows real image or styled placeholder ────────────────────────

function ImageArt({ item, imageUrl }: { item: VocabItem; imageUrl?: string }) {
  const gradient = getPosGradient(item.partOfSpeech);

  if (imageUrl) {
    return (
      <div className="w-full aspect-[4/3] rounded-md overflow-hidden bg-muted/30">
        <img
          src={imageUrl}
          alt={item.word}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`w-full aspect-[4/3] rounded-md bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 select-none`}
      aria-hidden
    >
      <span className="text-5xl font-bold tracking-tight text-foreground/80">
        {item.word}
      </span>
      {item.gender && (
        <span className="text-sm text-muted-foreground font-medium uppercase tracking-widest">
          {item.gender === "m" ? "masc." : "fem."}
        </span>
      )}
    </div>
  );
}

// ── VocabCard — one item in the See It Say It loop ───────────────────────────

function VocabCard({
  item,
  step,
  langTag,
  imageUrl,
  onListen,
  onStartSpeaking,
  onDoneSpeaking,
  onGotIt,
  onNeedsWork,
  onRetry,
}: {
  item: VocabItem;
  step: VocabStep;
  langTag: string;
  imageUrl?: string;
  onListen: () => void;
  onStartSpeaking: () => void;
  onDoneSpeaking: () => void;
  onGotIt: () => void;
  onNeedsWork: () => void;
  onRetry: () => void;
}) {
  const phrase = item.exampleSentences?.[0];

  return (
    <div className="space-y-4">
      <ImageArt item={item} imageUrl={imageUrl} />

      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xl font-semibold text-foreground">{item.word}</span>
          <Badge variant="outline" className="text-xs">
            {item.partOfSpeech}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{item.translation}</p>
      </div>

      {phrase && (
        <div className="rounded-md bg-muted/50 px-4 py-3 space-y-1">
          <p className="text-base font-medium text-foreground">{phrase.target}</p>
          <p className="text-sm text-muted-foreground">{phrase.translation}</p>
        </div>
      )}

      {step === "present" && (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={onListen}
            data-testid="button-sisl-listen"
          >
            <Volume2 className="h-4 w-4 mr-2" />
            Listen
          </Button>
          <Button
            className="w-full"
            onClick={onStartSpeaking}
            data-testid="button-sisl-speak"
          >
            <Mic className="h-4 w-4 mr-2" />
            Say it
          </Button>
        </div>
      )}

      {step === "speaking" && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            Listening…
          </div>
          <Button
            variant="destructive"
            className="w-full max-w-xs"
            onClick={onDoneSpeaking}
            data-testid="button-sisl-done"
          >
            <MicOff className="h-4 w-4 mr-2" />
            Done
          </Button>
        </div>
      )}

      {step === "eval" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-center text-muted-foreground">
            How did you do?
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onNeedsWork}
              data-testid="button-sisl-needs-work"
            >
              <XCircle className="h-4 w-4 mr-1.5 text-destructive" />
              Needs work
            </Button>
            <Button
              className="flex-1"
              onClick={onGotIt}
              data-testid="button-sisl-got-it"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Got it
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onRetry}
            data-testid="button-sisl-retry"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Say again
          </Button>
        </div>
      )}
    </div>
  );
}

// ── PhraseCard — key phrase for conversation ─────────────────────────────────

function PhraseCard({
  phrase,
  index,
  total,
  step,
  langTag,
  onListen,
  onStartSpeaking,
  onDoneSpeaking,
  onNext,
}: {
  phrase: KeyPhrase;
  index: number;
  total: number;
  step: VocabStep;
  langTag: string;
  onListen: () => void;
  onStartSpeaking: () => void;
  onDoneSpeaking: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <Badge variant="outline" className="mb-2">
          <BookOpen className="h-3 w-3 mr-1" />
          Phrase {index + 1} of {total}
        </Badge>
        <p className="text-3xl font-semibold tracking-tight text-foreground">
          {phrase.phrase}
        </p>
        <p className="text-base text-muted-foreground">{phrase.translation}</p>
      </div>

      <div className="rounded-md bg-muted/50 px-4 py-3">
        <p className="text-sm text-muted-foreground italic">{phrase.context}</p>
      </div>

      {step === "present" && (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={onListen}
            data-testid={`button-phrase-listen-${index}`}
          >
            <Volume2 className="h-4 w-4 mr-2" />
            Listen
          </Button>
          <Button
            className="w-full"
            onClick={onStartSpeaking}
            data-testid={`button-phrase-speak-${index}`}
          >
            <Mic className="h-4 w-4 mr-2" />
            Say it
          </Button>
        </div>
      )}

      {step === "speaking" && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            Listening…
          </div>
          <Button
            variant="destructive"
            className="w-full max-w-xs"
            onClick={onDoneSpeaking}
            data-testid={`button-phrase-done-${index}`}
          >
            <MicOff className="h-4 w-4 mr-2" />
            Done
          </Button>
        </div>
      )}

      {step === "eval" && (
        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={onNext}
            data-testid={`button-phrase-next-${index}`}
          >
            {index + 1 < total ? (
              <>
                Next phrase
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                Finish
                <CheckCircle2 className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── CompletionView ────────────────────────────────────────────────────────────

function CompletionView({
  vocabCount,
  phraseCount,
  masteredCount,
  onRestart,
  onDone,
}: {
  vocabCount: number;
  phraseCount: number;
  masteredCount: number;
  onRestart: () => void;
  onDone?: () => void;
}) {
  const pct = vocabCount > 0 ? Math.round((masteredCount / vocabCount) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
        <Star className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold">Session complete</p>
        <p className="text-sm text-muted-foreground">
          {masteredCount} of {vocabCount} words — got it right away
        </p>
        {phraseCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {phraseCount} conversation {phraseCount === 1 ? "phrase" : "phrases"} practiced
          </p>
        )}
      </div>
      <Progress value={pct} className="w-full max-w-xs h-2" />
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {masteredCount < vocabCount && (
          <Button variant="outline" onClick={onRestart} data-testid="button-sisl-restart">
            <RotateCcw className="h-4 w-4 mr-2" />
            Practice again
          </Button>
        )}
        {onDone && (
          <Button onClick={onDone} data-testid="button-sisl-done-session">
            Done
          </Button>
        )}
      </div>
    </div>
  );
}

// ── SeeItSayItLoop — main component ──────────────────────────────────────────

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

  const [phase, setPhase] = useState<Phase>("vocab");
  const [vocabIndex, setVocabIndex] = useState(0);
  const [vocabStep, setVocabStep] = useState<VocabStep>("present");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phraseStep, setPhraseStep] = useState<VocabStep>("present");
  const [masteredIds, setMasteredIds] = useState<Set<number>>(new Set());

  const currentVocab = vocabList[vocabIndex];
  const currentPhrase = phrases[phraseIndex];
  const totalItems = vocabList.length + phrases.length;
  const doneItems =
    phase === "vocab"
      ? vocabIndex
      : vocabList.length + (phase === "phrases" ? phraseIndex : phrases.length);
  const progressPct = totalItems > 0 ? (doneItems / totalItems) * 100 : 0;

  const advanceVocab = useCallback(() => {
    const next = vocabIndex + 1;
    if (next < vocabList.length) {
      setVocabIndex(next);
      setVocabStep("present");
    } else if (phrases.length > 0) {
      setPhase("phrases");
      setPhraseIndex(0);
      setPhraseStep("present");
    } else {
      setPhase("complete");
      onComplete?.();
    }
  }, [vocabIndex, vocabList.length, phrases.length, onComplete]);

  const advancePhrase = useCallback(() => {
    const next = phraseIndex + 1;
    if (next < phrases.length) {
      setPhraseIndex(next);
      setPhraseStep("present");
    } else {
      setPhase("complete");
      onComplete?.();
    }
  }, [phraseIndex, phrases.length, onComplete]);

  const handleRestart = () => {
    setPhase("vocab");
    setVocabIndex(0);
    setVocabStep("present");
    setPhraseIndex(0);
    setPhraseStep("present");
  };

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

  // ── Complete ───────────────────────────────────────────────────────────────

  if (phase === "complete") {
    return (
      <CompletionView
        vocabCount={vocabList.length}
        phraseCount={phrases.length}
        masteredCount={masteredIds.size}
        onRestart={handleRestart}
        onDone={onComplete}
      />
    );
  }

  // ── Progress bar (shared) ──────────────────────────────────────────────────

  const progressBar = (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {phase === "vocab" ? (
            <>Word {vocabIndex + 1} of {vocabList.length}</>
          ) : (
            <>Phrase {phraseIndex + 1} of {phrases.length}</>
          )}
        </span>
        <span>{Math.round(progressPct)}%</span>
      </div>
      <Progress value={progressPct} className="h-1.5" />
    </div>
  );

  // ── Vocab phase ────────────────────────────────────────────────────────────

  if (phase === "vocab" && currentVocab) {
    return (
      <div className="space-y-4" data-testid="sisl-vocab-phase">
        {progressBar}
        <VocabCard
          item={currentVocab}
          step={vocabStep}
          langTag={langTag}
          imageUrl={imageMap[currentVocab.word]}
          onListen={() => {
            const phrase = currentVocab.exampleSentences?.[0]?.target ?? currentVocab.word;
            speakText(phrase, langTag);
          }}
          onStartSpeaking={() => setVocabStep("speaking")}
          onDoneSpeaking={() => setVocabStep("eval")}
          onGotIt={() => {
            setMasteredIds((prev) => new Set([...prev, vocabIndex]));
            advanceVocab();
          }}
          onNeedsWork={() => advanceVocab()}
          onRetry={() => {
            setVocabStep("speaking");
          }}
        />
      </div>
    );
  }

  // ── Phrases phase ──────────────────────────────────────────────────────────

  if (phase === "phrases" && currentPhrase) {
    return (
      <div className="space-y-4" data-testid="sisl-phrases-phase">
        {progressBar}
        <PhraseCard
          phrase={currentPhrase}
          index={phraseIndex}
          total={phrases.length}
          step={phraseStep}
          langTag={langTag}
          onListen={() => speakText(currentPhrase.phrase, langTag)}
          onStartSpeaking={() => setPhraseStep("speaking")}
          onDoneSpeaking={() => setPhraseStep("eval")}
          onNext={advancePhrase}
        />
      </div>
    );
  }

  return null;
}
