import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Volume2, Mic, MicOff, CheckCircle2, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SocialPhrase {
  spanish: string;
  pronunciation: string;
  english: string;
  context: string;
  register?: "Informal" | "Formal" | "Neutral";
}

interface VocabImageMap {
  [word: string]: { url: string; source: string };
}

// ── Phrase data ────────────────────────────────────────────────────────────────

const GREETINGS: SocialPhrase[] = [
  {
    spanish: "Hola",
    pronunciation: "OH-lah",
    english: "Hello / Hi",
    context: "Any time, any person — the most universal Spanish greeting",
    register: "Neutral",
  },
  {
    spanish: "Buenos días",
    pronunciation: "BWEH-nos DEE-ahs",
    english: "Good morning",
    context: "Use from sunrise until noon",
    register: "Neutral",
  },
  {
    spanish: "Buenas tardes",
    pronunciation: "BWEH-nas TAR-des",
    english: "Good afternoon",
    context: "Use from noon until dark",
    register: "Neutral",
  },
  {
    spanish: "Buenas noches",
    pronunciation: "BWEH-nas NO-ches",
    english: "Good evening / Good night",
    context: "After dark — both a greeting and a farewell",
    register: "Neutral",
  },
  {
    spanish: "¿Qué tal?",
    pronunciation: "KEH tahl",
    english: "How's it going?",
    context: "Casual opener between people who know each other",
    register: "Informal",
  },
  {
    spanish: "¿Qué pasa?",
    pronunciation: "KEH PAH-sah",
    english: "What's up?",
    context: "Very casual — 'what's happening?'",
    register: "Informal",
  },
];

const RESPONSES: SocialPhrase[] = [
  {
    spanish: "Bien",
    pronunciation: "bee-EN",
    english: "Good / Fine",
    context: "Solid everyday answer — works for anything from great to mediocre",
    register: "Neutral",
  },
  {
    spanish: "Muy bien",
    pronunciation: "MWEE bee-EN",
    english: "Very good",
    context: "Genuinely positive — use when things are actually going well",
    register: "Neutral",
  },
  {
    spanish: "Todo bien",
    pronunciation: "TO-do bee-EN",
    english: "All good / Everything's fine",
    context: "As a question: ¿Todo bien? As an answer: Todo bien. Works both ways",
    register: "Informal",
  },
  {
    spanish: "Más o menos",
    pronunciation: "mahs oh MEH-nos",
    english: "So-so / More or less",
    context: "The honest middle answer — 'not great, not terrible'",
    register: "Informal",
  },
  {
    spanish: "Regular",
    pronunciation: "reh-goo-LAR",
    english: "Just okay / So-so",
    context: "More downbeat than más o menos — things could be better",
    register: "Neutral",
  },
  {
    spanish: "¿Y usted?",
    pronunciation: "ee oos-TED",
    english: "And you? (formal)",
    context: "Same turn-back, but for elders, strangers, or professional settings",
    register: "Formal",
  },
  {
    spanish: "Mucho gusto",
    pronunciation: "MOO-cho GOOS-to",
    english: "Nice to meet you",
    context: "Said when meeting someone for the first time",
    register: "Neutral",
  },
  {
    spanish: "Igualmente",
    pronunciation: "ee-gwal-MEN-teh",
    english: "Likewise / Same to you",
    context: "The reply to Mucho gusto — equally gracious",
    register: "Neutral",
  },
];

const COURTESIES: SocialPhrase[] = [
  {
    spanish: "Gracias",
    pronunciation: "GRAH-syahs",
    english: "Thank you",
    context: "Any situation — always appropriate",
    register: "Neutral",
  },
  {
    spanish: "De nada",
    pronunciation: "deh NAH-dah",
    english: "You're welcome",
    context: "Standard response to gracias",
    register: "Neutral",
  },
  {
    spanish: "Por favor",
    pronunciation: "por fah-BOR",
    english: "Please",
    context: "Any polite request — attach to anything you ask for",
    register: "Neutral",
  },
  {
    spanish: "Perdón",
    pronunciation: "per-DON",
    english: "Excuse me / I'm sorry",
    context: "Bumping into someone, interrupting, or a light apology",
    register: "Neutral",
  },
  {
    spanish: "Con permiso",
    pronunciation: "kon per-MEE-so",
    english: "Excuse me (passing through)",
    context: "When moving past someone or leaving a space — more physical than Perdón",
    register: "Neutral",
  },
];

const FAREWELLS: SocialPhrase[] = [
  {
    spanish: "Adiós",
    pronunciation: "ah-DYOS",
    english: "Goodbye",
    context: "Formal or longer departure",
    register: "Neutral",
  },
  {
    spanish: "Hasta luego",
    pronunciation: "AH-stah LWEH-go",
    english: "See you later",
    context: "Casual goodbye when you expect to see them again",
    register: "Informal",
  },
  {
    spanish: "Hasta mañana",
    pronunciation: "AH-stah mah-NYAH-nah",
    english: "See you tomorrow",
    context: "Goodbye until the next day",
    register: "Informal",
  },
  {
    spanish: "Nos vemos",
    pronunciation: "nos BEH-mos",
    english: "See you / We'll see each other",
    context: "Very common casual parting — more natural than Hasta luego in everyday speech",
    register: "Informal",
  },
  {
    spanish: "Nos vemos pronto",
    pronunciation: "nos BEH-mos PRON-to",
    english: "See you soon",
    context: "Warm goodbye when you expect to reconnect shortly",
    register: "Informal",
  },
  {
    spanish: "Me alegro",
    pronunciation: "meh ah-LEH-gro",
    english: "I'm glad / I'm happy to hear it",
    context: "Warm response when someone shares good news",
    register: "Neutral",
  },
  {
    spanish: "Me divertí",
    pronunciation: "meh dee-ver-TEE",
    english: "I had a good time",
    context: "Said at the end of a visit or event — past tense of divertirse",
    register: "Neutral",
  },
  {
    spanish: "Buena suerte",
    pronunciation: "BWEH-nah SWER-teh",
    english: "Good luck",
    context: "Said before an exam, interview, or challenge",
    register: "Neutral",
  },
  {
    spanish: "Figúrese",
    pronunciation: "fee-GOO-reh-seh",
    english: "Just imagine / Can you imagine?",
    context: "Expresses surprise or disbelief — invites the listener to picture the situation",
    register: "Neutral",
  },
];

const ALL_GROUPS = [
  { label: "Greetings", phrases: GREETINGS },
  { label: "Responses", phrases: RESPONSES },
  { label: "Courtesies", phrases: COURTESIES },
  { label: "Farewells", phrases: FAREWELLS },
];

// ── Single phrase card ─────────────────────────────────────────────────────────

function PhraseCard({
  phrase,
  index,
  imageUrl,
}: {
  phrase: SocialPhrase;
  index: number;
  imageUrl?: string;
}) {
  const { tutorGender } = useLanguage();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [practiced, setPracticed] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleListen = useCallback(async () => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);
    try {
      const response = await apiRequest("POST", "/api/tts/pronunciation", {
        text: phrase.spanish,
        language: "spanish",
        gender: tutorGender ?? "female",
      });
      const data = await response.json();
      const audio = new Audio(data.audioUrl);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      await audio.play();
    } catch {
      setIsPlayingAudio(false);
    }
  }, [phrase.spanish, tutorGender, isPlayingAudio]);

  const handleSpeak = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "speech.webm");
        formData.append("language", "spanish");
        try {
          const res = await fetch("/api/stt/transcribe", {
            method: "POST",
            credentials: "include",
            body: formData,
          });
          if (res.ok) setPracticed(true);
          else setPracticed(true); // still count the attempt
        } catch {
          setPracticed(true);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 5000);
    } catch {
      setIsRecording(false);
    }
  }, [isRecording]);

  return (
    <div
      className={`flex flex-col rounded-md border overflow-hidden transition-colors ${
        practiced ? "border-green-500/40 bg-green-500/5" : "bg-card"
      }`}
      data-testid={`phrase-card-${index}`}
    >
      {/* Image area — square, matching Chapter 2 VocabImageCard standard */}
      <div className="relative aspect-square overflow-hidden bg-muted/20">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={phrase.spanish}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      {/* Text content */}
      <div className="flex flex-col flex-1 p-3 space-y-1">
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span
                className="text-lg font-semibold leading-snug"
                data-testid={`phrase-spanish-${index}`}
              >
                {phrase.spanish}
              </span>
              {practiced && (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/60 italic leading-tight">
              {phrase.pronunciation}
            </p>
          </div>
          {phrase.register === "Informal" && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5">
              Informal
            </Badge>
          )}
          {phrase.register === "Formal" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5">
              Formal
            </Badge>
          )}
        </div>

        <p
          className="text-sm font-medium text-foreground/80 leading-snug"
          data-testid={`phrase-english-${index}`}
        >
          {phrase.english}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
          {phrase.context}
        </p>
      </div>

      {/* Audio controls */}
      <div className="flex items-center gap-1 px-3 pb-2.5">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleListen}
          disabled={isPlayingAudio}
          aria-label={`Listen to ${phrase.spanish}`}
          data-testid={`button-listen-${index}`}
          className="h-8 w-8"
        >
          {isPlayingAudio ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          size="icon"
          variant={isRecording ? "default" : "ghost"}
          onClick={handleSpeak}
          aria-label={`Say ${phrase.spanish}`}
          data-testid={`button-speak-${index}`}
          className={`h-8 w-8 ${isRecording ? "animate-pulse" : ""}`}
        >
          {isRecording ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SocialPhraseUnitProps {
  language?: string;
  lessonId?: string;
}

export function SocialPhraseUnit({ language = "spanish", lessonId: _lessonId }: SocialPhraseUnitProps) {
  // Fetch images directly by word list — bypasses lesson vocabulary_list so every
  // phrase card gets an image regardless of what the lesson's DB record contains.
  const allPhraseWords = ALL_GROUPS.flatMap(({ phrases }) => phrases.map(p => p.spanish));

  const { data: imageData } = useQuery<{ images: VocabImageMap }>({
    queryKey: ["/api/vocab-images/by-word-list", language, allPhraseWords.join(",")],
    queryFn: async () => {
      const res = await fetch("/api/vocab-images/by-word-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ language, words: allPhraseWords }),
      });
      if (!res.ok) return { images: {} };
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
  });

  // Build a lookup: normalized Spanish → image URL
  const imageMap: Record<string, string> = {};
  const images = imageData?.images ?? {};
  for (const [word, data] of Object.entries(images)) {
    imageMap[word.toLowerCase()] = data.url;
  }

  function getImage(phrase: SocialPhrase): string | undefined {
    return imageMap[phrase.spanish.toLowerCase()] ?? imageMap[phrase.english.toLowerCase()];
  }

  // Build a flat index for data-testid consistency
  let idx = 0;

  return (
    <div className="space-y-8" data-testid="social-phrase-unit">
      {ALL_GROUPS.map(({ label, phrases }) => (
        <div key={label}>
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">
            {label}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {phrases.map((phrase) => {
              const cardIdx = idx++;
              return (
                <PhraseCard
                  key={phrase.spanish}
                  phrase={phrase}
                  index={cardIdx}
                  imageUrl={getImage(phrase)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
