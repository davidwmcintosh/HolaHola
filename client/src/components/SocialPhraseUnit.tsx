import { useState, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
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

// ── Phrase data ────────────────────────────────────────────────────────────────

const SPANISH_SOCIAL_PHRASES: SocialPhrase[] = [
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
    context: "Bumping into someone, interrupting, or offering a light apology",
    register: "Neutral",
  },
  {
    spanish: "Con permiso",
    pronunciation: "kon per-MEE-so",
    english: "Excuse me (passing through)",
    context: "When moving past someone or leaving a space — more physical than Perdón",
    register: "Neutral",
  },
  {
    spanish: "Adiós",
    pronunciation: "ah-DYOS",
    english: "Goodbye",
    context: "Formal or longer departure — not seeing someone again soon",
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
];

// ── Single phrase row ──────────────────────────────────────────────────────────

function PhraseRow({ phrase, index }: { phrase: SocialPhrase; index: number }) {
  const { gender } = useLanguage();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [practiced, setPracticed] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleListen = useCallback(async () => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);
    try {
      const res = await fetch("/api/tts/pronunciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: phrase.spanish,
          language: "spanish",
          gender: gender ?? "female",
        }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setIsPlayingAudio(false);
    }
  }, [phrase.spanish, gender, isPlayingAudio]);

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
          if (res.ok) {
            const { text } = await res.json();
            if (text && text.trim().length > 0) {
              setPracticed(true);
            }
          }
        } catch {
          // silent — speech attempt still counts
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
      className={`flex items-start justify-between gap-4 py-4 border-b last:border-0 transition-colors ${
        practiced ? "bg-muted/20" : ""
      }`}
      data-testid={`phrase-row-${index}`}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xl font-semibold leading-snug" data-testid={`phrase-spanish-${index}`}>
            {phrase.spanish}
          </span>
          <span className="text-xs text-muted-foreground/70 italic font-normal tracking-wide">
            {phrase.pronunciation}
          </span>
          {practiced && (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          )}
        </div>
        <p className="text-sm font-medium text-foreground/80" data-testid={`phrase-english-${index}`}>
          {phrase.english}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {phrase.context}
        </p>
        {phrase.register === "Informal" && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            Informal
          </Badge>
        )}
        {phrase.register === "Formal" && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Formal
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 pt-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleListen}
          disabled={isPlayingAudio}
          aria-label={`Listen to ${phrase.spanish}`}
          data-testid={`button-listen-${index}`}
        >
          {isPlayingAudio ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant={isRecording ? "default" : "ghost"}
          onClick={handleSpeak}
          aria-label={`Say ${phrase.spanish}`}
          data-testid={`button-speak-${index}`}
          className={isRecording ? "animate-pulse" : ""}
        >
          {isRecording ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SocialPhraseUnitProps {
  language?: string;
}

export function SocialPhraseUnit({ language = "spanish" }: SocialPhraseUnitProps) {
  const phrases =
    language === "spanish" ? SPANISH_SOCIAL_PHRASES : SPANISH_SOCIAL_PHRASES;

  const greetings = phrases.slice(0, 6);
  const courtesies = phrases.slice(6, 11);
  const farewells = phrases.slice(11);

  return (
    <div className="space-y-8" data-testid="social-phrase-unit">
      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">
          Greetings
        </p>
        <div>
          {greetings.map((phrase, i) => (
            <PhraseRow key={phrase.spanish} phrase={phrase} index={i} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">
          Courtesies
        </p>
        <div>
          {courtesies.map((phrase, i) => (
            <PhraseRow key={phrase.spanish} phrase={phrase} index={greetings.length + i} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">
          Farewells
        </p>
        <div>
          {farewells.map((phrase, i) => (
            <PhraseRow key={phrase.spanish} phrase={phrase} index={greetings.length + courtesies.length + i} />
          ))}
        </div>
      </div>
    </div>
  );
}
